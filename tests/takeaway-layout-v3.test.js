// 2026-11-17: takeaway page layout. The address comes before the locker (the locker list depends on the dorm), runner
// details sit in their own card with quick note chips, section headings use icons, and fee + bill share one card.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const xml = read('pages/takeaway/index.wxml'), js = read('pages/takeaway/index.js');
const at = s => { const i = xml.indexOf(s); assert.ok(i >= 0, 'missing ' + s); return i; };
assert.ok(at('class="addr-label"') < at("{{zh?'外卖柜':'Takeaway locker'}}"), 'address first, then the locker');
assert.ok(at('class="tw-first-hint"') < at('<picker wx:if="{{!lockerManual}}"'), 'without an address, a hint says lockers appear after adding one');
assert.match(xml, /wx:if="\{\{!addressReady && !tripId\}\}" class="tw-first-hint"/);
assert.ok(at('class="flow-card tw-details"') < at('note-photo-area'), 'runner details have their own card');
assert.ok(at('class="flow-card arrival-card"') < at('class="flow-card tw-details"') && at('purchase-status-card') < at('class="flow-card tw-details"'), 'arrival time (or order status) comes right after the locker');
assert.ok(at('note-photo-area') < at('note-soup') && at('note-soup') < at('{{ui.noteLabel}}'), 'runner card: photos, soup, then the note last');
assert.match(xml, /class="tw-chip"[^>]*data-text="\{\{item\}\}" bindtap="noteChip"/, 'quick note chips');
for (const icon of ['clock', 'coin', 'note']) { assert.match(xml, new RegExp('class="tw-head-icon" mode="aspectFit" src="/assets/icons3d/' + icon + '\\.svg"')); }
for (const icon of ['clock', 'coin']) assert.ok(fs.existsSync(path.join(__dirname, '..', 'assets/icons3d/' + icon + '.svg')), icon + ' icon exists');
assert.match(xml, /class="flow-card arrival-card"/, 'the first-time tip still finds the arrival card');
assert.ok(at('class="flow-card fee-card"') < at('class="totals-card tw-bill"') && xml.indexOf('flow-card totals-card') < 0, 'fee and bill in one card');
// chips add an instruction once
let def; global.Page = d => { def = d; }; global.wx = global.wx || { getStorageSync: () => null, setStorageSync() {} };
const noteChip = new Function('return ({' + js.slice(js.indexOf('noteChip(e){'), js.indexOf('text(e){')) + '})')().noteChip;
const page = { data: { note: '', zh: false }, text(e) { this.data.note = e.detail.value; } };
noteChip.call(page, { currentTarget: { dataset: { text: 'Knock when you arrive' } } });
noteChip.call(page, { currentTarget: { dataset: { text: 'Call me from downstairs' } } });
noteChip.call(page, { currentTarget: { dataset: { text: 'Knock when you arrive' } } });
assert.equal(page.data.note, 'Knock when you arrive, Call me from downstairs');
console.log('Takeaway layout: address then locker, runner card with chips, icon headings, one price card');
