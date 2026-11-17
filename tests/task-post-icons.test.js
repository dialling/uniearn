// 2026-11-17: Post a task uses 3D icon headings (task, clock, coin) like the takeaway and parcel pages, not numbers.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const xml = fs.readFileSync(path.join(__dirname, '..', 'pages/task-post/index.wxml'), 'utf8');
for (const [icon, title] of [['task', 'ui.need'], ['clock', 'ui.doneBy'], ['coin', 'ui.price']]) assert.match(xml, new RegExp('class="tp-head-icon" mode="aspectFit" src="/assets/icons3d/' + icon + '\.svg"/><text>\{\{' + title.replace('.', '\.') + '\}\}</text>'), icon + ' heading');
assert.doesNotMatch(xml, /class="step tp-step"/, 'no number badges');
assert.match(xml, /class="flow-card deadline-card"/, 'the first-time tip still finds the deadline card');
console.log('Post a task: icon headings');
