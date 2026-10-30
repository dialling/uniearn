'use strict';
const store=require('../../utils/store'),levelData=require('../../utils/yuni-level');
const THEMES=['star','helper','pro','ace','captain'];
const MASCOTS=['hello','bag','happy','party','wave'];
function rows(language){
 const en=language==='en';
 return levelData.levels.map((level,index)=>({
  ...level,
  theme:THEMES[index],
  mascot:'/assets/yuni-'+MASCOTS[index]+'.png',
  name:en?level.en:level.zh,
  shortName:(en?level.en:level.zh).replace('Yuni ',''),
  number:String(index+1).padStart(2,'0'),
  contentTitle:en?'What you receive':'可获得内容',
  benefits:[
   {title:en?'Level title':'等级称号',detail:en?'“'+level.en+'”':'「'+level.zh+'」'},
   {title:en?'Level identity':'等级标识',detail:'Lv.'+level.level},
   index===0
    ?{title:en?'Growth record':'成长记录',detail:en?'Level points start from 0':'长期等级积分从 0 分开始记录'}
    :{title:en?'Level-up moment':'升级时刻',detail:en?'Yuni level-up animation and milestone record':'Yuni 升级动画与等级里程碑记录'},
   index===levelData.levels.length-1
    ?{title:en?'Journey status':'成长状态',detail:en?'Highest confirmed level · progress complete':'当前已确认最高等级 · 进度完成'}
    :{title:en?'Next-level progress':'下一级进度',detail:en?'Points remaining to '+levelData.levels[index+1].en+' are shown':'展示距离「'+levelData.levels[index+1].zh+'」还差多少积分'}
  ],
  conditionTitle:en?'Unlock requirement':'解锁条件',
  condition:index===0?(en?'Initial level · 0 level points':'初始等级 · 0 等级积分'):index===1?(en?'Complete your first order · 20 total points for the first completion':'完成首笔订单 · 首单总计 20 积分'):(en?'Reach '+level.min+' lifetime level points':'长期等级积分达到 '+level.min+' 分')
 }));
}
Page({
 data:{language:'zh',levels:rows('zh'),current:0,currentItem:rows('zh')[0],currentLevel:1,points:0},
 onLoad(){this.localize(true);},
 onShow(){this.localize(false);require('../../utils/page-title').apply(this);},
 localize(first){
  const state=store.get(),language=state.language==='en'?'en':'zh',view=levelData.view(state.progression||{}),current=first?Math.max(0,view.level-1):this.data.current;
  const levels=rows(language);
  this.setData({language,levels,current,currentItem:levels[current],currentLevel:view.level,points:view.points});
 },
 select(e){const current=Number(e.currentTarget.dataset.index)||0;this.setData({current,currentItem:this.data.levels[current]});}
});
