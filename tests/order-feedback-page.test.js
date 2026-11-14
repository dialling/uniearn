const assert=require('node:assert/strict');let def,calls=[],phoneCalls=0,fail=false,confirm=true,resolveConfirm;
global.Page=v=>def=v;global.wx={getStorageSync:()=>null,setStorageSync(){},showToast(){},makePhoneCall(){phoneCalls++;},setNavigationBarTitle(){}};
const orders=require('../utils/orders'),ui=require('../utils/ui');orders.act=async(action,args)=>{if(fail)throw Error('Cloud unavailable');calls.push({action,...args});return{}};orders.upload=async photo=>photo;ui.confirm=async()=>confirm;
require('../pages/order-feedback/index');
const page={...def,id:'r1',data:structuredClone(def.data),setData(v){Object.assign(this.data,v)},refresh(){}};
page.data.request={id:'r1',isMine:true,status:'delivered',category:'takeout',reward:3,runnerId:'t'};page.data.otherPhone='13801026092';
(async()=>{
 // 2026-11-14: the page is a chat with the Uniearn team: an optional reason chip plus a message of at least one character.
 page.data.reasons=[{id:'Not received',photo:false},{id:'Spilled or damaged',photo:true}];
 page.choose({currentTarget:{dataset:{reason:'Spilled or damaged'}}});assert.equal(page.data.reason,'Spilled or damaged');assert.equal(page.data.photoRequired,true);
 page.input({detail:{value:'Leaked'}});assert.equal(page.data.canSubmit,true);let count=calls.length;await page.submit();assert.equal(calls.length,count,'a photo reason cannot be sent without a photo');
 page.data.reason='';page.data.photoRequired=false;page.validate();assert.equal(page.data.canSubmit,false,'the first message needs a problem picked');page.choose({currentTarget:{dataset:{reason:'Not received'}}});assert.equal(page.data.reason,'Not received');assert.equal(page.data.photoRequired,false);
 page.input({detail:{value:'   '}});assert.equal(page.data.canSubmit,false);page.input({detail:{value:'Hi'}});assert.equal(page.data.canSubmit,true);
 await page.submit();assert.equal(calls.at(-1).action,'orderFeedbackSubmit');assert.equal(calls.at(-1).note,'Hi');assert.equal(calls.at(-1).reason,'Not received');assert.equal(page.data.note,'');assert.equal(page.data.busy,false);
 page.data.sentAny=true;page.input({detail:{value:'Any update?'}});assert.equal(page.data.canSubmit,true,'after the first message, later messages need no problem');
 fail=true;page.input({detail:{value:'Second try'}});await page.submit();assert.match(page.data.error,/Cloud unavailable/);assert.equal(page.data.note,'Second try','a failed send keeps the message');fail=false;
 page.data.canResolve=true;confirm=false;count=calls.length;await page.resolve();assert.equal(calls.length,count);assert.equal(page.data.busy,false);
 ui.confirm=()=>new Promise(resolve=>resolveConfirm=resolve);const pending=page.resolve();await page.resolve();assert.equal(page.data.busy,true);resolveConfirm(true);await pending;assert.equal(calls.length,count+1,'resolution cannot be double submitted');assert.equal(calls.at(-1).action,'orderFeedbackResolve');
 console.log('Feedback chat: problem first, photo rule, one-character messages, send reset, failed-send recovery, confirmation cancellation and duplicate resolution passed.');
})().catch(e=>{console.error(e);process.exitCode=1});
