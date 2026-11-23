// 2026-11-18: no daily check-in popup. Feed on the Me page eats today's dried fish right in Yuni's scene,
// marks it eaten, closes the check-in notice and shows the points; the Me tab shows a dot while the fish waits.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const mem={};global.wx={getStorageSync:k=>mem[k],setStorageSync:(k,v)=>{mem[k]=v;}};
const store=require('../utils/store'),checkin=require('../utils/checkin'),china=require('../utils/china-time');
store.reset();const today=china.dayKey(Date.now());
store.update(s=>{s.profile={...s.profile,accountId:'acc1',onboarded:true,campusId:'sip',loggedOut:false};s.progressionAccountId='acc1';s.serverTime=Date.now();s.progression={checkin:{day:today,streak:4,cycleDay:4,dailyPoints:2,rewardPoints:0},notices:[]};});
assert.equal(checkin.dailyFishWaiting(),true,'checked in today, fish not eaten yet');
assert.equal(checkin.todayFish().points,2,'the stage gets today\'s token with its points');
checkin.markFed({key:'acc1:'+today});
assert.equal(checkin.dailyFishWaiting(),false,'after Yuni eats it, Feed goes back to the bucket');assert.equal(checkin.todayFish(),null);
store.update(s=>{s.progression.checkin.day='2000-01-01';});assert.equal(checkin.dailyFishWaiting(),false,'no check-in today, nothing waiting');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const stage=read('components/yuni-stage/index.js'),wxml=read('components/yuni-stage/index.wxml');
assert.match(stage,/if \(this\.data\.dailyFish && !this\.F\) return this\.feedDailyFish\(\);/,'Feed eats today\'s fish first');
const fd=stage.slice(stage.indexOf('    feedDailyFish() {'),stage.indexOf('    feedOrderFish() {'));
assert.ok(fd.includes('checkin.markFed(n); checkin.markCollected(n);')&&fd.includes("orders.act('ackLoyaltyNotice', { noticeId: n.id })")&&fd.includes('this.fedNow()'),'eaten, notice closed, Yuni full');
assert.ok(!stage.includes("triggerEvent('dailyfeed')"),'no popup any more');
// 2026-11-17: Feed shows one count of every fish ready to eat; it turns amber while a dried or order fish waits.
assert.match(stage,/next\.feedCount = \(next\.dailyFish \? 1 : 0\) \+ next\.orderFish \+ next\.bucketCount;/,'one count for every fish ready to eat');
assert.match(wxml,/<text wx:if="\{\{feedCount\}\}" class="ys-count \{\{gift\?'ys-count-gift':''\}\}">\{\{feedCount\}\}<\/text>/,'the waiting fish shows as an amber count on Feed');
const me=read('pages/profile/index.wxml'),mejs=read('pages/profile/index.js');
assert.doesNotMatch(me,/dailyfeed/);assert.ok(mejs.includes("this.autoFeed=o.feed==='1'")&&mejs.includes('feedDailyNow(){'),'Me page feeds on arrival from Levels');
// 合并模式接的是西浦跑后端，没有云端每日签到数据；红点恒亮但页面上没有可喂的鱼，
// 所以 nav 在 merge-mode 下隐藏这个红点（见 components/nav/index.js）。
assert.ok(read('components/nav/index.wxml').includes('class="nav-fish-dot"')&&read('components/nav/index.js').includes("!require('../../utils/merge-mode').enabled&&require('../../utils/checkin').dailyFishWaiting()"),'fish dot hidden while merge-mode has no check-in data');
assert.ok(!read('components/lang-switch/index.wxml').includes('daily-checkin'),'popup removed from every page');
console.log('Me page Feed: Yuni eats today\'s dried fish in the scene; Me tab dot; no popup');
