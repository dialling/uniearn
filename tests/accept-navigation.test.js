const assert=require('node:assert/strict');
const {harness}=require('./helpers/order-cloud');
const {publicAccount}=require('../cloudfunctions/studentAccount/handler');
const clientContact=require('../utils/runner-contact'),serverContact=require('../cloudfunctions/orderService/runner-contact');
const h=harness(),id=h.engine.idFor;let definition,navigations=[],acceptCalls=0,legacyStatus=false;
const actor=id('runner'),runner=h.accounts[actor];
runner.profile={...runner.profile,name:'',phone:''};runner.verification={status:'verified',studentName:'Private Real Name',phone:'13800001111',gender:'female'};
h.user='runner';
global.Page=value=>definition=value;
global.wx={getStorageSync:()=>null,setStorageSync(){},showToast(){},showModal:()=>{throw Error('Accepting a job must not show a confirmation modal.');},navigateTo:options=>navigations.push(options.url),redirectTo:options=>navigations.push(options.url),reLaunch:options=>navigations.push(options.url),cloud:{init(){},async callFunction({name,data}){
 if(name==='studentAccount'){const a=publicAccount(h.accounts[id(h.user)],id(h.user));if(legacyStatus)delete a.verification.phone;return{result:{ok:true,account:a}};}
 assert.equal(name,'orderService');if(data.action==='accept')acceptCalls++;return{result:await h.client(data)};
}}};
const store=require('../utils/store'),orders=require('../utils/orders'),account=require('../utils/account');
store.update(s=>{s.profile={...runner.profile,accountId:actor,onboarded:true,studentVerified:true,runnerRulesAccepted:true};s.language='zh';s.agreements={terms:true};});
function page(name,options={}) {delete require.cache[require.resolve('../pages/'+name+'/index')];require('../pages/'+name+'/index');const page={...definition,data:structuredClone(definition.data),setData(patch){Object.assign(this.data,patch);}};if(page.onLoad)page.onLoad(options);return page;}
const food={category:'takeout',owner:'Customer',phone:'13801026092',station:'North gate',dorm:'Dorm 7',room:'412',bags:1,price:3,arrived:true};
(async()=>{
 for(const sample of [{profile:{name:'Display',phone:'138 0000 0000'},verification:{status:'verified',phone:'13900000000'}},{profile:{name:'Legacy',phone:'138 0000 0000'},verification:{status:'verified'}},{profile:{},verification:{status:'pending',phone:'13900000000'}}])assert.deepEqual(clientContact(sample),serverContact(sample),'client/server contact precedence matches');
 legacyStatus=true; // Reproduce an older deployed status response without verification.phone.
 const posted=await h.call('customer','create',{data:food});assert.equal(posted.ok,true,posted.error);await orders.sync();
 const jobs=page('jobs');jobs.refresh();await jobs.take({currentTarget:{dataset:{ids:[posted.value.id]}}});
 assert.equal(acceptCalls,1,'reviewed applicant can actually accept with an empty general profile');
 assert.equal(navigations.length,1);assert.equal(navigations[0],'/pages/trip/index?id='+h.state.trips[0].id,'acceptance opens the newly created trip');assert.ok(!navigations.includes('/pages/profile/index'));
 legacyStatus=false;
 assert.equal(h.state.trips[0].runnerPhone,'13800001111');assert.equal(h.state.trips[0].runnerName,'Runner','private application name is never published as a display name');
 const trip=page('trip',{id:h.state.trips[0].id});trip.refresh();assert.equal(trip.data.requests.length,1);assert.equal(trip.data.requests[0].id,posted.value.id);assert.equal(trip.data.requests[0].phone,food.phone);
 // Starting a trip and selecting parcel items use the same reviewed contact on the server.
 const start=await h.call('runner','startTrip',{data:{category:'takeout',when:'now',duration:10,station:'Other gate',dorm:'Dorm 7',capacity:1}});assert.equal(start.ok,true,start.error);assert.equal(h.state.trips.find(t=>t.id===start.value.id).runnerPhone,'13800001111');
 const parcel=await h.call('customer','create',{data:{...food,category:'parcel',parcelItems:[{size:'small',code:'11-1-1111'}]}});assert.equal(parcel.ok,true,parcel.error);const boxes=await h.call('runner','acceptBoxes',{refs:[{requestId:parcel.value.id,index:0}]});assert.equal(boxes.ok,true,boxes.error);assert.equal(h.state.trips.find(t=>t.id===boxes.value.id).runnerPhone,'13800001111');
 navigations=[];runner.verification.status='pending';assert.equal(await account.requireRunner(),false);assert.deepEqual(navigations,['/pages/student-check/index'],'unapproved applicants still complete the review flow');
 navigations=[];runner.verification.status='verified';runner.runnerRulesAcceptedAt=0;assert.equal(await account.requireRunner(),false);assert.deepEqual(navigations,['/pages/student-check/index']);
 navigations=[];runner.runnerRulesAcceptedAt=1;runner.verification.phone='';runner.profile.phone='138 0000 0000';assert.equal(await account.requireRunner(),true);assert.deepEqual(navigations,[],'older reviewed profiles still work with normalized phone');
 runner.profile.phone='';runner.verification.phone='';navigations=[];assert.equal(await account.requireRunner(),true);assert.deepEqual(navigations,[],'the acceptance endpoint owns contact validation; no silent redirect to Me');
 const noContact=await h.call('customer','create',{data:food});assert.equal(noContact.ok,true,noContact.error);await orders.sync();navigations=[];await jobs.take({currentTarget:{dataset:{ids:[noContact.value.id]}}});assert.equal(h.state.requests.find(r=>r.id===noContact.value.id).status,'taken','approved runner is not rejected for missing legacy contact');assert.match(navigations.at(-1),/pages\/trip\/index/);
 runner.verification.status='unverified';const blocked=await h.call('runner','startTrip',{data:{category:'takeout',when:'now',duration:10,station:'Other gate',dorm:'Dorm 7',capacity:1}});assert.equal(blocked.ok,false);assert.match(blocked.error,/student check/);runner.verification.status='verified';
 runner.loggedOut=true;navigations=[];assert.equal(await account.requireRunner(),false);assert.deepEqual(navigations,['/pages/welcome/index']);
 console.log('Acceptance navigation: actual approval guard → cloud accept → new trip details, reviewed phone fallback, private real name, parcel/start-trip parity, legacy profiles, review/rules and logout gates passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
