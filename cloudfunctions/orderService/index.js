const cloud = require('wx-server-sdk');
const crypto = require('crypto');
const engine = require('./engine');
cloud.init({env:cloud.DYNAMIC_CURRENT_ENV});
const db = cloud.database();
const json = value => JSON.parse(JSON.stringify(value));
async function getAccount(tx, actor) {
  try { return (await tx.collection('uniearn_accounts').doc(actor).get()).data || {}; }
  catch (e) { if (/not exist|not found|does not exist/i.test(e.message || '') || e.errCode === -502005 || e.code === -502005) return {}; throw e; }
}
const ARCHIVE_CHECK_MS = 3600000;
// Runs in its own transaction so a missing archive collection never blocks orders.
// Archived rows are written in the same transaction that removes them, so nothing is lost.
async function archiveFinished() {
  try {
    await db.runTransaction(async tx => {
      const ref = tx.collection('uniearn_order_state').doc('team-test');
      const state = (await ref.get()).data; delete state._id;
      const now = Date.now();
      if (now - (state.archiveCheckedAt || 0) <= ARCHIVE_CHECK_MS) return;
      // Preserve the runner identity before trips are trimmed by the archive routine.
      for(const r of state.requests){const t=state.trips.find(t=>t.id===r.runnerId);if(t?.runnerAccountId)r.analyticsRunnerId=t.runnerAccountId;}
      const removed = engine.archive(state, now);
      for (const r of removed) await tx.collection('uniearn_news').doc('orderArchive-'+crypto.createHash('sha256').update(r.id+'-'+r.createdAt).digest('hex')).set({data:json({kind:'orderArchive',order:r,archivedAt:now})});
      state.archiveCheckedAt = now;
      if (removed.length) state.revision = (state.revision || 0) + 1;
      await ref.set({data:json(state)});
    });
  } catch (e) { console.error('orderService archive', e.code || e.errCode || '', e.message); }
}
// Invoked by the deployed CloudBase timer even when every mini program is closed.
async function autoSettle() {
  try {
    const result = await db.runTransaction(async tx => {
      const ref = tx.collection('uniearn_order_state').doc('team-test');
      const state = (await ref.get()).data;
      if (!state || !Array.isArray(state.requests) || !state.receipts) throw Error('Invalid team-test database document.');
      delete state._id;
      const before = JSON.stringify(state), now = Date.now();state.loyaltyStartedAt=state.loyaltyStartedAt||now;
      engine.expire(state,now);require('./rewards').settle(state,now);require('./wallet').settle(state,now);
      if (JSON.stringify(state) !== before) {
        state.revision = (state.revision || 0) + 1;
        if (Buffer.byteLength(JSON.stringify(state)) > 850000) throw Error('Team test storage is full. Export test data first.');
        await ref.set({data:json(state)});
      }
      return {ok:true,mode:'test'};
    });
    return result && result.ok ? result : result.result;
  } catch (e) { console.error('wallet-auto-settle',e.message);return {ok:false,error:e.message}; }
}
exports.main = async (event = {}) => {
  const openid = cloud.getWXContext().OPENID;
  if (!openid) {
    if (event.Type === 'Timer' && event.TriggerName === 'wallet-auto-settle') return autoSettle();
    return {ok:false,error:'Open this mini program in WeChat to continue.'};
  }
  const actor = engine.idFor(openid), action = event.action || 'sync';
  try {
    if (JSON.stringify(event).length > 18000) throw Error('Request is too large.');
    const result = await db.runTransaction(async tx => {
      const ref = tx.collection('uniearn_order_state').doc('team-test');
      let state;
      try { state = (await ref.get()).data; } catch (_) { throw Error('Create uniearn_order_state / team-test using the deployment instructions first.'); }
      if (!state || !Array.isArray(state.requests) || !state.receipts) throw Error('Invalid team-test database document.');
      delete state._id;
      const now = Date.now(), account = await getAccount(tx, actor);account._reviewer=String(process.env.REVIEWER_OPENIDS||'').split(',').map(x=>x.trim()).includes(openid);account._admin=!!(account.admin&&account.admin.until>now&&account.admin.revision===(account.authRevision||0));
      const before = JSON.stringify(state);
      const analyticsBefore=require('./analytics').before(state);
      // Read the shared admin configuration on every sync; issued coupons retain their terms.
      try {const cfg=(await tx.collection('uniearn_news').doc('promotion-config').get()).data;if(cfg&&cfg.value&&Array.isArray(cfg.value.campaigns))state.adminPromotions=cfg.value;}catch(e){if(!/not exist|not found|does not exist/i.test(e.message||'')&&e.errCode!==-502005&&e.code!==-502005)throw e;}
      state.loyaltyStartedAt=state.loyaltyStartedAt||now;
      if(account.profile&&!account.loggedOut)require('./rewards').dailyLogin(state,actor,now);
      engine.expire(state, now);require('./rewards').settle(state,now);require('./wallet').settle(state,now);
      let value = {};
      if (action === 'wallet') {
        if (!account.profile || account.loggedOut) throw Error('Log in before opening your wallet.');
        value = require('./wallet').overview(state,actor,now,event.lang==='en');
      } else if (action === 'prepareUpload') {
        if (!account.profile || account.loggedOut) throw Error('Save your profile / log in in Me first.');
        value = {cloudPath:'order-photos/' + actor + '/' + crypto.randomBytes(16).toString('hex') + '.jpg'};
      } else if (action !== 'sync') {
        if (!/^[a-zA-Z0-9_-]{12,100}$/.test(event.operationId || '')) throw Error('Invalid operation ID. Please update the mini program.');
        const key = actor + '_' + event.operationId;
        const signature = crypto.createHash('sha256').update(JSON.stringify({...event,operationId:undefined})).digest('hex');
        const previous = state.receipts[key];
        if (previous) {
          if (previous.signature !== signature) throw Error('Operation ID was reused.');
          value = previous.value;
        } else {
          value = engine.execute(state, actor, account, {...event, action}, now);
          state.receipts[key] = {value,signature,at:now};
        }
        // Retry receipts expire after 24 hours. Clients must not replay older operations.
        for (const k of Object.keys(state.receipts)) if (state.receipts[k].at < now - 86400000) delete state.receipts[k];
      }
      require('./analytics').annotate(state,analyticsBefore,actor,event,now);
      if (JSON.stringify(state) !== before) {
        state.revision = (state.revision || 0) + 1;
        if (Buffer.byteLength(JSON.stringify(state)) > 850000) throw Error('Team test storage is full. Export and archive test data first.');
        await ref.set({data:json(state)});
      }
      return {ok:true,value,archiveDue:now-(state.archiveCheckedAt||0)>ARCHIVE_CHECK_MS,snapshot:json(engine.snapshot(state,actor,account,now))};
    });
    // wx-server-sdk versions may return the callback result directly or under result.
    const response = result && result.ok ? result : result.result;
    if (response.archiveDue) await archiveFinished();
    delete response.archiveDue;
    // Private storage remains private. Only photos in this authorized snapshot get URLs.
    const ids = new Set();
    for (const r of response.snapshot.requests) {
      [r.photo,r.riderPhoto,r.noticePhoto,...(r.orderPictures||[]),r.dispute&&r.dispute.photo].forEach(p=>{if(typeof p==='string'&&p.startsWith('cloud://'))ids.add(p);});
    }
    const urls = {};
    try {
      const list = [...ids];
      for (let i=0;i<list.length;i+=50) {
        const res = await cloud.getTempFileURL({fileList:list.slice(i,i+50).map(fileID=>({fileID,maxAge:600}))});
        (res.fileList||[]).forEach(x=>{if(x.tempFileURL)urls[x.fileID]=x.tempFileURL;});
      }
    } catch (_) { response.photoWarning = 'Some photos could not load. Refresh to try again.'; }
    response.snapshot.photoURLs = urls;
    return response;
  } catch (e) {
    console.error('orderService', e.code || e.errCode || '', e.message);
    return {ok:false,error:e.message || 'Cloud order service is unavailable. Try again.'};
  }
};
