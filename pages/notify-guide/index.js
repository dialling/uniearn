// Text-only guide to WeChat's subscription-message settings. The other mini
// program ships the same 4 steps with screenshots; IDs and screenshots are
// app-specific, so only the steps and the "can't find it" fallback are kept.
const store=require('../../utils/store');
const STEPS={
  zh:[
    {n:'1',title:'点小程序右上角的「···」',body:'在任意页面都可以，入口就在右上角的胶囊按钮里。'},
    {n:'2',title:'在弹出的菜单里点「设置」',body:'菜单里还有「转发」「浮窗」等选项，不要点错。'},
    {n:'3',title:'点「订阅消息」',body:'这里会列出这个校园跑腿小程序能发给你的通知。'},
    {n:'4',title:'两项都选「接收并提醒」',body:'「抢单提醒」和「订单沟通消息提醒」都要选；顶部的「接收通知」总开关也要是打开的（绿色）。'}
  ],
  en:[
    {n:'1',title:'Tap “···” at the top right',body:'It sits in the capsule button on any page.'},
    {n:'2',title:'Tap “Settings” in the menu',body:'The same menu also has Forward and Floating window — pick Settings.'},
    {n:'3',title:'Tap “Subscribe messages”',body:'This lists the notifications this campus errand mini program can send you.'},
    {n:'4',title:'Choose “Receive and notify” for both',body:'Turn on both “New job alert” and “Order message alert”, and make sure the master “Receive notifications” switch at the top is on (green).'}
  ]
};
Page({
  data:{zh:true,steps:STEPS.zh},
  onShow(){this.localize();},
  localize(){const zh=store.get().language!=='en';this.setData({zh,steps:STEPS[zh?'zh':'en']});},
  openSettings(){try{if(wx.openSetting)wx.openSetting({});}catch(e){console.error(e);}}
});
