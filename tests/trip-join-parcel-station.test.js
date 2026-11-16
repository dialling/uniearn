// 2026-11-16: joining a parcel trip from the share card failed with "Some requests are unavailable for this route"
// because the parcel's station came from the form's own station picker, not the trip's station.
const assert=require('node:assert/strict');
let definition;
global.Page=value=>definition=value;global.wx={getStorageSync:()=>null,setStorageSync(){},showToast(o){global.lastToast=o.title;},redirectTo(){},reLaunch(){},navigateTo(){}};
const store=require('../utils/store'),orders=require('../utils/orders');
const {harness}=require('./helpers/order-cloud'),h=harness();
require('../pages/create/index');
const p={...definition,data:structuredClone(definition.data),setData(values){Object.assign(this.data,values);}};
(async()=>{
 const start=await h.call('runner','startTrip',{data:{category:'parcel',when:'now',duration:10,station:'North gate Cainiao station',dorm:'D01',capacity:3}});
 assert.equal(start.ok,true,start.error);const trip=h.state.trips.find(t=>t.id===start.value.id);
 store.reset();const accountId=h.engine.idFor('customer');
 store.update(s=>{s.language='en';s.profile={...s.profile,...h.accounts[accountId].profile,accountId,onboarded:true};s.publicTrips=[trip];});
 p.onLoad({mode:'request',category:'parcel',tripId:trip.id});
 // a scanned notice or an old choice puts another station on the parcel
 p.setData({room:'2324',name:'zhiyuan',phone:'13800138000',codes:['11-1-9410'],parcelStations:[{point:'翰林兔喜',chosen:true}],pickupPoint:'翰林兔喜',sizeOptions:p.data.sizeOptions.map((size,i)=>({...size,count:i===0?1:0}))});
 p.syncStation();
 assert.equal(p.data.pickupPoint,'North gate Cainiao station','joining a trip uses the trip station');
 assert.deepEqual(p.data.parcelStations.map(x=>x.point),['North gate Cainiao station']);
 const act=orders.act;orders.act=async(action,args)=>{const r=await h.call('customer',action,args);assert.equal(r.ok,true,r.error);return r.value;};
 orders.guestSignIn=async()=>false;
 await p.post();orders.act=act;
 const r=h.state.requests.find(x=>x.offeredTripId===trip.id);
 assert.ok(r,'the parcel joins the trip ('+(global.lastToast||'no toast')+')');
 assert.equal(r.station,'North gate Cainiao station');assert.ok(r.parcelItems.every(x=>x.pickupPoint==='North gate Cainiao station'));
 console.log('parcel trip join uses the trip station');
})().catch(e=>{console.error(e);process.exit(1);});
