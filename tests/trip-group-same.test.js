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
assert.match(xml, /wx:for="\{\{item\.groupIds\}\}" wx:for-item="gid" wx:key="\*this" class="btn pickup-cancel pickup-cancel-small" data-id="\{\{gid\}\}" bindtap="cancel"/, 'cancel each order on its own');
assert.match(js, /for\(const id of ids\)\{const r=store\.get\(\)\.requests\.find\(x=>x\.id===id\);if\(r&&r\.status==='collected'\)await orders\.act\('deliver',\{id,photo\}\);\}/);
console.log('Trip groups: same person, locker, destination and step share one card; cancel stays per order');
