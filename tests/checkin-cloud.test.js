const assert=require('node:assert/strict'),{harness}=require('./helpers/order-cloud');
const h=harness(),D=86400000,originalNow=Date.now;let now=Date.parse('2026-11-27T23:59:00+08:00');Date.now=()=>now;
const id=h.engine.idFor('customer'),policy=require('../cloudfunctions/orderService/activity-config');
const old=policy.clone(policy.defaults),weekly=old.tasks.find(t=>t.kind==='weekly_login');weekly.points=20;weekly.weekStartsOn='monday';delete weekly.repeat;
h.documents['uniearn_news:activity-config']={value:old};
const call=(who,action,extra={})=>h.call(who,action,{...extra,checkinVersion:1});
(async()=>{
 let result;
 for(let i=0;i<7;i++){
  now=Date.parse('2026-11-27T23:59:00+08:00')+i*D;
  result=await call('customer','sync');assert.equal(result.ok,true,result.error);
  const p=result.snapshot.progression;assert.equal(p.checkin.streak,i+1);assert.equal(p.checkin.cycleDay,i+1);assert.equal(p.points,i===6?10:0);
  assert.equal(p.notices.filter(n=>n.type==='checkin').length,1,'only the latest daily check-in is kept');
  assert.equal(result.snapshot.rewards.activities.config.tasks.find(t=>t.kind==='weekly_login').points,10,'legacy configuration cannot restore the old 20-point rule');
 }
 assert.equal(result.snapshot.progression.checkin.day,'2026-12-03');
 assert.equal(result.snapshot.progression.notices.find(n=>n.type==='checkin').points,10);
 await Promise.all([call('customer','sync'),call('customer','sync')]);
 assert.equal(h.state.members[id].loyalty.points,10,'duplicate/concurrent syncs cannot pay twice');
 const note=result.snapshot.progression.notices.find(n=>n.type==='checkin');
 await call('customer','ackLoyaltyNotice',{noticeId:note.id});await call('customer','sync');
 assert.equal(h.state.members[id].loyalty.notices.some(n=>n.id===note.id),false,'an acknowledged day does not reappear');
 for(let i=7;i<14;i++){now=Date.parse('2026-11-27T23:59:00+08:00')+i*D;await call('customer','sync');}
 assert.equal(h.state.members[id].loyalty.points,20,'each further block of 7 consecutive days earns 10');
 assert.equal(h.state.members[id].loyalty.checkin.streak,14);
 now+=2*D;result=await call('customer','sync');assert.equal(result.snapshot.progression.checkin.streak,1,'a missed day restarts the streak');assert.equal(result.snapshot.progression.points,20);
 const day=result.snapshot.progression.checkin.day;
 now-=D;await call('customer','sync');assert.equal(h.state.members[id].loyalty.checkin.day,day,'clock rollback cannot produce an extra check-in');
 // New account; count the China midnight boundary, independent of host timezone.
 now=Date.parse('2026-12-31T23:59:59+08:00');result=await call('runner','sync');assert.equal(result.snapshot.progression.checkin.streak,1);
 now+=1000;result=await call('runner','sync');assert.equal(result.snapshot.progression.checkin.day,'2027-01-01');assert.equal(result.snapshot.progression.checkin.streak,2);
 h.accounts[h.engine.idFor('runner')].loggedOut=true;now+=D;result=await call('runner','sync');assert.equal(result.snapshot.progression,null,'logged-out sessions do not check in');
 h.accounts[h.engine.idFor('other')].profile=null;result=await call('other','sync');assert.equal(result.snapshot.progression,null,'accounts without a profile do not check in');
 const legacy=await h.call('customer','sync');assert.equal(legacy.snapshot.progression.notices.some(n=>n.type==='checkin'),false,'old clients never receive an unknown popup type');
 assert.equal(policy.validate(old).tasks.find(t=>t.kind==='weekly_login').repeat,'consecutive');
 console.log('Daily check-in cloud: rolling 7-day/10-point rewards, missed days, cross-week/month/year/China midnight, concurrency, ack, clock rollback, legacy config and login guards passed.');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{Date.now=originalNow;});
