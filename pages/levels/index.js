'use strict';
const store=require('../../utils/store'),levelData=require('../../utils/yuni-level');
const activityDisplay=require('../../utils/activity-display');
const THEMES=['star','helper','pro','ace','captain'];
const MASCOTS=['star','helper','pro','ace','captain'];
const ACTIONS_ZH=['展开地图，准备出发','挥旗回应，一起同行','放眼远方，发现方向','乘风破浪，勇往直前','稳稳掌舵，带领同行'];
const ACTIONS_EN=['Open the map. Begin your journey.','Wave hello. Travel together.','Look ahead. Find your direction.','Ride the waves. Keep exploring.','Take the helm. Lead the way.'];
// Arc gesture tuning: adjust these values to fine-tune feel on real devices.
const ARC_MOVE_MS=340;       // level-change animation duration
const ARC_RELEASE_MS=420;    // ease-out duration after the finger lifts
const ARC_STEP_RATIO=.14;    // drag distance per level, relative to orbit width
const ARC_MOMENTUM_MS=170;   // how far the latest velocity projects on release
const ARC_MAX_MOMENTUM=1.35; // maximum extra levels contributed by inertia
function checkinView(state,language,now=Date.now()){
 const en=language==='en',day=require('../../utils/china-time').dayKey,record=(state.progression||{}).checkin||{},signedIn=!!state.profile.accountId&&!state.profile.loggedOut,today=day(now),yesterday=day(now-86400000),checked=signedIn&&record.day===today,ongoing=signedIn&&(checked||record.day===yesterday),streak=ongoing?Math.max(0,Number(record.streak)||0):0,cycleDay=checked?Math.max(1,Math.min(7,Number(record.cycleDay)||(streak-1)%7+1)):ongoing?(streak%7):0;
 return {checked,streak,total:signedIn?Math.max(0,Number(record.totalDays)||0):0,status:!signedIn?(en?'Sign in to check in':'登录后自动签到'):checked?(en?'Checked in today'+(record.dailyPoints?' · +2 pts':''):'今日已签到'+(record.dailyPoints?' · +2 积分':'')):(en?'Syncing today’s check-in':'正在同步今日签到'),hint:!signedIn?(en?'Your first sign-in each day checks you in automatically.':'每天首次登录，自动完成签到。'):checked&&Number(record.dailyPoints)>0?(en?'Daily +2 points added'+(record.rewardPoints?' · Streak bonus +'+record.rewardPoints:''):'今日签到 +2 积分已到账'+(record.rewardPoints?' · 连签额外 +'+record.rewardPoints+' 积分':'')):checked&&Number(record.rewardPoints)>0?(en?'7-day reward: +'+record.rewardPoints+' points added':'连续 7 天奖励 +'+record.rewardPoints+' 积分已到账'):(en?'Earn 2 points daily + 10 extra for every 7-day streak. One missed day per cycle is protected; a second miss restarts that cycle.':'每日签到得 2 积分，连续 7 天额外得 10 积分。每个周期可保护 1 次漏签，再漏则本周期重计。'),days:Array.from({length:7},(_,i)=>({day:i+1,done:i<cycleDay,today:checked&&i+1===cycleDay}))};
}
function rows(language){
 const en=language==='en';
 const icons=['/assets/news-trophy.svg','/assets/shield-outline.svg','/assets/news-ticket.svg','/assets/news-growth.svg'];
 return levelData.levels.map((level,index)=>({
  ...level,
  theme:THEMES[index],
  mascot:'/assets/yuni-adventure-'+MASCOTS[index]+'.png',
  action:(en?ACTIONS_EN:ACTIONS_ZH)[index],
  name:en?level.en:level.zh,
  shortName:(en?level.en:level.zh).replace('Yuni ',''),
  number:String(index+1).padStart(2,'0'),
  contentTitle:en?'What you receive':'可获得内容',
  benefits:[
   {title:en?'Level title':'等级称号',detail:en?'“'+level.en+'”':'「'+level.zh+'」',icon:icons[0]},
   {title:en?'Level identity':'等级标识',detail:'Lv.'+level.level,icon:icons[1]},
   index===0
    ?{title:en?'Growth record':'成长记录',detail:en?'Level points start from 0':'长期等级积分从 0 分开始记录',icon:icons[2]}
    :{title:en?'Level-up moment':'升级时刻',detail:en?'Yuni level-up animation and milestone record':'Yuni 升级动画与等级里程碑记录',icon:icons[2]},
   index===levelData.levels.length-1
    ?{title:en?'Journey status':'成长状态',detail:en?'Highest confirmed level · progress complete':'当前已确认最高等级 · 进度完成',icon:icons[3]}
    :{title:en?'Next-level progress':'下一级进度',detail:en?'Points remaining to '+levelData.levels[index+1].en+' are shown':'展示距离「'+levelData.levels[index+1].zh+'」还差多少积分',icon:icons[3]}
  ],
  conditionTitle:en?'Unlock requirement':'解锁条件',
  condition:index===0?(en?'Initial level · 0 level points':'初始等级 · 0 等级积分'):index===1?(en?'Complete your first order · 20 total points for the first completion':'完成首笔订单 · 首单总计 20 积分'):(en?'Reach '+level.min+' lifetime level points':'长期等级积分达到 '+level.min+' 分')
 }));
}
Page({
 data:{...require('../../utils/motion').data(),language:'zh',pointTasks:[],pointsStatus:'',pointsSyncError:false,levels:rows('zh'),current:0,currentItem:rows('zh')[0],currentLevel:1,points:0,arcMoveMs:ARC_MOVE_MS,arcReleaseMs:ARC_RELEASE_MS,gestureActive:false,dragX:0,dragY:0,mascotJumping:false},
 onLoad(){this.localize(true);},
 onReady(){wx.createSelectorQuery().in(this).select('.level-orbit').boundingClientRect(rect=>{this.orbitRect=rect;}).exec();},
 onShow(){this.localize(false);require('../../utils/orders').bind(this,'refreshCheckin');require('../../utils/page-title').apply(this);this.stopPointsSync();this.stopPoints=require('../../utils/activity-sync').subscribe(config=>{this.pointsConfig=activityDisplay.latest(this.pointsConfig,config);this.updatePointTasks();this.setData({pointsSyncError:false});},()=>this.setData({pointsSyncError:true}));},
 stopPointsSync(){if(this.stopPoints){this.stopPoints();this.stopPoints=null;}},
 refreshCheckin(){const state=store.get(),view=levelData.view(state.progression||{});this.setData({checkin:checkinView(state,this.data.language),currentLevel:view.level,points:view.points});},
 updatePointTasks(){const cached=(store.get().rewards||{}).activities;this.pointsConfig=activityDisplay.latest(this.pointsConfig,cached&&cached.config);const view=activityDisplay.display(this.pointsConfig,this.data.language==='zh');this.setData({pointTasks:view.activityTasks,pointsStatus:view.activityStatusLabel});},
 localize(first){
  const state=store.get(),language=state.language==='en'?'en':'zh',view=levelData.view(state.progression||{}),current=first?Math.max(0,view.level-1):this.data.current;
  const levels=rows(language);
  this.setData({checkin:checkinView(state,language),language,levels,current,currentItem:levels[current],currentLevel:view.level,points:view.points});this.updatePointTasks();
 },
 onMotionChange(enabled){this.stopMascotJump();this.stopArcMotion();this.setData({gestureActive:false,dragX:0,dragY:0,arcMoveMs:enabled?ARC_MOVE_MS:0,arcReleaseMs:enabled?ARC_RELEASE_MS:0});},
 stopMascotJump(){
  if(this.mascotJumpTimer)clearTimeout(this.mascotJumpTimer);
  this.mascotJumpTimer=null;
  if(this.data.mascotJumping)this.setData({mascotJumping:false});
 },
 onMascotTap(){
  if(this.arcMoved||this.data.mascotJumping||!require('../../utils/motion').enabled())return;
  this.setData({mascotJumping:true});
  this.mascotJumpTimer=setTimeout(()=>{this.mascotJumpTimer=null;this.setData({mascotJumping:false});},600);
 },
 stopArcMotion(){this.gestureVelocity=0;this.arcStartX=undefined;},
 setCurrent(current,fromArc=false){
  if(!fromArc)this.stopArcMotion();
  this.stopMascotJump();
  const last=this.data.levels.length-1,next=Math.max(0,Math.min(last,current));
  this.setData({current:next,currentItem:this.data.levels[next]});
 },
 select(e){this.setCurrent(Number(e.currentTarget.dataset.index)||0);},
 onArcStart(e){
  const touch=e.changedTouches&&e.changedTouches[0];
  if(!touch)return;
  this.stopArcMotion();
  this.arcMoved=false;this.arcStartX=touch.clientX;this.arcStartLevel=this.data.current;this.arcLastX=touch.clientX;this.arcLastAt=Date.now();this.gestureVelocity=0;
  this.setData({gestureActive:true,dragX:0,dragY:0});
 },
 onArcMove(e){
  const touch=e.changedTouches&&e.changedTouches[0],rect=this.orbitRect;
  if(!touch||!rect||!rect.width||this.arcStartX===undefined)return;
  if(Math.abs(touch.clientX-this.arcStartX)>8)this.arcMoved=true;
  const now=Date.now(),elapsed=Math.max(8,now-this.arcLastAt),instant=(touch.clientX-this.arcLastX)/elapsed;
  this.gestureVelocity=this.gestureVelocity*.72+instant*.28;this.arcLastX=touch.clientX;this.arcLastAt=now;
  const step=Math.max(36,rect.width*ARC_STEP_RATIO),rawShift=(this.arcStartX-touch.clientX)/step;
  const target=Math.max(0,Math.min(this.data.levels.length-1,Math.round(this.arcStartLevel+rawShift)));
  if(target!==this.data.current)this.setCurrent(target,true);
  const remainder=require('../../utils/motion').enabled()?rawShift-Math.round(rawShift):0,dragX=Math.max(-54,Math.min(54,-remainder*92));
  this.setData({gestureActive:true,dragX,dragY:-Math.abs(dragX)*.12});
 },
 onArcEnd(e){
  const touch=e.changedTouches&&e.changedTouches[0],rect=this.orbitRect;
  if(!touch||!rect||!rect.width||this.arcStartX===undefined){this.setData({gestureActive:false,dragX:0,dragY:0});return;}
  const step=Math.max(36,rect.width*ARC_STEP_RATIO),base=(this.arcStartX-touch.clientX)/step;
  const momentum=require('../../utils/motion').enabled()?Math.max(-ARC_MAX_MOMENTUM,Math.min(ARC_MAX_MOMENTUM,-this.gestureVelocity*ARC_MOMENTUM_MS/step)):0;
  const target=Math.max(0,Math.min(this.data.levels.length-1,Math.round(this.arcStartLevel+base+momentum)));
  this.setCurrent(target,true);this.stopArcMotion();
  this.setData({gestureActive:false,dragX:0,dragY:0});
 },
 onHide(){require('../../utils/orders').unbind(this);this.stopPointsSync();this.stopMascotJump();},
 onUnload(){require('../../utils/orders').unbind(this);this.stopPointsSync();this.stopMascotJump();this.stopArcMotion();}
});
