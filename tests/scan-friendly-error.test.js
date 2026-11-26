// 2026-11-17: when a pickup screenshot cannot be read, customers see a plain try-again message, never the raw cloud error
// (e.g. "cloud.callFunction:fail -501000 ..."). A screenshot that reads but holds no pickup codes gets the same message.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const EN = "We couldn't read the pickup code. Please try again with a clear screenshot where the code is easy to see.";
const ZH = '没能识别取件码。请换一张清晰的截图再试，确保取件码完整可见。';
// 2026-11-26 用户要求：快递代取上传截图后重新识别取件码和驿站（截图同时作为凭证发给跑手）。
// 识别失败时只提示手填，绝不显示原始云端错误。
const create = read('pages/create/index.js');
assert.ok(/ocr\.recognize/.test(create), 'the parcel page reads the pickup screenshot again');
assert.doesNotMatch(create, /scanState:e\.message|scanError:e\.message/, 'the parcel page never shows the raw error');
for (const f of ['pages/sms-scan/index.js']) {
  const s = read(f);
  assert.ok(s.includes(EN) && s.includes(ZH), f + ' has the friendly message in both languages');
  assert.doesNotMatch(s, /(error|scanError):e\.message\|\|/, f + ' never shows e.message to the customer');
}
// behaviour: the Read pickup screenshot page
let def; global.Page = d => { def = d; };
global.wx = { getStorageSync: () => null, setStorageSync() {}, cloud: null };
require('../pages/sms-scan/index.js');
const page = { ...def, data: { ...def.data, zh: false, mode: 'screenshot' }, setData(v) { Object.assign(this.data, v); } };
page.applyResult({ candidates: [] });
assert.equal(page.data.error, EN, 'no codes found: the same try-again message');
page.data.zh = true; page.applyResult({ candidates: [] });
assert.equal(page.data.error, ZH);
page.applyResult({ candidates: [{ id: '0', code: '5-1-2208', point: '', selected: true }] });
assert.equal(page.data.error, '', 'a good read clears the message');
console.log('Pickup screenshot: plain try-again message when it cannot be read, in English and Chinese');
