// 2026-11-15: joining a trip sends the runner a request. Accept = normal assignment; decline = normal job-board order.
const assert=require('node:assert/strict'),{harness}=require('./helpers/order-cloud');
const data={category:'takeout',owner:'Customer',phone:'13801026092',station:'Other gate',dorm:'Dorm 7',room:'412',bags:1,price:4,arrived:true};
(async()=>{
 const h=harness(),ok=async(who,action,args)=>{const r=await h.call(who,action,args);assert.equal(r.ok,true,r.error);return r;};
 const trip=(await ok('runner','startTrip',{data:{category:'takeout',when:'now',duration:10,station:'Other gate',dorm:'Dorm 7',capacity:3}})).value.id;
 // join -> request, not assigned
 let r=await ok('customer','create',{data,tripId:trip});const id=r.value.id,req=()=>h.state.requests.find(x=>x.id===id);
 assert.equal(req().runnerId,null);assert.equal(req().offeredTripId,trip);assert.equal(h.state.trips.find(t=>t.id===trip).requestIds.length,0);
 // hidden from everyone else's hall, visible to the trip runner
 const other=(await ok('other','sync')).snapshot;assert.ok(other.publicJobs.some(o=>o.id===id),'a join request is also on the job board');
 const run=(await ok('runner','sync')).snapshot;assert.equal(run.requests.find(o=>o.id===id).offeredTripId,trip);assert.equal(run.requests.find(o=>o.id===id).phone,'','runner sees no phone before accepting');
 const mine=(await ok('customer','sync')).snapshot;assert.equal(mine.requests.find(o=>o.id===id).offeredTripId,trip,'the customer sees it is waiting for this runner');
 // nobody else can grab it, and only this trip's runner can decide
 assert.equal((await h.call('other','tripOffer',{id,decision:'accept'})).ok,false,'only this trip\'s runner answers the request');
 // decline -> job board
 await ok('runner','tripOffer',{id,decision:'decline'});
 assert.equal(req().offeredTripId,undefined);assert.equal(req().status,'waiting');assert.equal(req().runnerId,null);
 assert.ok((await ok('other','sync')).snapshot.publicJobs.some(o=>o.id===id),'a declined order is a normal job-board order');
 assert.equal((await h.call('runner','tripOffer',{id,decision:'accept'})).ok,false,'a declined request cannot be accepted from the trip page');
 // accept path
 r=await ok('customer','create',{data,tripId:trip});const id2=r.value.id;
 await ok('runner','tripOffer',{id:id2,decision:'accept'});
 const a=h.state.requests.find(x=>x.id===id2);assert.equal(a.status,'taken');assert.equal(a.runnerId,trip);assert.equal(a.offeredTripId,undefined);
 // an unanswered request goes to the job board after 15 minutes
 r=await ok('customer','create',{data,tripId:trip});const id3=r.value.id;
 h.edit(s=>{s.requests.find(x=>x.id===id3).offeredAt=Date.now()-16*60000;});
 assert.ok((await ok('other','sync')).snapshot.publicJobs.some(o=>o.id===id3),'unanswered requests fall back to the job board');
 // a request that does not fit the trip still fails at join time
 assert.equal((await h.call('customer','create',{data:{...data,bags:5},tripId:trip})).ok,false);
 console.log('trip join requests: on the job board too, trip runner decides, decline or timeout leaves it there');
})().catch(e=>{console.error(e);process.exit(1);});
// 2026-11-16: joining a trip that already holds an older order is fine; only "arrives before the runner leaves" applies.
(async()=>{const assert=require('node:assert/strict'),{harness}=require('./helpers/order-cloud');
 const h=harness(),ok=async(who,action,args)=>{const r=await h.call(who,action,args);assert.equal(r.ok,true,r.error);return r;};
 const data={category:'takeout',owner:'Customer',phone:'13801026092',station:'Other gate',dorm:'Dorm 7',room:'412',bags:1,price:4,arrived:true};
 const trip=(await ok('runner','startTrip',{data:{category:'takeout',when:'now',duration:10,station:'Other gate',dorm:'Dorm 7',capacity:3}})).value.id;
 const first=(await ok('customer','create',{data,tripId:trip})).value.id;await ok('runner','tripOffer',{id:first,decision:'accept'});
 h.edit(s=>{const r=s.requests.find(x=>x.id===first);r.arrivalAt=Date.now()-60*60000;r.createdAt=Date.now()-60*60000;});
 const second=await h.call('other','create',{data,tripId:trip});assert.equal(second.ok,true,second.error);
 const acc=await h.call('runner','tripOffer',{id:second.value.id,decision:'accept'});assert.equal(acc.ok,true,acc.error);
 console.log('trip join ignores the 15-minute spread between orders');})().catch(e=>{console.error(e);process.exit(1);});
