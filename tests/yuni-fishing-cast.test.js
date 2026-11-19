// 2026-11-19: tapping 抛竿 must start the cast even when WeChat never fires catchtap
// (the button lives inside #ysStage, which catchtouchmove's the drag).
const assert = require('node:assert/strict');
const catalog = require('../utils/yuni-catalog');
const orders = require('../utils/orders');

global.wx = global.wx || {
  getStorageSync: () => null,
  setStorageSync() {},
  getWindowInfo: () => ({ windowWidth: 375, windowHeight: 667 }),
  getSystemInfoSync: () => ({ windowWidth: 375, windowHeight: 667 }),
  pageScrollTo() {}
};

let def;
global.Component = opt => { def = opt; };
require('../components/yuni-stage/index.js');
assert.ok(def && def.methods && def.methods.beginCast, 'component methods loaded');

const acts = [];
const origAct = orders.act;
orders.act = async (action, payload) => {
  acts.push({ action, payload });
  if (action === 'yuniFish' && payload && payload.landed) return { fish: catalog.FISH[0].id };
  return {};
};

const realSetTimeout = setTimeout;
const realClearTimeout = clearTimeout;
const realNow = Date.now;
let now = 1_000_000, nextId = 1, queue = [];
function installClock() {
  now = 1_000_000; nextId = 1; queue = [];
  global.setTimeout = (fn, ms = 0) => {
    const id = nextId++;
    queue.push({ id, fn, at: now + Number(ms) || 0 });
    return id;
  };
  global.clearTimeout = id => { queue = queue.filter(t => t.id !== id); };
  Date.now = () => now;
}
function flush(ms = 0) {
  now += ms;
  for (;;) {
    queue.sort((a, b) => a.at - b.at);
    const t = queue[0];
    if (!t || t.at > now) break;
    queue.shift();
    t.fn();
  }
}
function restoreClock() {
  global.setTimeout = realSetTimeout;
  global.clearTimeout = realClearTimeout;
  Date.now = realNow;
}

