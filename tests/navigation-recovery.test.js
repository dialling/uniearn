const assert=require('node:assert/strict');
let stack=[{route:'pages/jobs/index',options:{}}],definition;
global.Page=v=>definition=v;global.getCurrentPages=()=>stack;
const calls=[],callbackCalls=[];
global.wx={getStorageSync(){},setStorageSync(){},showToast(){},reLaunch:o=>calls.push({kind:'root',o}),redirectTo:o=>calls.push({kind:'redirect',o}),navigateTo:o=>calls.push({kind:'detail',o}),navigateBack:o=>calls.push({kind:'back',o})};
const nav=require('../utils/nav'),settle=()=>Promise.resolve();
(async()=>{
 nav.reLaunch({url:'/pages/profile/index',success:()=>callbackCalls.push('ok'),fail:()=>callbackCalls.push('fail'),complete:()=>callbackCalls.push('complete')});
 const primary=calls.at(-1).o;primary.fail({errMsg:'reLaunch:fail WebView timeout'});assert.equal(calls.at(-1).kind,'redirect');assert.deepEqual(callbackCalls,[],'no failure toast before recovery');primary.complete({errMsg:'reLaunch:fail WebView timeout'});assert.equal(calls.length,2);
 const fallback=calls.at(-1).o;stack=[{route:'pages/profile/index',options:{}}];fallback.success({errMsg:'redirectTo:ok'});fallback.complete({errMsg:'redirectTo:ok'});assert.deepEqual(callbackCalls,['ok','complete'],'callbacks delivered once');nav.pageReady(stack[0]);
 nav.reLaunch({url:'/pages/requests/index',fail:()=>callbackCalls.push('final')});calls.at(-1).o.fail({errMsg:'reLaunch:fail native failure'});calls.at(-1).o.fail({errMsg:'redirectTo:fail native failure'});assert.equal(callbackCalls.filter(x=>x==='final').length,1);nav.reLaunch({url:'/pages/jobs/index'});assert.equal(calls.at(-1).kind,'root');stack=[{route:'pages/jobs/index',options:{}}];nav.pageReady(stack[0]);
 const count=calls.length;nav.reLaunch({url:'/pages/missing/index',fail:()=>callbackCalls.push('missing')});calls.at(-1).o.fail({errMsg:'reLaunch:fail page not found'});assert.equal(calls.length,count+1,'invalid routes do not trigger a blind retry');assert.equal(callbackCalls.at(-1),'missing');
 nav.navigateTo({url:'/pages/trip/index?id=t'});calls.at(-1).o.fail({errMsg:'navigateTo:fail page stack limit'});assert.equal(calls.at(-1).kind,'redirect');assert.equal(calls.at(-1).o.url,'/pages/trip/index?id=t');calls.at(-1).o.success({errMsg:'redirectTo:ok'});
 // Reproduce Take during a bottom-tab transition: accept once, then open that exact trip.
 const store=require('../utils/store'),orders=require('../utils/orders'),account=require('../utils/account');account.requireRunner=async()=>true;const confirmation=require.resolve('../utils/accept-confirm');require.cache[confirmation]={id:confirmation,filename:confirmation,loaded:true,exports:async()=>true};
 let accepts=0;orders.act=async(action,payload)=>{assert.equal(action,'accept');assert.deepEqual(payload.ids,['order']);accepts++;return{id:'accepted-trip'}};
 store.reset();store.update(s=>{s.profile={...s.profile,accountId:'runner'};s.requests=[{id:'order',category:'takeout',status:'waiting',reward:3,isMine:false,small:1,big:0}];});require('../pages/jobs/index');const jobs={...definition,data:structuredClone(definition.data),setData(v){Object.assign(this.data,v)}};
 nav.reLaunch({url:'/pages/requests/index'});const before=calls.length;await jobs.take({currentTarget:{dataset:{ids:['order']}}});assert.equal(accepts,1);assert.equal(calls.length,before,'trip waits for tab readiness instead of overlapping');stack=[{route:'pages/requests/index',options:{}}];nav.pageReady(stack[0]);await settle();assert.equal(calls.at(-1).o.url,'/pages/trip/index?id=accepted-trip');assert.equal(accepts,1,'navigation recovery must never resubmit acceptance');assert.equal(jobs.taking,false);
 // Keep the final tab intent when tabs are tapped quickly.
 nav.reLaunch({url:'/pages/profile/index'});nav.reLaunch({url:'/pages/rewards/index'});nav.reLaunch({url:'/pages/jobs/index'});const length=calls.length;stack=[{route:'pages/profile/index',options:{}}];nav.pageReady(stack[0]);await settle();assert.equal(calls.length,length+1);assert.equal(calls.at(-1).o.url,'/pages/jobs/index');stack=[{route:'pages/jobs/index',options:{}}];nav.pageReady(stack[0]);
 console.log('Navigation recovery: native root/detail fallback, one final callback, hard-route errors, failed-lock release, queued Take without duplicate acceptance and final tab intent passed.');
})().catch(e=>{console.error(e);process.exitCode=1});
