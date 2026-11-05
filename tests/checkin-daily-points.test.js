const assert=require('node:assert/strict'),loyalty=require('../cloudfunctions/orderService/loyalty'),policy=require('../cloudfunctions/orderService/activity-config');
const now=Date.parse('2026-11-05T12:00:00+08:00'),day='2026-11-05',config=policy.clone(policy.defaults);
const state={activityConfig:config,members:{old:{loyalty:{points:10,level:1,notices:[{id:'today',type:'checkin',day,points:10}],checkin:{day,streak:7,cycleDay:7,totalDays:7,rewardPoints:10}}}}};
loyalty.dailyLogin(state,'old',now);let l=state.members.old.loyalty;assert.equal(l.points,12);assert.equal(l.checkin.dailyPoints,2);assert.equal(l.checkin.totalDays,7);assert.equal(l.notices[0].points,12);assert.equal(l.notices[0].dailyPoints,2);assert.equal(l.notices[0].weeklyPoints,10);
loyalty.acknowledge(state,'old','today');for(let i=0;i<3;i++)loyalty.dailyLogin(state,'old',now);assert.equal(l.points,12);assert.equal(l.notices.length,0,'backfill does not redisplay an acknowledged notice');
loyalty.dailyLogin(state,'new',now);l=state.members.new.loyalty;assert.equal(l.points,2);assert.equal(l.checkin.rewardPoints,0);assert.equal(l.notices.find(n=>n.type==='checkin').points,2);assert.equal(l.checkin.cycleDay,1);
for(let i=1;i<7;i++)loyalty.dailyLogin(state,'new',now+i*86400000);assert.equal(l.points,24);assert.equal(l.checkin.dailyPoints,2);assert.equal(l.checkin.rewardPoints,10);assert.equal(l.notices.find(n=>n.type==='checkin').points,12);
config.pointsProgram.status='paused';loyalty.dailyLogin(state,'paused',now);assert.equal(state.members.paused.loyalty.points,0);assert.equal(state.members.paused.loyalty.checkin.dailyPoints,0);
console.log('Daily 2 points: fresh check-in, today-only legacy backfill, no duplicate credit/notices, unchanged streak count, day-7 total 12 and paused program passed.');
