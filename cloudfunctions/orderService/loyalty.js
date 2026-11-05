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
 const kind=reason==='customer-order'?'customer_order':reason==='runner-order'?'runner_order':reason==='profile'?'profile':(reason==='weekly-login'||reason==='daily-checkin')?'weekly_login':'referral';
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
// A separate record starts the new rolling streak without treating legacy weekly counts as consecutive days.
function dailyLogin(s,id,now){
 const l=data(member(s,id)),today=dayKey(now),c=l.checkin||(l.checkin={day:'',streak:0,totalDays:0});
 if(c.day>today)return false;
 // Credit today's daily reward once, including accounts already checked in before this update.
 if(c.day===today){if(c.dailyPoints===undefined){c.dailyPoints=activities.enabled(s,'weekly_login',now)?2:0;if(c.dailyPoints)addPoints(s,id,c.dailyPoints,'daily-checkin',now);const notice=(l.notices||[]).find(n=>n.type==='checkin'&&n.day===today);if(notice)Object.assign(notice,{dailyPoints:c.dailyPoints,weeklyPoints:c.rewardPoints||0,points:c.dailyPoints+(c.rewardPoints||0)});}return false;}
 const yesterday=dayKey(now-DAY);
 c.streak=c.day===yesterday?(Number(c.streak)||0)+1:1;
 c.day=today;c.at=now;c.totalDays=(Number(c.totalDays)||0)+1;c.cycleDay=(c.streak-1)%7+1;
 c.dailyPoints=activities.enabled(s,'weekly_login',now)?2:0;
 if(c.dailyPoints)addPoints(s,id,c.dailyPoints,'daily-checkin',now);
 c.rewardPoints=c.cycleDay===7&&activities.enabled(s,'weekly_login',now)?10:0;
 l.lastLoginDay=today;l.loginStreak=c.streak;
 if(c.rewardPoints)addPoints(s,id,c.rewardPoints,'weekly-login',now);
 // Only today's unacknowledged check-in is relevant; level-up notices retain their queue.
 l.notices=(l.notices||[]).filter(n=>n.type!=='checkin').concat({id:'checkin-'+today,type:'checkin',day:today,streak:c.streak,cycleDay:c.cycleDay,dailyPoints:c.dailyPoints,weeklyPoints:c.rewardPoints,points:c.dailyPoints+c.rewardPoints,at:now}).slice(-10);
 return true;
}
function invite(s,inviter,invitee,now){
 addPoints(s,inviter,activities.task(s,'referral').points,'invite-'+invitee,now);
 addPoints(s,invitee,activities.task(s,'referral').points,'invite-welcome',now);
}
function acknowledge(s,id,noticeId){const l=data(member(s,id)),i=(l.notices||[]).findIndex(x=>x.id===noticeId);if(i>=0)l.notices.splice(i,1);}
function view(m){
 const l=data(m||{}),points=Number(l.points)||0,level=LEVELS[Math.min(4,Math.max(0,(l.level||1)-1))],next=LEVELS[level.level]||null;
 const start=level.points,to=next?next.points:start,segment=Math.max(0,points-start);
 return {points,level:level.level,nameZh:level.zh,nameEn:level.en,next:next?{level:next.level,nameZh:next.zh,nameEn:next.en,points:next.points,remaining:Math.max(0,next.points-points)}:null,remaining:next?Math.max(0,next.points-points):0,progress:next?Math.min(100,Math.max(0,(segment/(to-start))*100)):100,anyCompleted:!!l.anyCompleted,loginStreak:l.loginStreak||0,checkin:l.checkin?{...l.checkin}:null,notices:(l.notices||[]).slice()};
}
module.exports={LEVELS,member,addPoints,completeOrder,profileCompleted,dailyLogin,invite,acknowledge,view};
