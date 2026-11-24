// 2026-11-17: the level points list keeps points and fish apart: "+10 pts" in the pill, "2 fish" under it (5 points a fish).
// Inviting a classmate is worth 20.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const server = JSON.parse(read('legacy/cloudfunctions/orderService/activity-default.json'));
assert.equal(server.tasks.find(t => t.kind === 'referral').points, 20, 'invite is 20 points on the server');
assert.match(read('utils/news-activity.js'), /"kind": "referral",\s*"enabled": true,\s*"points": 20/, 'the app shows 20 for invite');
let def; global.Page = d => { def = d; }; global.wx = global.wx || { getStorageSync: () => null, setStorageSync() {} };
require('../pages/levels/index.js');
const src = read('pages/levels/index.js'), fishInfo = new Function(src.slice(src.indexOf('const FISH_POINTS'), src.indexOf('Page({')) + 'return fishInfo;')();
const order = fishInfo({ kind: 'customer_order', points: 10, firstCompletion: { points: 20 } }, false);
assert.equal(order.fishCount, 2, '+10 points is 2 fish'); assert.equal(order.fishLabel, '2 fish'); assert.equal(order.fishIcons.length, 2);
assert.equal(order.firstLabel, 'First completion in this role: 20 points (4 fish)');
assert.equal(fishInfo({ kind: 'runner_order', points: 15 }, true).fishLabel, '3 条鱼');
assert.equal(fishInfo({ kind: 'weekly_login', points: 10 }, false).fishLabel, '1 a day');
assert.equal(fishInfo({ kind: 'referral', points: 20 }, false).fishCount, undefined, 'invite has no fish');
const wxml = read('pages/levels/index.wxml');
assert.match(wxml, /\+\{\{item\.points\}\}<text class="lv-earn-unit">/, 'the pill says points');
assert.match(wxml, /wx:for="\{\{item\.fishIcons\}\}"[^>]*class="lv-earn-fish"/, 'one fish picture per fish');
assert.ok(fs.existsSync(path.join(__dirname, '..', 'assets/yuni-feed/fish.png')));
console.log('Level points: points and fish shown apart (5 points a fish); invite 20 points');
