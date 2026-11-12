const assert=require('node:assert/strict'),fs=require('fs'),path=require('path');let definition,calls=[],confirm=true,finishConfirm;
global.Component=value=>definition=value;global.wx={getStorageSync:()=>null,setStorageSync(){},showToast(){}};
const orders=require('../utils/orders'),ui=require('../utils/ui');orders.act=async(action,args)=>calls.push({action,...args});ui.confirm=async()=>confirm;
require('../components/order-feedback/index');const component={...definition.methods,data:{orderId:'r1',zh:true,resolvable:true,resolving:false},setData(value){Object.assign(this.data,value)}};
(async()=>{
 confirm=false;await component.resolve();assert.equal(calls.length,0);assert.equal(component.data.resolving,false);
 ui.confirm=()=>new Promise(resolve=>finishConfirm=resolve);const pending=component.resolve();await component.resolve();finishConfirm(true);await pending;assert.deepEqual(calls,[{action:'orderFeedbackResolve',id:'r1'}]);assert.equal(component.data.resolving,false);
 component.data.resolvable=false;await component.resolve();assert.equal(calls.length,1,'no action outside a customer dispute');
 component.data.resolvable=true;orders.act=async()=>{throw Error('Order changed')};ui.confirm=async()=>true;await component.resolve();assert.equal(component.data.resolving,false,'a failed request releases the button');
 const root=path.join(__dirname,'..');for(const name of ['request','task']){const xml=fs.readFileSync(path.join(root,'pages/'+name+'/index.wxml'),'utf8');assert.ok(xml.includes('resolvable="{{request.canResolveFeedback}}"'));}
 const xml=fs.readFileSync(path.join(root,'components/order-feedback/index.wxml'),'utf8'),css=fs.readFileSync(path.join(root,'components/order-feedback/index.wxss'),'utf8');assert.ok(xml.includes('问题已解决'));assert.ok(xml.includes('wx:if="{{resolvable}}"'));assert.ok(css.includes('position:fixed')&&css.includes('safe-area-inset-bottom'));
 console.log('Order-detail resolution: customer/dispute visibility, bottom safe area, confirmation cancellation, duplicate taps and failed-request recovery passed.');
})().catch(error=>{console.error(error);process.exitCode=1});
