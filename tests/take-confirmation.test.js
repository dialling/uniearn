const assert=require('node:assert/strict');let definition,modals=[],answer=true,actions=[],releaseAct;
// 2026-11-14: the user asked for a double check before a runner takes an order, so a mistap cannot accept a job.
global.Page=v=>definition=v;global.wx={getStorageSync:()=>null,setStorageSync(){},showToast(){},showModal:o=>{modals.push(o);o.success&&o.success({confirm:answer});},navigateTo(){},redirectTo(){}};
const store=require('../utils/store'),account=require('../utils/account'),orders=require('../utils/orders');account.requireRunner=async()=>true;
orders.act=async(action,args)=>{actions.push({action,...args});if(releaseAct)await new Promise(resolve=>releaseAct=resolve);return{id:'trip'};};
function page(name){require('../pages/'+name+'/index');return {...definition,data:structuredClone(definition.data),setData(v){Object.assign(this.data,v);}};}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
(async()=>{
 store.update(s=>{s.language='en';s.profile.accountId='runner';s.requests=[{id:'one',status:'waiting',category:'takeout',reward:3,ownerId:'customer',isMine:false}];});
 const hall=page('jobs');hall.data.language='en';const event={currentTarget:{dataset:{ids:['one']}}};

 answer=false;await hall.take(event);
 assert.equal(modals.length,1,'hall take asks for confirmation first');
 assert.match(modals[0].title,/Take this order\?/);assert.match(modals[0].content,/¥3\.00/);
 assert.equal(actions.length,0,'cancelling the confirmation must not accept the order');assert.equal(hall.taking,false);

 answer=true;modals.length=0;await hall.take(event);
 assert.equal(modals.length,1);assert.equal(actions.length,1);assert.equal(actions[0].action,'accept');assert.equal(hall.taking,false);

 releaseAct=true;actions.length=0;modals.length=0;
 const first=hall.take(event);await tick();await tick();
 assert.equal(hall.taking,true);assert.equal(actions.length,1);
 await hall.take(event);await tick();
 assert.equal(actions.length,1,'duplicate hall taps must not start a second accept');assert.equal(modals.length,1,'duplicate taps must not open a second confirmation');
 const finish=releaseAct;releaseAct=null;finish();
 await first;assert.equal(hall.taking,false);

 const parcels=page('job');parcels.data.parcels=[{key:'one:0',requestId:'one',index:0}];parcels.data.selected={'one:0':true};parcels.data.total=3;
 releaseAct=null;actions.length=0;modals.length=0;
 answer=false;await parcels.accept();
 assert.equal(modals.length,1,'parcel accept asks for confirmation first');assert.equal(actions.length,0,'cancelling must not accept parcels');assert.equal(parcels.taking,false);
 answer=true;modals.length=0;await parcels.accept();
 assert.equal(modals.length,1);assert.equal(actions.length,1);assert.equal(actions[0].action,'acceptBoxes');assert.equal(parcels.taking,false);

 releaseAct=true;actions.length=0;
 const pending=parcels.accept();await tick();await tick();
 assert.equal(parcels.taking,true);assert.equal(actions.length,1);
 await parcels.accept();await tick();
 assert.equal(actions.length,1,'duplicate parcel taps must not start a second accept');
 const done=releaseAct;releaseAct=null;done();
 await pending;assert.equal(parcels.taking,false);
 console.log('Take confirmation: hall and parcel accept ask first, cancel takes nothing, and duplicate-click guards still hold.');
})().catch(e=>{console.error(e);process.exitCode=1;});