function applyPatch(data, patch) {
  for (const [k, v] of Object.entries(patch)) {
    if (!k.includes('.')) { data[k] = v; continue; }
    const parts = k.split('.');
    let cur = data;
    for (let i = 0; i < parts.length - 1; i++) {
      if (cur[parts[i]] == null || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
      cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = v;
  }
}
function queryOf(res) {
  const q = { select() { return q; }, boundingClientRect() { return q; }, exec(cb) { cb(res); } };
  return () => q;
}
const STAGE = { left: 0, top: 0, width: 375, height: 667 };
const YUNI = { left: 50, top: 180, width: 200, height: 250 };
const goodQuery = queryOf([STAGE, YUNI]);
const missQuery = queryOf([null, null]);

function playState(over = {}) {
  return {
    balance: 45, owned: ['rod'], bucket: [], seen: [], level: 1, testRounds: true,
    worn: { ...catalog.DEFAULT_WORN, hand: 'rod', ...(over.worn || {}) },
    fishing: { open: true, left: 2, used: {}, nextFrom: 0, window: 'lunch', ...(over.fishing || {}) }
  };
}

function makeInst(opts = {}) {
  const play = opts.play || playState();
  const inst = {
    data: JSON.parse(JSON.stringify(def.data)),
    ...def.methods,
    triggerEvent() {},
    createSelectorQuery: opts.query || goodQuery
  };
  inst.play = () => play;
  inst.sync = function () {};
  inst.rest = function () {};
  inst.wake = function () { return false; };
  inst.setData = function (patch, cb) { applyPatch(this.data, patch); cb && cb(); };
  inst.data.zh = true;
  inst.data.motion = false;
  inst.data.hasRod = true;
  inst.data.mode = 'fish';
  inst.data.L = inst.data.L || {};
  inst.face = '';
  inst.mouth = false;
  inst.taps = [];
  inst.busy = false;
  return inst;
}

installClock();
try {
  const xml = require('node:fs').readFileSync(require('node:path').join(__dirname, '../components/yuni-stage/index.wxml'), 'utf8');
  const wxss = require('node:fs').readFileSync(require('node:path').join(__dirname, '../components/yuni-stage/index.wxss'), 'utf8');
  assert.match(xml, /catchtouchstart="castDown"[^>]*catchtap="cast"/, 'finger-down and tap stay on the button');
  assert.match(wxss, /\.ys-hint\{[^}]*pointer-events:none/, 'the hint cannot cover the button');

  // 1. Finger-down on 抛竿 starts the cast without waiting for catchtap.
  let inst = makeInst();
  inst.drawGame();
  assert.equal(inst.data.castLabel, '抛竿');
  inst.castDown();
  assert.equal(inst.F && inst.F.phase, 'cast', 'cast starts on touchstart');
  assert.equal(inst.data.castLabel, '等待');
  assert.equal(inst.data.casting, true);
  assert.ok(inst.data.bobStyle.includes('left:'), 'bobber is placed');
  // catchtap is often missing; if it later fires, it must not restart or cancel the cast
  inst.cast();
  assert.equal(inst.F.phase, 'cast');
  assert.equal(inst.data.castLabel, '等待');
  flush(60);
  assert.equal(inst.F.phase, 'wait', 'bobber lands and we wait for a bite');
  assert.match(inst.data.hint, /等浮标沉下去/);

  // 2. Rapid extra presses during the throw do not start a second try.
  inst = makeInst();
  inst.castDown(); inst.castDown(); inst.castDown();
  assert.equal(inst.F.phase, 'cast');
  const firstTip = inst.F.tip.x;
  assert.equal(inst.F.pulls, 0);

  // 3. If #ysYuni cannot be measured, still start with a fallback layout.
  inst = makeInst({ query: missQuery });
  inst.castDown();
  assert.equal(inst.F && inst.F.phase, 'cast', 'fallback geometry still starts the cast');
  assert.equal(inst.data.castLabel, '等待');
  assert.ok(inst.data.bobStyle, 'fallback bobber is visible');
  assert.ok(inst.geo && inst.geo.stage.width, 'fallback geo is stored');

  // 4. Closed window / no tries: visible feedback, no hidden state.
  inst = makeInst({ play: playState({ fishing: { open: false, left: 0, used: { lunch: true, dinner: true }, window: 'dinner', nextFrom: 0 } }) });
  inst.drawGame();
  assert.equal(inst.data.castLabel, '明天');
  inst.castDown();
  assert.equal(inst.F, undefined, 'no try is started');
  assert.match(inst.data.bubble, /今天钓完啦/);
  inst = makeInst({ play: playState({ fishing: { open: false, left: 1, used: { lunch: true }, window: 'lunch', nextFrom: 17 } }) });
  inst.castDown();
  assert.equal(inst.F, undefined);
  assert.match(inst.data.bubble, /17:00 再来/);

  // 5-7 are async because land() awaits the order call.
  // Invoked as an IIFE (no CJS-style return) so scripts/check.js vm.Script can parse this file.
  (async () => {
    inst = makeInst();
    inst.castDown();
    flush(60);
    assert.equal(inst.F.phase, 'wait');
    inst.bite();
    assert.equal(inst.F.phase, 'timing');
    assert.equal(inst.data.castLabel, '停！');
    inst.finishTiming(inst.F, inst.F.zone[0] + 0.05, true, false);
    flush(750);
    assert.equal(inst.F.phase, 'bite');
    assert.match(inst.data.castLabel, /拉/);
    inst.castDown();
    inst.castDown();
    assert.equal(inst.F.pulls, 2);
    inst.castDown();
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(inst.F, null, 'the try ends after a catch');
    assert.ok(inst.data.card && inst.data.card.name, 'the catch card is shown');
    assert.ok(acts.some(a => a.action === 'yuniFish' && a.payload.landed === true));
    inst.drawGame();
    inst.downAt = 0;
    inst.castDown();
    assert.equal(inst.F && inst.F.phase, 'cast', 'another try can start after the last one ends');

    inst = makeInst();
    inst.castDown();
    flush(60);
    assert.equal(inst.F.phase, 'wait');
    inst.leave();
    assert.equal(inst.F, null);
    assert.equal(inst.data.mode, '');
    assert.equal(inst.data.casting, false);
    const bitesBefore = inst.bite;
    let biteRan = false;
    inst.bite = function () { biteRan = true; return bitesBefore.call(this); };
    flush(10000);
    assert.equal(biteRan, false, 'leave clears the bite timer');

    let pending;
    const delayed = () => {
      const q = { select() { return q; }, boundingClientRect() { return q; }, exec(cb) { pending = cb; } };
      return q;
    };
    inst = makeInst({ query: delayed });
    inst.castDown();
    assert.equal(inst.F, undefined);
    inst.leave();
    pending && pending([STAGE, YUNI]);
    assert.ok(!inst.F, 'a late measure after leave does not start a cast');
    assert.equal(inst.data.mode, '');

    console.log('Fishing cast: touchstart starts the throw, fallback, wait/pull/land, no tries, leave cleanup and rapid taps passed.');
  })().finally(() => {
    restoreClock();
    orders.act = origAct;
  });
} catch (e) {
  restoreClock();
  orders.act = origAct;
  throw e;
}
