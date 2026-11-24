const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const rewards=require('../legacy/cloudfunctions/orderService/rewards');
const loyalty=require('../legacy/cloudfunctions/orderService/loyalty');
const adminRewards=require('../legacy/cloudfunctions/adminService/order-engine/rewards');
const orderDefaults=require('../legacy/cloudfunctions/orderService/activity-default.json');
const newsDefaults=require('../legacy/cloudfunctions/newsService/activity-default.json');
const clientActivity=require('../utils/news-activity');
const meCopy=require('../utils/me-copy');

const referral=config=>config.tasks.find(t=>t.kind==='referral');
const weekly=config=>config.tasks.find(t=>t.kind==='weekly_login');
for(const [name,config] of [['orderService',orderDefaults],['newsService',newsDefaults],['client-js',clientActivity]]){
 assert.equal(referral(config).points,20,name+' invite task is 20 points');
 assert.equal(weekly(config).points,10,name+' weekly check-in stays at 10');
 assert.equal(config.referralCoupon.discountRate,0.5,name+' invite coupon rate unchanged');
 assert.equal(config.referralCoupon.maxDiscount,3.9,name+' invite coupon cap unchanged');
}
assert.equal(orderDefaults.referralCoupon.days,30);
assert.equal(newsDefaults.referralCoupon.days,30);

const now=Date.parse('2030-01-02T12:00:00+08:00');
const inviter='inviter-account-1',friend='friend-account-2';
const s={members:{},requests:[],trips:[]};
rewards.init(s,inviter,now);rewards.init(s,friend,now);
rewards.invite(s,friend,inviter.slice(0,12),now);
assert.equal(s.members[inviter].loyalty.points,20,'orderService awards the inviter 20');
assert.equal(s.members[friend].loyalty.points,20,'orderService awards the invitee 20');
assert.equal(s.members[inviter].loyalty.pointHistory[0].points,20);
assert.equal(s.members[inviter].loyalty.pointHistory[0].kind,'referral');
assert.equal(s.members[inviter].loyalty.pointHistory[0].key,'invite-'+friend);
assert.equal(s.members[friend].loyalty.pointHistory[0].key,'invite-welcome');
assert.equal(s.members[friend].invitedBy,inviter);
assert.throws(()=>rewards.invite(s,friend,inviter.slice(0,12),now+1000),/already linked/);
assert.equal(s.members[inviter].loyalty.points,20,'repeat binding does not re-award the inviter');
assert.equal(s.members[friend].loyalty.points,20,'repeat binding does not re-award the invitee');
assert.equal(s.members[inviter].loyalty.pointHistory.length,1);
assert.equal(s.members[friend].loyalty.pointHistory.length,1);

s.activityConfig=structuredClone(orderDefaults);
s.activityConfig.tasks.find(t=>t.kind==='referral').points=99;
assert.equal(s.members[inviter].loyalty.points,20,'later config changes do not rewrite past invite points');
assert.equal(s.members[friend].loyalty.pointHistory[0].points,20);

const legacy={members:{},requests:[],trips:[]};
const oldInviter='legacy-inviter-1',oldFriend='legacy-friend-2';
rewards.init(legacy,oldInviter,now);rewards.init(legacy,oldFriend,now);
legacy.members[oldInviter].loyalty={points:10,level:1,anyCompleted:false,notices:[],pointHistory:[{kind:'referral',points:10,key:'invite-'+oldFriend,at:now-86400000}]};
legacy.members[oldFriend].loyalty={points:10,level:1,anyCompleted:false,notices:[],pointHistory:[{kind:'referral',points:10,key:'invite-welcome',at:now-86400000}]};
legacy.members[oldFriend].invitedBy=oldInviter;
legacy.members[oldFriend].invitedAt=now-86400000;
rewards.init(legacy,oldInviter,now);rewards.init(legacy,oldFriend,now);
assert.throws(()=>rewards.invite(legacy,oldFriend,oldInviter.slice(0,12),now),/already linked/);
assert.equal(legacy.members[oldInviter].loyalty.points,10,'legacy inviter points are not topped up');
assert.equal(legacy.members[oldFriend].loyalty.points,10,'legacy invitee points are not topped up');
assert.equal(legacy.members[oldInviter].loyalty.pointHistory[0].points,10);
assert.equal(legacy.members[oldFriend].loyalty.pointHistory[0].points,10);

