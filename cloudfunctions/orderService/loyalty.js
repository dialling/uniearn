'use strict';
const DAY=86400000,CHINA=28800000;
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
 const m=member(s,id),l=data(m),before=l.level||1;l.points=(Number(l.points)||0)+amount;
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
  addPoints(s,r.ownerId,first?20:10,'customer-order',now,!(l.anyCompleted));
  l.firstCustomerOrder=true;r.loyaltyPointsAwarded.customer=true;
 }
 if(trip&&trip.runnerAccountId&&!r.loyaltyPointsAwarded.runner){
  const m=member(s,trip.runnerAccountId),l=data(m),first=!l.firstRunnerOrder;
  addPoints(s,trip.runnerAccountId,first?20:15,'runner-order',now,!(l.anyCompleted));
  l.firstRunnerOrder=true;r.loyaltyPointsAwarded.runner=true;
 }
}
function profileCompleted(s,id,now){
 const m=member(s,id),l=data(m);if(l.profileAwarded)return false;
 l.profileAwarded=true;addPoints(s,id,20,'profile',now);return true;
}
function dayKey(now){return new Date(now+CHINA).toISOString().slice(0,10);}
function dailyLogin(s,id,now){
 const l=data(member(s,id)),today=dayKey(now);if(l.lastLoginDay===today)return false;
 const previous=l.lastLoginDay?Date.parse(l.lastLoginDay+'T00:00:00+08:00'):0,todayAt=Date.parse(today+'T00:00:00+08:00');
 const consecutive=previous&&todayAt-previous===DAY;
 l.loginStreak=consecutive?(l.loginStreak||0)+1:1;l.lastLoginDay=today;
 if(l.loginStreak>=7){
  addPoints(s,id,20,'weekly-login',now);
  l.loginStreak=0;l.notices=(l.notices||[]).concat({id:'wk-'+today,type:'weekly',points:20,at:now}).slice(-10);
  return true;
 }
 return false;
}
function invite(s,inviter,invitee,now){
 addPoints(s,inviter,10,'invite-'+invitee,now);
 addPoints(s,invitee,10,'invite-welcome',now);
}
function acknowledge(s,id,noticeId){const l=data(member(s,id)),i=(l.notices||[]).findIndex(x=>x.id===noticeId);if(i>=0)l.notices.splice(i,1);}
function view(m){
 const l=data(m||{}),points=Number(l.points)||0,level=LEVELS[Math.min(4,Math.max(0,(l.level||1)-1))],next=LEVELS[level.level]||null;
 const start=level.points,to=next?next.points:start,segment=Math.max(0,points-start);
 return {points,level:level.level,nameZh:level.zh,nameEn:level.en,next:next?{level:next.level,nameZh:next.zh,nameEn:next.en,points:next.points,remaining:Math.max(0,next.points-points)}:null,remaining:next?Math.max(0,next.points-points):0,progress:next?Math.min(100,Math.max(0,(segment/(to-start))*100)):100,anyCompleted:!!l.anyCompleted,loginStreak:l.loginStreak||0,notices:(l.notices||[]).slice()};
}
module.exports={LEVELS,member,addPoints,completeOrder,profileCompleted,dailyLogin,invite,acknowledge,view};
