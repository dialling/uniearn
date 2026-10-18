const assert=require('node:assert/strict');
let definition;
global.Page=p=>definition=p;
global.wx={getStorageSync:()=>null,setStorageSync(){},showToast(){}};
const store=require('../utils/store'),orders=require('../utils/orders');
function page(name){require('../pages/'+name+'/index');return {...definition,data:structuredClone(definition.data),setData(v){Object.assign(this.data,v);}};}
const parcel=page('create');
parcel.data.smsText='【菜鸟驿站】您有2个包裹在太仓青草巷广场二十一号店，取件码为14-5-4465、29-6-8730';
parcel.parseSms();
assert.deepEqual(parcel.data.codes,['14-5-4465','29-6-8730']);
assert.equal(parcel.data.pickupPoint,'太仓青草巷广场二十一号店');
assert.equal(parcel.data.parcelCount,2);
assert.equal(parcel.data.foundCodes,2);
assert.equal(parcel.data.scanBusy,false);
assert.equal(parcel.data.smsEditing,false);
assert.equal(parcel.data.discount,'0.00');
store.update(s=>{s.rewards={coupons:[{id:'owned',short:'¥2 off',kind:'total',max:2,usable:true,expiresAt:Date.now()+86400000},{id:'expired',max:5,expiresAt:1},{id:'used',max:5,usedBy:'order'}]};});
for(const form of [parcel,page('takeaway')]){
 form.couponManual=false;form.totals();assert.equal(form.data.coupons.length,1);
 assert.equal(form.data.couponId,'owned','best usable coupon is applied automatically');assert.equal(form.data.discount,'2.00');
 const after=Number(form.data.total);
 form.coupon({currentTarget:{dataset:{id:''}}});assert.equal(form.data.discount,'0.00');assert.equal(Number(form.data.total),after+2);
 form.totals();assert.equal(form.data.couponId,'','a manual "none" choice is kept');
 form.coupon({currentTarget:{dataset:{id:'owned'}}});assert.equal(form.data.couponId,'owned');assert.equal(Number(form.data.total),after);
}
(async()=>{
 orders.sync=async()=>{throw Error('offline');};
 await parcel.loadCoupons();
 assert.equal(parcel.data.coupons[0].id,'owned');
 assert.ok(parcel.data.couponError);
 assert.equal(parcel.data.scanBusy,false);
 console.log('Read exact screenshot SMS, two parcel totals, owned coupon display/selection and offline refresh passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
