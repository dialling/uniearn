const assert=require('node:assert/strict'),rewards=require('../cloudfunctions/orderService/rewards');
const now=Date.parse('2030-01-02T12:00:00+08:00'),s={members:{},requests:[],trips:[]};
const inviter='inviter-account-1',friend='friend-account-2';
rewards.init(s,inviter,now);rewards.init(s,friend,now);
rewards.invite(s,friend,inviter.slice(0,12),now);
assert.equal(s.members[friend].inviteRewarded,true,'reward is issued as soon as the code is entered');
s.requests.push({id:'r0',ownerId:friend,status:'confirmed',reward:3,serviceFee:0,createdAt:now});
rewards.settle(s,now);assert.equal(s.members[inviter].coupons.filter(c=>c.id.startsWith('invite-')).length,1,'settling later does not issue a second reward');
const coupon=id=>s.members[id].coupons.find(c=>c.id.startsWith('invite-'));
for(const id of [inviter,friend]){const c=coupon(id);assert.equal(c.balance,3.9);assert.equal(c.stored,true);assert.equal(c.expiresAt,now+30*86400000,'valid for 30 days from issue');}
const c=coupon(inviter),order=(id,reward)=>{const r={id,ownerId:inviter,reward,serviceFee:0,status:'waiting'};s.requests.push(r);rewards.apply(s,inviter,r,c.id,now);return r;};
const a=order('r1',3);assert.equal(a.discount,3);assert.equal(c.balance,0.9);assert.ok(!c.usedBy,'balance left, coupon stays usable');
assert.equal(rewards.view(s,inviter,now).coupons.find(x=>x.id===c.id).face,'¥0.9');
const b=order('r2',4);assert.equal(b.discount,0.9);assert.equal(c.balance,0);assert.equal(c.usedBy,'r2');
assert.throws(()=>order('r3',4),/used/);
b.status='cancelled';rewards.restore(s,b);assert.equal(c.balance,0.9);assert.ok(!c.usedBy);rewards.restore(s,b);assert.equal(c.balance,0.9,'restore is idempotent');
const d=order('r4',4);assert.equal(d.discount,0.9);
const expired={id:'expired-coupon',titleZh:'过期券',max:2,kind:'total',issuedAt:now-40*86400000,expiresAt:now-1};s.members[inviter].coupons.push(expired);
const wallet=rewards.view(s,inviter,now);
assert.equal(wallet.couponHistory.find(x=>x.id===c.id).status,'used','wallet history includes fully consumed coupons');
assert.equal(wallet.couponHistory.find(x=>x.id===expired.id).status,'expired','wallet history includes expired coupons');
assert.ok(!wallet.coupons.some(x=>x.id===c.id||x.id===expired.id),'order selection list remains limited to active coupons');
const fresh={...coupon(friend)};const big={id:'r5',ownerId:friend,reward:4,serviceFee:0,status:'waiting'};s.requests.push(big);rewards.apply(s,friend,big,fresh.id,now);assert.equal(big.discount,3.9,'a ¥4 order uses the full ¥3.9');
assert.throws(()=>{const late={id:'r6',ownerId:inviter,reward:3,serviceFee:0};const x=coupon(inviter);x.balance=1;delete x.usedBy;rewards.apply(s,inviter,late,x.id,now+31*86400000);},/expired/);
console.log('Stored-value invite coupon: ¥3.9 balance, partial use, refund back to balance and 30-day validity passed.');

// Prior orders do not block a first binding; each person can still bind only once.
{
 const state={members:{},requests:[],trips:[]},host='host-account-001',other='other-account-01';
 const people=['waiting-user-001','completed-user-01','archived-user-01'];
 for(const id of [host,other,...people])rewards.init(state,id,now);
 state.requests.push({id:'waiting',ownerId:people[0],status:'waiting'},{id:'completed',ownerId:people[1],status:'confirmed'});
 state.members[people[2]].archivedOrders=5;
 for(const id of people){
  assert.throws(()=>rewards.invite(state,id,id.slice(0,12),now),/Invalid invitation/);
  assert.throws(()=>rewards.invite(state,id,'missing-code',now),/Invalid invitation/);
  assert.ok(!state.members[id].invitedBy,'rejected codes do not bind the account');
  rewards.invite(state,id,host.slice(0,12),now);
  assert.equal(state.members[id].invitedBy,host);
  assert.throws(()=>rewards.invite(state,id,host.slice(0,12),now),/already linked/);
  assert.throws(()=>rewards.invite(state,id,other.slice(0,12),now),/already linked/);
  assert.equal(state.members[id].coupons.filter(c=>c.id.startsWith('invite-')).length,1);
 }
 rewards.settle(state,now);
 assert.equal(state.members[host].coupons.filter(c=>c.id.startsWith('invite-')).length,people.length,'one inviter can earn rewards for several existing users');
 assert.equal(state.members[other].coupons.filter(c=>c.id.startsWith('invite-')).length,0,'a rejected change does not reward another inviter');
}
console.log('Invitation binding: existing and archived orders allowed, self/unknown codes rejected, one binding per person and multiple invitees passed.');
