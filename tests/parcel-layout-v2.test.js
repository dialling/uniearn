// 2026-11-17: the parcel request page uses the takeaway page's look: 3D icon headings, a pin on the address summary,
// quick note chips, a fragile switch, and "Need it faster?" sharing one card with the bill.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const xml = read('pages/create/index.wxml'), js = read('pages/create/index.js'), css = read('pages/create/index.wxss');
assert.match(xml, /class="post-page create-page \{\{darkClass\}\} \{\{mode==='request'&&category==='parcel'\?'pc-v2':''\}\}"/, 'scoped to the parcel request page');
for (const icon of ['home', 'parcel', 'note', 'clock', 'coin']) assert.match(xml, new RegExp('class="pc-head-icon" mode="aspectFit" src="/assets/icons3d/' + icon + '\\.svg"'), icon + ' heading icon');
assert.doesNotMatch(xml, /class="step-number[^"]*">[1-4★]</, 'no number badges left on the parcel page');
assert.match(xml, /class="addr-summary"><image class="pc-sum-icon"/, 'address summary shows the pin, not a "To" badge');
assert.match(xml, /class="tw-chip"[^>]*bindtap="noteChip"/, 'quick note chips');
assert.ok(xml.indexOf('class="step-card pc-price"') < xml.indexOf('class="totals-card pc-bill"') && xml.indexOf('step-card totals-card') < 0, 'tip and bill in one card');
assert.ok(xml.indexOf('size-private') < xml.indexOf('catchtap="openParcelScreenshot"'), 'the screenshot upload stays under the private heading');
assert.match(css, /\.create-page\.pc-v2 \.fragile-toggle \.check\.checked::after\{transform:translateX\(36rpx\)\}/, 'fragile is a switch');
const noteChip = new Function('return ({' + js.slice(js.indexOf('noteChip(e){'), js.indexOf('text(e){')) + '})')().noteChip;
const page = { data: { description: 'One box is fragile', zh: false }, text(e) { this.data[e.currentTarget.dataset.field] = e.detail.value; } };
noteChip.call(page, { currentTarget: { dataset: { text: 'Call me from downstairs' } } });
noteChip.call(page, { currentTarget: { dataset: { text: 'Call me from downstairs' } } });
assert.equal(page.data.description, 'One box is fragile, Call me from downstairs');
console.log('Parcel layout: icon headings, pin summary, note chips, fragile switch, one price card');
