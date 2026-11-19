// 2026-11-18: the daily check-in popup is gone. Feed Yuni on the Levels page opens the Me page (feed=1 while today's fish waits).
const assert=require('node:assert/strict'),fs=require('node:fs');
let pageDef,toasts=[],launched=[];
global.Page=x=>pageDef=x;global.Component=()=>{};
global.wx={getStorageSync:()=>null,setStorageSync(){},showToast:x=>toasts.push(x.title),reLaunch:o=>launched.push(o.url)};
const navPath=require.resolve('../utils/nav');require.cache[navPath]={id:navPath,filename:navPath,loaded:true,exports:{reLaunch:o=>launched.push(o.url),navigateTo(){}}};
const store=require('../utils/store'),china=require('../utils/china-time');
require('../pages/levels/index');
const page={data:{language:'zh'},...pageDef,setData(v){Object.assign(this.data,v)}};
store.reset();const today=china.dayKey(Date.now());
store.update(s=>{s.profile={...s.profile,accountId:'member',onboarded:true,campusId:'sip',loggedOut:false};s.progressionAccountId='member';s.serverTime=Date.now();s.progression={checkin:{day:today,streak:2,cycleDay:2,dailyPoints:2,rewardPoints:0},notices:[]};});
page.openYuniFeed();assert.equal(launched.at(-1),'/pages/profile/index?feed=1','today\'s fish waits: go to Me and feed it there');
store.update(s=>{s.progression.checkin.day='2000-01-01';});page.openYuniFeed();assert.equal(launched.at(-1),'/pages/profile/index','nothing waiting: just open Me');
store.update(s=>s.profile.loggedOut=true);page.openYuniFeed();assert.match(toasts.at(-1),/登录/);assert.equal(launched.length,2,'signed out: no navigation');
const xml=fs.readFileSync(require.resolve('../pages/levels/index.wxml'),'utf8');assert.match(xml,/bindtap="openYuniFeed"/);assert.match(xml,/bones-white\.png/);assert.match(xml,/bones\.png/);assert.match(xml,/fish-grey\.png/);
assert.ok(!fs.existsSync(require('path').join(__dirname,'../components/daily-checkin')),'the popup component is removed');
assert.doesNotMatch(fs.readFileSync(require.resolve('../app.json'),'utf8'),/daily-checkin/);
console.log('Levels Feed Yuni: opens the Me page to feed today\'s fish; no check-in popup');
