const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const engine=require('../cloudfunctions/orderService/engine');
const MIN=60000,now=Date.parse('2030-01-02T18:00:00+08:00');
const base={station:'North gate',dorm:'D01',room:'101',owner:'Student',phone:'13801026092',bags:1,price:3};
for(const prefix of ['../utils/','../cloudfunctions/orderService/']){
 const workflow=require(prefix+'workflow'),domain=require(prefix+'domain');
 const state=()=>{const s=domain.initial();s.requests=[];return s;};
 for(const minutes of [10,30,60]){
  const s=state(),target=now+minutes*MIN;
  const order=workflow.createTakeaway(s,{...base,arrived:true,deliverAt:target,deliverBy:workflow.clock(target)},now);
  assert.equal(order.deliverBy,workflow.clock(target));
  assert.equal(order.closesAt,order.createdAt+30*MIN);
  engine.expire(s,now+30*MIN-1);assert.equal(order.status,'waiting');
  engine.expire(s,now+30*MIN);assert.equal(order.status,'refunded');assert.equal(order.refundAmount,workflow.total(order));
 }
 for(const time of ['18:10','19:15','23:55']){
  const s=state(),order=workflow.createTakeaway(s,{...base,arrived:false,arrivalTime:time},now);
  const deadline=workflow.todayAt(time,now)+30*MIN;
  assert.equal(order.closesAt,deadline);assert.equal(order.deadline,workflow.clock(deadline));
  engine.expire(s,deadline-1);assert.equal(order.status,'waiting');
  engine.expire(s,deadline);assert.equal(order.status,'refunded');
 }
 const s=state(),taken=workflow.createTakeaway(s,{...base,arrived:true},now);taken.status='taken';
 engine.expire(s,now+31*MIN);assert.equal(taken.status,'taken','accepted jobs do not auto-cancel');
}
// Render the Yuni row in both languages to verify the displayed timing contract.
const template=fs.readFileSync(require.resolve('../pages/takeaway/index.wxml'),'utf8');
const hint=template.slice(template.indexOf('<view wx:if="{{closeTime}}" class="arrival-close arrival-note">')).split('</view>')[0];
function render(data){return hint.replace(/\{\{(.*?)\}\}/gs,(_,expression)=>String(vm.runInNewContext(expression,data)));}
assert.doesNotMatch(template,/bindtap="pickDoor"|doorChips|期待送达时间/);
for(const zh of [true,false]){
 const arrived=render({zh,arrived:true,night:false,purchaseStatus:'ordered',closeTime:'18:30'});
 assert.match(arrived,/18:30/);assert.doesNotMatch(arrived,/30 min after posting|下单 30 分钟后/);
 const later=render({zh,arrived:false,night:false,purchaseStatus:'ordered',closeTime:'19:45'});
 assert.match(later,/19:45/);assert.doesNotMatch(later,/30 min after posting|下单 30 分钟后/);
}
console.log('Takeaway cancellation: local/cloud deadline parity, 30-minute boundary refunds, ETA plus 30 across midnight, accepted-order exclusion and bilingual Yuni hints passed.');
