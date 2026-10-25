const {ensureCloud}=require('./cloud');
async function call(action,extra={}){
  const {result}=await ensureCloud().callFunction({name:'newsService',data:{action,...extra}});
  if(!result||!result.ok){const e=Error(result&&result.error||'动态加载失败 / Could not load news.');e.code=result&&result.code;throw e;}
  return result;
}
async function display(items,zh){
  const ids=[...new Set(items.filter(x=>!x.coverURL).map(x=>x.cover).filter(Boolean))];
  let urls={};
  if(ids.length){try{const r=await ensureCloud().getTempFileURL({fileList:ids});for(const x of r.fileList||[])if(x.tempFileURL)urls[x.fileID]=x.tempFileURL;}catch(_){} }
  return items.map(x=>({...x,title:(zh?x.titleZh:x.titleEn)||x.titleZh||x.titleEn,body:(zh?x.bodyZh:x.bodyEn)||x.bodyZh||x.bodyEn,coverURL:x.coverURL||urls[x.cover]||'',date:new Date(x.publishedAt+28800000).toISOString().slice(0,10)}));
}
function subscribe(onData,onError,zh){
  let stopped=false,timer;
  async function pull(){
    try{const r=await call('newsList');const items=await display(r.items||[],zh);if(!stopped)onData(items);}
    catch(e){if(!stopped)onError(e);}
    finally{if(!stopped)timer=setTimeout(pull,5000);}
  }
  pull();
  return ()=>{stopped=true;clearTimeout(timer);};
}
module.exports={call,display,subscribe};
