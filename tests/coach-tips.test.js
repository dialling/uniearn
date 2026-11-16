// 2026-11-16: first-time tips: short (at most 3 steps), once per account, replayable; placed on the key screens.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
global.wx={getStorageSync:()=>null,setStorageSync(){}};
const read0=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');const store=require('../utils/store'),coach=require('../utils/coach');store.reset();store.update(s=>{s.profile={...s.profile,accountId:'a1',onboarded:true};});
assert.deepEqual(coach.names.sort(),['parcel','post','takeaway','task','trip']);
for(const n of coach.names){const en=coach.steps(n,'en'),zh=coach.steps(n,'zh');assert.ok(en.length>=1&&en.length<=3,n+' stays short');assert.ok(zh.every(s=>s.title&&s.text),n+' has Chinese');}
assert.deepEqual(coach.steps('post','en').map(s=>s.title),['Post a pick-up','Post any task','Start a trip']);
// 2026-11-17: the form tips point only at the confusing part, never at the post button
for(const n of ['trip','takeaway','parcel','task'])assert.ok(!coach.steps(n,'en').some(s=>/post-submit|tp-go/.test(s.target)),n+' skips the post button');
assert.deepEqual(['takeaway','parcel','task'].map(n=>coach.steps(n,'en')[0].target),['.arrival-card','.notice-upload','.deadline-card']);
assert.deepEqual(coach.steps('trip','en').map(s=>s.target),['#tsOther','.ts-go']);
assert.match(coach.steps('task','en')[0].text,/not when the task must be done/);
assert.match(read0('pages/trip-start/index.wxml'),/id="tsOther"/);
assert.match(read0('pages/jobs/index.js'),/placeGuideCard/,'the job hall guide card moves off its target');
assert.equal(coach.seen('trip'),false);coach.mark('trip');assert.equal(coach.seen('trip'),true,'shown once');
store.update(s=>{s.profile.accountId='a2';});assert.equal(coach.seen('trip'),false,'per account');
store.update(s=>{s.profile.accountId='a1';});coach.reset();assert.equal(coach.seen('trip'),false,'replay resets the tips');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
assert.match(read('components/nav/index.wxml'),/<coach-tip name="post" when="\{\{showCreateSheet\}\}"\/>/);
for(const id of ['csPickup','csTask','csTrip'])assert.ok(read('components/nav/index.wxml').includes('id="'+id+'"'));
assert.match(read('pages/trip-start/index.wxml'),/<coach-tip name="trip"/);
assert.match(read('pages/takeaway/index.wxml'),/<coach-tip name="takeaway" when="\{\{!tripId\}\}"/,'no tips while joining a trip');
assert.match(read('pages/create/index.wxml'),/<coach-tip name="parcel"/);assert.match(read('pages/task-post/index.wxml'),/<coach-tip name="task" when="\{\{!tripId\}\}"/);
assert.match(read('app.json'),/"coach-tip": "\/components\/coach\/index"/);
assert.match(read('utils/app-guide.js'),/Start a trip and earn on the way/,'the job hall guide mentions trips');
assert.match(read('pages/yuni/index.js'),/require\('\.\.\/\.\.\/utils\/coach'\)\.reset\(\)/,'Replay the app guide brings the tips back');
console.log('Coach tips: 5 short first-time tips, once per account, replayable');
