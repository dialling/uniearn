const assert=require('node:assert/strict');
const {parseText}=require('../cloudfunctions/parseParcelScreenshot/parser');
const english=parseText([
 'Already placed in Cainiao station',
 'Tracking number YT7646005782127',
 'To be picked up 09-24 12:00',
 'Store No. 21, Qingcao Lane Square',
 'B1-21-1, Qingcao Lane Plaza, No. 15 Taicang Avenue',
 'Pickup code',
 '12 - 3 - 4567',
 'Contact 15962299562'
]);
assert.equal(english.pickupCode,'12-3-4567');
assert.match(english.pickupPoint,/Store No\. 21/);
assert.match(english.pickupAddress,/Taicang Avenue/);
assert.deepEqual(english.needsReview,[]);
const chinese=parseText(['物流单号 YT12345678910','菜鸟驿站 3号店','太仓市文教路 18 号','取件码：34-2-5678','收件人 13800000000']);
assert.equal(chinese.pickupCode,'34-2-5678');
assert.match(chinese.pickupAddress,/文教路/);
const missing=parseText(['包裹已到站','物流单号 YT12345678910','客服电话 13800000000']);
assert.equal(missing.pickupCode,'');
assert.ok(missing.needsReview.includes('pickupCode'));
const split=parseText(['Already placed in Cainiao station','Store No. 21, Qingcao Lane Square','B1-21-1, Qingcao','Lane Plaza, No. 15 Taicang Avenue','Pickup code 12-3-4567']);
assert.match(split.pickupAddress,/^B1-21-1/);
console.log('OCR field extraction checks passed');
const pending=parseText([
 '待取件6','追踪中','已签收9','已退回',
 '太仓青草巷广场二十一号店 > 畅通',
 '1-1-0881','今日到站 本人 周* 189****2873','京东 JD0262126420881',
 '1-2-8011','今日到站 本人 周*','京东 JD026212731380-1-1-',
 '3-4-8559','已到3天','中通 79034721028559',
 '5-5-5341','已到1天','中通 73728460425341',
 '13-2-1337','今日到站','中通 79144918891337',
 '26-4-1320','已到3天','圆通 YT0076166291320'
]);
assert.deepEqual(pending.pickupCodes,['1-1-0881','1-2-8011','3-4-8559','5-5-5341','13-2-1337','26-4-1320']);
assert.equal(pending.pickupPoint,'太仓青草巷广场二十一号店');
assert.equal(pending.pickupAddress,'');
assert.equal(pending.candidates.length,6);
const groups=parseText(['太仓青草巷广场二十一号店','1-1-0881','另一广场二十二号店','1-2-8011']);
assert.equal(groups.candidates[0].point,'太仓青草巷广场二十一号店');
assert.equal(groups.candidates[1].point,'另一广场二十二号店');
assert.equal(groups.pickupPoint,'');
console.log('Pending parcel list: all six codes, station assignment, tracking number exclusion, missing address and multiple stations passed.');
{
 const r=parseText(['公太仓青草巷广场二十一号店 > 畅通','1-1-0881','1-2-8011','3-4-8559','5-5-5341','13-2-1337','26-4-1320']);
 assert.equal(r.pickupPoint,'太仓青草巷广场二十一号店');
 assert.equal(r.pickupCodes.length,6);
 assert.equal(parseText(['公园二十一号店','1-1-0881']).pickupPoint,'公园二十一号店');
 console.log('Confirmed icon alias cleaned; legitimate 公 preserved.');
}
