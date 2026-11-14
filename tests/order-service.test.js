// Keep these base-settlement fixtures outside the lunch-rush bonus window.
const fixtureClock=Date.parse('2030-01-02T18:00:00+08:00');Date.now=()=>fixtureClock;
const assert=require('node:assert/strict');
const {harness}=require('./helpers/order-cloud');
const h=harness(),id=h.engine.idFor;
const data={category:'takeout',owner:'Customer',phone:'13801026092',station:'North gate',dorm:'Dorm 7',room:'412',bags:1,price:4,arrived:true};
const ok=async(who,action,extra={})=>{const r=await h.call(who,action,extra);assert.equal(r.ok,true,r.error);return r;};
(async()=>{
 let r=await ok('customer','create',{data:{...data,ownerId:id('runner'),status:'confirmed',reward:999}}),rid=r.value.id;
 assert.equal(h.state.requests[0].ownerId,id('customer'));assert.equal(h.state.requests[0].reward,4);assert.equal(h.state.requests[0].status,'waiting');
 let publicView=(await ok('stranger','sync')).snapshot;
 assert.equal(publicView.requests[0].phone,'');assert.equal(publicView.requests[0].room,'412');assert.ok(!JSON.stringify(publicView).includes('13801026092'));
 assert.equal((await h.call('customer','accept',{ids:[rid]})).ok,false,'cannot accept own order');
 assert.equal((await h.call('stranger','accept',{ids:[rid]})).ok,false,'runner student check enforced on server');
 assert.equal((await h.call('other','raise',{id:rid,amount:1.88})).ok,false,'customer ownership checked');
 const racing=await Promise.all(['runner','other'].map(who=>h.call(who,'accept',{ids:[rid]})));
 assert.equal(racing.filter(x=>x.ok).length,1,'exactly one runner wins a concurrent acceptance');
 const who=racing[0].ok?'runner':'other',loser=who==='runner'?'other':'runner',tid=h.state.requests[0].runnerId;
 assert.equal((await ok(loser,'sync')).snapshot.requests.length,0,'non-owner cannot fetch accepted order');
 assert.equal((await h.call(loser,'pickup',{id:rid})).ok,false);
 assert.equal((await h.call(who,'confirm',{id:rid})).ok,false);
 await ok(who,'pickup',{id:rid});
 assert.equal((await h.call(who,'deliver',{id:rid,photo:'wxfile://local',location:'Downstairs',sealChecked:true})).ok,false,'local paths rejected');
 const cloudPhoto='cloud://test/order-photos/'+id(who)+'/'+'a'.repeat(32)+'.jpg';
 await ok(who,'deliver',{id:rid,photo:cloudPhoto,location:'Downstairs',sealChecked:true});
 r=await ok('customer','sync');assert.ok(r.snapshot.photoURLs[cloudPhoto],'customer receives authorized signed photo URL');
 assert.equal((await ok(loser,'sync')).snapshot.photoURLs[cloudPhoto],undefined);
 const beforePaid=(await ok('customer','sync')).snapshot.stats.paid;
 await ok('customer','confirm',{id:rid,operationId:'confirm_idempotent_1'});
 await ok('customer','confirm',{id:rid,operationId:'confirm_idempotent_1'});
 assert.equal((await ok(who,'sync')).snapshot.stats.paid,4);assert.equal((await ok('customer','sync')).snapshot.stats.paid,beforePaid,'customer does not receive runner earnings');
 assert.equal((await h.call('customer','confirm',{id:rid})).ok,false);
 // Create request retry returns the same ID without another order.
 const once=await ok('customer','create',{data,operationId:'create_idempotent_1'});
 const twice=await ok('customer','create',{data,operationId:'create_idempotent_1'});assert.equal(once.value.id,twice.value.id);
 assert.equal((await h.call('customer','create',{data:{...data,bags:2},operationId:'create_idempotent_1'})).ok,false);
 // Partial parcel acceptance preserves split ownership but never exposes splitOriginal codes.
 r=await ok('customer','create',{data:{...data,category:'parcel',parcelItems:[{size:'small',code:'11-1-1111'},{size:'small',code:'22-2-2222'}],tip:0}});
 const parcelId=r.value.id;
 await ok(who,'acceptBoxes',{refs:[{requestId:parcelId,index:0}]});
 const runnerView=(await ok(who,'sync')).snapshot;
 assert.ok(!JSON.stringify(runnerView).includes('22-2-2222'));
 assert.ok(!JSON.stringify((await ok('stranger','sync')).snapshot).includes('11-1-1111'));
 await ok(who,'pickup',{id:parcelId});await ok(who,'deliver',{id:parcelId,photo:cloudPhoto,location:'Downstairs',sealChecked:true});
 h.edit(s=>{s.requests.find(x=>x.id===parcelId).deliveredAt=Date.now()-2*3600000+1;});
 await ok('customer','sync');assert.equal(h.state.requests.find(x=>x.id===parcelId).status,'delivered','parcels remain pending just before 2h');
 h.edit(s=>{s.requests.find(x=>x.id===parcelId).deliveredAt=Date.now()-2*3600000;});
 await ok('customer','sync');assert.equal(h.state.requests.find(x=>x.id===parcelId).status,'confirmed');
 // Capacity failures roll back both the new order and the ID counter.
 const trip=(await ok(who,'startTrip',{data:{category:'takeout',when:'now',duration:10,station:'Other gate',dorm:'Dorm 7',capacity:1}})).value.id;
 const before=JSON.stringify(h.state);
 assert.equal((await h.call('customer','create',{data:{...data,station:'Other gate',bags:2},tripId:trip})).ok,false);
 assert.equal(JSON.stringify(h.state),before);
 r=await ok('customer','create',{data:{...data,station:'Other gate'},tripId:trip});
 await ok(who,'pickup',{id:r.value.id});await ok(who,'leave',{id:trip});await ok(who,'deliver',{id:r.value.id,photo:cloudPhoto,location:'Downstairs',sealChecked:true});
 h.edit(s=>{s.requests.find(x=>x.id===r.value.id).deliveredAt=Date.now()-2*3600000;});
 await ok('customer','sync');assert.equal(h.state.requests.find(x=>x.id===r.value.id).status,'confirmed');
 // Dispute remains unconfirmed beyond timeout.
 const disputed=(await ok('customer','create',{data})).value.id;
 await ok(who,'accept',{ids:[disputed]});await ok(who,'pickup',{id:disputed});await ok(who,'deliver',{id:disputed,photo:cloudPhoto,location:'Downstairs',sealChecked:true});
 await ok('customer','report',{id:disputed,reason:'Not received',note:'',photo:''});
 h.edit(s=>{s.requests.find(x=>x.id===disputed).deliveredAt=Date.now()-72*3600000;});await ok('customer','sync');assert.equal(h.state.requests.find(x=>x.id===disputed).status,'disputed');
 h.accounts[id('customer')].loggedOut=true;
 assert.equal((await h.call('customer','create',{data})).ok,false);assert.ok(!(await ok('customer','sync')).snapshot.requests.some(x=>x.isMine));
 console.log('Cloud service: server identity, privacy, concurrent acceptance, idempotency, private photo access, split parcel privacy, atomic joins, uniform 2h settlement and logout passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
