'use strict';
const DAY=86400000,CHINA=28800000;
const activities=require('./activities');
const LEVELS=[
 {level:1,zh:'Yuni 新星',en:'Yuni Star',points:0},
 {level:2,zh:'Yuni 帮手',en:'Yuni Helper',points:20},
 {level:3,zh:'Yuni 达人',en:'Yuni Pro',points:150},
 {level:4,zh:'Yuni 王牌',en:'Yuni Ace',points:500},
 {level:5,zh:'Yuni 船长',en:'Yuni Captain',points:1000}
];
const member=(s,id)=>s.members[id]||(s.members[id]={marks:[]});
function data(m){return m.loyalty||(m.loyalty={points:0,level:1,anyCompleted:false,notices:[]});}
function addPoints(s,id,amount,reason,now,firstCompletion=false){
 const m=member(s,id),l=data(m),before=l.level||1;
 const kind=reason==='customer-order'?'customer_order':reason==='runner-order'?'runner_order':reason==='profile'?'profile':reason==='weekly-login'?'weekly_login':'referral';
 amount=activities.enabled(s,kind,now)?amount:0;l.points=(Number(l.points)||0)+amount;activities.record(s,id,kind,amount,reason,now);
 if(firstCompletion){l.anyCompleted=true;if(before===1)l.level=2;}
 else if(before>=2&&before<5&&l.points>=LEVELS[before].points)l.level=before+1;
 if(l.level>before){l.notices=(l.notices||[]).concat({id:'lv-'+l.level+'-'+now+'-'+reason,type:'level',level:l.level,at:now}).slice(-10);}
 l.lastReason=reason;return l;
}
function completeOrder(s,r,trip,now){
 if(!s.loyaltyStartedAt||!r.confirmedAt||r.confirmedAt<s.loyaltyStartedAt)return;
 r.loyaltyPointsAwarded=r.loyaltyPointsAwarded||{};
 if(r.ownerId&&!r.loyaltyPointsAwarded.customer){
  const m=member(s,r.ownerId),l=data(m),first=!l.firstCustomerOrder;
  addPoints(s,r.ownerId,first?activities.task(s,'customer_order').firstCompletion.points:activities.task(s,'customer_order').points,'customer-order',now,!(l.anyCompleted));
  l.firstCustomerOrder=true;r.loyaltyPointsAwarded.customer=true;
 }
 if(trip&&trip.runnerAccountId&&!r.loyaltyPointsAwarded.runner){
  const m=member(s,trip.runnerAccountId),l=data(m),first=!l.firstRunnerOrder;
  addPoints(s,trip.runnerAccountId,first?activities.task(s,'runner_order').firstCompletion.points:activities.task(s,'runner_order').points,'runner-order',now,!(l.anyCompleted));
  l.firstRunnerOrder=true;r.loyaltyPointsAwarded.runner=true;
 }
}
function profileCompleted(s,id,now){
 const m=member(s,id),l=data(m);if(l.profileAwarded||!activities.enabled(s,'profile',now))return false;
 l.profileAwarded=true;addPoints(s,id,activities.task(s,'profile').points,'profile',now);return true;
}
function dayKey(now){return new Date(now+CHINA).toISOString().slice(0,10);}
function dailyLogin(s,id,now){const l=data(member(s,id)),today=dayKey(now);if(l.lastLoginDay===today)return false;const d=new Date(now+CHINA);d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);const week=d.toISOString().slice(0,10);if(l.loginWeek!==week){l.loginWeek=week;l.loginDays=[];l.weekAwarded=false;}l.lastLoginDay=today;l.loginDays=(l.loginDays||[]).concat(today);l.loginStreak=l.loginDays.length;if(l.loginDays.length===7&&!l.weekAwarded){l.weekAwarded=true;const points=activities.task(s,'weekly_login').points;addPoints(s,id,points,'weekly-login',now);if(activities.enabled(s,'weekly_login',now))l.notices=(l.notices||[]).concat({id:'wk-'+week,type:'weekly',points,at:now}).slice(-10);return true;}return false;}
function invite(s,inviter,invitee,now){
 addPoints(s,inviter,activities.task(s,'referral').points,'invite-'+invitee,now);
 addPoints(s,invitee,activities.task(s,'referral').points,'invite-welcome',now);
}
function acknowledge(s,id,noticeId){const l=data(member(s,id)),i=(l.notices||[]).findIndex(x=>x.id===noticeId);if(i>=0)l.notices.splice(i,1);}
function view(m){
 const l=data(m||{}),points=Number(l.points)||0,level=LEVELS[Math.min(4,Math.max(0,(l.level||1)-1))],next=LEVELS[level.level]||null;
 const start=level.points,to=next?next.points:start,segment=Math.max(0,points-start);
 return {points,level:level.level,nameZh:level.zh,nameEn:level.en,next:next?{level:next.level,nameZh:next.zh,nameEn:next.en,points:next.points,remaining:Math.max(0,next.points-points)}:null,remaining:next?Math.max(0,next.points-points):0,progress:next?Math.min(100,Math.max(0,(segment/(to-start))*100)):100,anyCompleted:!!l.anyCompleted,loginStreak:l.loginStreak||0,notices:(l.notices||[]).slice()};
}
module.exports={LEVELS,member,addPoints,completeOrder,profileCompleted,dailyLogin,invite,acknowledge,view};
