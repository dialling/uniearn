// Global appearance (light / dark). The in-app switch lives in Me → Appearance.
// Pages call apply() on show (via the lang-switch component) so the native
// navigation bar and the custom bottom nav follow the setting.
const store=require('./store');
const DARK={bar:'#1b1c1a',front:'#ffffff',window:'#1b1c1a'};
const LIGHT={bar:'#ffffff',front:'#000000',window:'#eeede8'};
function isDark(){return store.get().meAppearance==='dark';}
function apply(page){
  if(page&&page.setData)page.setData({darkClass:isDark()?'page-dark':''});
  if(typeof wx==='undefined')return;
  const c=isDark()?DARK:LIGHT;
  const paint=()=>{if(wx.setNavigationBarColor)wx.setNavigationBarColor({frontColor:c.front,backgroundColor:c.bar,animation:{duration:0}});};
  paint();
  // Page window config is applied after onLoad, so repaint once it has settled.
  if(typeof setTimeout==='function')setTimeout(paint,0);
  if(wx.setBackgroundColor)wx.setBackgroundColor({backgroundColorTop:c.window,backgroundColorBottom:c.window});
}
module.exports={isDark,apply};
