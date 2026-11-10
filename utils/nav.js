// WeChat keeps at most 10 pages in the navigation stack. Pages that link to each
// other (request ⇄ chat, profile ⇄ student check) would otherwise pile up until
// navigateTo fails silently.
const MAX_STACK=9;
function parse(url){const [path,query='']=String(url||'').split('?');const options={};query.split('&').filter(Boolean).forEach(pair=>{const i=pair.indexOf('=');const key=decodeURIComponent(i<0?pair:pair.slice(0,i)),value=i<0?'':decodeURIComponent(pair.slice(i+1));options[key]=value;});return {route:path.replace(/^\//,''),options};}
function sameOptions(a,b){const ka=Object.keys(a||{}),kb=Object.keys(b||{});return ka.length===kb.length&&ka.every(k=>String(a[k])===String(b[k]));}
function navigateTo(opts={}){
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
module.exports={navigateTo,parse};
