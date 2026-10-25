'use strict';
const levels=[
 {level:1,zh:'Yuni 新星',en:'Yuni Star',min:0},
 {level:2,zh:'Yuni 帮手',en:'Yuni Helper',min:20},
 {level:3,zh:'Yuni 达人',en:'Yuni Pro',min:150},
 {level:4,zh:'Yuni 王牌',en:'Yuni Ace',min:500},
 {level:5,zh:'Yuni 船长',en:'Yuni Captain',min:1000}
];
function view(data={}){
 const points=Math.max(0,Number(data.points)||0),n=Math.min(5,Math.max(1,Number(data.level)||1)),current=levels[n-1],next=levels[n]||null;
 const min=n===2?20:current.min,max=next?next.min:min,remaining=next?Math.max(0,max-points):0;
 return {points,level:n,nameZh:current.zh,nameEn:current.en,next:next?{...next,nameZh:next.zh,nameEn:next.en,remaining}:null,remaining:n===1?1:next?Math.max(0,max-points):0,progress:next?(n===1?0:Math.max(0,Math.min(100,(points-min)/(max-min)*100))):100,anyCompleted:!!data.anyCompleted,loginStreak:Number(data.loginStreak)||0};
}
module.exports={levels,view};
