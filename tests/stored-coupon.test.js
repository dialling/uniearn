const assert=require('node:assert/strict'),rewards=require('../cloudfunctions/orderService/rewards');
const now=Date.parse('2030-01-02T12:00:00+08:00'),s={members:{},requests:[],trips:[]};
const inviter='inviter-account-1',friend='friend-account-2';
rewards.init(s,inviter,now);rewards.init(s,friend,now);
rewards.invite(s,friend,inviter.slice(0,12),now);

// The invite reward now waits for the friend's first confirmed order.
const inviteCoupon=()=>s.members[inviter].coupons.find(c=>c.id==='invite-'+friend);
assert.equal(s.members[friend].invitedBy,inviter);
assert.equal(inviteCoupon().pending,true,'the invite coupon stays pending until the friend orders');
assert.equal(inviteCoupon().kind,'deliveryPercent');
assert.equal(inviteCoupon().max,3.9,'half of the delivery fee, capped at ¥3.9');
assert.ok(!rewards.view(s,inviter,now).coupons.some(c=>c.id==='invite-'+friend),'a pending coupon stays out of the picker');
assert.equal(rewards.view(s,inviter,now).couponHistory.find(c=>c.id==='invite-'+friend).status,'pending');

s.requests.push({id:'r0',ownerId:friend,status:'confirmed',reward:3,serviceFee:0,createdAt:now,confirmedAt:now+1000});
rewards.settle(s,now+2000);
assert.equal(inviteCoupon().pending,false,'the friend\u2019s first confirmed order unlocks it');
assert.equal(inviteCoupon().expiresAt,now+2000+30*86400000,'valid for 30 days from unlock');
assert.equal(s.members[friend].inviteCouponUnlocked,true);
rewards.settle(s,now+3000);
assert.equal(s.members[inviter].coupons.filter(c=>c.id==='invite-'+friend).length,1,'settling again does not issue a second coupon');

const c=inviteCoupon(),order=(id,reward)=>{const r={id,ownerId:inviter,reward,serviceFee:0,status:'waiting'};s.requests.push(r);rewards.apply(s,inviter,r,c.id,now+4000);return r;};
const a=order('r1',4);
assert.equal(a.discount,2,'half of a ¥4 delivery reward');
assert.equal(c.usedBy,'r1');
assert.throws(()=>order('r2',4),/used|expired/);
a.status='cancelled';rewards.restore(s,a);
assert.ok(!c.usedBy,'a cancelled order releases the coupon');
const b=order('r3',10);
assert.equal(b.discount,3.9,'the cap holds on a bigger reward');
assert.equal(rewards.view(s,inviter,now+4000).couponHistory.find(x=>x.id===c.id).status,'used','wallet history marks a spent coupon');
delete c.usedBy;
assert.throws(()=>{const late={id:'r4',ownerId:inviter,reward:4,serviceFee:0};s.requests.push(late);rewards.apply(s,inviter,late,c.id,now+40*86400000);},/expired/,'an old coupon stops working after 30 days');

// Stored-value coupons are a separate shape and still spend down across orders.
const member=s.members[inviter];
const stored={id:'stored-1',title:'Stored',short:'Stored',kind:'total',stored:true,balance:3.9,max:3.9,issuedAt:now,expiresAt:now+30*86400000};
member.coupons.push(stored);
const spend=(id,reward)=>{const r={id,ownerId:inviter,reward,serviceFee:0,status:'waiting'};s.requests.push(r);rewards.apply(s,inviter,r,stored.id,now);return r;};
const d=spend('r5',3);
assert.equal(d.discount,3);assert.equal(stored.balance,0.9);assert.ok(!stored.usedBy,'balance left, coupon stays usable');
assert.equal(rewards.view(s,inviter,now).coupons.find(x=>x.id===stored.id).face,'¥0.9');
const e=spend('r6',4);
assert.equal(e.discount,0.9);assert.equal(stored.balance,0);assert.equal(stored.usedBy,'r6');
assert.throws(()=>spend('r7',4),/used|expired/);
e.status='cancelled';rewards.restore(s,e);assert.equal(stored.balance,0.9);assert.ok(!stored.usedBy);rewards.restore(s,e);
assert.equal(stored.balance,0.9,'restore is idempotent');

// Expired coupons stay in the wallet history but never reach the picker.
const expired={id:'expired-coupon',titleZh:'过期券',max:2,kind:'total',issuedAt:now-40*86400000,expiresAt:now-1};
member.coupons.push(expired);
const wallet=rewards.view(s,inviter,now);
assert.equal(wallet.couponHistory.find(x=>x.id===expired.id).status,'expired','wallet history includes expired coupons');
assert.ok(!wallet.coupons.some(x=>x.id===expired.id),'the picker only offers usable coupons');
console.log('Invite coupon: pending until the friend\u2019s first order, 50% delivery capped at ¥3.9, released on cancel and 30-day validity; stored-value balance still spends down.');

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
  // The reward lands on the inviter as a pending coupon named after the friend.
  assert.equal(state.members[host].coupons.filter(c=>c.id==='invite-'+id).length,1);
 }
 rewards.settle(state,now);
 assert.equal(state.members[host].coupons.filter(c=>c.id.startsWith('invite-')).length,people.length,'one inviter can earn rewards for several existing users');
 assert.equal(state.members[other].coupons.filter(c=>c.id.startsWith('invite-')).length,0,'a rejected change does not reward another inviter');
}
console.log('Invitation binding: existing and archived orders allowed, self/unknown codes rejected, one binding per person and multiple invitees passed.');
