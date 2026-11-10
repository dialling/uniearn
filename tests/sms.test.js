const assert=require('node:assert/strict');
const {parseSms}=require('../cloudfunctions/parseSmsScreenshot/parser');
const now=Date.parse('2026-09-29T10:37:00Z');
const fixture=[
 'Sun, Sep 20 at 13:13','【菜鸟驿站】您的包裹已到站，凭','17-2-9125到太仓青草巷广场二十一','号店取件。',
 'Sun, Sep 20 at 14:59','【菜鸟驿站】您有2个包裹在太仓青草','巷广场二十一号店，取件码为','26-6-7597, 28-3-1642',
 'Mon, Sep 21 at 13:06','【菜鸟驿站】您有2个包裹在太仓青草','巷广场二十一号店，取件码为','6-4-7549, 9-5-8359',
 'Yesterday 12:33','【菜鸟驿站】您有3个包裹在太仓青草','巷广场二十一号店待取，请凭','5-5-5341, 26-4-1320, 3-4-8559等','取件码，尽早取件。',
 'Today 11:00','【菜鸟驿站】您有3个包裹在太仓青草','巷广场二十一号店，取件码为','1-2-8011, 1-1-0881, 5-5-5341'];
const r=parseSms(fixture,now);
assert.deepEqual(r.candidates.filter(x=>x.selected).map(x=>x.code),['1-2-8011','1-1-0881','5-5-5341','26-4-1320','3-4-8559']);
assert.equal(r.candidates.length,10);
assert.ok(r.candidates.every(x=>x.point==='太仓青草巷广场二十一号店'));
assert.deepEqual(parseSms(fixture.slice(0,16),now).candidates.filter(x=>x.selected).map(x=>x.code),['5-5-5341','26-4-1320','3-4-8559']);
assert.deepEqual(parseSms(['【菜鸟驿站】凭17-2-9125取件','【菜鸟驿站】凭3-4-8559取件'],now).candidates.filter(x=>x.selected).map(x=>x.code),['3-4-8559']);
assert.equal(parseSms(['Today 11:00','取件码3–4–8559, 26－4－1320'],now).candidates.length,2);
assert.equal(parseSms('No pickup notice',now).candidates.length,0);
const coords=fixture.map((DetectedText,i)=>({DetectedText,ItemPolygon:{X:20,Y:i*40,Height:20}})).reverse();
assert.deepEqual(parseSms(coords,now),r);
const eng=parseSms(['Today 11:00','Collect at Store No. 21, Qingcao Lane Square. Please use pickup code 27-4-2127.'],now);
assert.equal(eng.candidates[0].point,'Store No. 21, Qingcao Lane Square');
const {dateOf}=require('../cloudfunctions/parseSmsScreenshot/parser');
assert.equal(dateOf('2026年9月29日 11:00',now),dateOf('Today 11:00',now));
assert.equal(dateOf('Yesterday 12:33',now)+1,dateOf('Today 11:00',now));
console.log('SMS parser: screenshot fixture, deduplication, date gap, unknown dates, OCR order, English and Chinese dates passed.');
