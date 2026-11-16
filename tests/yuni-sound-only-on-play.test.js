// 2026-11-17: Yuni is silent unless someone plays with Yuni. Idle moves (hungry, fish time, humming) make no sound;
// the play actions (feed, fish, stroke, high five, spin, dance, eagle tap) keep theirs.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const src = fs.readFileSync(path.join(__dirname, '..', 'components/yuni-stage/index.js'), 'utf8');
const start = src.indexOf('    chat() {'), end = src.indexOf('    hi(zh, en', start);
assert.ok(start > 0 && end > start, 'found the idle chat');
assert.doesNotMatch(src.slice(start, end), /sound\.\w+\(/, 'idle moves play no sound');
for (const call of ['sound.dance()', 'sound.giggle()', 'sound.clap(n)', 'sound.eat(pts)', 'sound.cast()', 'sound.whoosh(1)']) assert.ok(src.includes(call), call + ' still plays when played with');
console.log('Yuni sound: silent unless played with');
