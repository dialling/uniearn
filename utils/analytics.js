// Volatile, bounded queue. Never pass form values, URLs, errors or photos here.
const VERSION='2026.10.22-a1',FORMS=['create','takeaway','task-post'];
let queue=[],timer=null,sending=false,session='',source='direct',backoff=5000,activePage='other',lastActive=0;
const id=()=>Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,14);
function pageName(page){let r=page&&page.route;if(r&&typeof r==='object')r=r.path;return typeof r==='string'?r.split('/')[1]||'other':'other';}
function metadata(){let environment='develop';try{environment=wx.getAccountInfoSync().miniProgram.envVersion;}catch(_){}return {version:VERSION,source,environment};}
function record(name,props={}){try{if(!session)session=id();lastActive=Date.now();queue.push({id:id(),session,name,at:Date.now(),props:{...metadata(),page:activePage,...props}});if(queue.length>60)queue.shift();schedule();}catch(_){}}
function schedule(){if(!timer&&queue.length){timer=setTimeout(()=>{timer=null;flush();},backoff);if(timer&&typeof timer.unref==='function')timer.unref();}}
async function flush(){
 if(sending||!queue.length)return;sending=true;const batch=queue.slice(0,12);
 try{const {result}=await require('./cloud').ensureCloud().callFunction({name:'newsService',data:{action:'analyticsBatch',events:batch}});if(!result?.ok)throw Error();queue=queue.filter(e=>!batch.some(b=>b.id===e.id));backoff=5000;}catch(_){backoff=Math.min(60000,backoff*2);}finally{sending=false;schedule();}
}
function open(options={}){if(!session||Date.now()-lastActive>=1800000){session=id();const scene=Number(options.scene);source=options.query?.invite?'invite':[1007,1008,1044].includes(scene)?'share':[1011,1012,1013,1047,1048,1049].includes(scene)?'qr':'direct';}record('app_open');}
function observe(page){try{if(!page||!wx.createIntersectionObserver)return;if(page._analyticsObserver)page._analyticsObserver.disconnect();const observer=wx.createIntersectionObserver(page,{observeAll:true});page._analyticsObserver=observer;observer.relativeToViewport().observe('.analytics-card',entry=>{if(entry.intersectionRatio<=0)return;const d=entry.dataset||{},key=d.kind+':'+d.contentId;page._analyticsSeen=page._analyticsSeen||new Set();if(page._analyticsSeen.has(key))return;page._analyticsSeen.add(key);record(d.kind==='news'?'news_view':'campaign_view',{contentId:d.contentId,page:'rewards'});});}catch(_){}}
function install(){
 if(typeof Page!=='function'||Page._uniearnAnalytics)return;
 const original=Page,wrapped=function(options){
  const show=options.onShow,hide=options.onHide,unload=options.onUnload;
  options.onShow=function(...args){activePage=pageName(this);if(this._analyticsPageSession!==session){this._analyticsPageSession=session;this._analyticsFormStarted=false;this._analyticsSeen=new Set();}if(!this._analyticsVisible||this._analyticsViewSession!==session){this._analyticsVisible=true;this._analyticsViewSession=session;record('page_view',{page:activePage});}return show&&show.apply(this,args);};
  const leave=(fn)=>function(...args){this._analyticsVisible=false;if(this._analyticsObserver)this._analyticsObserver.disconnect();flush();return fn&&fn.apply(this,args);};
  options.onHide=leave(hide);options.onUnload=leave(unload);
  for(const key of ['text','field','code','priceInput','handlePrice','sizeCount','example','handleDate','handleTime','station','dorm','chooseAddress'])if(typeof options[key]==='function'){
   const fn=options[key];options[key]=function(...args){const page=pageName(this);if(FORMS.includes(page)&&!this._analyticsFormStarted){this._analyticsFormStarted=true;record('form_start',{page});}const correction=key==='code'||['text','field'].includes(key)&&['pickupPoint','pickupAddress'].includes(args[0]?.currentTarget?.dataset?.field);if(this._analyticsOcr&&correction&&!this._analyticsOcrEdited){this._analyticsOcrEdited=true;record('ocr_edit',{page});}return fn.apply(this,args);};
  }
  if(typeof options.post==='function'){const post=options.post;options.post=function(...args){if(FORMS.includes(pageName(this)))record('submit_attempt',{action:'create',page:pageName(this)});return post.apply(this,args);};}
  return original(options);
 };wrapped._uniearnAnalytics=true;Page=wrapped;
}
module.exports={VERSION,record,flush,open,install,observe,metadata};
