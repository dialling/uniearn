const assert=require('node:assert/strict'),{harness}=require('./helpers/order-cloud'),h=harness(),notices=[];
global.wx={getStorageSync:()=>null,setStorageSync(){},showToast:x=>notices.push(x.title),cloud:{init(){},async callFunction({data}){return {result:await h.client(data)};}}};
const store=require('../utils/store'),orders=require('../utils/orders');store.reset();
store.update(s=>{s.language='zh';s.yuniTips=false;s.profile={...s.profile,...h.accounts[h.engine.idFor('customer')].profile,accountId:h.engine.idFor('customer'),onboarded:true};});
(async()=>{
 const created=await h.call('customer','create',{data:{category:'takeout',station:'North gate',dorm:'D01',room:'1111',owner:'Student',phone:'13801026092',bags:1,price:3,arrived:true}});assert.equal(created.ok,true,created.error);
 await orders.sync();notices.length=0;
 assert.equal((await h.call('runner','accept',{ids:[created.value.id]})).ok,true);await orders.sync();
 assert.equal(notices.includes('订单进度已更新，请查看我的订单。'),true,'turning animations off retains plain order progress notifications');
 assert.equal(store.get().requests.find(r=>r.id===created.value.id).status,'taken');
 await orders.act('preferences',{values:{orderUpdates:false}});notices.length=0;
 assert.equal((await h.call('runner','pickup',{id:created.value.id})).ok,true);await orders.sync();assert.deepEqual(notices,[],'the separate order notification switch still controls progress reminders');
 console.log('Motion-off mode keeps plain order updates and respects the separate order notification preference');
})().catch(e=>{console.error(e);process.exitCode=1;});
