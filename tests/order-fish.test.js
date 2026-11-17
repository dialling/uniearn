// 2026-11-17: a finished order leaves a fish for Yuni (poster and runner each get one). The points are added when the
// order is confirmed; feeding the fish on the Me page only shows them, and each fish can be fed once.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const loyalty = require('../cloudfunctions/orderService/loyalty');
const now = Date.parse('2026-11-17T04:00:00Z');
const s = { members: {}, requests: [], trips: [], loyaltyStartedAt: now - 86400000 };
const r = { id: 'r1', ownerId: 'poster', confirmedAt: now };
loyalty.completeOrder(s, r, { runnerAccountId: 'runner' }, now);
const posterFish = s.members.poster.loyalty.orderFish, runnerFish = s.members.runner.loyalty.orderFish;
const pts = s.members.poster.loyalty.points;
assert.equal(posterFish.length, Math.ceil(pts / 5), 'the poster gets one fish per 5 points'); assert.ok(runnerFish.length >= 2, 'the runner gets fish too');
assert.ok(posterFish.every(f => f.points <= 5), 'each fish is worth up to 5 points');
assert.equal(posterFish.reduce((n, f) => n + f.points, 0), pts, 'together the fish show the points just added');
assert.equal(runnerFish[0].role, 'runner');
loyalty.completeOrder(s, r, { runnerAccountId: 'runner' }, now + 1000);
assert.equal(s.members.poster.loyalty.orderFish.length, posterFish.length, 'confirming again adds no more fish');
assert.deepEqual(loyalty.view(s.members.poster).orderFish, posterFish, 'the app receives the fish');

// App side: the fish waits on Feed until Yuni eats it.
const saved = {}; global.wx = { getStorageSync: k => saved[k], setStorageSync: (k, v) => { saved[k] = v; } };
const store = require('../utils/store'), fish = require('../utils/order-fish');
store.reset(); store.update(x => { x.profile = { ...x.profile, accountId: 'poster', onboarded: true }; x.progressionAccountId = 'poster'; x.serverTime = now; x.progression = { orderFish: posterFish }; });
assert.equal(fish.waiting().length, posterFish.length, 'all the fish wait');
fish.markFed(posterFish[0].id); assert.equal(fish.waiting().length, posterFish.length - 1, 'each fish is fed once');
store.update(x => { x.progression = { orderFish: [{ id: 'old', role: 'customer', points: 10, at: now - 20 * 86400000 }] }; });
assert.equal(fish.waiting().length, 0, 'fish older than 14 days are not shown');

const stage = fs.readFileSync(path.join(__dirname, '..', 'components/yuni-stage/index.js'), 'utf8');
assert.match(stage, /if \(this\.data\.orderFish && !this\.F\) return this\.feedOrderFish\(\);/, 'Feed eats an order fish');
assert.doesNotMatch(stage.slice(stage.indexOf('feedOrderFish() {'), stage.indexOf('    chew() {')), /orders\.act/, 'feeding an order fish never adds points again');
console.log('Order fish: 5 points a fish for poster and runner, each fed once on the Me page');