// 2026-11-16: the 15-minute skip is only for food that has already arrived; empty trips end when the join window closes.
(async()=>{const assert=require('node:assert/strict'),{harness}=require('./helpers/order-cloud');
 const h=harness(),ok=async(who,action,args)=>{const r=await h.call(who,action,args);assert.equal(r.ok,true,r.error);return r;};
 const base={category:'takeout',owner:'Customer',phone:'13801026092',station:'Other gate',dorm:'Dorm 7',room:'412',bags:1,price:4};
 const trip=(await ok('runner','startTrip',{data:{category:'takeout',when:'now',duration:30,station:'Other gate',dorm:'Dorm 7',capacity:4}})).value.id;
 const first=(await ok('customer','create',{data:{...base,arrived:true},tripId:trip})).value.id;await ok('runner','tripOffer',{id:first,decision:'accept'});
 h.edit(s=>{const r=s.requests.find(x=>x.id===first);r.arrivalAt=Date.now()-60*60000;r.createdAt=Date.now()-60*60000;});
 const hh=new Date(Date.now()+20*60000+8*3600000),later=String(hh.getUTCHours()).padStart(2,'0')+':'+String(hh.getUTCMinutes()).padStart(2,'0');
 const notYet=await h.call('other','create',{data:{...base,arrived:false,arrivalTime:later},tripId:trip});
 assert.equal(notYet.ok,false,'food that has not arrived still follows the 15-minute rule');
 assert.equal((await h.call('other','create',{data:{...base,arrived:true},tripId:trip})).ok,true,'arrived food skips it');
 // empty trip ends at the join deadline
 const h2=harness(),ok2=async(who,action,args)=>{const r=await h2.call(who,action,args);assert.equal(r.ok,true,r.error);return r;};
 const empty=(await ok2('runner','startTrip',{data:{category:'takeout',when:'now',duration:10,station:'Other gate',dorm:'Dorm 7',capacity:3}})).value.id;
 h2.edit(s=>{s.trips.find(t=>t.id===empty).joinUntil=Date.now()-1000;});
 await ok2('runner','sync');assert.equal(h2.state.trips.find(t=>t.id===empty).cancelled,true,'an empty trip ends when its join window closes');
 assert.ok(!(await ok2('other','sync',{viewTripId:empty})).snapshot.publicTrips.some(t=>t.id===empty),'an ended trip link shows nothing');
 console.log('arrived-only skip and auto-ending empty trips ok');})().catch(e=>{console.error(e);process.exit(1);});

// 2026-11-16: another runner can take a join request from the job board; it then leaves the trip runner's requests.
(async()=>{const assert=require('node:assert/strict'),{harness}=require('./helpers/order-cloud');
 const h=harness(),ok=async(who,action,args)=>{const r=await h.call(who,action,args);assert.equal(r.ok,true,r.error);return r;};
 const data={category:'takeout',owner:'Customer',phone:'13801026092',station:'Other gate',dorm:'Dorm 7',room:'412',bags:1,price:4,arrived:true};
 const trip=(await ok('runner','startTrip',{data:{category:'takeout',when:'now',duration:10,station:'Other gate',dorm:'Dorm 7',capacity:3}})).value.id;
 const id=(await ok('customer','create',{data,tripId:trip})).value.id;
 await ok('other','accept',{ids:[id]});
 const r=h.state.requests.find(x=>x.id===id);assert.equal(r.status,'taken');assert.notEqual(r.runnerId,trip);
 assert.equal((await h.call('runner','tripOffer',{id,decision:'accept'})).ok,false,'the trip runner can no longer take it');
 console.log('job board runner can take a join request first');})().catch(e=>{console.error(e);process.exit(1);});
