// 2026-11-18: the WeChat WXML compiler rejects backslash escapes such as \' inside {{ }} ("Bad value ... did you forget }}").
// Write apostrophes in WXML strings as ʼ (U+02BC) instead.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const root = path.join(__dirname, '..'), skip = new Set(['node_modules', '.git', 'preview-web', 'UniEarn-GitHub-Changes', 'uniearn-upload', 'design', 'admin-web']);
const bad = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skip.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.wxml') && fs.readFileSync(p, 'utf8').includes(String.fromCharCode(92))) bad.push(path.relative(root, p));
  }
})(root);
assert.deepEqual(bad, [], 'no backslashes in WXML: ' + bad.join(', '));
console.log('WXML: no backslash escapes (the WeChat compiler rejects them)');
