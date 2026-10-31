const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const locale=require('../utils/ui-locale');

const source={status:'delivered',statusLabel:'Delivered · please check',category:'parcel',unit:'boxes',sizeLabel:'Small × 2 · Medium × 1',destinationDisplay:'Dorm 7 · Room 302',history:[{label:'Delivered · photo'}],dispute:{reason:'Wrong bag'},arrivalLabel:'Arrives 18:30'};
const zh=locale.request(source,true),en=locale.request(source,false);
assert.equal(zh.displayStatus,'已送达 · 请确认');
assert.equal(zh.unit,'件');
assert.equal(zh.sizeLabel,'小件 × 2 · 中件 × 1');
assert.match(zh.destinationDisplay,/房间 302/);
assert.equal(zh.history[0].label,'已送达 · 照片');
assert.equal(zh.dispute.reason,'送错餐袋');
assert.equal(en.displayStatus,source.statusLabel);
assert.equal(en.unit,source.unit);
assert.equal(source.history[0].label,'Delivered · photo');
const coupon={couponTitle:'Free delivery',coupons:[{short:'¥2 off',unavailableLabel:'Unavailable now'}]};
assert.equal(locale.quote(coupon,true).couponTitle,'免配送费');
assert.equal(locale.quote(coupon,true).coupons[0].short,'减 ¥2');
assert.equal(locale.quote(coupon,false),coupon);
assert.equal(locale.translate('My dorm'),'我的宿舍');

for(const page of ['create','request','trip','task','earnings','rewards','student-check','route-edit']){
  const content=fs.readFileSync(path.join(__dirname,'..','pages',page,'index.wxml'),'utf8');
  assert.equal((content.match(/\{\{/g)||[]).length,(content.match(/\}\}/g)||[]).length,page+' has an unmatched WXML expression');
  assert.doesNotMatch(content,/\{\{[^}]*\{\{|>\|\|/,page+' has a nested or broken WXML expression');
}
console.log('Bilingual request labels and edited WXML expression boundaries passed.');
