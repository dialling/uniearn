const store = require('./store');
const {ensureCloud} = require('./cloud');
const yuniEvents=require('./yuni-events');
const cloudErrors=require('./cloud-errors');
function track(name,props){try{require('./analytics').record(name,props);}catch(_){}}
function pairMap(rows,value){const result={};rows.forEach(r=>{result[r.id]=value(r);});return result;}
let queue = Promise.resolve(), syncing = null, mutating = false, timer = null;
let previous = null, lastError = '', foreground = true, generation = 0;
const subscribers = new Set(), uploads = new Map(), STALE_OPERATION_MS = 20 * 3600000;
// A cloud call that never answers must not freeze every later tap.
const CALL_TIMEOUT_MS = 20000, MUTATION_STALE_MS = 30000;
let mutatingAt = 0;
function enqueue(fn) { const p = queue.then(fn); queue = p.catch(()=>{}); return p; }
// Photo uploads must not queue behind sync()/act(): three photos should upload together, not one by one.
const UPLOAD_SLOTS = 3; let uploadRunning = 0; const uploadWaiters = [];
function uploadJob(fn) {
  const run = () => { uploadRunning++; const p = Promise.resolve().then(fn); const free = () => { uploadRunning--; const next = uploadWaiters.shift(); if (next) next(); }; p.then(free, free); return p; };
  if (uploadRunning < UPLOAD_SLOTS) return run();
  return new Promise((resolve, reject) => { uploadWaiters.push(() => { run().then(resolve, reject); }); });
}
function tell(title) { if (foreground) wx.showToast({title,icon:'none',duration:2500}); }
function apply(snapshot) {
  if (!snapshot) return;
  const state = store.get();
  if (state.cloudRevision > snapshot.revision && state.profile.accountId === snapshot.accountId) return;
  if(!previous && state.cloudRevision>=0 && state.profile.accountId===snapshot.accountId)previous={accountId:snapshot.accountId,unread:pairMap(state.requests,r=>r.unread||0),tripIds:(state.publicTrips||[]).map(t=>t.id),status:pairMap(state.requests,r=>r.status)};
  if (previous && previous.accountId === snapshot.accountId) {
    const prefs=state.preferences||{},newMessage=snapshot.requests.some(r=>r.unread>(previous.unread?.[r.id]||0)),newRoute=(snapshot.publicTrips||[]).some(t=>!previous.tripIds?.includes(t.id)&&snapshot.requests.some(r=>r.isMine&&r.status==='waiting'&&r.station===t.station&&r.dorm===t.dorm));
    if(newMessage&&prefs.orderUpdates!==false)tell('New order message · open My orders');
    if(newRoute&&prefs.nearbyTrip)tell('A runner opened a trip on your route');
    const changes = snapshot.requests.filter(r => (r.isMine||r.isRunner) && previous.status[r.id] && previous.status[r.id] !== r.status && (r.status!=='delivered'||prefs.deliveredUpdates!==false));
    const joined=snapshot.requests.some(r=>r.isRunner&&!previous.status[r.id]);
    const newJobs = snapshot.requests.filter(r => !r.isMine && r.status==='waiting' && !previous.status[r.id]);
    if (changes.length && state.preferences?.orderUpdates!==false && foreground) {
      if(state.yuniTips===false)tell(state.language==='en'?'Order progress updated · open My orders':'订单进度已更新，请查看我的订单。');
      else changes.forEach(r=>yuniEvents.status(r,snapshot.revision));
    }
    else if(joined&&state.preferences?.orderUpdates!==false)tell('A customer joined your trip');
    else if (state.profile.studentVerified && newJobs.length && state.preferences?.newJobs!==false) tell('New pickup jobs available');
  }
  previous = {accountId:snapshot.accountId,unread:pairMap(snapshot.requests,r=>r.unread||0),tripIds:(snapshot.publicTrips||[]).map(t=>t.id),status:pairMap(snapshot.requests,r=>r.status)};
  store.update(s=>{
    s.orderCapabilities=snapshot.capabilities||{};s.walletSummary=snapshot.walletSummary||null;s.progression=snapshot.progression||null;s.progressionAccountId=snapshot.accountId;s.serverTime=snapshot.serverTime;s.publicJobs=snapshot.publicJobs||[];s.deliveredThisWeek=snapshot.deliveredThisWeek||0;s.requests=snapshot.requests; s.trips=snapshot.trips; s.publicTrips=snapshot.publicTrips;
    s.supportTickets=snapshot.supportTickets||[];s.supportInbox=snapshot.supportInbox||[];s.adjustments=snapshot.adjustments||[];s.rewards=snapshot.rewards;s.preferences=snapshot.preferences||{};s.photoURLs=snapshot.photoURLs||{}; s.cloudRevision=snapshot.revision; s.lastSyncAt=Date.now();
    s.profile={...s.profile,...snapshot.stats,accountId:snapshot.accountId};
  });
  subscribers.forEach(fn=>{try{fn();}catch(e){console.error('Order view refresh',e);}});
}
async function call(data) {
  const expectedGeneration=generation;
  let timer=null;
  const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(store.get().language==='en'?'The cloud is taking too long. Check your network and try again.':'云端响应超时，请检查网络后重试。')),CALL_TIMEOUT_MS);});
  let response;
  try { response = await Promise.race([ensureCloud().callFunction({name:'orderService',data:{...data,checkinVersion:1}}), timeout]); }
  finally { if (timer) clearTimeout(timer); }
  const {result} = response;
  if (!result || !result.ok) {
    const error = Error(result && result.error || 'Cloud order service returned no result.');
    error.business = !!result; throw error;
  }
  if(expectedGeneration===generation){apply(result.snapshot);if(foreground&&store.get().preferences?.orderUpdates!==false&&['create','accept','acceptBoxes'].includes(data.action)){const requests=(result.snapshot||{}).requests||[];requests.filter(r=>data.action==='create'?r.isMine&&r.id===result.value?.id:r.isRunner&&r.runnerId===result.value?.id).forEach(r=>yuniEvents.status(r,result.snapshot.revision));}} return result.value || {};
}
function sync() {
  if (syncing) return syncing;
  syncing = enqueue(async()=>{
    const syncGeneration=generation,value=await call({action:'sync'});
    if(syncGeneration!==generation)return value;
    const repairs=require('./dorm-gender-memory').repairs(store.get());
    if(repairs.length)try{await call({action:'restoreDormGenders',repairs,operationId:'restore_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2)});}catch(e){console.warn('Dorm gender restoration deferred',e.message);}
    return value;
  }).then(v=>{lastError='';return v;}).catch(e=>{
    const state=store.get(),message=cloudErrors.syncMessage(e,state.language);
    if(message!==lastError){
      // Login explains missing tool credentials inline; do not cover that screen
      // with another background-sync toast. SDK call IDs change on each retry.
      if(!cloudErrors.accessTokenMissing(e)||(state.profile.onboarded&&!state.profile.loggedOut))tell(message);
      lastError=message;
    }
    throw e;
  }).finally(()=>{syncing=null;});
  return syncing;
}
async function act(action, payload = {}) {
  if (mutating) {
    // A lost cloud response used to leave this flag set forever; recover instead of blocking taps.
    if (Date.now() - mutatingAt > MUTATION_STALE_MS) { console.warn('orders.act recovered a stale action'); mutating = false; }
    else throw Error(store.get().language === 'en'
      ? 'The previous action is still finishing. Try again in a second.'
      : '上一个操作还在处理，请稍等一下再点。');
  }
  mutating=true; mutatingAt=Date.now();
  const started=Date.now();
  try {
    return await enqueue(async()=>{
      const s=store.get(), signature=JSON.stringify({action,...payload});
      let pending=s.pendingOrderOperation;
      // The server keeps retry receipts for 24 hours. Replaying an older operation could run it twice,
      // so drop it, refresh, and let the student check before trying again.
      if (pending && Date.now()-pending.at>=STALE_OPERATION_MS) {
        store.update(x=>{delete x.pendingOrderOperation;});
        try { await call({action:'sync'}); } catch (_) {}
        throw Error(store.get().language==='en'?'Your last action could not be confirmed. Orders were refreshed. Check them, then try again.':'上一次操作未能确认，订单已刷新。请先检查订单，再重新操作。');
      }
      // Resume an uncertain request before sending a second mutation.
      const recovering=!!pending;
      if (!pending) {
        let meta={};try{meta=require('./analytics').metadata();}catch(_){}
        pending={at:Date.now(),signature,data:{action,...payload,analyticsVersion:meta.version||'',analyticsSource:meta.source||'other',operationId:'op_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2)+'_'+Math.random().toString(36).slice(2)}};
        store.update(x=>{x.pendingOrderOperation=pending;});
      }
      let value;
      for (let attempt=0;attempt<2;attempt++) {
        try { value=await call(pending.data); break; }
        catch (e) {
          if (e.business) { store.update(x=>{delete x.pendingOrderOperation;}); throw e; }
          if (attempt===1) throw Error('Network interrupted. Retry this action; its operation ID is saved to prevent duplicates.');
        }
      }
      store.update(x=>{delete x.pendingOrderOperation;});
      if (recovering && pending.signature!==signature) throw Error('The previous action was recovered. Check your orders, then submit this change again.');
      track('action_result',{action,result:'ok',duration:Date.now()-started});return value;
    });
  } catch(e){track('action_result',{action,result:e.business?'business':'network',duration:Date.now()-started});throw e;}finally { mutating=false; }
}
async function upload(path) {
  if (!path || path.startsWith('cloud://')) return path || '';
  if (uploads.has(path)) return uploads.get(path);
  const job=uploadJob(async()=>{
    const {cloudPath}=await call({action:'prepareUpload'});
    const file=await ensureCloud().uploadFile({cloudPath,filePath:path});return file.fileID;
  });
  uploads.set(path,job);
  const started=Date.now();try {const value=await job;track('upload_result',{result:'ok',duration:Date.now()-started});return value;} catch(e) {track('upload_result',{result:'network',duration:Date.now()-started});uploads.delete(path);throw e;}
}
function bind(page, method='refresh') {
  unbind(page);
  page._orderRender=()=>page[method](); subscribers.add(page._orderRender);
  page[method](); sync().catch(()=>{});
}
function subscribe(fn) { subscribers.add(fn); return ()=>subscribers.delete(fn); }
function unbind(page) { if(page._orderRender)subscribers.delete(page._orderRender);page._orderRender=null; }
function start() { foreground=true;stopTimer();sync().catch(()=>{});timer=setInterval(()=>{if(uploadRunning)return;sync().catch(()=>{});},10000); }
function stopTimer() { if(timer)clearInterval(timer);timer=null; }
function stop() { foreground=false;stopTimer(); }
function photoURL(path) { return store.get().photoURLs[path] || path; }
function invalidate(){yuniEvents.reset();generation++;previous=null;uploads.clear();}
module.exports={invalidate,sync,act,upload,bind,unbind,subscribe,start,stop,photoURL};
