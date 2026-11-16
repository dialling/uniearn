'use strict';
// Yuni's shop, wardrobe and fishing game (2026-11-15).
// Levels keep counting every point ever earned (loyalty.points); the shop spends from a separate
// balance (points - spent), so buying never lowers a level.
const catalog = require('./yuni-catalog');
const loyalty = require('./loyalty');

// 2026-11-15 team test: fishing is open at any hour (still one try per half-day, two a day) so it can be
// tried outside lunch and dinner. Set to false before launch. See the testing-limits note.
let FISH_ANY_TIME_FOR_TESTING = true;
// 2026-11-15 team test: the shop shows a "+200 test points" button so every item and level reward can be tried.
// The points count toward levels like real points. Set to false before launch. See the testing-limits note.
let TEST_POINTS_FOR_TESTING = true;
// 2026-11-16 TEAM TEST ONLY: a button gives fresh fishing tries for today, so the team can fish again and again.
// Set to false before launch. See the testing-limits note.
let TEST_ROUNDS_FOR_TESTING = true;
const TEST_POINTS = 200;

const CHINA = 8 * 3600000;
const check = (ok, message) => { if (!ok) throw Error(message); };
const dayKey = now => new Date(now + CHINA).toISOString().slice(0, 10);
const chinaHour = now => { const d = new Date(now + CHINA); return d.getUTCHours() + d.getUTCMinutes() / 60; };

function state(m) {
  const y = m.yuni || (m.yuni = {});
  y.owned = Array.isArray(y.owned) ? y.owned : [];
  y.worn = y.worn && typeof y.worn === 'object' ? y.worn : {};
  y.spent = Math.max(0, Number(y.spent) || 0);
  y.bucket = Array.isArray(y.bucket) ? y.bucket : [];
  y.seen = Array.isArray(y.seen) ? y.seen : [];
  y.fishing = y.fishing && typeof y.fishing === 'object' ? y.fishing : { day: '', used: {} };
  return y;
}
const level = m => Math.min(5, Math.max(1, Number((m.loyalty || {}).level) || 1));
const points = m => Math.max(0, Number((m.loyalty || {}).points) || 0);
function has(m, it) { return !!it && (it.price === 0 || (it.level ? level(m) >= it.level : state(m).owned.includes(it.id))); }
// What Yuni wears right now: saved choices, defaults for required slots, and nothing the member no longer has.
function worn(m) {
  const y = state(m), out = {};
  for (const [slot, id] of Object.entries({ ...catalog.DEFAULT_WORN, ...y.worn })) {
    const it = catalog.item(id);
    if (id && it && it.slot === slot && has(m, it)) out[slot] = id;
    else if (catalog.REQUIRED.includes(slot)) out[slot] = catalog.DEFAULT_WORN[slot];
  }
  // A new level reward is put on once, the first time the level is reached.
  y.granted = Array.isArray(y.granted) ? y.granted : [];
  for (const it of catalog.ITEMS) if (it.level && level(m) >= it.level && !y.granted.includes(it.id)) { y.granted.push(it.id); y.worn[it.slot] = it.id; out[it.slot] = it.id; }
  return out;
}
// used: the windows already fished today. While testing, any hour counts as the next unused window.
function windowAt(now, used = {}) {
  const h = chinaHour(now), real = catalog.WINDOWS.find(w => h >= w.from && h < w.to);
  if (!FISH_ANY_TIME_FOR_TESTING) return real || null;
  return (real && !used[real.id] ? real : catalog.WINDOWS.find(w => !used[w.id])) || real || catalog.WINDOWS[catalog.WINDOWS.length - 1];
}
function fishingView(m, now) {
  const y = state(m), today = dayKey(now), used = y.fishing.day === today ? y.fishing.used || {} : {}, h = chinaHour(now), w = windowAt(now, used);
  const left = FISH_ANY_TIME_FOR_TESTING ? catalog.WINDOWS.filter(x => !used[x.id]).length : catalog.WINDOWS.filter(x => !used[x.id] && h < x.to).length;
  const next = FISH_ANY_TIME_FOR_TESTING ? null : catalog.WINDOWS.find(x => !used[x.id] && h < x.from) || null;
  return { window: w ? w.id : '', open: !!w && !used[w.id], used: { ...used }, left, nextFrom: next ? next.from : 0, anyTime: FISH_ANY_TIME_FOR_TESTING };
}
function view(m, now) {
  if (!m) return null;
  const y = state(m), w = worn(m);
  return { testPoints: TEST_POINTS_FOR_TESTING, testRounds: TEST_ROUNDS_FOR_TESTING, balance: Math.max(0, points(m) - y.spent), spent: y.spent, owned: y.owned.slice(), worn: w, bucket: y.bucket.slice(), seen: y.seen.slice(), fishing: fishingView(m, now), level: level(m) };
}

