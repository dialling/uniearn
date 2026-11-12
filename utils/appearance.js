// Dark appearance is retired. The app stays light; apply() only paints the light chrome.
const LIGHT={bar:'#ffffff',front:'#000000',window:'#eeede8'};
function isDark(){return false;}
function apply(page){
  if(page&&page.setData)page.setData({darkClass:''});
  if(typeof wx==='undefined')return;
  const paint=()=>{if(wx.setNavigationBarColor)wx.setNavigationBarColor({frontColor:LIGHT.front,backgroundColor:LIGHT.bar,animation:{duration:0}});};
  paint();
  if(typeof setTimeout==='function')setTimeout(paint,0);
  if(wx.setBackgroundColor)wx.setBackgroundColor({backgroundColorTop:LIGHT.window,backgroundColorBottom:LIGHT.window});
}
module.exports={isDark,apply};
