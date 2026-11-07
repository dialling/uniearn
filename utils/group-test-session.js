// Only the explicit DevTools test route starts this local session.
let session=null;
function post(data){
  return new Promise((resolve,reject)=>wx.request({
    url:'http://127.0.0.1:18746/orders',method:'POST',data,
    success:r=>r.statusCode===200?resolve(r.data):reject(Error(r.data?.error||'测试服务不可用')),
    fail:e=>reject(Error(e.errMsg||'测试服务不可用'))
  }));
}
function start(){
  if(wx.getSystemInfoSync().platform!=='devtools')throw Error('仅限微信开发者工具');
  session={token:post({}).then(r=>r.token),role:'runner',photos:{}};
  session.token.catch(()=>{});
}
function role(value){if(session)session.role=value;}
async function call(event){
  const active=session,who=active.role;
  const result=await post({token:await active.token,role:who,event});
  if(result.snapshot)result.snapshot.photoURLs={...active.photos};
  return result;
}
async function upload(path){
  const active=session,result=await call({action:'prepareUpload'});
  if(!result.ok)throw Error(result.error);
  const id='cloud://group-test/'+result.value.cloudPath;
  active.photos[id]=path;
  return id;
}
module.exports={start,role,call,upload,current:()=>session,stop:()=>{session=null;}};
