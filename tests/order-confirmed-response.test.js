const assert=require('node:assert/strict');
let calls=0,broken=false;
global.wx={getStorageSync(){},setStorageSync(){},showToast(){},cloud:{init(){},async callFunction(){
 calls++;
 return {result:{ok:true,value:{id:'trip-confirmed'},snapshot:{accountId:'student',revision:calls,requests:broken?null:[{id:'r1',status:'taken',isRunner:true,runnerId:'trip-confirmed'}],trips:[],publicTrips:[],stats:{},preferences:{}}}};
}}};
const store=require('../utils/store'),orders=require('../utils/orders'),events=require('../utils/yuni-events');
(async()=>{
 store.reset();store.update(s=>{s.language='zh';});
 events.status=()=>{throw Error('detached notification component');};
 assert.equal((await orders.act('accept',{ids:['r1']})).id,'trip-confirmed');
 assert.equal(calls,1,'confirmed actions are not replayed when notifications throw');
 assert.equal(store.get().pendingOrderOperation,undefined);
 assert.equal(store.get().requests[0].runnerId,'trip-confirmed');
 broken=true;
 assert.equal((await orders.act('accept',{ids:['r2']})).id,'trip-confirmed');
 assert.equal(calls,2,'snapshot rendering failure does not replay a confirmed action');
 assert.equal(store.get().pendingOrderOperation,undefined);
 console.log('Confirmed cloud results remain successful when snapshot rendering or notifications fail.');
})().catch(e=>{console.error(e);process.exitCode=1;});
