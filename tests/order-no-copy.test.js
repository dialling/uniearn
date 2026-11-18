// 2026-11-18: order numbers are quiet metadata in Order details, each with a copy icon.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
for (const [xml, js] of [['pages/request/index.wxml', 'pages/request/index.js'], ['pages/task/index.wxml', 'pages/task/index.js'], ['pages/order-feedback/index.wxml', 'pages/order-feedback/index.js'], ['pages/public-job/detail.wxml', 'pages/public-job/index.js']]) {
  assert.match(read(xml), /class="ue-orderno[^"]*" data-id="\{\{[a-z.]+\}\}" catchtap="copyOrderNo"/, xml + ' has the copy row');
  assert.match(read(xml), /src="\/assets\/icons\/copy\.svg"/, xml + ' shows the copy icon');
  assert.ok(read(js).includes("copyOrderNo(e){require('../../utils/order-no').copy(e.currentTarget.dataset.id,this.data.zh);}"), js + ' copies');
}
let copied = null, toast = null;
global.wx = { setClipboardData: o => { copied = o.data; o.success(); }, showToast: o => { toast = o.title; } };
require('../utils/order-no').copy('r212', false);
assert.equal(copied, 'R212', 'copies the number as shown'); assert.equal(toast, 'Order no. copied');
assert.ok(fs.existsSync(path.join(__dirname, '..', 'assets/icons/copy.svg')));
assert.match(read('app.wxss'), /\.ue-copy-icon\{/);
console.log('Order numbers: in Order details with a copy icon on every page');
