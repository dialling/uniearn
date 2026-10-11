const config=require('./ocr-config');
let initializedCloud;

function ensureCloud(){
  if(!config.envId)throw Error('CloudBase ID is missing in this imported copy. Import the latest UniEarn project.');
  if(!wx.cloud||typeof wx.cloud.init!=='function')throw Error('WeChat Cloud APIs are unavailable. Use a registered Mini Program AppID linked to this cloud environment and update the base library.');
  if(initializedCloud!==wx.cloud){
    wx.cloud.init({env:config.envId,traceUser:true});
    initializedCloud=wx.cloud;
  }
  return wx.cloud;
}

module.exports={ensureCloud};
