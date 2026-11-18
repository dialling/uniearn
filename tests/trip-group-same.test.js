// 2026-11-18: on the runner's trip page, takeaway orders from the same person, same locker, same destination and same step
// share one card: one pick-up, one delivery photo, and each order can still be cancelled on its own.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const js = read('pages/trip/index.js'), xml = read('pages/trip/index.wxml');
const groupSame = new Function(js.slice(js.indexOf('function groupSame('), js.indexOf("const store=require('../../utils/store'),")) + 'return groupSame;')();
const base = { category: 'takeout', night: false, status: 'taken', ownerId: 'u1', owner: 'Ming', pickupPoint: 'KFC', destinationType: 'dorm', dorm: 'D01', room: '1218', deliveryAddress: '', phone: '13800001111', phoneLast4: '1111', boxes: 1 };
let out = groupSame([{ ...base, id: 'r1' }, { ...base, id: 'r2' }, { ...base, id: 'r3', room: '1220' }]);
assert.deepEqual(out[0].groupIds, ['r1', 'r2'], 'same person, locker and room: one group');
assert.equal(out[0].groupLabel, '#r1 · #r2'); assert.equal(out[0].groupBoxes, 2); assert.equal(out[1].groupHidden, true);
assert.equal(out[2].groupIds, null, 'another room stays its own card');
out = groupSame([{ ...base, id: 'r1' }, { ...base, id: 'r2', status: 'collected' }]);
assert.equal(out[0].groupIds, null, 'different steps are not grouped');
out = groupSame([{ ...base, id: 'r1' }, { ...base, id: 'r2', phone: '13900002222', phoneLast4: '2222' }]);
assert.deepEqual(out[0].groupExtraPhones, [{ id: 'r2', phone: '13900002222', last4: '2222' }], 'a different bag phone is listed too');
assert.equal(groupSame([{ ...base, id: 'r1', night: true }, { ...base, id: 'r2', night: true }])[0].groupIds, null, 'night market orders stay separate');
assert.match(xml, /&& !item\.groupHidden\}\}" class="flow-card \{\{item\.groupIds\?'trip-group-card':''\}\}"/);
assert.match(xml, /data-ids="\{\{item\.groupIdsText\|\|item\.id\}\}" bindtap="collectAndDeliver"/, 'one pick-up for the group');
assert.match(xml, /data-ids="\{\{item\.groupIdsText\|\|item\.id\}\}" bindtap="photo"/, 'one delivery photo for the group');
assert.match(js, /for\(const id of ids\)\{const r=store\.get\(\)\.requests\.find\(x=>x\.id===id\);if\(r&&r\.status==='collected'\)await orders\.act\('deliver',\{id,photo\}\);\}/);
assert.ok(xml.includes('class="trip-group-remind"'), 'reminds how many bags'); assert.ok(xml.includes("'Picked up '+item.groupBoxes+' bags, go deliver'"), 'the button says the bag count');
assert.ok(xml.includes('data-ids="{{item.groupIdsText}}" bindtap="cancelPick"'), 'one cancel button for the group'); assert.ok(js.includes('cancelPick(e){') && js.slice(js.indexOf('cancelPick(e){'), js.indexOf('},cancel(e){')).includes('wx.showActionSheet'), 'it asks which order');
console.log('Trip groups: same person, locker, destination and step share one card; one Cancel that asks which order, bag-count reminder');
