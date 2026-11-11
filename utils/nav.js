// Keep root transitions serial; accepting an order must not lose its detail navigation.
const MAX_STACK=9;
let rootTransition=null,pendingNavigation=null;
function parse(url){const [path,query='']=String(url||'').split('?');const options={};query.split('&').filter(Boolean).forEach(pair=>{const i=pair.indexOf('=');const key=decodeURIComponent(i<0?pair:pair.slice(0,i)),value=i<0?'':decodeURIComponent(pair.slice(i+1));options[key]=value;});return {route:path.replace(/^\//,''),options};}
function sameOptions(a,b){const ka=Object.keys(a||{}),kb=Object.keys(b||{});return ka.length===kb.length&&ka.every(k=>String(a[k])===String(b[k]));}
function pageRoute(page){const route=page&&page.route;return typeof route==='string'?route.replace(/^\//,''):route&&route.path?route.path.replace(/^\//,''):'';}
function pages(){return typeof getCurrentPages==='function'?getCurrentPages()||[]:[];}
function isHardRouteError(error){return /not found|not exist|not registered|invalid (?:url|route)|not in.*app\.json|tabbar page/i.test(error&&error.errMsg||error&&error.message||'');}
// A native reLaunch/WebView failure can be recovered by replacing the current page.
// Callbacks are delivered once, from the successful attempt or final failure only.
function openWithFallback(method,fallback,opts,onFailure){
 let finished=false;
 function finish(ok,result){if(finished)return;finished=true;if(!ok&&onFailure)onFailure(result);if(ok){if(opts.success)opts.success(result);}else if(opts.fail)opts.fail(result);if(opts.complete)opts.complete(result);}
 function attempt(name,last){
  let failed=false;const wrapped={...opts,success:result=>finish(true,result),fail(error){if(failed||finished)return;failed=true;if(!last&&fallback!==name&&typeof wx[fallback]==='function'&&!isHardRouteError(error)){console.warn('navigation fallback',name,parse(opts.url).route,error&&error.errMsg||error&&error.message||'native failure');return attempt(fallback,true);}finish(false,error);},complete(result){if(failed||finished)return;if(result&&/:fail/.test(result.errMsg||''))wrapped.fail(result);else if(result&&/:ok/.test(result.errMsg||''))finish(true,result);}};
  try{return wx[name](wrapped);}catch(error){return wrapped.fail(error);}
 }
 return attempt(method,false);
}
function flushPending(){const next=pendingNavigation;pendingNavigation=null;if(!next)return;Promise.resolve().then(()=>{if(rootTransition){pendingNavigation=next;return;}if(next.kind==='root')reLaunch(next.opts);else navigateTo(next.opts);});}
function clearRoot(token){if(rootTransition!==token)return;if(token.timer)clearTimeout(token.timer);rootTransition=null;flushPending();}
function queue(kind,opts){pendingNavigation={kind,opts};return false;}
function navigateTo(opts={}){
 if(rootTransition)return queue('detail',opts);
 const stack=pages(),target=parse(opts.url);
 for(let i=stack.length-1;i>=0;i--){if(pageRoute(stack[i])===target.route&&sameOptions(stack[i].options,target.options)){const delta=stack.length-1-i;if(!delta){if(opts.success)opts.success({});if(opts.complete)opts.complete({});return;}return openWithFallback('navigateBack','redirectTo',{...opts,delta});}}
 return openWithFallback(stack.length>=MAX_STACK?'redirectTo':'navigateTo','redirectTo',opts);
}
function pageReady(page){const token=rootTransition;if(token&&pageRoute(page)===token.target.route)clearRoot(token);}
function reLaunch(opts={}){
 const target=parse(opts.url),stack=pages(),top=stack[stack.length-1];
 if(rootTransition){if(rootTransition.target.route===target.route&&sameOptions(rootTransition.target.options,target.options))return false;return queue('root',opts);}
 if(top&&pageRoute(top)===target.route&&sameOptions(top.options,target.options)){if(opts.success)opts.success({});if(opts.complete)opts.complete({});return false;}
 const token={target};rootTransition=token;
 token.timer=setTimeout(()=>clearRoot(token),5000);if(token.timer&&token.timer.unref)token.timer.unref();
 return openWithFallback('reLaunch','redirectTo',opts,()=>clearRoot(token));
}
module.exports={navigateTo,reLaunch,pageReady,parse};
