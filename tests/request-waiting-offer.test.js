// 2026-11-17: takeaway/parcel order page while waiting for a runner, the same as the task page: the offer moves out of the
// ticket into one card under it (lightning heading, light pills, total under a dashed line, orange cancel last). After a
// runner accepts, the ticket footer and the usual cancel card come back.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const xml = read('pages/request/index.wxml'), css = read('pages/request/index.wxss');
const at = s => { const i = xml.indexOf(s); assert.ok(i >= 0, 'missing ' + s); return i; };
assert.ok(xml.indexOf('journey-offer-panel') < 0, 'no offer panel inside the ticket any more');
assert.match(xml, /<view wx:if="\{\{request\.isMine && request\.status==='waiting'\}\}" class="flow-card offer-card rq-offer">/);
assert.match(xml, /class="rq-head-icon" mode="aspectFit" src="\/assets\/icons3d\/bolt\.svg"/);
assert.ok(at('class="offer-options"') < at('class="rq-bill"') && at('class="rq-bill"') < at('class="offer-footer"'), 'pills, total, cancel');
assert.ok(!xml.slice(at('class="rq-bill"'), at('class="offer-footer"')).includes('serviceFee'), 'no service fee row');
assert.match(xml, /class="offer-cancel" hover-class="offer-cancel-press" bindtap="cancel">\{\{cancelWindow\.button\}\}/);
assert.match(xml, /request\.isMine && request\.status!=='waiting' && \(request\.status==='taken'\|\|request\.status==='collected'\|\|cancelWindow\.phase!=='hidden'\)\}\}" class="journey-ticket-footer"/, 'ticket footer only after acceptance');
assert.match(xml, /cancelWindow\.phase!=='hidden' && !\(request\.isMine && request\.status==='waiting'\)\}\}" class="flow-card cancel-window-card"/, 'one cancel button while waiting');
assert.match(css, /\.rq-offer button\.offer-cancel\{[^}]*background:#fdeee4;color:#c2410c/, 'orange cancel');
console.log('Order waiting: offer card under the ticket like the task page, orange cancel, footer back after acceptance');
// 2026-11-17 (shorter): price shown once (no "Your offer" in the heading), three amounts, Order details folded while waiting.
assert.ok(!xml.includes("'Your offer'"), 'no "Your offer" price in the heading');
assert.match(read('pages/request/index.js'), /offerAmounts:\[1\.88,3\.88,5\.88\]/); assert.match(read('pages/task/index.js'), /offerAmounts:\[1\.88,3\.88,5\.88\]/);
assert.ok(!read('pages/task/index.wxml').includes("'Your offer'"), 'task heading has no "Your offer" either');
assert.match(xml, /bindtap="toggleDetails"/); assert.match(xml, /<block wx:if="\{\{!\(request\.isMine && request\.status==='waiting'\) \|\| detailsOpen\}\}">/, 'details fold while waiting');
assert.match(xml, /<view wx:if="\{\{!\(request\.isMine && request\.status==='waiting'\)\}\}" class="journey-detail-row journey-price-row">/, 'no reward row while waiting (the total is in the offer card)');
