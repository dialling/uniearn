const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),{harness}=require('./helpers/order-cloud');
const base={station:'Gate',dorm:'D01',room:'101',owner:'Customer',phone:'13801026092'};
(async()=>{
 for(const data of [{...base,category:'parcel',parcelItems:[{size:'small',code:'A'}]},{...base,category:'takeout',arrived:true,bags:1,price:3},{...base,category:'takeout',night:true,shop:'Stall',arrived:true,bags:1,price:4}]){
  const h=harness();let result=await h.call('customer','create',{data});assert.equal(result.ok,true,result.error);const id=result.value.id;
  result=await h.call('customer','raise',{id,amount:1.25});assert.equal(result.ok,true,result.error);assert.equal(h.state.requests.find(r=>r.id===id).raised,1.25);
  result=await h.call('runner','accept',{ids:[id]});assert.equal(result.ok,true,result.error);
  for(const status of ['taken','collected','delivered','confirmed','cancelled','refunded','disputed']){
   h.edit(s=>{const r=s.requests.find(r=>r.id===id);r.status=status;delete r.deliveredAt;});const before=JSON.stringify(h.state);
   result=await h.call('customer','raise',{id,amount:1.25});assert.equal(result.ok,false,data.category+' '+status+' cannot raise');assert.match(result.error,/no longer be increased/);assert.equal(JSON.stringify(h.state),before,'rejected raise is atomic');
  }
  h.edit(s=>s.requests.find(r=>r.id===id).status='taken');result=await h.call('customer','taskTip',{id,amount:2});assert.equal(result.ok,false,'Parcel/takeaway cannot use the task-only tip API');
 }
 const xml=fs.readFileSync(path.join(__dirname,'../pages/request/index.wxml'),'utf8');assert.ok(xml.includes('bindtap="raise"'));assert.ok(xml.includes('bindtap="customRaise"'));assert.ok(xml.includes("request.isMine && request.status==='waiting'"));assert.ok(xml.includes('bindtap="cancel"'));
 let def,posts=0;global.Page=v=>def=v;global.wx={getStorageSync:()=>null,setStorageSync(){},showToast(){}};const orders=require('../utils/orders'),ui=require('../utils/ui');orders.act=async()=>{posts++};ui.confirm=async()=>true;require('../pages/request/index');
 const p={...def,data:structuredClone(def.data),setData(v){Object.assign(this.data,v)}};
 assert.equal(typeof p.raise,'function');assert.equal(typeof p.customRaise,'function');for(const status of ['taken','collected','delivered','confirmed','cancelled','refunded','disputed']){p.data.request={isMine:true,status,reward:3};await p.raise({currentTarget:{dataset:{amount:1}}});p.customRaise();}assert.equal(posts,0,'post-acceptance client calls are blocked');
 console.log('Post-acceptance guard: parcel/takeaway/night-market statuses, backend bypass rejection, atomic prices, waiting-only entry and preset/custom client guards passed.');
})().catch(e=>{console.error(e);process.exitCode=1});
