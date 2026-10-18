const assert=require('node:assert/strict'),c=require('../utils/campus'),r=require('../utils/saved-routes');
assert.equal(c.buildings().length,31,'4 areas x 31 buildings');
assert.equal(r.dorms.length,31,'route picker uses the real building list');
assert.equal(r.dorms[0],'D01');
assert.equal(c.areaOfBuilding('A05').zh,'文星');
assert.equal(c.buildingLabel('D01','zh'),'文缘 D01');
assert.equal(c.buildingLabel('D01','en'),'Wenyuan D01');
assert.equal(c.buildingLabel('A05','zh'),'文星 A05');
assert.equal(c.maxFloorOf('A05'),20,'A05 has 20 floors');
assert.equal(c.maxFloorOf('D01'),23,'Wenyuan blocks have 23 floors');
assert.equal(c.maxFloorOf('A01'),6,'Wenxing blocks default to 6 floors');
assert.equal(c.floorsOf('A01').length,6);
assert.equal(c.floorOfRoom('1201'),12,'room 1201 sits on floor 12');
assert.equal(c.floorOfRoom('412'),4);
assert.equal(c.floorOfRoom('n/a'),0);
assert.equal(c.highFloor('wenxing',3,'A01'),true,'Wenxing floor 3+ pays the surcharge');
assert.equal(c.highFloor('wenxing',3,'A05'),false,'A05 has a lift, no surcharge');
assert.equal(c.highFloor('wenxing',2,'A01'),false);
assert.equal(c.stationLabel('North gate','zh'),'北门');
assert.equal(c.stationLabel('Wenyuan Cainiao station','zh'),'文缘菜鸟驿站');
assert.equal(r.stationLabel('East gate JD point','en'),'East gate JD point');

// floor surcharge: Wenxing floor 3+ costs +1, A05 (lift) and Wenyuan are free
const d=require('../utils/domain');
const s=d.initial();s.requests=[];
const mk=(extra)=>d.createRequest(s,{category:'takeout',station:'North gate',dorm:'A01',room:'1201',phone:'13800000000',small:1,pricePerBox:3,codes:[''],owner:'A',deadline:'18:00',...extra});
assert.equal(mk({}).reward,4,'Wenxing floor 12 pays +1');
assert.equal(mk({dorm:'A05'}).reward,3,'A05 has a lift');
assert.equal(mk({dorm:'A01',floor:2}).reward,3,'floor 2 has no surcharge');
assert.equal(mk({dorm:'D01'}).reward,3,'Wenyuan has no surcharge');
assert.throws(()=>mk({dorm:'A01',floor:99}),/floor/i,'nonexistent floor is rejected');
assert.equal(r.validate({destinationType:'dorm',station:'North gate',dorm:'D01',room:'101',floor:23,owner:'A',phone:'13800000000'}).area,'wenyuan');
assert.throws(()=>r.validate({destinationType:'dorm',station:'North gate',dorm:'D01',room:'101',floor:24,owner:'A',phone:'13800000000'}),/floor/i);

// multi-parcel caps: up to 12 items, at most 9 of one size
const s2=d.initial();s2.requests=[];
const parcelBase={category:'parcel',station:'North gate',dorm:'D01',room:'101',phone:'13800000000',owner:'A',deadline:'18:00',tip:0};
const tooMany=Array.from({length:13},(_,i)=>({size:'small',code:'C'+i}));
assert.throws(()=>d.createRequest(s2,{...parcelBase,parcelItems:tooMany}),/12/);
const tenSmall=Array.from({length:10},(_,i)=>({size:'small',code:'D'+i}));
assert.throws(()=>d.createRequest(s2,{...parcelBase,parcelItems:tenSmall}),/9 items/);
const twelve=Array.from({length:12},(_,i)=>({size:i%2?'small':'medium',code:'E'+i}));
assert.equal(d.createRequest(s2,{...parcelBase,parcelItems:twelve}).parcelItems.length,12);

// 1-hour auto-cancel: unaccepted takeout orders expire, parcels do not
const s3=d.initial();s3.requests=[];
const take=(extra)=>d.createRequest(s3,{category:'takeout',station:'North gate',dorm:'D01',room:'101',phone:'13800000000',small:1,codes:[''],pricePerBox:3,owner:'A',deadline:'18:00',...extra});
const stale=take({});stale.createdAt=Date.now()-2*3600000;
const staleParcel=d.createRequest(s3,{category:'parcel',parcelSize:'small',station:'North gate',dorm:'D01',room:'101',phone:'13800000000',small:1,big:0,codes:['C1'],owner:'A',deadline:'18:00',pricePerBox:3});staleParcel.createdAt=Date.now()-2*3600000;
const fresh=take({});
assert.equal(d.sweepExpired(s3),1,'only the stale takeout order expires');
assert.equal(stale.status,'cancelled');assert.equal(stale.cancelReason,'expired');
assert.equal(staleParcel.status,'waiting','parcels are never auto-cancelled');
assert.equal(fresh.status,'waiting');
assert.equal(d.sweepExpired(s3),0,'sweeping twice is a no-op');
console.log('Campus data: 31 real buildings, floors, lift rule and bilingual pickup points passed.');
