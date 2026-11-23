'use strict';
// Sounds for playing with Yuni (2026-11-15): short tunes and effects made with Web Audio, so no audio
// files are shipped. Everything is silent when the device has no Web Audio or sounds are switched off.
const store = require('./store');
let ctx = null, master = null, failed = false;
const enabled = () => store.get().yuniSounds !== false;
function context() {
  if (!enabled() || failed) return null;
  if (ctx) return ctx;
  // WeChat's Web Audio first; fall back to the browser's when WeChat's is missing or incomplete.
  try { if (typeof wx !== 'undefined' && wx.createWebAudioContext) ctx = wx.createWebAudioContext(); } catch (_) { ctx = null; }
  if (!ctx || !ctx.createOscillator) {
    ctx = null;
    try {
      if (typeof AudioContext !== 'undefined') ctx = new AudioContext();
      else if (typeof webkitAudioContext !== 'undefined') ctx = new webkitAudioContext(); // eslint-disable-line no-undef
    } catch (_) { ctx = null; }
  }
  if (!ctx || !ctx.createOscillator) { ctx = null; failed = true; return null; }
  // 手机扬声器上原来的 .16 音量几乎听不见：加一级总增益，统一放大
  try {
    if (!master && ctx.createGain) {
      master = ctx.createGain();
      master.gain.value = 2.2;
      master.connect(ctx.destination);
    }
  } catch (_) { master = null; }
  return ctx;
}
// Browsers only start audio after a tap; call this from any tap so later sounds (like Yuni's own chatter) can play.
function unlock() {
  const a = context(); if (!a) return;
  try { if (a.state === 'suspended' && a.resume) a.resume(); const b = a.createBuffer(1, 1, a.sampleRate || 44100), src = a.createBufferSource(); src.buffer = b; src.connect(a.destination); src.start(0); } catch (_) {}
}
function tone(f, at, dur, o = {}) {
  const a = context(); if (!a) return;
  try {
    if (a.state === 'suspended' && a.resume) a.resume();
    const t = a.currentTime + at, osc = a.createOscillator(), g = a.createGain();
    osc.type = o.type || 'triangle'; osc.frequency.setValueAtTime(f, t); if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(o.vol || .28, t + .012); g.gain.exponentialRampToValueAtTime(.001, t + dur);
    osc.connect(g); g.connect(master || a.destination); osc.start(t); osc.stop(t + dur + .03); api.played++;
  } catch (_) {}
}
function noise(at, dur, o = {}) {
  const a = context(); if (!a) return;
  try {
    if (a.state === 'suspended' && a.resume) a.resume();
    const t = a.currentTime + at, n = Math.floor(a.sampleRate * dur), buf = a.createBuffer(1, n, a.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain(); src.buffer = buf;
    f.type = o.type || 'lowpass'; f.frequency.setValueAtTime(o.from || 1200, t); if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t + dur);
    g.gain.setValueAtTime(o.vol || .3, t); g.gain.exponentialRampToValueAtTime(.001, t + dur);
    src.connect(f); f.connect(g); g.connect(master || a.destination); src.start(t); api.played++;
  } catch (_) {}
}
const N = { G4: 392, C5: 523, E5: 659, G5: 784, A5: 880, C6: 1047, E6: 1319, G6: 1568 };
const api = {
  played: 0, enabled, unlock,
  // Dance: two bars on the same 1.2 s sway as Yuni's groove (a beat every 0.3 s).
  dance() { ['C5', 'E5', 'G5', 'E5', 'A5', 'G5', 'E5', 'G5'].forEach((n, i) => { tone(N[n], i * .3, .26, { type: 'square', vol: .07 }); tone(N[n] / 2, i * .3, .2, { vol: .1 }); noise(i * .3 + .15, .05, { type: 'highpass', from: 6000, vol: .05 }); if (i % 2 === 0) tone(110, i * .3, .16, { type: 'sine', to: 50, vol: .3 }); }); tone(N.C6, 2.4, .5, { vol: .12 }); },
  // Entering the fishing game: a fast rising fanfare with drum hits.
  gameStart() { ['G4', 'C5', 'E5', 'G5', 'C6'].forEach((n, i) => tone(N[n], i * .08, .16, { type: 'square', vol: .09 })); [0, .16, .32].forEach(t => tone(120, t, .12, { type: 'sine', to: 50, vol: .3 })); ['C6', 'E6', 'G6'].forEach(n => tone(N[n], .44, .7, { vol: .08 })); noise(.44, .5, { type: 'highpass', from: 5000, vol: .07 }); },
  cast() { noise(0, .45, { type: 'bandpass', from: 500, to: 3200, vol: .16 }); tone(300, 0, .4, { type: 'sine', to: 900, vol: .05 }); },
  plop() { tone(520, 0, .2, { type: 'sine', to: 110, vol: .28 }); noise(.02, .35, { from: 2400, to: 400, vol: .2 }); },
  nibble() { tone(700, 0, .07, { type: 'sine', to: 500, vol: .12 }); },
  bite() { tone(N.E6, 0, .09, { type: 'square', vol: .1 }); tone(N.E6, .12, .09, { type: 'square', vol: .1 }); tone(N.G6, .24, .2, { type: 'square', vol: .1 }); noise(0, .25, { from: 1800, to: 500, vol: .16 }); },
  // Each pull: a reel ratchet that climbs in pitch.
  reel(k) { for (let i = 0; i < 6; i++) noise(i * .035, .025, { type: 'highpass', from: 2500 + k * 700, vol: .14 }); tone(220 + k * 90, 0, .2, { type: 'sawtooth', to: 330 + k * 120, vol: .06 }); },
  catchFish(r) { noise(0, .5, { from: 3000, to: 500, vol: .24 }); const up = r === 'super' ? ['C5', 'E5', 'G5', 'C6', 'E6', 'G6'] : r === 'rare' ? ['C5', 'E5', 'G5', 'C6'] : ['E5', 'G5', 'C6']; up.forEach((n, i) => tone(N[n], .18 + i * .09, .22, { type: 'square', vol: .09 })); if (r === 'super') ['C6', 'E6', 'G6'].forEach(n => tone(N[n], .8, .9, { vol: .08 })); },
  miss() { tone(440, 0, .5, { type: 'sawtooth', to: 110, vol: .07 }); },
  eat(points) { [0, .15, .3, .45].forEach(t => noise(t, .07, { type: 'bandpass', from: 900, vol: .3 })); tone(N.E5, .62, .12, { vol: .12 }); tone(points >= 10 ? N.E6 : points >= 5 ? N.C6 : N.G5, .72, .4, { vol: .14 }); },
  growl() { noise(0, .5, { from: 220, to: 90, vol: .32 }); tone(70, .05, .45, { type: 'sawtooth', to: 55, vol: .05 }); noise(.55, .35, { from: 180, to: 80, vol: .22 }); },
  slurp() { noise(0, .25, { type: 'bandpass', from: 700, to: 1800, vol: .18 }); tone(500, .02, .22, { type: 'sine', to: 900, vol: .07 }); tone(N.C6, .32, .12, { vol: .08 }); tone(N.E6, .44, .2, { vol: .08 }); },
  hum() { ['E5', 'G5', 'A5', 'G5', 'E5'].forEach((n, i) => tone(N[n], i * .38, .34, { type: 'sine', vol: .06 })); },
  // High five: a sharper slap, and each combo step rings a higher note.
  clap(level = 1) { const k = Math.min(Math.max(1, level), 5); noise(0, .1, { type: 'highpass', from: 1500, vol: .4 }); noise(0, .05, { from: 400, vol: .3 }); const up = [N.C6, N.E6, N.G6, N.C6 * 2, N.E6 * 2]; tone(up[k - 1], .04, .22, { vol: .11 }); if (k > 1) tone(up[k - 1] * 1.5, .1, .18, { type: 'square', vol: .05 }); },
  // Spin: a rising whoosh; more turns, longer whoosh.
  whoosh(level = 1) { const k = Math.min(Math.max(1, level), 3); noise(0, .45 + k * .12, { type: 'bandpass', from: 350, to: 2400, vol: .22 }); tone(300, .05, .4 + k * .1, { type: 'sine', to: 900 + k * 200, vol: .06 }); },
  // Timing bar: a ding in the green zone, a soft low note outside it.
  zone(hit) { if (hit) { tone(N.G5, 0, .12, { type: 'square', vol: .07 }); tone(N.C6 * 1.5, .08, .28, { vol: .12 }); } else tone(220, 0, .22, { type: 'sine', to: 150, vol: .14 }); },
  // Landing thump after a spin.
  land() { tone(140, 0, .16, { type: 'sine', to: 60, vol: .28 }); noise(0, .12, { from: 600, to: 150, vol: .18 }); },
  // A short happy fanfare for big moments (not the dance tune).
  fanfare() { ['C5', 'E5', 'G5', 'C6'].forEach((n, i) => tone(N[n], i * .09, .2, { type: 'triangle', vol: .12 })); tone(N.E6, .38, .45, { type: 'triangle', vol: .1 }); tone(N.G6, .42, .4, { type: 'sine', vol: .06 }); },
  // Stroking Yuni: a shy giggle, a happy coo, and a soft purr-chirp while the stroking goes on.
  giggle() { [0, .11, .22].forEach((t, i) => tone(820 + i * 120, t, .09, { type: 'sine', to: 1080 + i * 120, vol: .09 })); },
  coo() { tone(560, 0, .28, { type: 'sine', to: 880, vol: .1 }); tone(880, .26, .32, { type: 'sine', to: 720, vol: .09 }); tone(1320, .5, .18, { type: 'triangle', vol: .05 }); },
  purr(love) { const f = love ? 660 : 520; tone(f, 0, .16, { type: 'sine', to: f * 1.18, vol: .06 }); tone(f * 1.18, .14, .12, { type: 'sine', to: f, vol: .05 }); },
  coin() { tone(N.E6, 0, .08, { type: 'square', vol: .08 }); tone(N.G6, .08, .3, { type: 'square', vol: .08 }); }
};
module.exports = api;
