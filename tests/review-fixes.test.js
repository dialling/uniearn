const assert=require('node:assert/strict');
const e=require('../cloudfunctions/orderService/engine'),d=require('../cloudfunctions/orderService/domain'),f=require('../cloudfunctions/orderService/workflow');
const now=Date.now(),student=e.idFor('student'),runner=e.idFor('runner'),other=e.idFor('other');
const account=(name,phone)=>({profile:{universityId:'xjtlu',campusId:'sip',name,phone},verification:{status:'verified'},runnerRulesAcceptedAt:1});
const accounts={[student]:account('Student','13800000001'),[runner]:account('Runner','13800000002'),[other]:account('Other','13800000003')};
let state=e.initial();
function act(id,action,data={},at=now){const copy=structuredClone(state),out=e.execute(copy,id,accounts[id],{action,...data},at);state=copy;return out;}
const task=(price,extra={})=>({category:'task',title:'Return my library books',price,dueAt:now+3600000,owner:'Student',phone:'13800000001',dorm:'',room:'',...extra});

// Prices: decimal cents are accepted, maximums enforced.
const decimal=act(student,'create',{data:task(4.35)}).id;assert.equal(state.requests.find(r=>r.id===decimal).reward,4.35);
assert.throws(()=>act(student,'create',{data:task(4.355)}),/¥3 to ¥500/);
assert.throws(()=>act(student,'create',{data:task(501)}),/¥3 to ¥500/);
const food={category:'takeout',station:'Gate',dorm:'Dorm 7',room:'412',owner:'Student',phone:'13800000001',bags:1,arrived:true};
assert.throws(()=>act(student,'create',{data:{...food,price:51}}),/¥3–50/);
assert.throws(()=>d.createRequest({nextId:1,requests:[],profile:{}},{category:'parcel',parcelSize:'small',small:1,big:0,codes:['1-1'],pricePerBox:2.333,station:'A',dorm:'B',room:'1',phone:'13800000000'}),/offer/);

// One student cannot fill the shared order document.
for(let i=0;i<9;i++)act(student,'create',{data:task(3)});
assert.throws(()=>act(student,'create',{data:task(3)}),/10 open orders/);
act(other,'create',{data:task(3)});
state.requests.filter(r=>r.ownerId===student).forEach(r=>{r.status='cancelled';});
for(let i=0;i<20;i++){act(student,'create',{data:task(3)});state.requests[0].status='cancelled';}
assert.throws(()=>act(student,'create',{data:task(3)}),/30 orders a day/);
console.log('Order board: decimal prices, price maximums, 10 open orders and 30 posts a day per student passed.');

// Coupon split never makes a part negative, and abandoning restores the original discount.
{
  const s={nextId:1,requests:[],trips:[],profile:{jobsDone:40,onTime:40}};
  const r=d.createRequest({...s,profile:{accountId:'owner'}},{category:'parcel',parcelItems:[{size:'oversized',code:'A'},{size:'small',code:'B'}],station:'A',dorm:'B',room:'1',phone:'13800000000'});
  s.requests=[r];s.nextId=5;r.campusId='sip';r.discount=10;
  const t=d.acceptBoxes(s,[{requestId:r.id,index:1}]);t.phase='collect';
  const extra=s.requests.find(x=>x.splitParentId===r.id);
  assert.ok(f.total(r)>=0&&f.total(extra)>=0,'no negative totals');
  assert.equal(Math.round((r.discount+extra.discount)*100)/100,10,'the discount is not created or lost');
  assert.ok(r.discount<=r.reward+r.serviceFee);
  d.abandonUncollectedTrip(s,t.id);assert.equal(r.discount,10);assert.equal(s.requests.length,1);
  const c={...r,id:'c',status:'waiting',discount:99};s.requests.push(c);d.cancelRequest(s,'c');assert.equal(c.refundAmount,0,'refund never goes negative');
  assert.equal(f.total({reward:3,serviceFee:.5,discount:9}),0);
}
// acceptBoxes uses the same route rules as other accepts.
{
  const base={category:'parcel',parcelItems:[{size:'small',code:'A'}],station:'A',dorm:'B',room:'1',phone:'13800000000'};
  const s={nextId:1,requests:[],trips:[],profile:{accountId:'owner',jobsDone:40,onTime:40}};
  const a=d.createRequest(s,base),b=d.createRequest(s,base);a.campusId=b.campusId='sip';a.destinationKey='x';b.destinationKey='y';
  assert.throws(()=>d.acceptBoxes(s,[{requestId:a.id,index:0},{requestId:b.id,index:0}]),/same route/);
  b.destinationKey='x';b.closesAt=Date.now()-1;assert.throws(()=>d.acceptBoxes(s,[{requestId:b.id,index:0}]),/no longer available/);
  const takeout={...a,id:'t1',category:'takeout'};s.requests.push(takeout);assert.throws(()=>d.acceptBoxes(s,[{requestId:'t1',index:0}]),/no longer available/);
}
console.log('Coupon split caps, abandon restore, refund floor and acceptBoxes route checks passed.');

