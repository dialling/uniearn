const store=require('./store');
function enabled(){return store.get().yuniTips!==false;}
function duration(ms){return enabled()?ms:0;}
function data(){const on=enabled();return {motionEnabled:on,motionStyle:on?'':'--ue-animation:none;--ue-animation-name:none;--ue-transition:none;'};}
function watch(fn,immediate=true){let last=enabled();if(immediate)fn(last);return store.subscribe(()=>{const next=enabled();if(next!==last){last=next;fn(next);}});}
function apply(page,force=false){
 const patch=data(),changed=force||page.data?.motionEnabled!==patch.motionEnabled;
 if(changed||page.data?.motionStyle!==patch.motionStyle)page.setData(patch);
 if(changed&&typeof page.onMotionChange==='function')page.onMotionChange(patch.motionEnabled);
}
// Seed the first render and update every retained page when the setting changes.
function install(){
 if(typeof Page!=='function'||Page._uniearnMotion)return;
 const original=Page,wrapped=function(options){
  options.data={...options.data,...data()};
  const load=options.onLoad,show=options.onShow,unload=options.onUnload;
  options.onLoad=function(...args){apply(this,true);if(this._motionOff)this._motionOff();this._motionOff=watch(()=>apply(this),false);return load&&load.apply(this,args);};
  options.onShow=function(...args){apply(this);return show&&show.apply(this,args);};
  options.onUnload=function(...args){if(this._motionOff)this._motionOff();this._motionOff=null;return unload&&unload.apply(this,args);};
  return original(options);
 };
 wrapped._uniearnMotion=true;wrapped._uniearnAnalytics=original._uniearnAnalytics;Page=wrapped;
}
module.exports={enabled,duration,data,watch,apply,install};
