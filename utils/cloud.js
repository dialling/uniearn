const config=require('./ocr-config');
let initializedCloud;

function ensureCloud(){
  const demo=require('./group-test-session');
  const session=demo.current();
  if(session)return {async callFunction({name,data}){
    if(name==='orderService')return {result:await demo.call(data)};
    if(name==='studentAccount'&&data.action==='status'){
      const result=await demo.call({action:'sync'});
      if(!result.ok)throw Error(result.error);
      return {result:{ok:true,account:{id:result.snapshot.accountId,profile:{name:session.role,phone:'13800000000',campusId:'sip',universityId:'xjtlu'},verification:{status:'verified'},runnerRulesAccepted:true}}};
    }
    throw Error('请退出测试大厅后使用此服务');
  }};
  if(!config.envId)throw Error('CloudBase ID is missing in this imported copy. Import the latest UniEarn project.');
  if(!wx.cloud||typeof wx.cloud.init!=='function')throw Error('WeChat Cloud APIs are unavailable. Use a registered Mini Program AppID linked to this cloud environment and update the base library.');
  if(initializedCloud!==wx.cloud){
    wx.cloud.init({env:config.envId,traceUser:true});
    initializedCloud=wx.cloud;
  }
  return wx.cloud;
}

module.exports={ensureCloud};
