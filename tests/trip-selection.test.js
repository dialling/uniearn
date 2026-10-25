const assert=require('node:assert/strict');const {harness}=require('./helpers/order-cloud');
const now=Date.now(),food={category:'takeout',station:'North gate',pickupPoint:'丰食汇KFC外卖柜',dorm:'D01',room:'412',phone:'13801026092',owner:'Customer',arrived:true,bags:1,price:3};
const cfg={category:'takeout',when:'now',duration:10,station:'丰食汇KFC外卖柜',dorm:'D01',capacity:5};
async function create(h,data=food,who='customer'){const r=await h.call(who,'create',{data});assert.equal(r.ok,true,r.error);return r.value.id;}
(async()=>{
 const direct=harness(),one=await create(direct),two=await create(direct,{...food,pickupPoint:'文缘夜市门口外卖柜'});let mixed=await direct.call('runner','accept',{ids:[one,two]});assert.equal(mixed.ok,false,'different lockers must not form one trip');let accepted=await direct.call('runner','accept',{ids:[one]});assert.equal(accepted.ok,true,accepted.error);assert.equal(direct.state.trips.find(t=>t.id===accepted.value.id).station,food.pickupPoint,'direct acceptance uses the actual locker');
 const h=harness(),a=await create(h),b=await create(h),c=await create(h);
 let r=await h.call('runner','startTrip',{data:{...cfg,requestIds:[a,c]}});assert.equal(r.ok,true,r.error);
 assert.deepEqual(h.state.trips.find(t=>t.id===r.value.id).requestIds,[a,c]);assert.equal(h.state.requests.find(x=>x.id===b).status,'waiting');
 r=await h.call('runner','startTrip',{data:{...cfg,requestIds:[]}});assert.equal(r.ok,true);assert.deepEqual(h.state.trips.find(t=>t.id===r.value.id).requestIds,[]);assert.equal(h.state.requests.find(x=>x.id===b).status,'waiting');
 const d=await create(h),e=await create(h);let before=JSON.stringify(h.state);
 r=await h.call('runner','startTrip',{data:{...cfg,capacity:1,requestIds:[d,e]}});assert.equal(r.ok,false);assert.match(r.error,/Too many/);assert.equal(JSON.stringify(h.state),before,'over-capacity creation is atomic');
 for(const requestIds of [[a],[d,d],['missing'],null,Array(13).fill(d)]){before=JSON.stringify(h.state);r=await h.call('runner','startTrip',{data:{...cfg,requestIds}});assert.equal(r.ok,false);assert.equal(JSON.stringify(h.state),before);}
 const own=await create(h,food,'runner');r=await h.call('runner','startTrip',{data:{...cfg,requestIds:[own]}});assert.equal(r.ok,false);assert.match(r.error,/own/);
 const foreign=await create(h,food);h.edit(s=>s.requests.find(x=>x.id===foreign).campusId='taicang');r=await h.call('runner','startTrip',{data:{...cfg,requestIds:[foreign]}});assert.equal(r.ok,false);
 const hh=harness();const expensive1=await create(hh,{...food,price:6}),expensive2=await create(hh,{...food,price:6});r=await hh.call('runner','startTrip',{data:{...cfg,requestIds:[expensive1,expensive2]}});assert.equal(r.ok,false);assert.match(r.error,/runner limit/);
 const places=harness();const p1=await create(places,{...food,destinationType:'place',deliveryAddress:'Library east entrance'}),p2=await create(places,{...food,destinationType:'place',deliveryAddress:'Library west entrance'});r=await places.call('runner','startTrip',{data:{...cfg,dorm:'Library',requestIds:[p1,p2]}});assert.equal(r.ok,false);assert.match(r.error,/same delivery address/);
 const times=harness(),t1=await create(times),t2=await create(times);times.edit(s=>s.requests.find(x=>x.id===t2).arrivalAt=now-20*60000);r=await times.call('runner','startTrip',{data:{...cfg,requestIds:[t1,t2]}});assert.equal(r.ok,false);assert.match(r.error,/15 minutes/);
 const race=harness(),taken=await create(race);assert.equal((await race.call('other','accept',{ids:[taken]})).ok,true);r=await race.call('runner','startTrip',{data:{...cfg,requestIds:[taken]}});assert.equal(r.ok,false);assert.match(r.error,/changed/);
 const legacy=harness(),old=await create(legacy);r=await legacy.call('runner','startTrip',{data:cfg});assert.equal(r.ok,true);assert.ok(legacy.state.trips.find(t=>t.id===r.value.id).requestIds.includes(old),'old clients remain compatible');
 // Parcel selection also uses whole orders, not a count of individual checkboxes.
 const parcels=harness(),parcel={category:'parcel',owner:'Customer',phone:'13801026092',station:'North gate Cainiao station',dorm:'Dorm 7',room:'412',parcelItems:[{size:'small',code:'A'},{size:'small',code:'B'}]};
 const parcel1=await create(parcels,parcel),parcel2=await create(parcels,{...parcel,parcelItems:[{size:'small',code:'C'}]});r=await parcels.call('runner','startTrip',{data:{...cfg,category:'parcel',dorm:parcel.dorm,station:parcel.station,requestIds:[parcel2]}});assert.equal(r.ok,true);assert.equal(parcels.state.requests.find(x=>x.id===parcel1).status,'waiting');
 // Preview cannot change waiting orders; verify both local and server copies.
 for(const base of ['../utils/','../cloudfunctions/orderService/']){const f=require(base+'workflow'),s={...harness().state,profile:{accountId:'runner',campusId:'sip',jobsDone:0}};s.requests=[{id:'a',...food,campusId:'sip',status:'waiting',small:1,big:0,reward:3,ownerId:'customer',arrivalAt:now,closesAt:now+3600000,createdAt:now}];before=JSON.stringify(s);assert.deepEqual(f.previewTrip(s,{...cfg,requestIds:['a']}).ids,['a']);assert.equal(JSON.stringify(s),before);}
 let def,posted,notices=[];
 global.wx={getStorageSync:()=>null,setStorageSync(){},redirectTo(){},showToast:x=>notices.push(x.title)};global.Page=x=>def=x;
 const store=require('../utils/store'),orders=require('../utils/orders'),account=require('../utils/account');account.requireRunner=async()=>true;orders.act=async(action,args)=>{posted={action,...args};return{id:'t-new'};};orders.sync=async()=>{};
 require('../pages/trip-start/index');store.reset();store.update(s=>{s.language='zh';s.profile={...s.profile,accountId:'runner',campusId:'sip',universityId:'xjtlu',jobsDone:0};s.requests=['a','b','c'].map((id,i)=>({...food,id,campusId:'sip',status:'waiting',small:i===0?2:1,big:0,reward:3,arrivalAt:now,closesAt:now+3600000,createdAt:now,isMine:false}));s.requests.push({...s.requests[0],id:'mine',isMine:true});});
 const page={...def,data:structuredClone(def.data),setData(x){Object.assign(this.data,x);}};page.setData({dorm:'D01'});page.refresh();assert.equal(page.data.waiting,3);assert.equal(page.data.selectedCount,0);assert.equal(page.data.reward,'0.00');
 const toggle=id=>page.toggleOrder({currentTarget:{dataset:{id}}});toggle('a');toggle('b');assert.deepEqual(page.data.requestIds,['a','b']);assert.equal(page.data.selectedBoxes,3);assert.equal(page.data.reward,'6.00');
 page.refresh();assert.deepEqual(page.data.requestIds,['a','b'],'poll preserves user selection');
 page.changeCapacity({currentTarget:{dataset:{delta:-3}}});assert.match(page.data.error,/容量/);toggle('a');assert.equal(page.data.error,'');assert.deepEqual(page.data.requestIds,['b']);assert.equal(page.data.reward,'3.00');
 toggle('a');assert.deepEqual(page.data.requestIds,['b'],'over-capacity add rejected');assert.ok(notices.length);
 await page.start();assert.equal(posted.action,'startTrip');assert.deepEqual(posted.data.requestIds,['b']);assert.equal(posted.data.recommendedOrders,undefined,'send only trip configuration');
 page.clearOrders();await page.start();assert.deepEqual(posted.data.requestIds,[]);
 toggle('b');store.update(s=>{s.requests.find(r=>r.id==='b').status='taken';});page.refresh();assert.deepEqual(page.data.requestIds,[]);assert.equal(page.data.selectedBoxes,0);
 page.stationChoice({currentTarget:{dataset:{index:1}}});assert.equal(page.data.waiting,0);assert.deepEqual(page.data.requestIds,[]);
 page.select({currentTarget:{dataset:{field:'duration',value:20}}});assert.equal(page.data.duration,20);page.setCustomDuration({detail:{value:'25'}});assert.equal(page.data.duration,25);assert.equal(page.data.error,'');page.destinationArea({detail:{value:1}});assert.equal(page.data.areaIndex,1);assert.deepEqual(page.data.requestIds,[]);
 store.update(s=>s.language='en');page.refresh();assert.equal(page.data.zh,false);
 console.log('Trip checkboxes: exact subset, empty trip, capacity/value limits, duplicate/stale/own/campus/address/time guards, parcel orders, read-only previews, polling and both languages passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
