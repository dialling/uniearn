// Global appearance (light / dark). The in-app switch lives in Me → Appearance.
// Pages call apply() on show (via the lang-switch component) so the native
// navigation bar and the custom bottom nav follow the setting.
const store=require('./store');
const DARK={bar:'#202522',front:'#ffffff',window:'#202522'};
const LIGHT={bar:'#ffffff',front:'#000000',window:'#f7f7f4'};
function isDark(){return store.get().meAppearance==='dark';}
function apply(){
  if(typeof wx==='undefined')return;
  const c=isDark()?DARK:LIGHT;
  if(wx.setNavigationBarColor)wx.setNavigationBarColor({frontColor:c.front,backgroundColor:c.bar,animation:{duration:0}});
  if(wx.setBackgroundColor)wx.setBackgroundColor({backgroundColorTop:c.window,backgroundColorBottom:c.window});
}
module.exports={isDark,apply};
