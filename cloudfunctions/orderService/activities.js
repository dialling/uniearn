'use strict';
const {configFor,rankingOpen,fairnessOf}=require('./activity-config');
const member=(s,id)=>s.members[id]||(s.members[id]={marks:[]});
const data=(s,id)=>member(s,id).loyalty||(member(s,id).loyalty={points:0,level:1,anyCompleted:false,notices:[]});
const task=(s,kind)=>configFor(s).tasks.find(t=>t.kind===kind);
const enabled=(s,kind,now)=>{const c=configFor(s);return c.pointsProgram.status==='active'&&now>=Date.parse(c.pointsProgram.startedAt)&&!!task(s,kind)?.enabled;};
const fairness=s=>fairnessOf(configFor(s));
function record(s,id,kind,points,key,now){
 if(!(points>0))return;
 const c=configFor(s),l=data(s,id),fair=fairnessOf(c);
 l.pointHistory=[{kind,points,key,at:now,revision:c.revision},...(l.pointHistory||[])].slice(0,40);
 if(!rankingOpen(c,now))return;
 if(kind==='profile'&&!fair.profileCountsForRanking)return;
 l.rankings=l.rankings||{};
 const bucket=l.rankings[c.id]||(l.rankings[c.id]={points:0,reachedAt:now,referralCount:0});
 if(kind==='referral'&&key!=='invite-welcome'){
  if((bucket.referralCount||0)>=fair.referralRankingPerRound)return;
  bucket.referralCount=(bucket.referralCount||0)+1;
 }
 bucket.points+=points;bucket.reachedAt=now;
}
function view(s,id,now){
 const c=configFor(s),l=data(s,id),fair=fairnessOf(c),open=rankingOpen(c,now),ended=c.status==='ended'||(c.schedule.endsAt&&now>=Date.parse(c.schedule.endsAt));
 const rows=open||ended?Object.entries(s.members).map(([account,m])=>({account,points:m.loyalty?.rankings?.[c.id]?.points||0,reachedAt:m.loyalty?.rankings?.[c.id]?.reachedAt||0})).filter(x=>x.points>0).sort((a,b)=>b.points-a.points||a.reachedAt-b.reachedAt||a.account.localeCompare(b.account)):[];
 const day=new Date(now+28800000).toISOString().slice(0,10),award=(l.awardDays||{})[day]||{};
 return {config:c,points:Number(l.points)||0,rankingStatus:open?'open':ended?'ended':'not_open',rankingPoints:l.rankings?.[c.id]?.points||0,myRank:rows.findIndex(x=>x.account===id)+1||null,leaderboard:rows.slice(0,100).map((x,i)=>({rank:i+1,name:'Yuni '+x.account.slice(-4).toUpperCase(),points:x.points,mine:x.account===id})),history:l.pointHistory||[],taskProgress:{
  profile:!!l.profileAwarded,customerToday:award.customer||0,customerCap:fair.customerOrdersPerDay,runnerToday:award.runner||0,runnerCap:fair.runnerOrdersPerDay,
  referralRankingUsed:l.rankings?.[c.id]?.referralCount||0,referralRankingCap:fair.referralRankingPerRound,profileCountsForRanking:fair.profileCountsForRanking,
  checkin:l.checkin?{streak:Number(l.checkin.streak)||0,cycleDay:Number(l.checkin.cycleDay)||0,graceUsed:!!l.checkin.graceUsed,day:l.checkin.day||'',dailyPoints:Number(l.checkin.dailyPoints)||0}:null,
  firstCustomer:!!l.firstCustomerOrder,firstRunner:!!l.firstRunnerOrder
 }};
}
module.exports={task,enabled,record,view,fairness};
