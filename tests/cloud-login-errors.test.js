const assert=require('node:assert/strict');
let mode='missing',sequence=0,platform='devtools',definition,navigation;
const notices=[];
global.Page=p=>definition=p;
global.wx={getStorageSync:()=>null,setStorageSync(){},showToast:o=>notices.push(o.title),getDeviceInfo:()=>({platform}),reLaunch:o=>navigation=o.url,
 cloud:{init(){},async callFunction(){
  if(mode!=='ok')throw Error(mode==='missing'?'cloud.callFunction:fail Error: access_token missing (callId: '+(++sequence)+')':'cloud.callFunction:fail network timeout (callId: '+(++sequence)+')');
  return {result:{ok:true,snapshot:{accountId:'student',revision:++sequence,requests:[],trips:[],publicTrips:[],stats:{},preferences:{}}}};
 }}};
const store=require('../utils/store'),orders=require('../utils/orders'),errors=require('../utils/cloud-errors');
(async()=>{
 store.reset();store.update(s=>{s.language='zh';s.profile={...s.profile,onboarded:false,loggedOut:true};});
 await assert.rejects(orders.sync(),/access_token missing/);assert.deepEqual(notices,[],'background sync must not cover the sign-in screen');
 mode='ok';await orders.sync();store.update(s=>{s.profile={...s.profile,onboarded:true,loggedOut:false};s.requests=[{id:'cached',status:'waiting'}];});
 mode='missing';await assert.rejects(orders.sync(),/access_token missing/);await assert.rejects(orders.sync(),/access_token missing/);
 assert.deepEqual(notices,['请先扫码登录微信开发者工具。'],'changing SDK call IDs cannot flood the UI');
 assert.equal(store.get().requests[0].id,'cached','failed sync keeps the existing order cache');
 mode='network';await assert.rejects(orders.sync(),/network timeout/);await assert.rejects(orders.sync(),/network timeout/);
 assert.equal(notices.length,2);assert.equal(notices[1],'订单暂未同步，请稍后重试。');assert(!notices.some(x=>/callId|cloud\.callFunction|access_token/.test(x)));
 mode='ok';await orders.sync();mode='missing';await assert.rejects(orders.sync(),/access_token missing/);assert.equal(notices.length,3,'successful sync resets the error suppression');
 store.update(s=>{s.language='en';});await assert.rejects(orders.sync(),/access_token missing/);assert.match(notices.at(-1),/WeChat DevTools/);
 require('../pages/welcome/index');const page={...definition,data:structuredClone(definition.data),setData(p){Object.assign(this.data,p);}};
 store.update(s=>{s.language='zh';});page.onShow();page.agree();const original=console.error,diagnostics=[];
 try{console.error=(tag,error)=>diagnostics.push(error);await page.enter();assert.match(page.data.error,/扫码登录工具/);assert.equal(page.data.busy,false);assert.equal(navigation,undefined);assert.match(diagnostics[0].message,/access_token missing/);
  mode='network';await page.enter();assert.equal(page.data.error,page.data.copy.retry,'unknown login failures keep the regular localized retry copy');
 }finally{console.error=original;}
 platform='ios';assert(!errors.loginMessage(Error('access_token missing'),'zh','fallback').includes('开发者工具'));
 assert.equal(errors.loginMessage(Error('unrelated'),'en','Try again'),'Try again');
 assert(errors.accessTokenMissing({errMsg:'cloud.callFunction:fail access_token missing'}));
 console.log('Cloud login errors: tool-specific guidance, bilingual safe messages, raw diagnostics retained, call-ID deduplication, sign-in toast suppression, cache preservation and recovery reset passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
