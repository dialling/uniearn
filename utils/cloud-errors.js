// SDK diagnostics stay on the error object; only actionable copy reaches the UI.
function accessTokenMissing(error){
 const text=[error&&error.message,error&&error.errMsg,typeof error==='string'?error:''].filter(Boolean).join(' ');
 return /access_token\s+(?:is\s+)?missing/i.test(text);
}
function devtools(){
 try{
  const info=typeof wx.getDeviceInfo==='function'?wx.getDeviceInfo():typeof wx.getSystemInfoSync==='function'?wx.getSystemInfoSync():{};
  return info.platform==='devtools';
 }catch(_){return false;}
}
function loginMessage(error,language,fallback){
 if(!accessTokenMissing(error))return fallback;
 if(language==='en')return devtools()?'Sign in to WeChat DevTools, then compile again.':'Your WeChat session is unavailable. Reopen the mini program and try again.';
 return devtools()?'开发者工具未登录或登录已过期，请先扫码登录工具，再重新编译。':'微信登录状态不可用，请重新进入小程序后重试。';
}
function syncMessage(error,language){
 if(accessTokenMissing(error))return language==='en'?(devtools()?'Sign in to WeChat DevTools first.':'Please reopen the mini program and sign in.'):(devtools()?'请先扫码登录微信开发者工具。':'请重新进入小程序并登录。');
 return language==='en'?'Orders could not sync. Please try again shortly.':'订单暂未同步，请稍后重试。';
}
module.exports={accessTokenMissing,loginMessage,syncMessage};
