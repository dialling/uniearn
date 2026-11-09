const assert=require('node:assert/strict'),fs=require('node:fs');
let pageDef,hookDef,syncCalls=0,opened=false,toasts=[],loading=0;
global.Page=x=>pageDef=x;global.Component=x=>hookDef=x;
global.wx={getStorageSync:()=>null,setStorageSync(){},showToast:x=>toasts.push(x.title),showLoading(){loading++;},hideLoading(){loading--;}};
const ordersPath=require.resolve('../utils/orders');require.cache[ordersPath]={id:ordersPath,filename:ordersPath,loaded:true,exports:{sync:async()=>{syncCalls++;opened=true;}}};
const store=require('../utils/store');
require('../components/lang-switch/index');
const bridge={selectComponent:id=>{assert.equal(id,'#daily-checkin');return {openFromJourney:()=>opened};},...hookDef.methods};
require('../pages/levels/index');
const page={data:{language:'zh'},...pageDef,selectComponent:id=>{assert.equal(id,'#level-page-hook');return bridge;},refreshCheckin(){},setData(v){Object.assign(this.data,v)}};
(async()=>{
 store.reset();store.update(s=>s.profile={...s.profile,accountId:'member',loggedOut:false});
 opened=true;await page.openYuniFeed();assert.equal(syncCalls,0,'ready entry reuses the same popup without another request');
 opened=false;await page.openYuniFeed();assert.equal(syncCalls,1);assert.equal(opened,true);assert.equal(loading,0);
 opened=false;store.update(s=>s.profile.loggedOut=true);await page.openYuniFeed();assert.match(toasts.at(-1),/登录/);assert.equal(syncCalls,1);
 const xml=fs.readFileSync(require.resolve('../pages/levels/index.wxml'),'utf8');assert.match(xml,/bindtap="openYuniFeed"/);assert.match(xml,/bones-white\.png/);assert.match(xml,/bones\.png/);assert.match(xml,/fish-grey\.png/);assert.match(xml,/id="level-page-hook"/);
 console.log('Level journey feed entry: nested shared component, sync fallback, login guard, no duplicate ready-state request and dried-fish/bone progress passed.');
})().catch(e=>{console.error(e);process.exitCode=1});
