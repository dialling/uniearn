// 2026-11-16: a task for a closed trip can still be posted; it goes to the job board instead of the trip.
const assert=require('node:assert/strict');let def,navigation;
global.Page=x=>def=x;global.wx={getStorageSync:()=>null,setStorageSync(){},navigateTo:x=>navigation=x.url,redirectTo:x=>navigation=x.url,showToast(){},showModal:o=>o.success({confirm:true})};
const store=require('../utils/store'),orders=require('../utils/orders');
store.reset();
store.update(s=>{s.language='en';s.profile={...s.profile,name:'Kevin',onboarded:true,phone:'13801026092'};s.publicTrips=[{id:'t9',category:'other',phase:'collect',cancelled:false,joinUntil:Date.now()-60000,capacity:5,remaining:5,station:'Restaurant',dorm:'D01'}];});
require('../pages/task-post/index');
const p={...def,data:structuredClone(def.data),setData(v,cb){Object.assign(this.data,v);if(typeof cb==='function')cb();}};
p.onLoad({tripId:'t9'});
p.text({currentTarget:{dataset:{field:'title'}},detail:{value:'Help me return a book'}});
assert.equal(p.data.tripReady,false);
assert.match(p.data.tripError,/job board/);
assert.equal(p.data.postLabel,'Post to job board · ¥3.00');
let sent;const act=orders.act;orders.act=async(action,args)=>{sent={action,args};return {id:'r1'};};
(async()=>{
 await p.post();orders.act=act;
 assert.equal(sent.action,'create');
 assert.equal(sent.args.tripId,undefined,'a closed trip is not joined');
 assert.equal(sent.args.data.title,'Help me return a book');
 assert.match(navigation,/pages\/task\/index/);
 // an open trip still joins
 store.update(s=>{s.publicTrips[0].joinUntil=Date.now()+600000;});p.refreshTrip();
 assert.equal(p.data.postLabel,'Join trip · ¥3.00');
 orders.act=async(action,args)=>{sent={action,args};return {id:'r2'};};await p.post();orders.act=act;
 assert.equal(sent.args.tripId,'t9');
 console.log('closed trip: task goes to the job board');
})().catch(e=>{console.error(e);process.exit(1);});
