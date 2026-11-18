// 2026-11-18: when Yuni lands a fish, the fish is shown first (it leaps into the card), then it flies into the bucket.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const js = read('components/yuni-stage/index.js'), css = read('components/yuni-stage/index.wxss'), xml = read('components/yuni-stage/index.wxml');
const at = s => { const i = js.indexOf(s); assert.ok(i >= 0, 'missing ' + s); return i; };
assert.ok(at("kind: 'leap'") < at('done(true);') && at('done(true);') < at("kind: 'stash'"), 'leap into the card, show it, then stash it');
assert.ok(js.includes("'card.leaving': true"), 'the card steps back while the fish flies to the bucket');
assert.match(js, /hold = f\.r === 'super' \? 2400 : f\.r === 'rare' \? 2000 : 1500/, 'rarer fish stay on show longer');
assert.ok(js.includes('bumpBucket() {') && js.includes('this.setData({ prize: null, card: null }); this.bumpBucket();'), 'the bucket bumps when the fish lands in it');
assert.match(css, /@keyframes ys-prize-leap\{/); assert.match(css, /@keyframes ys-prize-stash\{/); assert.match(css, /\.ys-card\.is-leaving \.ys-img\{opacity:0\}/);
assert.ok(xml.includes("{{card.leaving?'is-leaving':''}}"));
assert.ok(js.includes('bucketCount: this.holdBucket != null ? this.holdBucket : play.bucket.length') && js.includes('this.holdBucket = this.data.bucketCount;') && js.includes('bumpBucket() { this.holdBucket = null;'), 'the bucket count goes up only when the fish lands in it');
console.log('Catch: the fish is shown first, then flies into the bucket');
