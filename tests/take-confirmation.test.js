const assert=require('node:assert/strict');let definition,modal,modalCount=0,actions=[];
global.Page=v=>definition=v;global.wx={getStorageSync:()=>null,setStorageSync(){},showToast(){},showModal:o=>{modal=o;modalCount++;},navigateTo(){},redirectTo(){}};
const store=require('../utils/store'),account=require('../utils/account'),orders=require('../utils/orders');account.requireRunner=async()=>true;orders.act=async(action,args)=>{actions.push({action,...args});return{id:'trip'};};
function page(name){require('../pages/'+name+'/index');return {...definition,data:structuredClone(definition.data),setData(v){Object.assign(this.data,v);}};}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
(async()=>{
 store.update(s=>{s.language='zh';s.profile.accountId='runner';s.requests=[{id:'one',status:'waiting',category:'takeout',reward:3,ownerId:'customer',isMine:false}];});
 const hall=page('jobs');hall.data.language='zh';const event={currentTarget:{dataset:{ids:['one']}}};
 const cancel=hall.take(event);await tick();assert.equal(actions.length,0);assert.equal(modal.title,'确定接单吗？');modal.success({confirm:false});await cancel;assert.equal(actions.length,0);assert.equal(hall.taking,false);
 store.update(s=>s.language='en');const accept=hall.take(event);await tick();const before=modalCount;await hall.take(event);assert.equal(modalCount,before);assert.equal(actions.length,0);assert.equal(modal.confirmText,'Take job');modal.success({confirm:true});await accept;assert.equal(actions.length,1);assert.equal(actions[0].action,'accept');assert.equal(hall.taking,false);
 const parcels=page('job');parcels.data.parcels=[{key:'one:0',requestId:'one',index:0}];parcels.data.selected={'one:0':true};parcels.data.total=3;
 const rejected=parcels.accept();await tick();modal.success({confirm:false});await rejected;assert.equal(actions.length,1);
 const approved=parcels.accept();await tick();const count=modalCount;await parcels.accept();assert.equal(modalCount,count);modal.success({confirm:true});await approved;assert.equal(actions.length,2);assert.equal(actions[1].action,'acceptBoxes');assert.equal(parcels.taking,false);
 console.log('Take confirmation: bilingual prompts, cancellation without mutation, explicit acceptance and duplicate-click guards passed for hall and parcel selection.');
})().catch(e=>{console.error(e);process.exitCode=1;});
