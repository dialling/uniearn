const assert=require('node:assert/strict');
const {extractPoint,normalizePoint}=require('../utils/pickup-point');
assert.equal(extractPoint('【菜鸟驿站】您的包裹已到站，凭13-2-1337到太仓青草巷广场二十一号店取件。'),'太仓青草巷广场二十一号店');
assert.equal(extractPoint('【菜鸟驿站】您的包裹已到站，凭13-2-1337到太仓青草巷广场21号店取件。'),'太仓青草巷广场21号店');
assert.equal(extractPoint('【菜鸟驿站】包裹在苏州园区文荟公寓驿站，取件码13-2-1337。'),'苏州园区文荟公寓驿站');
assert.equal(extractPoint('【菜鸟驿站】凭13-2-1337到园区翰林缘自提点取件。'),'园区翰林缘自提点');
assert.equal(extractPoint('Please collect at Store No. 21, Qingcao Lane Square. Please use pickup code 27-4-2127.'),'Store No. 21, Qingcao Lane Square');
assert.equal(normalizePoint('公园二十一号店'),'公园二十一号店');
assert.equal(extractPoint('您的包裹已到站，取件码13-2-1337。'),'');
const {parseSms}=require('../cloudfunctions/parseSmsScreenshot/parser');
const multi=parseSms('【菜鸟驿站】凭13-2-1337到园区文荟公寓驿站取件\n【菜鸟驿站】凭14-2-1338到园区翰林缘自提点取件');
assert.equal(new Set(multi.candidates.map(x=>x.point)).size,2);
// 2026-11-22: Cainiao pending-parcel list. The app's own search box "到驿站的所有包裹都可查" and the
// "欢迎使用菜鸟驿站" banner must not become the station; the store header above the codes is the station.
assert.equal(extractPoint('到驿站的所有包裹都可查 欢迎使用菜鸟驿站 公太仓青草巷广场二十一号店 畅通 8-3-7279 本人 中通 79049488227279'),'');
assert.equal(extractPoint('到驿站的所有包裹都可查\n欢迎使用菜鸟驿站\n太仓青草巷广场二十一号店 畅通 >\n8-3-7279'),'太仓青草巷广场二十一号店');
{
  const {parseText}=require('../cloudfunctions/parseSmsScreenshot/parcel-parser');
  const rows=['11:19','到驿站的所有包裹都可查','欢迎使用菜鸟驿站','公太仓青草巷广场二十一号店','8-3-7279','本人 M* 188****0404','中通 79049488227279','26-4-4757','本人 M* 188****0404','邮政 9352131914757','已签收'];
  const det=rows.map((t,i)=>({DetectedText:t,ItemPolygon:{X:100,Y:i*60,Width:300,Height:40}}));
  const list=parseText(det);
  assert.deepEqual(list.candidates.map(x=>[x.code,x.point]),[['8-3-7279','太仓青草巷广场二十一号店'],['26-4-4757','太仓青草巷广场二十一号店']]);
  assert.equal(parseSms(det).candidates.every(x=>!x.point),true);
}
console.log('Station extraction: full SMS removed, actual name variants retained, campus stations separated, no fixed default.');
