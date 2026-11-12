const assert=require('node:assert/strict');let definition,modalCount=0,actions=[],releaseAct;
global.Page=v=>definition=v;global.wx={getStorageSync:()=>null,setStorageSync(){},showToast(){},showModal:()=>{modalCount++;},navigateTo(){},redirectTo(){}};
const store=require('../utils/store'),account=require('../utils/account'),orders=require('../utils/orders');account.requireRunner=async()=>true;
orders.act=async(action,args)=>{actions.push({action,...args});if(releaseAct)await new Promise(resolve=>releaseAct=resolve);return{id:'trip'};};
function page(name){require('../pages/'+name+'/index');return {...definition,data:structuredClone(definition.data),setData(v){Object.assign(this.data,v);}};}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
(async()=>{
 store.update(s=>{s.language='zh';s.profile.accountId='runner';s.requests=[{id:'one',status:'waiting',category:'takeout',reward:3,ownerId:'customer',isMine:false}];});
 const hall=page('jobs');hall.data.language='zh';const event={currentTarget:{dataset:{ids:['one']}}};
 await hall.take(event);
 assert.equal(modalCount,0,'hall take must not show a confirmation modal');
 assert.equal(actions.length,1);assert.equal(actions[0].action,'accept');assert.equal(hall.taking,false);

 releaseAct=true;actions.length=0;
 const first=hall.take(event);await tick();
 assert.equal(hall.taking,true);assert.equal(actions.length,1);
 await hall.take(event);await tick();
 assert.equal(actions.length,1,'duplicate hall taps must not start a second accept');
 const finish=releaseAct;releaseAct=null;finish();
 await first;assert.equal(hall.taking,false);

 const parcels=page('job');parcels.data.parcels=[{key:'one:0',requestId:'one',index:0}];parcels.data.selected={'one:0':true};parcels.data.total=3;
 releaseAct=null;actions.length=0;
 await parcels.accept();
 assert.equal(modalCount,0,'parcel accept must not show a confirmation modal');
 assert.equal(actions.length,1);assert.equal(actions[0].action,'acceptBoxes');assert.equal(parcels.taking,false);

 releaseAct=true;actions.length=0;
 const pending=parcels.accept();await tick();
 assert.equal(parcels.taking,true);assert.equal(actions.length,1);
 await parcels.accept();await tick();
 assert.equal(actions.length,1,'duplicate parcel taps must not start a second accept');
 const done=releaseAct;releaseAct=null;done();
 await pending;assert.equal(parcels.taking,false);
 console.log('Take confirmation removed: hall and parcel accept immediately, with no modal, and duplicate-click guards still hold.');
})().catch(e=>{console.error(e);process.exitCode=1;});
