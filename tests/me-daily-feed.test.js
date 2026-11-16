// 2026-11-16: the Me page Feed button opens the Feed Yuni sheet while today's dried fish is still waiting.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const mem={};global.wx={getStorageSync:k=>mem[k],setStorageSync:(k,v)=>{mem[k]=v;}};
const store=require('../utils/store'),checkin=require('../utils/checkin'),china=require('../utils/china-time');
store.reset();const today=china.dayKey(Date.now());
store.update(s=>{s.profile={...s.profile,accountId:'acc1',onboarded:true,campusId:'sip',loggedOut:false};s.progressionAccountId='acc1';s.serverTime=Date.now();s.progression={checkin:{day:today,streak:4,cycleDay:4,dailyPoints:2,rewardPoints:0},notices:[]};});
assert.equal(checkin.dailyFishWaiting(),true,'checked in today, fish not eaten yet');
checkin.markFed({key:'acc1:'+today});
assert.equal(checkin.dailyFishWaiting(),false,'after Yuni eats it, Feed goes back to the bucket');
store.update(s=>{s.progression.checkin.day='2000-01-01';});assert.equal(checkin.dailyFishWaiting(),false,'no check-in today, nothing waiting');
const stage=fs.readFileSync(path.join(__dirname,'../components/yuni-stage/index.js'),'utf8'),wxml=fs.readFileSync(path.join(__dirname,'../components/yuni-stage/index.wxml'),'utf8');
assert.match(stage,/if \(this\.data\.dailyFish && !this\.F\) \{ this\.triggerEvent\('dailyfeed'\); return; \}/,'Feed opens the sheet first');
assert.match(wxml,/wx:if="\{\{dailyFish\}\}" class="ys-daily-fish"/,'a dried-fish badge waits on the Feed button');
const me=fs.readFileSync(path.join(__dirname,'../pages/profile/index.wxml'),'utf8'),mejs=fs.readFileSync(path.join(__dirname,'../pages/profile/index.js'),'utf8');
assert.match(me,/<lang-switch id="me-lang">/);assert.match(me,/bind:dailyfeed="openDailyFeed"/);assert.match(mejs,/selectComponent\('#me-lang'\);if\(host&&host\.openYuniFeed\(\)\)return;/);
console.log('Me page Feed: opens the Feed Yuni sheet while today\'s dried fish waits');
