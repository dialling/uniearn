// 2026-11-17: Yuni reminds people how points are earned: finish or run an order, and feed Yuni fish.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const src = fs.readFileSync(path.join(__dirname, '..', 'components/yuni-stage/index.js'), 'utf8');
assert.match(src, /moves\.push\('orderHint', 'orderHint'\)/, 'the order tip is part of Yuni\'s chatter');
assert.match(src, /'Finish or run orders for points!', 'Feed me fish for points too!'/);
assert.match(src, /'完成订单或帮忙跑单，都能赚积分！', '喂我吃鱼也能赚积分哦！'/);
console.log('Yuni order hint: finish or run an order, and feed Yuni, to earn points');
