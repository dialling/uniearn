const assert=require('node:assert/strict');
for(const base of ['../utils/','../cloudfunctions/orderService/']){
 const d=require(base+'domain'),rank=require(base+'runner-level');
 for(const jobsDone of [0,15,40]){
  assert.equal(rank.level({jobsDone}).limit,Infinity);
  for(const action of ['acceptJob','acceptBoxes']){
   const s=d.initial();s.profile.jobsDone=jobsDone;s.requests.filter(r=>['r1','r2'].includes(r.id)).forEach(r=>r.reward=100);
   const t=action==='acceptJob'?d.acceptJob(s,['r1','r2']):d.acceptBoxes(s,[{requestId:'r1',index:0},{requestId:'r2',index:0}]);
   assert.equal(t.requestIds.length,2);assert.ok(t.requestIds.reduce((n,id)=>n+s.requests.find(r=>r.id===id).reward,0)>25);
  }
 }
 assert.equal(rank.level({marks:Array(5).fill({at:Date.now()})}).paused,true,'conduct suspension still applies');
}
const {harness}=require('./helpers/order-cloud');
(async()=>{const h=harness();const created=await h.call('customer','create',{data:{category:'task',title:'Help return these library books',price:100}});assert.equal(created.ok,true,created.error);const accepted=await h.call('runner','accept',{ids:[created.value.id]});assert.equal(accepted.ok,true,accepted.error);console.log('Runner amounts: all ranks accept high-value whole orders, individual parcels and tasks; conduct suspension retained.');})().catch(e=>{console.error(e);process.exitCode=1;});
