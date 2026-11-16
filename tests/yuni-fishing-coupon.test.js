// 2026-11-16: a lucky-draw coupon in a bottle while fishing (1% on every catch, at most once every 7 days), saved to My coupons.
const assert=require('node:assert/strict'),{harness}=require('./helpers/order-cloud');
const play=require('../cloudfunctions/orderService/yuni-play'),catalog=require('../cloudfunctions/orderService/yuni-catalog'),rewards=require('../cloudfunctions/orderService/rewards');
(async()=>{
 const h=harness(),me=h.engine.idFor('customer');await h.call('customer','sync');
 h.edit(s=>{const m=s.members[me];m.loyalty=m.loyalty||{points:0,level:1,notices:[]};m.loyalty.points=400;m.loyalty.level=3;});
 await h.call('customer','sync');assert.equal((await h.call('customer','yuniBuy',{item:'rod'})).ok,true);
 assert.equal(catalog.COUPON_CHANCE,0.01,'lucky draw: 1% on every catch');
 const day=86400000;let t=Date.parse('2026-11-16T04:00:00Z');const fishAt=(seq,ev={landed:true,perfect:true})=>{t+=day;let i=0;return play.fish(h.state,me,ev,t,()=>seq[Math.min(i++,seq.length-1)]);};
 const m=()=>h.state.members[me],bucket0=m().yuni.bucket.length,coupons0=(m().coupons||[]).length;
 // a lucky roll under 2%: a coupon instead of a fish
 assert.ok(!m().yuni.lastCouponAt,'no coupon yet: the first catch can already win');
 const got=fishAt([0.004,0.95]);assert.ok(got.coupon,'a coupon was caught');assert.equal(got.fish,undefined);
 assert.equal(m().yuni.bucket.length,bucket0,'the coupon does not go in the bucket');
 const c=m().coupons.at(-1);assert.equal(m().coupons.length,coupons0+1);assert.equal(c.kind,'delivery','0.95 of the weights is the free-delivery prize');assert.equal(c.campaignId,'yuni-bottle-free');
 assert.ok(c.expiresAt-c.issuedAt===14*day,'valid for 14 days');assert.equal(rewards.available(c,t),true,'usable right away');
 // the next lucky roll within 7 days gives a fish instead
 const again=fishAt([0.001,0.5,0.5]);assert.ok(again.fish&&!again.coupon,'at most one coupon every 7 days');
 // after 7 days another coupon can bite; a normal roll is a fish
 t+=7*day;assert.ok(fishAt([0.004,0.1]).coupon,'a new coupon after the cooldown');assert.equal(m().coupons.at(-1).campaignId,'yuni-bottle-1','0.1 of the weights is ¥1 off');
 t+=8*day;assert.ok(fishAt([0.5,0.5]).fish,'a normal roll is a fish');
 // a missed timing bar never gives a coupon
 t+=8*day;assert.deepEqual(fishAt([0.001,0.5],{landed:true,perfect:false}),{missed:true});
 // over many catches the coupon rate stays rare
 assert.ok(fishAt([0.011,0.5]).fish,'just over 1% is a fish');t+=8*day;
 let coupons=0;for(let i=0;i<20000;i++){const y=m().yuni;y.lastCouponAt=0;y.bucket=[];t+=day;const r=play.fish(h.state,me,{landed:true,perfect:true},t,Math.random);if(r.coupon)coupons++;}
 assert.ok(coupons>140&&coupons<270,'about 1% of 20000 catches: '+coupons);
 console.log('Fishing coupon: 1% lucky draw on every catch, 7-day limit, saved to My coupons ('+coupons+'/20000 without the limit)');
})().catch(e=>{console.error(e);process.exit(1);});
