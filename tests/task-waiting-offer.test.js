// 2026-11-17: on the customer's task page while waiting for a runner, the offer and the price details share one card
// (coin heading, light amount pills, the bill under a dashed line, cancel as the last row). The separate price card
// returns once a runner accepts.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const xml = fs.readFileSync(path.join(__dirname, '..', 'pages/task/index.wxml'), 'utf8');
const at = s => { const i = xml.indexOf(s); assert.ok(i >= 0, 'missing ' + s); return i; };
assert.match(xml, /class="flow-card offer-card task-offer-v2"/);
assert.match(xml, /class="tk-head-icon" mode="aspectFit" src="\/assets\/icons3d\/coin\.svg"/);
assert.ok(at('class="offer-options"') < at('class="tk-bill"') && at('class="tk-bill"') < at('class="offer-footer"'), 'pills, then the bill, then cancel');
assert.ok(xml.slice(at('class="tk-bill"'), at('class="offer-footer"')).includes('{{ui.totalSim}}'), 'the bill shows the total');
assert.match(xml, /<view wx:if="\{\{!\(request\.isMine && request\.status==='waiting'\)\}\}" class="flow-card">\s*<view class="strong">\{\{zh\?'费用明细':'Price details'\}\}<\/view>/, 'separate price card only when not waiting');
assert.match(xml, /bindtap="raise"/); assert.match(xml, /bindtap="customRaise"/); assert.match(xml, /class="offer-cancel"[^>]*bindtap="cancel"/);
assert.match(xml, /<template is="customerCancelSheet"/, 'the approved cancel sheet is unchanged');
console.log('Task waiting: one offer + price card, cancel last, price card back after acceptance');
