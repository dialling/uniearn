// 2026-11-16: the Yuni guide on the Me page: 7 steps with the same spotlight as the app guide, once per account, and a replay row.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const g=require('../utils/yuni-guide');
assert.equal(g.count,7);
const en=g.steps('en'),zh=g.steps('zh');
assert.deepEqual(en.map(s=>s.title),['Meet Yuni','Pet and tap','Feed Yuni','Go fishing','Play together','Shop and friends','Level up']);
assert.ok(zh.every(s=>s.title&&s.text),'every step has Chinese text');
assert.equal(en[0].target,'','the first step is the welcome');
const stage=fs.readFileSync(path.join(__dirname,'../components/yuni-stage/index.wxml'),'utf8');
for(const id of ['ysYuni','ysFeed','ysFish','ysPlay','ysShopBtn'])assert.ok(stage.includes('id="'+id+'"'),'stage has #'+id+' for the spotlight');
const me=fs.readFileSync(path.join(__dirname,'../pages/profile/index.wxml'),'utf8'),mejs=fs.readFileSync(path.join(__dirname,'../pages/profile/index.js'),'utf8');
assert.match(me,/class="guide-focus yg-focus"/,'same spotlight as the app guide');assert.match(me,/class="guide-modal yg-modal/);
assert.match(mejs,/yuniGuideDoneFor/,'shown once per account');assert.match(mejs,/yuniGuideReplay/,'can be replayed');
assert.match(mejs,/appGuideDone=\(s\.guideDoneFor\|\|\[\]\)\.includes\(id\)/,'waits until the app guide is done');
const yp=fs.readFileSync(path.join(__dirname,'../pages/yuni/index.wxml'),'utf8');assert.match(yp,/bindtap="yuniGuide"/,'replay from Me › Yuni');
console.log('Yuni guide: 7 spotlight steps, once per account, replay from the Yuni page');
