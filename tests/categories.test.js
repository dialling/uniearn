const assert=require('node:assert/strict'),d=require('../utils/domain'),c=require('../utils/catalog');
const base={station:'Station A',dorm:'Dorm 7',room:'412',phone:'13801026092',deadline:'18:00',owner:'You',codes:['CODE'],small:1,big:0,pricePerBox:3};
for(const size of c.sizes){const s=d.initial();const bigSize=['large','oversized'].includes(size.id);const r=d.createRequest(s,{...base,parcelSize:size.id,small:bigSize?0:1,big:bigSize?1:0,pricePerBox:size.price});assert.equal(r.reward,size.price);const t=d.acceptBoxes(s,[{requestId:r.id,index:0}]);assert.equal(t.category,'parcel');d.collect(s,r.id);d.deliver(s,r.id,'photo');d.confirm(s,r.id);assert.equal(r.status,'confirmed');}
const s=d.initial(),r=d.createRequest(s,{...base,parcelItems:[{size:'small',code:'A'},{size:'medium',code:'B'},{size:'medium',code:'C'}]});assert.equal(r.reward,11);assert.equal(d.serviceFee(d.boxes(r)),0);
const t=d.acceptBoxes(s,[{requestId:r.id,index:1}]);assert.equal(r.reward,4);assert.deepEqual(r.codes,['B']);assert.equal(r.parcelItems[0].size,'medium');assert.equal(d.abandonUncollectedTrip(s,t.id),true);assert.equal(r.reward,11);assert.deepEqual(r.codes,['A','B','C']);assert.equal(r.parcelItems.length,3);
const mix=d.createRequest(s,{...base,parcelItems:[{size:'small',code:'D'},{size:'large',code:'E'}]});assert.equal(mix.big,1);const trip=d.acceptBoxes(s,[{requestId:mix.id,index:0}]);assert.equal(mix.big,0);assert.equal(mix.small,1);assert.equal(mix.reward,3);d.abandonUncollectedTrip(s,trip.id);assert.equal(mix.big,1);assert.equal(mix.reward,8);
assert.throws(()=>d.createRequest(s,{...base,parcelItems:[{size:'medium',code:''}]}));
const food=d.createRequest(s,{...base,category:'takeout',codes:[],small:2,pricePerBox:5});assert.equal(food.reward,10);assert.equal(food.codes.length,2);assert.equal(food.codes[0],'');
assert.throws(()=>d.acceptBoxes(s,[{requestId:r.id,index:0},{requestId:food.id,index:0}]));
assert.equal(d.initial().profile.studentVerified,false);assert.equal(d.initial().profile.onboarded,false);
console.log('Mixed size pricing, partial acceptance/restore, optional takeaway code and category separation passed');
