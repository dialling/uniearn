const assert=require('node:assert/strict');let def,calls=[],phoneCalls=0,fail=false,confirm=true,resolveConfirm;
global.Page=v=>def=v;global.wx={getStorageSync:()=>null,setStorageSync(){},showToast(){},makePhoneCall(){phoneCalls++;},setNavigationBarTitle(){}};
const orders=require('../utils/orders'),ui=require('../utils/ui');orders.act=async(action,args)=>{if(fail)throw Error('Cloud unavailable');calls.push({action,...args});return{}};orders.upload=async photo=>photo;ui.confirm=async()=>confirm;
require('../pages/order-feedback/index');
const page={...def,id:'r1',data:structuredClone(def.data),setData(v){Object.assign(this.data,v)},refresh(){}};
page.data.request={id:'r1',isMine:true,status:'delivered',category:'takeout',reward:3,runnerId:'t'};page.data.otherPhone='13801026092';
(async()=>{
 await page.contact({currentTarget:{dataset:{channel:'team'}}});assert.equal(page.data.formOpen,true);assert.equal(calls.at(-1).action,'orderFeedbackContact');assert.equal(calls.at(-1).id,'r1');
 page.choose({currentTarget:{dataset:{reason:'Something else'}}});page.input({detail:{value:'ab'}});assert.equal(page.data.canSubmit,false);page.input({detail:{value:'Please check the delivery'}});assert.equal(page.data.canSubmit,true);await page.submit();assert.equal(calls.at(-1).action,'orderFeedbackSubmit');assert.equal(calls.at(-1).note,'Please check the delivery');assert.equal(page.data.formOpen,false);assert.equal(page.data.busy,false);
 fail=true;await page.contact({currentTarget:{dataset:{channel:'phone'}}});assert.equal(phoneCalls,0,'cannot call before the pause request succeeds');assert.match(page.data.error,/Cloud unavailable/);fail=false;await page.contact({currentTarget:{dataset:{channel:'phone'}}});assert.equal(phoneCalls,1);
 page.data.canResolve=true;confirm=false;let count=calls.length;await page.resolve();assert.equal(calls.length,count);assert.equal(page.data.busy,false);
 ui.confirm=()=>new Promise(resolve=>resolveConfirm=resolve);const pending=page.resolve();await page.resolve();assert.equal(page.data.busy,true);resolveConfirm(true);await pending;assert.equal(calls.length,count+1,'resolution cannot be double submitted');assert.equal(calls.at(-1).action,'orderFeedbackResolve');
 console.log('Feedback page: linked order, team form, minimum note, submit reset, cloud-failure call guard, confirmation cancellation and duplicate resolution passed.');
})().catch(e=>{console.error(e);process.exitCode=1});
