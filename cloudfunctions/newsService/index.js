const cloud=require('wx-server-sdk');
cloud.init({env:cloud.DYNAMIC_CURRENT_ENV});
const db=cloud.database(),collection='uniearn_news';
function settings(){try{return require('./settings.json');}catch(error){if(error.code!=='MODULE_NOT_FOUND')throw error;return require('./settings.example.json');}}
const missing=error=>/not exist|not found|does not exist/i.test(error.message||'');
async function getDocument(id){const rows=(await db.collection(collection).where({_id:id}).limit(1).get()).data;return rows[0]||null;}
const repo={
  ...require('./operations-repo')(db),
  ...require('./analytics-repo')(db),
  getAdmin:()=>getDocument('admin'),
  async setupAdmin(record){return db.runTransaction(async tx=>{const ref=tx.collection(collection).doc('admin');let old;try{old=(await ref.get()).data;}catch(e){if(!missing(e))throw e;}if(old)return false;await ref.set({data:record});return true;});},
  async recordLogin(accepted,stamp){return db.runTransaction(async tx=>{const ref=tx.collection(collection).doc('admin'),admin=(await ref.get()).data;if(admin.lockedUntil>stamp)return {ok:false,error:'尝试次数过多，请 15 分钟后重试。'};const fails=accepted?0:(admin.fails||0)+1;await ref.update({data:{fails:fails>=5?0:fails,lockedUntil:fails>=5?stamp+900000:0}});return {ok:true};});},
  async newsGet(){return await getDocument('content')||{revision:0,items:[]};},
  async newsMutate(change){return db.runTransaction(async tx=>{const ref=tx.collection(collection).doc('content');let old;try{old=(await ref.get()).data;}catch(e){if(!missing(e))throw e;}const result=change(old||{revision:0,items:[]});if(result.ok){await ref.set({data:result.state});const {state:ignored,...response}=result;return response;}return result;});}
};
exports.main=async event=>{
  if(event&&event.httpMethod)return require('./http').createHttpHandler({repo,cloud,settings:settings()})(event);
  const openid=cloud.getWXContext().OPENID;
  if(openid&&event?.action==='analyticsBatch')try{return await repo.ingestAnalytics(openid,event,Date.now());}catch(_){return {ok:false,error:'Analytics temporarily unavailable.'};}
  if(!openid||!event||event.action!=='newsList')return {ok:false,code:'FORBIDDEN',error:'Only published news is available to Mini Program users.'};
  try{
    const result=await require('./news').handleNews({event,isAdmin:false,repo,id:'',now:Date.now});
    const files=[...new Set((result.items||[]).map(x=>x.cover).filter(Boolean))];
    if(files.length){const urls=await cloud.getTempFileURL({fileList:files});const map=Object.fromEntries(urls.fileList.map(x=>[x.fileID,x.tempFileURL||'']));result.items=result.items.map(x=>({...x,coverURL:map[x.cover]||''}));}
    return result;
  }catch(e){return {ok:false,error:'动态加载失败 / News is temporarily unavailable.'};}
};
