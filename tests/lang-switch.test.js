const assert=require('node:assert/strict'),fs=require('fs');
const titles=[];
global.wx={getStorageSync:()=>null,setStorageSync(){},setNavigationBarTitle(o){titles.push(o.title);}};
const store=require('../utils/store');
store.reset();store.update(s=>{s.language='zh';});
const t=require('../utils/page-title');
assert.equal(t.lang(),'zh');
let localized=0;
const page={route:'pages/requests/index',localize(){localized++;}};
assert.equal(t.apply(page),'我的订单');
assert.equal(titles.at(-1),'我的订单');
store.update(s=>{s.language='en';});
assert.equal(t.apply(page),'My orders');
assert.equal(titles.at(-1),'My orders');
t.toggle(page);
assert.equal(t.lang(),'zh','toggle switches Chinese back on');
assert.equal(titles.at(-1),'我的订单','toggle re-applies the localized title');
assert.equal(localized,1,'toggle re-runs the page localization');
// a missing, odd or {path}-shaped route must never throw
assert.equal(t.titleOf({}),'');
assert.equal(t.titleOf(null),'');
assert.equal(t.titleOf({route:123}),'');
store.update(s=>{s.language='en';});
assert.equal(t.titleOf({route:{path:'/pages/requests/index'}}),'My orders','object route falls back to its path');
assert.equal(t.titleOf({route:{}}),'');
// the page stack may contain an entry without a usable route
global.getCurrentPages=()=>[{route:undefined},{route:'/pages/jobs/index'}];
assert.equal(t.current().route,'/pages/jobs/index');
global.getCurrentPages=()=>[];
assert.equal(t.current(),null);
store.update(s=>{s.language='zh';});
// every page carries a title in both languages
// 接单大厅用页面内的大标题，不再设置原生标题栏
const noNativeTitle=new Set(['jobs']);
for(const dir of fs.readdirSync('pages')){
  if(noNativeTitle.has(dir))continue;
  for(const language of ['zh','en']){
    store.update(s=>{s.language=language;});
    const title=t.titleOf({route:`pages/${dir}/index`,data:{}});
    assert.ok(typeof title==='string'&&title.length>0,`missing ${language} title for ${dir}`);
  }
}
store.update(s=>{s.language='zh';});
assert.equal(t.titleOf({route:'pages/routes/index',data:{parcel:true}}),'常用快递地址');
assert.equal(t.titleOf({route:'pages/routes/index',data:{parcel:false}}),'常用路线');
assert.equal(t.titleOf({route:'pages/sms-scan/index',data:{mode:'sms'}}),'读取取件短信');
store.update(s=>{s.language='en';});
assert.equal(t.titleOf({route:'pages/sms-scan/index',data:{mode:'list'}}),'Read pending pickup list');
console.log('Language switch: every page title localized in both languages, toggle flips language, re-applies title and re-localizes passed.');
