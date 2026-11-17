// 2026-11-17: Me counts points up as Yuni eats. Points inside a waiting fish (order fish, today's dried fish) are held back
// from what Me shows and added when that fish is fed; the server total itself never changes.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const saved = {}; global.wx = { getStorageSync: k => saved[k], setStorageSync: (k, v) => { saved[k] = v; } };
const store = require('../utils/store'), fish = require('../utils/order-fish'), china = require('../utils/china-time');
const now = Date.now(), today = china.dayKey(now);
store.reset();
store.update(s => { s.profile = { ...s.profile, accountId: 'a1', onboarded: true, campusId: 'sip', loggedOut: false }; s.progressionAccountId = 'a1'; s.serverTime = now;
  s.progression = { points: 100, level: 2, checkin: { day: today, dailyPoints: 2, rewardPoints: 0 }, notices: [],
    orderFish: [{ id: 'f1', role: 'customer', points: 5, at: now }, { id: 'f2', role: 'customer', points: 5, at: now }] }; });
assert.equal(fish.pendingPoints(), 12, 'two order fish and today\'s dried fish are still waiting');
assert.equal(fish.shownProgression().points, 88, 'Me shows the points not yet fed');
fish.markFed('f1'); assert.equal(fish.shownProgression().points, 93, 'feeding a fish adds its 5 points');
require('../utils/checkin').markFed({ key: 'a1:' + today }); assert.equal(fish.shownProgression().points, 95, 'the dried fish adds its 2 points');
fish.markFed('f2'); assert.equal(fish.shownProgression().points, 100, 'all fed: Me matches the server total');
assert.equal(store.get().progression.points, 100, 'the server total is untouched');
const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
assert.match(read('pages/profile/index.js'), /yuni-level'\)\.view\(require\('\.\.\/\.\.\/utils\/order-fish'\)\.shownProgression\(state\)\)/, 'Me uses the shown points');
assert.match(read('components/yuni-stage/index.js'), /next\.feedCount !== this\.lastFeedCount\) setTimeout\(\(\) => this\.triggerEvent\('changed'\), 0\)/, 'eating a fish refreshes Me');
console.log('Order fish points: Me counts up 5 per fish as Yuni eats; server total unchanged');
