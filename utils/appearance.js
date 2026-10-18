// Global appearance (light / dark). The in-app switch lives in Me → Appearance.
// Pages call apply() on show (via the lang-switch component) so the native
// navigation bar and the custom bottom nav follow the setting.
const store=require('./store');
const DARK={bar:'#221610',front:'#f5e9dc',window:'#221610'};
const LIGHT={bar:'#f6efe4',front:'#3b2a20',window:'#f6efe4'};
function isDark(){return store.get().meAppearance==='dark';}
function apply(page){
  if(page&&page.setData)page.setData({darkClass:isDark()?'page-dark':''});
  if(typeof wx==='undefined')return;
  const c=isDark()?DARK:LIGHT;
  if(wx.setNavigationBarColor)wx.setNavigationBarColor({frontColor:c.front,backgroundColor:c.bar,animation:{duration:0}});
  if(wx.setBackgroundColor)wx.setBackgroundColor({backgroundColorTop:c.window,backgroundColorBottom:c.window});
}
module.exports={isDark,apply};