function buy(s, id, event, now) {
  const m = loyalty.member(s, id), y = state(m), it = catalog.item(String(event.item || ''));
  check(it, 'This item is not in the shop.');
  check(!it.level, 'This item is a level reward and cannot be bought.');
  check(it.price > 0 && !y.owned.includes(it.id), 'You already have this item.');
  const balance = points(m) - y.spent;
  check(balance >= it.price, 'You need ' + (it.price - balance) + ' more points.');
  y.spent += it.price; y.owned.push(it.id); y.worn[it.slot] = it.id;
  return { bought: it.id, balance: balance - it.price };
}
function wear(s, id, event) {
  const m = loyalty.member(s, id), y = state(m), slot = String(event.slot || ''), itemId = String(event.item || '');
  check(catalog.ITEMS.some(i => i.slot === slot), 'Unknown slot.');
  if (!itemId) { check(!catalog.REQUIRED.includes(slot), 'This one cannot be taken off.'); y.worn[slot] = ''; return { slot, item: '' }; }
  const it = catalog.item(itemId);
  check(it && it.slot === slot, 'This item does not go there.');
  check(has(m, it), 'You do not have this item yet.');
  y.worn[slot] = it.id; return { slot, item: it.id };
}
// One try per window. A missed pull uses the try and lands nothing.
function fish(s, id, event, now, random = Math.random) {
  const m = loyalty.member(s, id), y = state(m), tool = catalog.item(worn(m).hand);
  check(tool && tool.odds, 'Yuni needs a fishing rod first.');
  const today = dayKey(now);
  if (y.fishing.day !== today) y.fishing = { day: today, used: {} };
  const w = windowAt(now, y.fishing.used);
  check(w, 'Fish only bite at lunch and dinner.');
  check(!y.fishing.used[w.id], 'One try per meal. Come back later.');
  y.fishing.used[w.id] = true;
  // 2026-11-16: a fish only bites after a stop in the green on the timing bar; otherwise the try is used and nothing lands.
  if (event.landed !== true || event.perfect !== true) return { missed: true };
  // Very rare: a bottle with a coupon instead of a fish, at most once every COUPON_COOLDOWN_DAYS.
  const lucky = random();
  if (lucky < catalog.COUPON_CHANCE && !(y.lastCouponAt && now - y.lastCouponAt < catalog.COUPON_COOLDOWN_DAYS * 86400000)) {
    let pick = random() * catalog.COUPON_PRIZES.reduce((n, c) => n + c.weight, 0);
    const prize = catalog.COUPON_PRIZES.find(c => (pick -= c.weight) < 0) || catalog.COUPON_PRIZES[0];
    const { weight, zh, ...coupon } = prize, rewards = require('./rewards');
    rewards.issue(rewards.init(s, id, now), coupon, now, '-' + now);
    y.lastCouponAt = now;
    return { coupon: { id: prize.id + '-' + now, face: prize.face, title: prize.title, zh: prize.zh, days: prize.days } };
  }
  check(y.bucket.length < catalog.BUCKET_MAX, 'The bucket is full. Feed Yuni first.');
  let roll = random() * 100;
  const rarity = ['common', 'rare', 'super'].find((r, n) => (roll -= tool.odds[n]) < 0) || 'common';
  const pool = catalog.FISH.filter(f => f.r === rarity), caught = pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))];
  const isNew = !y.seen.includes(caught.id); if (isNew) y.seen.push(caught.id);
  y.bucket.push(caught.id);
  // 2026-11-16: a friend (the eagle) may dive for an extra fish, if the bucket still has room.
  const friend = catalog.item(worn(m).friend);
  if (friend && friend.helper && y.bucket.length < catalog.BUCKET_MAX && random() * 100 < friend.helper.chance) {
    let r2 = random() * 100;
    const er = ['common', 'rare', 'super'].find((r, n) => (r2 -= friend.helper.odds[n]) < 0) || 'common';
    const pool2 = catalog.FISH.filter(f => f.r === er), f2 = pool2[Math.min(pool2.length - 1, Math.floor(random() * pool2.length))];
    const new2 = !y.seen.includes(f2.id); if (new2) y.seen.push(f2.id);
    y.bucket.push(f2.id);
    return { fish: caught.id, rarity, isNew, eagle: { fish: f2.id, rarity: er, isNew: new2 } };
  }
  return { fish: caught.id, rarity, isNew };
}
// Feeding a caught fish to Yuni is what earns its points.
function feed(s, id, event, now) {
  const m = loyalty.member(s, id), y = state(m), index = Number(event.index);
  check(Number.isInteger(index) && index >= 0 && index < y.bucket.length, 'That fish is not in the bucket.');
  const f = catalog.fish(y.bucket[index]); y.bucket.splice(index, 1);
  const amount = f ? catalog.RARITY[f.r].points : 0;
  loyalty.bonus(s, id, amount, 'yuni-fish', now);
  return { fed: f ? f.id : '', points: amount };
}
function testPoints(s, id, now) {
  check(TEST_POINTS_FOR_TESTING, 'Test points are switched off.');
  loyalty.bonus(s, id, TEST_POINTS, 'test-points', now);
  return { added: TEST_POINTS };
}
// Team test only: fresh fishing tries for today.
function testRound(s, id, now) {
  check(TEST_ROUNDS_FOR_TESTING, 'Test fishing tries are switched off.');
  const y = state(loyalty.member(s, id));
  y.fishing = { day: dayKey(now), used: {} };
  return { left: catalog.WINDOWS.length };
}
// Tests switch the testing flag off to check the real lunch and dinner windows.
module.exports = { view, buy, wear, fish, feed, worn, testPoints, testRound, setTestPoints: on => { TEST_POINTS_FOR_TESTING = !!on; }, setTestRounds: on => { TEST_ROUNDS_FOR_TESTING = !!on; }, anyTime: () => FISH_ANY_TIME_FOR_TESTING, setAnyTime: on => { FISH_ANY_TIME_FOR_TESTING = !!on; } };
