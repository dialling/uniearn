// WeChat keeps at most 10 pages in the navigation stack. Pages that link to each
// other (request ⇄ chat, profile ⇄ student check) would otherwise pile up until
// navigateTo fails silently.
const MAX_STACK=9;
let rootTransition=null;
function parse(url){const [path,query='']=String(url||'').split('?');const options={};query.split('&').filter(Boolean).forEach(pair=>{const i=pair.indexOf('=');const key=decodeURIComponent(i<0?pair:pair.slice(0,i)),value=i<0?'':decodeURIComponent(pair.slice(i+1));options[key]=value;});return {route:path.replace(/^\//,''),options};}
function sameOptions(a,b){const ka=Object.keys(a||{}),kb=Object.keys(b||{});return ka.length===kb.length&&ka.every(k=>String(a[k])===String(b[k]));}
function navigateTo(opts={}){
  if(rootTransition)return false;
  const pages=typeof getCurrentPages==='function'?getCurrentPages():[];
  if(!pages.length)return wx.navigateTo(opts);
  const target=parse(opts.url);
  for(let i=pages.length-1;i>=0;i--){
    if(pages[i].route===target.route&&sameOptions(pages[i].options,target.options)){
      const delta=pages.length-1-i;
      if(!delta){if(opts.success)opts.success({});return;}
      return wx.navigateBack({delta,success:opts.success,fail:opts.fail,complete:opts.complete});
    }
  }
  if(pages.length>=MAX_STACK)return wx.redirectTo(opts);
  return wx.navigateTo(opts);
}
// Root tabs destroy/recreate a WebView. Do not overlap them or recreate the current root.
function pageRoute(page){const route=page&&page.route;return typeof route==='string'?route.replace(/^\//,''):route&&route.path?route.path.replace(/^\//,''):'';}
function clearRoot(token){if(rootTransition!==token)return;if(token.timer)clearTimeout(token.timer);rootTransition=null;}
function pageReady(page){const token=rootTransition;if(token&&pageRoute(page)===token.target.route)clearRoot(token);}
function reLaunch(opts={}){
 const target=parse(opts.url),pages=typeof getCurrentPages==='function'?getCurrentPages()||[]:[],top=pages[pages.length-1];
 if(rootTransition)return false;
 if(top&&pageRoute(top)===target.route&&sameOptions(top.options,target.options)){if(opts.success)opts.success({});if(opts.complete)opts.complete({});return false;}
 const token={target};rootTransition=token;
 // Failures release immediately; success stays locked until the destination is ready.
 token.timer=setTimeout(()=>clearRoot(token),5000);if(token.timer&&token.timer.unref)token.timer.unref();
 try{return wx.reLaunch({...opts,fail(error){clearRoot(token);if(opts.fail)opts.fail(error);},complete(result){if(result&&/:fail/.test(result.errMsg||''))clearRoot(token);if(opts.complete)opts.complete(result);}});}catch(error){clearRoot(token);throw error;}
}
module.exports={navigateTo,reLaunch,pageReady,parse};