// Archive keeps runner totals and reward facts while freeing the shared document.
{
  state=e.initial();
  const id=act(student,'create',{data:task(6)}).id;act(runner,'accept',{ids:[id]});
  const photo='cloud://test/order-photos/'+runner+'/'+'a'.repeat(32)+'.jpg';
  act(runner,'taskDone',{id,photo,note:'Books returned.'});act(student,'confirm',{id});
  act(student,'message',{id,text:'Thanks'});
  const before=e.snapshot(state,runner,accounts[runner],now).stats;
  assert.equal(e.archive(state,now+e.ARCHIVE_AFTER-1).length,0,'recent orders stay');
  const removed=e.archive(state,now+e.ARCHIVE_AFTER+60000);
  assert.equal(removed.length,1);assert.equal(state.requests.length,0);assert.equal(state.trips.length,0);assert.equal(Object.keys(state.threads).length,0);
  const after=e.snapshot(state,runner,accounts[runner],now).stats;
  assert.equal(after.jobsDone,before.jobsDone);assert.equal(after.onTime,before.onTime);assert.equal(after.paid,before.paid);
  assert.equal(state.members[student].archivedOrders,1);assert.equal(state.members[student].confirmedMonths.length,1);
  assert.throws(()=>require('../cloudfunctions/orderService/rewards').invite(state,student,runner.slice(0,12)),/before your first order/);
}
console.log('Archive: finished orders leave after 8 days, runner totals, chat cleanup and reward history kept.');

// Client helpers.
{
  const time=require('../utils/china-time'),utc=Date.UTC(2030,0,1,17,5);
  assert.equal(time.dayKey(utc),'2030-01-02');assert.equal(time.dateTime(utc),'2030/1/2 01:05');assert.equal(time.short(utc),'1/2 01:05');assert.equal(time.date(null),'');
  const calls=[];global.wx={navigateTo:o=>calls.push(['to',o.url]),navigateBack:o=>calls.push(['back',o.delta]),redirectTo:o=>calls.push(['redirect',o.url])};
  const nav=require('../utils/nav');let stack=[{route:'pages/request/index',options:{id:'r1'}},{route:'pages/chat/index',options:{id:'r1'}}];global.getCurrentPages=()=>stack;
  nav.navigateTo({url:'/pages/request/index?id=r1'});nav.navigateTo({url:'/pages/request/index?id=r2'});
  stack=Array.from({length:9},(_,i)=>({route:'pages/x'+i+'/index',options:{}}));nav.navigateTo({url:'/pages/request/index?id=r1'});
  assert.deepEqual(calls,[['back',1],['to','/pages/request/index?id=r2'],['redirect','/pages/request/index?id=r1']]);
  delete global.getCurrentPages;
}
(async()=>{
  const removedFiles=[];const hour=3600000,nowSec=Date.now()/1000;
  global.wx={getSavedFileList:o=>o.success({fileList:[{filePath:'old',createTime:nowSec-25*hour/1000,size:100},{filePath:'big1',createTime:nowSec-60,size:4*1024*1024},{filePath:'big2',createTime:nowSec-30,size:4*1024*1024}]}),removeSavedFile:o=>{removedFiles.push(o.filePath);o.complete();}};
  await require('../utils/ui').cleanSaved();assert.deepEqual(removedFiles,['old','big1'],'removes expired files, then the oldest until under the quota');
  console.log('China time display, stack-safe navigation and saved photo cleanup passed.');
})().catch(err=>{console.error(err);process.exitCode=1;});
