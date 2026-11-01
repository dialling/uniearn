const assert=require('node:assert/strict');
global.wx={getStorageSync:()=>null,setStorageSync(){},showToast(){}};
const store=require('../utils/store'),rewards=require('../utils/rewards'),server=require('../cloudfunctions/orderService/rewards');
function coupons(rows){store.update(s=>{s.rewards={coupons:rows};});}
const now=Date.now(),valid={id:'owned',kind:'total',max:2,expiresAt:now+86400000};
coupons([]);assert.equal(rewards.quote(null,3,0).total,'3.00');
coupons([valid]);assert.equal(rewards.quote('',3,0).discount,'0.00');assert.equal(rewards.quote(null,3,0,false).total,'3.00');assert.equal(rewards.quote(null,3,0).total,'1.00');
for(const c of [{...valid,pending:true},{...valid,usedBy:'r1'},{...valid,expiresAt:now-1},{...valid,daily:true,issuedAt:now-86400000},{...valid,daily:true},{...valid,stored:true,balance:0},{...valid,usable:false}]){coupons([c]);assert.equal(rewards.quote(null,3,0).discount,'0.00');}
for(const c of [{...valid,kind:'deliveryPercent',percent:50,max:3.9},{...valid,kind:'delivery'},{...valid,stored:true,balance:1.25}])for(const reward of [3,4,7.88,12])for(const fee of [0,0.5]){coupons([c]);assert.equal(rewards.quote(c.id,reward,fee).discount,server.discount(c,reward,fee).toFixed(2));}
coupons([{...valid,kind:'deliveryPercent',percent:50,max:3.9}]);assert.equal(rewards.quote(null,3,0).total,'1.50');
console.log('Coupon pricing: no coupon, unverified cache, pending/used/expired/daily/empty coupons and frontend/server pricing parity passed.');
