// 2026-11-18: My orders header: two role tabs with an icon (clipboard = any request, coin = running), no counts;
// the line under the tabs explains the chosen tab. "I'm" uses a straight apostrophe (the curly one shows a gap on phones).
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const xml = read('pages/requests/index.wxml'), css = read('pages/requests/index.wxss');
assert.ok(xml.includes('class="service-tabs glass rq-roles rq-roles-3"'), '三栏：我发布的 / 我的消息 / 我接的单');
assert.ok(xml.includes('src="/assets/icons3d/clipboard.svg"') && xml.includes('src="/assets/icons3d/trip.svg"'), 'an icon on each tab');
assert.ok(xml.indexOf('class="service-tabs glass rq-roles rq-roles-3"') < xml.indexOf('class="flow-sub rq-role-sub"'), 'the explanation sits under the tabs');
assert.ok(xml.includes("{{zh?'我接的单':runLabel}}") && read('pages/requests/index.js').includes(`runLabel:"I'm running"`));
assert.ok(!xml.includes('rq-role-count'), 'no counts on the tabs');
console.log('My orders: role tabs with icons, no counts, explanation under them');
