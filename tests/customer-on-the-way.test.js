// 2026-11-17: once the runner picks up, the customer sees "On the way" (not "Picked up", which read as finished).
// The runner still sees "Picked up". A status change shows one Yuni notice, not the card and a toast together.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const req = read('pages/request/index.js');
assert.match(req, /collected:zh\?'配送中':'On the way'/, 'customer status title');
assert.match(req, /Your runner has your items and is on the way\./, 'customer note');
assert.match(req, /if\(!r\.isMine\)titles\.collected=zh\?'已取件':'Picked up';/, 'runner keeps Picked up');
global.wx = global.wx || { getStorageSync: () => null, setStorageSync() {} };
const store = require('../utils/store'), events = require('../utils/yuni-events');
store.reset(); store.update(s => { s.language = 'en'; s.profile = { ...s.profile, accountId: 'a1' }; });
const got = []; events.subscribe(e => { if (e) { got.push(e); events.next(); } });
events.status({ id: 'r1', status: 'collected', isMine: true, category: 'takeout' }, 1);
events.status({ id: 'r2', status: 'collected', isMine: false, category: 'takeout' }, 1);
events.status({ id: 'r3', status: 'taken', isMine: false, category: 'task', station: 'Task' }, 1);
assert.equal(got[0].title, 'On the way!'); assert.equal(got[1].title, 'Picked up!');
assert.doesNotMatch(got[2].text, /Head to Task/, 'a task does not say "Head to Task"');
assert.match(read('components/yuni-assistant/index.wxml'), /wx:if="\{\{toast && event\.small\}\}" class="event-toast"/, 'no toast on top of the card');
console.log('Customer sees On the way after pickup; runner sees Picked up; one notice at a time');
