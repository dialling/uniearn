Page({onLoad(o={}){wx.redirectTo({url:'/pages/request/index?id='+encodeURIComponent(o.id||'')+(o.celebrate==='1'?'&celebrate=1':'')});}});
