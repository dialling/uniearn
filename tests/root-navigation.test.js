const assert=require('node:assert/strict'),fs=require('node:fs');
const calls=[],titles=[];let stack=[{route:'pages/jobs/index',options:{}}],definition;
global.getCurrentPages=()=>stack;
global.wx={getStorageSync:()=>null,setStorageSync(){},reLaunch:o=>calls.push(o),navigateTo:o=>calls.push(o),setNavigationBarTitle:o=>titles.push(o.title)};
const store=require('../utils/store');store.reset();const nav=require('../utils/nav');
(async()=>{
nav.reLaunch({url:'/pages/jobs/index'});assert.equal(calls.length,0);
nav.reLaunch({url:'/pages/requests/index'});const first=calls.at(-1);
nav.reLaunch({url:'/pages/profile/index'});nav.navigateTo({url:'/pages/request/index?id=r'});assert.equal(calls.length,1,'no overlapping native transitions');
first.complete({errMsg:'reLaunch:ok'});assert.equal(calls.length,1,'native completion still waits for ready');
nav.pageReady({route:'pages/jobs/index'});assert.equal(calls.length,1);
stack=[{route:'pages/requests/index',options:{}}];nav.pageReady(stack[0]);await Promise.resolve();assert.equal(calls.length,2);assert.equal(calls.at(-1).url,'/pages/request/index?id=r','latest detail request is preserved until ready');
nav.reLaunch({url:'/pages/profile/index'});assert.equal(calls.length,3);calls.at(-1).fail({errMsg:'reLaunch:fail test'});nav.reLaunch({url:'/pages/profile/index'});assert.equal(calls.length,4,'failed navigation releases the lock');
stack=[{route:'pages/profile/index',options:{}}];nav.pageReady(stack[0]);
// Component attachment sees the old stack during a route change; page hooks must not use it as the destination.
global.Page=o=>definition=o;Page._uniearnMotion=true;Page._uniearnAnalytics=true;
const title=require('../utils/page-title');title.install();const installed=Page;title.install();assert.equal(Page,installed);assert.equal(Page._uniearnMotion,true);assert.equal(Page._uniearnAnalytics,true);
let shown=0,ready=0;Page({onShow(){shown++;},onReady(){ready++;}});const hooks=definition;
const jobs={route:'pages/jobs/index',options:{}},requests={route:'pages/requests/index',options:{}};
stack=[requests];const before=titles.length;hooks.onShow.call(jobs);assert.equal(shown,1);assert.equal(titles.length,before,'destination onShow cannot write into the old page title');
stack=[jobs];hooks.onReady.call(jobs);assert.equal(ready,1);assert.equal(titles.at(-1),'接单大厅');hooks.onReady.call(requests);assert.equal(titles.at(-1),'接单大厅','late old lifecycle cannot replace the current title');
stack=[requests];hooks.onShow.call(requests);assert.equal(titles.at(-1),'我的订单');
let component;global.Component=o=>component=o;require('../components/lang-switch/index');const count=titles.length;component.lifetimes.attached.call({});assert.equal(titles.length,count,'component attachment never retitles a possibly stale global page');
const css=fs.readFileSync(require.resolve('../components/daily-checkin/index.wxss'),'utf8');assert.doesNotMatch(css,/(?:^|[\s>+~])(?:view|text|button|image|video)(?=[\s.#[:>+~{])/m,'isolated check-in styles use classes instead of forbidden element selectors');
console.log('Root navigation: current-tab no-op, overlap guard until target ready, failed retry, stale lifecycle/title isolation, preserved hooks and component class selectors passed.');

})().catch(e=>{console.error(e);process.exitCode=1});
