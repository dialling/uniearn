const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const engine=require('../cloudfunctions/orderService/engine');
const rewards=require('../cloudfunctions/orderService/rewards');
const realNow=Date.now;
let now=Date.parse('2030-01-02T18:00:00+08:00');
Date.now=()=>now;
const account={profile:{name:'Student',phone:'13800000000',campusId:'sip',universityId:'xjtlu'},verification:{status:'verified'},runnerRulesAcceptedAt:1};
const owner=engine.idFor('customer'),runner=engine.idFor('runner');
function execute(s,id,action,payload={}){return engine.execute(s,id,account,{action,...payload},now);}
function parcelState(){
 const s=engine.initial();
 const r=execute(s,owner,'create',{couponId:'welcome-two',data:{category:'parcel',owner:'Student',phone:'13800000000',station:'North gate',dorm:'D01',room:'101',parcelItems:[{size:'small',code:'A'},{size:'small',code:'B'},{size:'small',code:'C'}]}});
 return {s,id:r.id,coupon:s.members[owner].coupons.find(c=>c.id==='welcome-two')};
}
function split(s,id,index=0){execute(s,runner,'acceptBoxes',{refs:[{requestId:id,index}]});execute(s,runner,'runnerCancel',{id,reason:'personal'});}
try{
 {
  const {s,id,coupon}=parcelState();split(s,id);
  const remainder=s.requests.find(r=>r.splitParentId===id);
  split(s,remainder.id);
  execute(s,owner,'cancel',{id});
  assert.equal(coupon.usedBy,id,'a waiting sibling keeps the coupon consumed');
  for(const r of s.requests.filter(r=>r.status==='waiting'))execute(s,owner,'cancel',{id:r.id});
  assert.equal(coupon.usedBy,undefined,'all nested split parts cancelled restores the coupon');
  const next=execute(s,owner,'create',{couponId:'welcome-two',data:{category:'takeout',owner:'Student',phone:'13800000000',station:'North gate',dorm:'D01',room:'101',bags:1,price:4,arrived:true}});
  rewards.settle(s,now);
  assert.equal(coupon.usedBy,next.id,'old cancelled splits cannot restore a coupon used by a new order');
 }
 {
  const {s,id,coupon}=parcelState();split(s,id);
  const remainder=s.requests.find(r=>r.splitParentId===id);
  execute(s,runner,'acceptBoxes',{refs:[{requestId:remainder.id,index:0},{requestId:remainder.id,index:1}]});
  execute(s,runner,'pickup',{id:remainder.id,index:0});execute(s,runner,'pickup',{id:remainder.id,index:1});
  execute(s,runner,'deliver',{id:remainder.id,photo:'cloud://test/order-photos/'+runner+'/'+'a'.repeat(32)+'.jpg'});
  execute(s,owner,'confirm',{id:remainder.id});
  execute(s,owner,'cancel',{id});
  assert.equal(coupon.usedBy,id,'completed sibling must keep the coupon consumed');
  assert.equal(coupon.usedByCompleted,true);
 }
 {
  const {s,id,coupon}=parcelState();split(s,id);
  for(const r of s.requests)r.closesAt=now+1000;
  engine.expire(s,now+1001);rewards.settle(s,now+1001);
  assert.equal(coupon.usedBy,undefined,'automatic refunds restore an entirely cancelled split');
 }
 for(const dir of ['../utils','../cloudfunctions/orderService']){
  const d=require(dir+'/domain'),f=require(dir+'/workflow');
  const s={...engine.initial(),profile:{...account.profile,accountId:runner,jobsDone:0,marks:[]}};
  const base={category:'takeout',campusId:'sip',station:'North gate',dorm:'Library',destinationType:'place',phone:'13800000000',owner:'Customer',bags:1,price:3,arrived:true};
  const east=f.createTakeaway(s,{...base,deliveryAddress:'Library east entrance',destinationKey:'east'},now);
  const west=f.createTakeaway(s,{...base,deliveryAddress:'Library west entrance',destinationKey:'west'},now);
  const east2=f.createTakeaway(s,{...base,deliveryAddress:'Library east entrance',destinationKey:'east'},now);
  for(const r of s.requests)r.ownerId=owner;
  const trip={id:'test-trip',campusId:'sip',category:'takeout',station:'North gate',dorm:'Library',capacity:3,requestIds:[]};
  assert.throws(()=>d.assign(s,trip,[east.id,west.id]),/same delivery address/);
  assert.equal(east.status,'waiting','rejected mixed route must not mutate orders');
  const cfg={category:'takeout',station:'North gate',dorm:'Library',capacity:3,when:'now',duration:10};
  const preview=f.previewTrip(s,cfg,now);
  assert.equal(preview.ids.length,2);
  assert.equal(new Set(preview.ids.map(id=>s.requests.find(r=>r.id===id).destinationKey)).size,1);
  const started=f.startTrip(s,cfg,now);
  assert.equal(started.destinationKey,'east');
  assert.deepEqual(new Set(started.requestIds),new Set([east.id,east2.id]));
  const target=Date.parse('2030-01-03T00:10:00+08:00'),late=Date.parse('2030-01-02T23:55:00+08:00');
  const timed=f.createTakeaway(s,{...base,deliveryAddress:'Library east entrance',deliverBy:'00:10',deliverAt:target},late);
  assert.equal(timed.closesAt,target,'absolute delivery target survives midnight');
  assert.throws(()=>f.createTakeaway(s,{...base,deliverBy:'00:10',deliverAt:target},target+1),/future delivery/);
 }
 // Exercise the real page, including its submission payload, with a controllable clock.
 let definition,payload,toast='';
 const state={language:'en',profile:{name:'Student',phone:'13800000000'},deliveredThisWeek:0,selectedCoupon:'',agreements:{}};
 const saved={dorms:[],list:()=>[],dormLabel:x=>x,normalize:x=>({...x,station:'North gate'}),validate:x=>({...x,station:'North gate'}),formatPhone:x=>x,validPhone:()=>true,phoneHint:''};
 const dependencies={
  '../../utils/rewards':{quote:()=>({total:'4.00',coupons:[]})},'../../utils/saved-routes':saved,
  '../../utils/account':{},'../../utils/orders':{upload:async p=>p,act:async(action,args)=>{payload=args;return{id:'new-order'};}},
  '../../utils/store':{get:()=>state,update:fn=>fn(state)},'../../utils/workflow':require('../utils/workflow'),
  '../../utils/ui':{toast:e=>toast=String(e)},'../../utils/post-copy':{postCopy:()=>({}),label:x=>x},
  '../../utils/campus':{areaOfBuilding:()=>({}),floorOfRoom:()=>1,highFloor:()=>false}
 };
 vm.runInNewContext(fs.readFileSync(require.resolve('../pages/takeaway/index.js'),'utf8'),{Date,Page:p=>definition=p,wx:{redirectTo(){}},require:n=>{assert.ok(n in dependencies,n);return dependencies[n];}});
 const p={...definition,data:{...definition.data,zh:false,phone:'13800000000',dorm:'D01',room:'101',firstRoute:false,night:true,price:4}};
 p.setData=v=>Object.assign(p.data,v);
 p.syncArrival();p.totals();
 const chosen=p.data.deliverAt,display=p.data.deliverBy;
 now+=5*60000;p.totals();
 assert.equal(p.data.closeTime,display);assert.equal(p.data.deliverBy,display);
 (async()=>{
  await p.post();assert.equal(payload.data.deliverAt,chosen,'posting keeps the selected timestamp');
  payload=null;now=chosen+1;await p.post();assert.equal(payload,null,'expired delivery time must not submit');assert.match(toast,/passed/);
  p.pickDoor({detail:{},currentTarget:{dataset:{index:p.data.doorIndex}}});
  assert.ok(p.data.deliverAt>now,'tapping the same duration refreshes an expired selection');
  console.log('Review fixes: nested split refunds, coupon reuse, completion, precise-address grouping and fixed delivery timestamps passed.');
 })().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{Date.now=realNow;});
}catch(e){Date.now=realNow;throw e;}
