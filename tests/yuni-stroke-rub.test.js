// 2026-11-17: leading Yuni's eyes and sliding across Yuni is not a stroke; rubbing back and forth on Yuni is.
const assert = require('node:assert/strict');
global.wx = global.wx || { getStorageSync: () => null, setStorageSync() {} };
let def; global.Component = d => { def = d; };
require('../components/yuni-stage/index.js');
function stage() {
  const s = { ...def.methods, data: { ...def.data, zh: false, asleep: false }, setData(v) { Object.assign(this.data, v); } };
  Object.assign(s, { geo: { sl: 0, st: 0, left: 0, top: 0, width: 200, height: 200, cx: 100, cy: 100 }, measure() {}, lookAt() {}, rest() {}, pose() {}, say() {}, heart() {}, act() {}, cheer() {}, looks: 0 });
  s.lookAt = () => { s.looks++; };
  return s;
}
const touch = (x, y) => ({ touches: [{ clientX: x, clientY: y }] });

// A finger leading the eyes slides straight across Yuni's body: Yuni keeps looking, no stroke.
let s = stage(); s.onStart(touch(-60, 100));
for (let x = -50; x <= 260; x += 10) { s.lastLook = 0; s.onMove(touch(x, 100 + (x % 30 === 0 ? 3 : 0))); }
assert.equal(s.stroke, undefined, 'sliding across Yuni is not a stroke');
assert.ok(s.looks > 20, 'Yuni keeps following the finger');
// Going across and coming back once (a single turn) is still following, not rubbing.
for (let x = 250; x >= -50; x -= 10) s.onMove(touch(x, 100));
assert.equal(s.stroke, undefined, 'one turn is not a rub');
s.onEnd();

// Rubbing back and forth on Yuni's body: a stroke (shy), and longer rubbing turns into love.
s = stage(); s.onStart(touch(70, 100));
const rub = () => { for (let x = 70; x <= 130; x += 10) s.onMove(touch(x, 100)); for (let x = 130; x >= 70; x -= 10) s.onMove(touch(x, 100)); };
rub(); rub();
assert.equal(s.stroke, 'shy', 'rubbing on Yuni is a stroke');
for (let i = 0; i < 4; i++) rub();
assert.equal(s.stroke, 'love', 'keep rubbing and Yuni loves it');
s.onEnd(); assert.equal(s.stroke, null);
console.log('Yuni stroke: rubbing counts, sliding across while leading the eyes does not');
