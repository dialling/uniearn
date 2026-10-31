'use strict';
const store=require('../../utils/store'),levelData=require('../../utils/yuni-level');
const THEMES=['star','helper','pro','ace','captain'];
const MASCOTS=['hello','bag','happy','party','wave'];
// Arc gesture tuning: adjust these values to fine-tune feel on real devices.
const ARC_MOVE_MS=340;       // level-change animation duration
const ARC_RELEASE_MS=420;    // ease-out duration after the finger lifts
const ARC_STEP_RATIO=.14;    // drag distance per level, relative to orbit width
const ARC_MOMENTUM_MS=170;   // how far the latest velocity projects on release
const ARC_MAX_MOMENTUM=1.35; // maximum extra levels contributed by inertia
function rows(language){
 const en=language==='en';
 const icons=['/assets/news-trophy.svg','/assets/shield-outline.svg','/assets/news-ticket.svg','/assets/news-growth.svg'];
 return levelData.levels.map((level,index)=>({
  ...level,
  theme:THEMES[index],
  mascot:'/assets/yuni-'+MASCOTS[index]+'.png',
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
 data:{language:'zh',levels:rows('zh'),current:0,currentItem:rows('zh')[0],currentLevel:1,points:0,arcMoveMs:ARC_MOVE_MS,arcReleaseMs:ARC_RELEASE_MS,gestureActive:false,dragX:0,dragY:0},
 onLoad(){this.localize(true);},
 onReady(){wx.createSelectorQuery().in(this).select('.level-orbit').boundingClientRect(rect=>{this.orbitRect=rect;}).exec();},
 onShow(){this.localize(false);require('../../utils/page-title').apply(this);},
 localize(first){
  const state=store.get(),language=state.language==='en'?'en':'zh',view=levelData.view(state.progression||{}),current=first?Math.max(0,view.level-1):this.data.current;
  const levels=rows(language);
  this.setData({language,levels,current,currentItem:levels[current],currentLevel:view.level,points:view.points});
 },
 stopArcMotion(){this.gestureVelocity=0;this.arcStartX=undefined;},
 setCurrent(current,fromArc=false){
  if(!fromArc)this.stopArcMotion();
  const last=this.data.levels.length-1,next=Math.max(0,Math.min(last,current));
  this.setData({current:next,currentItem:this.data.levels[next]});
 },
 select(e){this.setCurrent(Number(e.currentTarget.dataset.index)||0);},
 onArcStart(e){
  const touch=e.changedTouches&&e.changedTouches[0];
  if(!touch)return;
  this.stopArcMotion();
  this.arcStartX=touch.clientX;this.arcStartLevel=this.data.current;this.arcLastX=touch.clientX;this.arcLastAt=Date.now();this.gestureVelocity=0;
  this.setData({gestureActive:true,dragX:0,dragY:0});
 },
 onArcMove(e){
  const touch=e.changedTouches&&e.changedTouches[0],rect=this.orbitRect;
  if(!touch||!rect||!rect.width||this.arcStartX===undefined)return;
  const now=Date.now(),elapsed=Math.max(8,now-this.arcLastAt),instant=(touch.clientX-this.arcLastX)/elapsed;
  this.gestureVelocity=this.gestureVelocity*.72+instant*.28;this.arcLastX=touch.clientX;this.arcLastAt=now;
  const step=Math.max(36,rect.width*ARC_STEP_RATIO),rawShift=(this.arcStartX-touch.clientX)/step;
  const target=Math.max(0,Math.min(this.data.levels.length-1,Math.round(this.arcStartLevel+rawShift)));
  if(target!==this.data.current)this.setCurrent(target,true);
  const remainder=rawShift-Math.round(rawShift),dragX=Math.max(-54,Math.min(54,-remainder*92));
  this.setData({gestureActive:true,dragX,dragY:-Math.abs(dragX)*.12});
 },
 onArcEnd(e){
  const touch=e.changedTouches&&e.changedTouches[0],rect=this.orbitRect;
  if(!touch||!rect||!rect.width||this.arcStartX===undefined){this.setData({gestureActive:false,dragX:0,dragY:0});return;}
  const step=Math.max(36,rect.width*ARC_STEP_RATIO),base=(this.arcStartX-touch.clientX)/step;
  const momentum=Math.max(-ARC_MAX_MOMENTUM,Math.min(ARC_MAX_MOMENTUM,-this.gestureVelocity*ARC_MOMENTUM_MS/step));
  const target=Math.max(0,Math.min(this.data.levels.length-1,Math.round(this.arcStartLevel+base+momentum)));
  this.setCurrent(target,true);this.stopArcMotion();
  this.setData({gestureActive:false,dragX:0,dragY:0});
 },
 onUnload(){this.stopArcMotion();}
});
