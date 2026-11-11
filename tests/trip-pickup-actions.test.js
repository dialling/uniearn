const assert=require('node:assert/strict'),{harness}=require('./helpers/order-cloud');
const h=harness();h.user='runner';let definition,confirm=true,actions=[],notices=[];
global.Page=x=>definition=x;
global.wx={getStorageSync:()=>null,setStorageSync(){},showToast:x=>notices.push(x.title),showModal:x=>x.success({confirm}),cloud:{init(){},async callFunction({data}){actions.push(data.action);return {result:await h.client(data)};}}};
const store=require('../utils/store'),orders=require('../utils/orders');
store.reset();store.update(s=>{s.language='zh';s.profile={...s.profile,accountId:h.engine.idFor('runner'),onboarded:true,campusId:'sip',studentVerified:true};});
require('../pages/trip/index');
function page(id){const p={...definition,data:structuredClone(definition.data),setData(x){Object.assign(this.data,x);}};p.onLoad({id});p.refresh();return p;}
const tap=id=>({currentTarget:{dataset:{id}}});
const food={category:'takeout',station:'North gate',pickupPoint:'文缘夜市门口外卖柜',dorm:'D01',room:'1111',owner:'Customer',phone:'13801026092',bags:1,price:3,arrived:true};
async function create(data=food){const r=await h.call('customer','create',{data});assert.equal(r.ok,true,r.error);return r.value.id;}
async function accept(ids){const r=await h.call('runner','accept',{ids});assert.equal(r.ok,true,r.error);await orders.sync();actions=[];return page(r.value.id);}
(async()=>{
 const id=await create({...food,bags:2}),p=await accept([id]);
 await Promise.all([p.collectAndDeliver(tap(id)),p.collectAndDeliver(tap(id))]);
 assert.deepEqual(actions,['pickup'],'one tap collects the whole food order; duplicate taps are blocked');
 assert.equal(p.data.requests[0].status,'collected');assert.equal(p.data.requests[0].collected.length,2);
 assert.equal(p.data.trip.phase,'deliver','single-order pickup proceeds to delivery without another modal');
 assert.equal(p.data.collectingId,'');assert.equal(p.data.requests[0].runnerPoints>0,true);
 const a=await create(),b=await create(),multi=await accept([a,b]);
 await multi.collectAndDeliver(tap(a));assert.equal(multi.data.trip.phase,'collect');
 assert.equal(multi.data.requests.find(r=>r.id===b).status,'taken','one order cannot mark another as picked up');
 assert.equal(multi.data.allCollected,false);assert.match(notices.at(-1),/其余订单/);
 await multi.collectAndDeliver(tap(b));assert.equal(multi.data.trip.phase,'deliver');
 // An older server may leave a fully collected trip in collect phase.
 h.edit(s=>s.trips.find(t=>t.id===multi.id).phase='collect');await orders.sync();actions=[];
 await multi.collectAndDeliver(tap(a));assert.deepEqual(actions,['leave'],'retry does not repeat successful pickup');
 assert.equal(multi.data.trip.phase,'deliver');
 const c=await create(),cancel=await accept([c]);cancel.cancel(tap(c));assert.equal(cancel.data.cancellingRequest.id,c);
 cancel.chooseReason({currentTarget:{dataset:{value:'quantity'}}});confirm=false;
 await cancel.submitCancel();assert.equal(store.get().requests.find(r=>r.id===c).status,'taken');assert.equal(cancel.data.cancelBusy,false);
 confirm=true;await Promise.all([cancel.submitCancel(),cancel.submitCancel()]);
 assert.equal(actions.filter(x=>x==='runnerCancel').length,1);
 assert.equal(h.state.requests.find(r=>r.id===c).status,'waiting');assert.equal(cancel.data.cancellingRequest,null);
 const d=await create(),retry=await accept([d]),original=orders.act;
 orders.act=async()=>{throw Error('Network interrupted');};await retry.collectAndDeliver(tap(d));
 assert.equal(retry.data.collectingId,'');assert.equal(retry.data.requests[0].status,'taken');
 orders.act=original;await retry.collectAndDeliver(tap(d));assert.equal(retry.data.trip.phase,'deliver');
 actions=[];await retry.collectAndDeliver(tap('not-in-trip'));assert.deepEqual(actions,[],'stale or unrelated card cannot mutate an order');
 const parcel={category:'parcel',station:'North gate',dorm:'D01',room:'1111',owner:'Customer',phone:'13801026092',parcelItems:[{size:'small',code:'5555'}]};
 const one=await create({...parcel}),parcelPage=await accept([one]),tapBox=(id,index)=>({currentTarget:{dataset:{id,index}}});
 await parcelPage.collect(tapBox(one,0));
 assert.equal(parcelPage.data.trip.phase,'deliver','last parcel pickup goes to delivery without a bottom button');
 assert.equal(parcelPage.data.requests[0].status,'collected');
 const twoItems={...parcel,parcelItems:[{size:'small',code:'A-1'},{size:'small',code:'A-2'}]};
 const two=await create(twoItems),boxes=await accept([two]);
 await boxes.collect(tapBox(two,0));assert.equal(boxes.data.trip.phase,'collect','first box stays in collect');
 await boxes.collect(tapBox(two,1));assert.equal(boxes.data.trip.phase,'deliver','taking the last box proceeds to delivery');
 const xml=require('fs').readFileSync(require.resolve('../pages/trip/index.wxml'),'utf8');
 assert.doesNotMatch(xml,/去送达 →|Go deliver →/);
 assert.doesNotMatch(xml,/bindtap="leave"/);
 console.log('Trip pickup actions: one-step food pickup/delivery, multi-order guards, retries, duplicate taps, cancellation and parcel auto-deliver passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
