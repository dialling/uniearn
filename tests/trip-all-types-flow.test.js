// 2026-11-16: Start a trip works end to end for takeaway, parcel and other (task) trips:
// runner starts → a friend joins → runner accepts the request → pickup / task done → delivered → friend confirms → trip done.
const assert=require('node:assert/strict'),{harness}=require('./helpers/order-cloud');
const phone='13801026092';
const flows={
 takeout:{trip:{category:'takeout',when:'now',duration:10,station:'North gate',dorm:'D01',capacity:3},
  order:{category:'takeout',station:'North gate',dorm:'D01',room:'1111',owner:'Friend',phone,bags:1,price:3,arrived:true}},
 parcel:{trip:{category:'parcel',when:'now',duration:10,station:'North gate Cainiao station',dorm:'D01',capacity:3},
  order:{category:'parcel',station:'North gate Cainiao station',pickupPoint:'North gate Cainiao station',dorm:'D01',room:'2324',owner:'Friend',phone,parcelItems:[{size:'small',code:'11-1-9410',pickupPoint:'North gate Cainiao station'}]}},
 other:{trip:{category:'other',when:'now',duration:20,station:'Restaurant',dorm:'D01',capacity:5},
  order:{category:'task',taskMode:'offline',title:'Bring a drink please',price:3,owner:'Friend',phone,dorm:'',room:''}}
};
(async()=>{
 for(const [name,cfg] of Object.entries(flows)){
  const h=harness(),runner=h.engine.idFor('runner');
  const ok=async(who,action,args,why)=>{const r=await h.call(who,action,args);assert.equal(r.ok,true,name+' '+action+(why?' ('+why+')':'')+': '+r.error);return r;};
  const photo='cloud://test/order-photos/'+runner+'/'+'a'.repeat(32)+'.jpg';
  const tripId=(await ok('runner','startTrip',{data:cfg.trip})).value.id;
  // the friend sees the shared trip (also before signing in, through viewTripId)
  const seen=(await h.call('customer','sync',{viewTripId:tripId})).snapshot.publicTrips.find(t=>t.id===tripId);
  assert.ok(seen,name+': the friend can open the shared trip');
  const id=(await ok('customer','create',{data:cfg.order,tripId})).value.id;
  let r=h.state.requests.find(x=>x.id===id);
  assert.equal(r.offeredTripId,tripId,name+': the join waits for the runner');
  const offers=(await ok('runner','sync')).snapshot.requests.filter(x=>x.offeredTripId===tripId);
  assert.equal(offers.length,1,name+': the runner sees the join request');
  await ok('runner','tripOffer',{id,decision:'accept'});
  r=h.state.requests.find(x=>x.id===id);const trip=()=>h.state.trips.find(t=>t.id===tripId);
  assert.equal(r.status,'taken',name+': accepted');assert.equal(r.runnerId,tripId);
  if(r.category==='task'){
   await ok('runner','taskDone',{id,photo,note:'Handed over at the gate'});
  }else{
   await ok('runner','pickup',r.category==='parcel'?{id,index:0,expectedCodes:r.codes}:{id});
   assert.equal(h.state.requests.find(x=>x.id===id).status,'collected',name+': picked up');
   if(trip().phase==='collect')await ok('runner','leave',{id:tripId},'go deliver');
   assert.equal(trip().phase,'deliver',name+': delivering');
   await ok('runner','deliver',{id,photo,location:'At your door',sealChecked:true});
  }
  assert.equal(h.state.requests.find(x=>x.id===id).status,'delivered',name+': delivered');
  await ok('customer','confirm',{id});
  assert.equal(h.state.requests.find(x=>x.id===id).status,'confirmed',name+': confirmed');
  const end=(await ok('runner','sync')).snapshot.trips.find(t=>t.id===tripId);
  assert.ok(end,name+': the runner still sees the trip');
  console.log(name+' trip: start → join → accept → '+(r.category==='task'?'task done':'pickup → deliver')+' → confirm ok · trip phase '+end.phase);
 }
})().catch(e=>{console.error(e);process.exit(1);});
// Other trips can take takeaway or parcels too; decline sends the order to the job board; a closed trip refuses joins.
(async()=>{
 const base={when:'now',duration:20,station:'North gate',dorm:'D01',capacity:5};
 for(const order of [{category:'takeout',station:'North gate',dorm:'D01',room:'1111',owner:'Friend',phone,bags:1,price:3,arrived:true},{category:'parcel',station:'North gate',pickupPoint:'North gate',dorm:'D01',room:'2324',owner:'Friend',phone,parcelItems:[{size:'small',code:'11-1-9410',pickupPoint:'North gate'}]}]){
  const h=harness();const ok=async(who,action,args)=>{const r=await h.call(who,action,args);assert.equal(r.ok,true,'other+'+order.category+' '+action+': '+r.error);return r;};
  const tripId=(await ok('runner','startTrip',{data:{...base,category:'other'}})).value.id;
  const id=(await ok('customer','create',{data:order,tripId})).value.id;
  assert.equal(h.state.requests.find(x=>x.id===id).offeredTripId,tripId);
  await ok('runner','tripOffer',{id,decision:'accept'});
  assert.equal(h.state.requests.find(x=>x.id===id).status,'taken');
  console.log('other trip accepts a '+order.category+' join');
 }
 {const h=harness();const ok=async(who,action,args)=>{const r=await h.call(who,action,args);assert.equal(r.ok,true,action+': '+r.error);return r;};
  const tripId=(await ok('runner','startTrip',{data:flows.takeout.trip})).value.id;
  const id=(await ok('customer','create',{data:flows.takeout.order,tripId})).value.id;
  await ok('runner','tripOffer',{id,decision:'decline'});
  const r=h.state.requests.find(x=>x.id===id);assert.equal(r.status,'waiting');assert.equal(r.offeredTripId,undefined);
  assert.ok((await ok('other','sync')).snapshot.publicJobs.some(o=>o.id===id),'a declined join stays on the job board');
  await ok('other','accept',{ids:[id]});assert.equal(h.state.requests.find(x=>x.id===id).status,'taken');
  console.log('declined join goes to the job board and another runner takes it');}
 {const h=harness();const ok=async(who,action,args)=>{const r=await h.call(who,action,args);assert.equal(r.ok,true,action+': '+r.error);return r;};
  const tripId=(await ok('runner','startTrip',{data:flows.parcel.trip})).value.id;
  h.state.trips.find(t=>t.id===tripId).joinUntil=Date.now()-1;
  const r=await h.call('customer','create',{data:flows.parcel.order,tripId});assert.equal(r.ok,false,'a closed trip refuses joins');
  console.log('closed trip refuses joins: '+r.error);}
})().catch(e=>{console.error(e);process.exit(1);});
