// 2026-11-17: on the customer's task page while waiting for a runner, the offer and the price details share one card
// (lightning heading = faster, orange cancel, no service fee row, light amount pills, the bill under a dashed line, cancel as the last row). The separate price card
// returns once a runner accepts.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const xml = fs.readFileSync(path.join(__dirname, '..', 'pages/task/index.wxml'), 'utf8');
const at = s => { const i = xml.indexOf(s); assert.ok(i >= 0, 'missing ' + s); return i; };
assert.match(xml, /class="flow-card offer-card task-offer-v2"/);
assert.match(xml, /class="tk-head-icon" mode="aspectFit" src="\/assets\/icons3d\/bolt\.svg"/, 'lightning heading: a faster pickup');
assert.ok(at('class="offer-options"') < at('class="tk-bill"') && at('class="tk-bill"') < at('class="offer-footer"'), 'pills, then the bill, then cancel');
assert.ok(xml.slice(at('class="tk-bill"'), at('class="offer-footer"')).includes('{{ui.totalSim}}'), 'the bill shows the total');
assert.match(xml, /<view wx:if="\{\{!\(request\.isMine && request\.status==='waiting'\)\}\}" class="flow-card">\s*<view class="strong">\{\{zh\?'费用明细':'Price details'\}\}<\/view>/, 'separate price card only when not waiting');
assert.match(xml, /bindtap="raise"/); assert.match(xml, /bindtap="customRaise"/); assert.match(xml, /class="offer-cancel"[^>]*bindtap="cancel"/);
assert.match(xml, /<template is="customerCancelSheet"/, 'the approved cancel sheet is unchanged');
assert.ok(!xml.slice(at('class="tk-bill"'), at('class="offer-footer"')).includes('ui.serviceFee'), 'no service fee row in the waiting card');
assert.ok(fs.existsSync(path.join(__dirname, '..', 'assets/icons3d/bolt.svg')), 'lightning icon exists');
assert.match(fs.readFileSync(path.join(__dirname, '..', 'pages/task/index.wxss'), 'utf8'), /button.offer-cancel{border:0;background:#fdeee4;color:#c2410c/, 'cancel is orange');
console.log('Task waiting: one offer + price card, cancel last, price card back after acceptance');