const admin={members:{},requests:[],trips:[]};
adminRewards.init(admin,inviter,now);adminRewards.init(admin,friend,now);
adminRewards.invite(admin,friend,inviter.slice(0,12),now);
assert.equal(admin.members[inviter].loyalty.points,20,'admin engine awards the inviter 20');
assert.equal(admin.members[friend].loyalty.points,20,'admin engine awards the invitee 20');
assert.throws(()=>adminRewards.invite(admin,friend,inviter.slice(0,12),now),/already linked/);
assert.equal(admin.members[inviter].loyalty.points,20);
assert.equal(admin.members[friend].loyalty.points,20);

const inviteWxml=read('pages/invite/index.wxml');
assert.match(inviteWxml,/iv-points-number">20</);
assert.doesNotMatch(inviteWxml,/iv-points-number">10</);
assert.match(inviteWxml,/双方各得 20 积分/);
assert.match(inviteWxml,/you each get 20 points/);
assert.doesNotMatch(inviteWxml,/双方各得 10 积分/);
assert.doesNotMatch(inviteWxml,/you each get 10 points/);
assert.match(inviteWxml,/5 折配送券，最高抵 ¥3\.9/);
assert.match(inviteWxml,/50% delivery coupon up to ¥3\.9/);

const inviteJs=read('pages/invite/index.js');
assert.equal(inviteJs.match(/双方各得 20 积分/g).length,3,'bind toasts and share title all say 20');
assert.match(inviteJs,/Invitation linked · 20 points each/);
assert.match(inviteJs,/加入 Uniearn，双方各得 20 积分/);
assert.match(inviteJs,/20 points for both of us/);
assert.doesNotMatch(inviteJs,/双方各得 10 积分/);
assert.doesNotMatch(inviteJs,/10 points each/);
assert.doesNotMatch(inviteJs,/10 points for both of us/);

const rewardsWxml=read('pages/rewards/index.wxml');
assert.match(rewardsWxml,/invite-primary-points-value"><text>20<\/text>/);
assert.doesNotMatch(rewardsWxml,/invite-primary-points-value"><text>10<\/text>/);
assert.match(rewardsWxml,/绑定邀请码，双方各得/);
assert.match(rewardsWxml,/Link a code · you each get/);

const zh=meCopy('zh'),en=meCopy('en');
assert.match(zh.inviteHelp,/双方各得 20 积分/);
assert.doesNotMatch(zh.inviteHelp,/双方各得 10 积分/);
assert.match(en.inviteHelp,/you each get 20 points/);
assert.doesNotMatch(en.inviteHelp,/you each get 10 points/);
assert.match(zh.inviteHelp,/¥3\.9/);
assert.match(en.inviteHelp,/¥3\.9/);

const rules=read('docs/activity-leaderboard-20261028.md');
assert.match(rules,/邀请新同学 \| 双方各 20 分/);
assert.doesNotMatch(rules,/邀请新同学 \| 双方各 10 分/);
assert.match(rules,/普通每单 10 分/,'unrelated customer-order 10 points stay unchanged');

const changeRecord=read('docs/change-record-20261028.md');
assert.match(changeRecord,/10 积分仍为绑定邀请码后双方各得/,'historical changelog is left as written');

assert.equal(loyalty.invite,require('../legacy/cloudfunctions/orderService/loyalty').invite);
console.log('Invite points: default configs and UI copy are 20 each, orderService and admin engines award 20 once, repeat binds do not pay again, legacy 10-point balances stay, weekly 10 and 50% / ¥3.9 / 30-day coupon rules unchanged.');
