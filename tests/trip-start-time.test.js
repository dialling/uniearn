const assert=require('node:assert/strict');
const noon=Date.parse('2030-01-02T12:00:00+08:00'),late=Date.parse('2030-01-02T23:30:00+08:00');
const cfg={category:'takeout',when:'later',time:'18:30',station:'Gate',dorm:'D01',capacity:5,requestIds:[]};
for(const base of ['../utils/','../cloudfunctions/orderService/']){
 const f=require(base+'workflow'),d=require(base+'domain');
 for(const duration of [0,31,'',10]){const p=f.previewTrip(d.initial(),{...cfg,duration},noon);assert.equal(p.trip.departAt,f.todayAt('18:30',noon));}
 for(const duration of [0,31])assert.throws(()=>f.previewTrip(d.initial(),{...cfg,when:'now',duration},noon),/duration/);
 assert.throws(()=>f.previewTrip(d.initial(),{...cfg,time:'12:10'},noon),/10 minutes/);
}
let definition,posts=0;global.Page=v=>definition=v;global.wx={getStorageSync:()=>null,setStorageSync(){},showToast(){},redirectTo(){}};
const store=require('../utils/store'),orders=require('../utils/orders'),account=require('../utils/account');require('../pages/trip-start/index');
store.update(s=>{s.language='zh';s.profile={...s.profile,campusId:'sip',dorm:'D01',studentVerified:true,runnerRulesAccepted:true};s.requests=[];});
function page(){return {...definition,data:structuredClone(definition.data),setData(v){Object.assign(this.data,v);}};}
const originalNow=Date.now;Date.now=()=>late;const night=page();night.onLoad();assert.equal(night.data.time,'23:59');night.select({currentTarget:{dataset:{field:'when',value:'later'}}});assert.equal(night.data.error,'');
Date.now=()=>noon;const form=page();form.onLoad();form.setCustomDuration({detail:{value:''}});assert.ok(form.data.error);form.select({currentTarget:{dataset:{field:'when',value:'later'}}});assert.equal(form.data.error,'');
account.requireRunner=async()=>true;orders.act=async()=>{posts++;return{id:'trip'};};orders.sync=async()=>{};
(async()=>{
 form.setData({error:'old preview error'});await form.start();assert.equal(posts,1,'valid current data clears stale error');
 const stale=page();stale.onLoad();stale.select({currentTarget:{dataset:{field:'when',value:'later'}}});stale.text({currentTarget:{dataset:{field:'time'}},detail:{value:'12:11'}});assert.equal(stale.data.error,'');Date.now=()=>noon+2*60000;await stale.start();assert.equal(posts,1,'expired departure is rejected before sending');assert.equal(stale.data.starting,false);
 Date.now=originalNow;console.log('Start trip: hidden duration, midnight default, stale preview recovery and current-time submission validation passed.');
})().catch(e=>{Date.now=originalNow;console.error(e);process.exitCode=1;});
