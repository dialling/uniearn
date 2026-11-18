// Yuni's stage on the Me page (2026-11-15): play with Yuni, dress Yuni from the points shop, and fish.
// Design: design/me-preview/index.html. Server rules: cloudfunctions/orderService/yuni-play.js.
const store = require('../../utils/store'), orders = require('../../utils/orders'), motion = require('../../utils/motion');
const rig = require('../../utils/yuni-rig'), catalog = require('../../utils/yuni-catalog'), sound = require('../../utils/yuni-sound'), ui = require('../../utils/ui');

const SCENES = {
  morning: { sky: 'linear-gradient(#a9dfc9 0%,#cdeedd 46%,#e9f7ee 62%)', a: '#2fa37a', b: '#0b7a55', c: '#085c41', ba: '#ffffff', bb: '#d4efe2', dark: false },
  sunset: { sky: 'linear-gradient(#ff8f73 0%,#ffbf8a 44%,#ffe6bf 62%)', a: '#e58a62', b: '#b9544c', c: '#7b3553', ba: '#fff1e2', bb: '#f5b9a0', dark: false },
  aurora: { sky: 'linear-gradient(#0e1a3c 0%,#1d3a6c 50%,#2b5b82 64%)', a: '#23788f', b: '#124a66', c: '#0a2e47', ba: '#e6f8ff', bb: '#9fd0e6', dark: true },
  lagoon: { sky: 'linear-gradient(#7fd0ff 0%,#bdeaff 48%,#f1fbff 62%)', a: '#45d6cb', b: '#14a8ba', c: '#0b7f9c', ba: '#ffffff', bb: '#bfeee9', dark: false },
  sakura: { sky: 'linear-gradient(#ffc6d9 0%,#ffe1ea 46%,#fff4f0 62%)', a: '#7fd1c4', b: '#5fb8b0', c: '#3d8f93', ba: '#fff8fb', bb: '#f7cfdc', dark: false },
  snow: { sky: 'linear-gradient(#b9d4ef 0%,#dbe9f7 48%,#f3f8fd 62%)', a: '#7fb0da', b: '#4f86b8', c: '#33628f', ba: '#ffffff', bb: '#dceaf7', dark: false },
  starry: { sky: 'linear-gradient(#070b2a 0%,#151c4a 50%,#2a3170 64%)', a: '#3c56a8', b: '#2a3f8f', c: '#172660', ba: '#dfe6ff', bb: '#8f9fd6', dark: true },
  rainbow: { sky: 'linear-gradient(#7fd6ff 0%,#c4efff 48%,#f2fcff 62%)', a: '#4fcfbf', b: '#2bb3a3', c: '#178a86', ba: '#ffffff', bb: '#cdf2ea', dark: false }
};
const EMPTY = { balance: 0, owned: [], worn: { ...catalog.DEFAULT_WORN }, bucket: [], seen: [], fishing: { open: false, left: 0, used: {}, nextFrom: 0, window: '' }, level: 1 };
const pick = list => list[Math.floor(Math.random() * list.length)];
const esc = uri => uri; // layer URIs are already safe inside url('...')
let fxId = 0;

Component({
  options: { addGlobalClass: false },
  // The Me page passes the member name, badge and level points shown on the scene (design/me-preview).
  properties: { name: { type: String, value: '' }, badge: { type: String, value: '' }, verified: { type: Boolean, value: false }, points: { type: Number, value: 0 } },
  data: {
    zh: false, motion: true, L: {}, wings: '', body: 'idle', blink: false, headStyle: '', eyeStyle: '', bubble: '', bubbleOn: false, asleep: false,
    sceneStyle: '', scene: 'morning', dark: false, rideBack: '', rideFront: '', ride: 'floe', mood: 0, moodHearts: [0, 1, 2, 3, 4], fx: [],
    mode: '', hasRod: false, bucketCount: 0, bucketMax: catalog.BUCKET_MAX, bucketBump: false, triesLeft: 0, soundOn: true,
    tabs: [], tab: 0, cards: [], sel: '', balance: 0, buyName: '', buyNote: '', buyLabel: '', buyDisabled: true, buyPlain: false,
    castLabel: '', castSub: '', castClass: '', hint: '', leftText: '', bucket: [], card: null, casting: false, bobStyle: '', bobSrc: '', bobClass: '', lineStyle: '', shadowClass: '', shadowStyle: '', bang: false, splash: null, prize: null, bookOpen: false, book: [], bookCount: '0/0'
  },
  lifetimes: {
    attached() { this.face = ''; this.mouth = false; this.trying = null; this.taps = []; this.unsubscribe = store.subscribe(() => this.sync()); this.sync(); this.rest(); this.blinker = setInterval(() => this.blinkOnce(), 3400); },
    detached() { if (this.unsubscribe) this.unsubscribe(); clearInterval(this.blinker); this.clearTimers(); }
  },
  // Each time the Me page opens, Yuni waves and greets the member by name.
  pageLifetimes: { hide() { if (this.F) this.stopFishing(); this.clearTimers(); this.greeted = false; }, show() { this.sync(); this.rest(); this.greet(); } },
  // 2026-11-17: the points pill pops when the points go up (feeding a fish adds the points shown on Me).
  observers: { name() { this.greet(); }, points(v) { if (this.lastPts !== undefined && v > this.lastPts) { this.setData({ ptsBump: false }); setTimeout(() => this.setData({ ptsBump: true }), 20); clearTimeout(this.ptsTimer); this.ptsTimer = setTimeout(() => this.setData({ ptsBump: false }), 700); } this.lastPts = v; } },
  methods: {
    t(zh, en) { return this.data.zh ? zh : en; },
    play() { return store.get().yuniPlay || EMPTY; },
    look() { const l = { ...this.play().worn }; if (this.trying) l[this.trying.slot] = this.trying.id; return l; },
    clearTimers() { this.friendOn = undefined; ['sleepTimer', 'chatTimer', 'bubbleTimer', 'actTimer', 'biteTimer', 'missTimer', 'cardTimer', 'chewTimer', 'friendTimer', 'friendGlide', 'tipTimer'].forEach(k => { clearTimeout(this[k]); clearInterval(this[k]); }); (this.nibbleTimers || []).forEach(clearTimeout); },
    // ── state from the store ──
    sync() {
      const s = store.get(), zh = s.language !== 'en', play = this.play(), l = this.look(), sc = SCENES[l.scene] || SCENES.morning, ride = rig.ride(l.ride, sc.a, sc.bb);
      const wave = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 18" preserveAspectRatio="none"><path d="M0 9q25-9 50 0t50 0V18H0z" fill="' + sc.a + '"/></svg>');
      const next = {
        zh, motion: motion.enabled(), soundOn: sound.enabled(), scene: SCENES[l.scene] ? l.scene : 'morning', dark: sc.dark, ride: l.ride || 'floe', rideBack: ride.back, rideFront: ride.front,
        sceneStyle: '--sky:' + sc.sky + ';--sea-a:' + sc.a + ';--sea-b:' + sc.b + ';--sea-c:' + sc.c + ';--berg-a:' + sc.ba + ';--berg-b:' + sc.bb + ';--wave:url(\'' + wave + '\')',
        hungry: this.hungry ? this.hungry() : false, testPoints: !!play.testPoints, testRounds: !!play.testRounds, friend: l.friend === 'eagle', dailyFish: require('../../utils/checkin').dailyFishWaiting(), orderFish: require('../../utils/order-fish').waiting().length, hasRod: rig.isTool(play.worn.hand), bucketCount: this.holdBucket != null ? this.holdBucket : play.bucket.length, triesLeft: play.fishing.left || 0, balance: play.balance
      };
      // One count on Feed: every fish ready to eat (today's dried fish, fish from orders, caught fish). gift = a dried or order fish is waiting.
      next.gift = !!(next.dailyFish || next.orderFish); next.feedCount = (next.dailyFish ? 1 : 0) + next.orderFish + next.bucketCount;
      // A fish was eaten (here or in the Feed Yuni sheet): tell the Me page so its points catch up.
      if (this.lastFeedCount !== undefined && next.feedCount !== this.lastFeedCount) setTimeout(() => this.triggerEvent('changed'), 0);
      this.lastFeedCount = next.feedCount;
      if (next.friend !== this.friendOn) { this.friendOn = next.friend; this.friendPlay(next.friend && next.motion); }
      this.setData(next); this.drawYuni();
      if (this.data.mode === 'shop') this.drawShop();
      if (this.data.mode === 'fish') this.drawGame();
    },
    drawYuni() {
      const L = rig.layers(this.look(), this.face, this.mouth), patch = {};
      for (const k of Object.keys(L)) if (this.data.L[k] !== L[k]) patch['L.' + k] = L[k];
      if (Object.keys(patch).length) this.setData(patch);
    },
    // face = eye style, wings = arm pose, body = whole-body move, mouth = open beak
    pose(p = {}) { this.face = p.face || ''; this.mouth = !!p.mouth; this.drawYuni(); const on = this.data.motion; this.setData({ drool: this.face === 'drool', wings: p.wings || '', body: on ? (p.body || 'idle') : '' }); },
    act(p, ms = 1400) { if (this.fperched && p && p.body && !['squash', 'munch', 'idle', 'snooze'].includes(p.body)) this.friendTakeoff(); this.busy = true; this.pose(p); clearTimeout(this.actTimer); this.actTimer = setTimeout(() => { this.busy = false; if (!this.data.asleep && !this.stroke) this.pose(); }, ms); },
    say(text, ms = 2200) { this.setData({ bubble: text, bubbleOn: true }); clearTimeout(this.bubbleTimer); this.bubbleTimer = setTimeout(() => this.setData({ bubbleOn: false }), ms); },
    lookAt(x, y) { this.setData({ eyeStyle: 'transform:translate(' + (x * .5).toFixed(2) + '%,' + (y * .45).toFixed(2) + '%)', headStyle: 'transform:translate(' + (x * .25).toFixed(2) + '%,' + (y * .12).toFixed(2) + '%) rotate(' + (x * 1.3).toFixed(2) + 'deg)' }); },
    blinkOnce() { if (this.data.asleep || !this.data.motion || this.face) return; this.setData({ blink: true }); setTimeout(() => this.setData({ blink: false }), 170); },
    // Any touch restarts the quiet timers: Yuni chats every 9-15 s on its own and naps after 45 s.
    rest() {
      clearTimeout(this.sleepTimer); clearTimeout(this.chatTimer); this.chatsSinceTouch = 0;
      this.sleepTimer = setTimeout(() => { if (this.busy || this.stroke || this.data.mode) return this.rest(); clearTimeout(this.chatTimer); this.setData({ asleep: true, bubbleOn: false }); this.lookAt(0, 0); this.pose({ face: 'sleep', body: 'snooze' }); }, 45000);
      this.scheduleChat();
    },
    scheduleChat() { clearTimeout(this.chatTimer); this.chatTimer = setTimeout(() => this.chat(), 9000 + Math.random() * 6000); },
    // Hungry until fed: a caught fish, or the daily "Feed Yuni" check-in, keeps Yuni full for 4 hours.
    hungry() { const at = Number(store.get().yuniFedAt) || 0; return Date.now() - at > 4 * 3600000; },
    fedNow() { store.update(x => { x.yuniFedAt = Date.now(); }); this.setData({ hungry: false }); },
    chat() {
      if (this.data.asleep || this.data.mode || this.busy || this.stroke || this.touch) return this.scheduleChat();
      const zh = this.data.zh, play = this.play(), moves = [];
      if (this.hungry()) moves.push('hungry', 'hungry', 'fishTime', 'fishTime');
      moves.push('look', 'stretch', 'hum', 'cheerUp', 'peek');
      if (this.data.hasRod && play.fishing.open) moves.push('fishHint');
      if (play.bucket.length) moves.push('bucketHint');
      moves.push('orderHint', 'orderHint'); // 2026-11-17: how points are earned
      if (this.data.orderFish) moves.push('orderFishHint', 'orderFishHint', 'orderFishHint');
      // 2026-11-17: idle moves stay silent. Yuni only makes sounds when someone plays with Yuni.
      const m = pick(moves);
      if (m === 'hungry') {
        this.act({ face: 'hungry', wings: 'belly', body: 'rumble' }, 2600);
        this.say(pick(zh ? ['好饿啊……', '肚子在咕咕叫……', '有小鱼干吗？'] : ['I\'m so hungry...', 'My tummy is rumbling...', 'Got a little fish for me?']), 2800);
        this.measure(g => { if (g) this.float({ kind: 'note', text: zh ? '咕噜…' : 'grr…', style: 'left:' + (g.cx + g.width * .18) + 'px;top:' + (g.cy + 20) + 'px' }, 1400); });
      } else if (m === 'fishTime') {
        // Excited in a good way: sparkly eyes, open beak, a drip of saliva, happy little bounces.
        this.act({ face: 'drool', wings: 'cheer', body: 'bounce', mouth: true }, 3000);
        this.say(zh ? '是不是到吃鱼时间了？！' : 'Is it fish time yet?!', 3000);
        this.measure(g => { if (g) [0, 350, 700].forEach(t => setTimeout(() => this.float({ kind: 'note', text: '✦', style: 'left:' + (g.cx + (Math.random() - .5) * g.width * .7) + 'px;top:' + (g.top + 30) + 'px;color:#ffe08a' }, 1200), t)); });
      } else if (m === 'look') {
        this.act({ wings: '', body: 'idle' }, 2400); this.lookAt(-6, -2); setTimeout(() => { if (!this.touch) this.lookAt(6, -1); }, 900); setTimeout(() => { if (!this.touch) this.lookAt(0, 0); }, 1900);
        this.say(pick(zh ? ['那边有什么？', '今天风好舒服。', '我看到一条鱼！'] : ['What\'s over there?', 'Nice breeze today.', 'I think I saw a fish!']), 2200);
      } else if (m === 'stretch') {
        this.act({ face: 'sleep', wings: 'reach', body: 'stretch', mouth: true }, 1500); this.say(zh ? '啊——伸个懒腰。' : 'Yaaawn... big stretch.', 1800);
      } else if (m === 'hum') {
        this.act({ face: 'happy', body: 'hum' }, 2400); this.say(zh ? '啦啦啦~' : 'La la la~', 2200);
        this.measure(g => { if (g) [0, 500, 1000].forEach(t => setTimeout(() => this.float({ kind: 'note', text: '♪', style: 'left:' + (g.cx + 30 + Math.random() * 40) + 'px;top:' + (g.top + 40) + 'px' }, 1300), t)); });
      } else if (m === 'cheerUp') {
        this.act({ face: 'happy', wings: 'wave', body: 'squash', mouth: true }, 1600); this.say(pick(zh ? ['今天有新订单吗？', '一起赚积分吧！', '摸摸我也可以哦。'] : ['Any orders today?', 'Let\'s earn some points!', 'You can pet me, you know.']), 2400);
      } else if (m === 'peek') {
        this.act({ face: 'happy', body: 'peek' }, 1800); this.lookAt(-5, 0); setTimeout(() => this.lookAt(0, 0), 1500); this.say(zh ? '躲猫猫！' : 'Peekaboo!', 1600);
      } else if (m === 'orderFishHint') {
        this.act({ face: 'drool', wings: 'cheer', body: 'bounce', mouth: true }, 1800); this.say(zh ? '你的订单给我带来一条鱼！' : 'Your order got me a fish!', 2200); clearTimeout(this.tipTimer); this.tipTimer = setTimeout(() => { if (!this.touch && !this.data.mode && !this.F) this.say(zh ? '点「喂食」喂给我吧！' : 'Tap Feed to give it to me!', 2400); }, 2400);
      } else if (m === 'orderHint') {
        // Points come from finishing an order, running one, and feeding Yuni a fish.
        this.act({ face: 'happy', wings: 'cheer', body: 'hop', mouth: true }, 1400);
        // The bubble is one line, so the tip comes as two short lines.
        const pair = pick(zh ? [['完成订单或帮忙跑单，都能赚积分！', '喂我吃鱼也能赚积分哦！'], ['攒积分换更好的鱼竿！', '钓更大的鱼！']] : [['Finish or run orders for points!', 'Feed me fish for points too!'], ['Save points for a better rod!', 'Better rod, bigger fish!']]);
        this.say(pair[0], 2200); clearTimeout(this.tipTimer); this.tipTimer = setTimeout(() => { if (!this.touch && !this.data.mode && !this.F) this.say(pair[1], 2400); }, 2400);
      } else if (m === 'fishHint') {
        this.act({ face: 'happy', wings: 'reach', body: 'hop', mouth: true }, 1200); this.say(zh ? '鱼儿正在咬钩，去钓鱼吧！' : 'The fish are biting. Let\'s go fishing!', 2600);
      } else if (m === 'bucketHint') {
        this.act({ face: 'hungry', wings: 'belly', body: 'rumble' }, 2000); this.say(zh ? '桶里还有鱼……可以喂我吗？' : 'There\'s fish in the bucket... can I have it?', 2600);
      }
      this.setData({ hungry: this.hungry() });
      if (++this.chatsSinceTouch < 4) this.scheduleChat();
    },
    // First word of the display name ("Leo Runner" -> "Leo"); Chinese names are kept whole.
    nick() { const n = String(this.data.name || '').trim(); return /\s/.test(n) ? n.split(/\s+/)[0] : n; },
    hi(zh, en, zhNamed, enNamed) { const n = this.nick(); return n ? this.t(zhNamed.replace('{n}', n), enNamed.replace('{n}', n)) : this.t(zh, en); },
    greet() {
      if (this.greeted || !this.nick() || this.data.mode) return; this.greeted = true;
      setTimeout(() => { if (this.data.mode || this.busy) return; this.act({ face: 'happy', wings: 'wave', body: 'squash', mouth: true }, 1600); this.say(pick([this.hi('', '', '{n}，你好呀！', 'Hi, {n}!'), this.hi('', '', '欢迎回来，{n}！', 'Welcome back, {n}!'), this.hi('', '', '{n}，今天也要加油哦！', 'Good to see you, {n}!')]), 2600); }, 600);
    },
    // A sleeping Yuni wakes on any touch. Buttons pass quiet=true so their own action still runs (no swallowed taps).
    wake(quiet) { if (!this.data.asleep) return false; this.setData({ asleep: false }); if (quiet) { this.pose(); this.rest(); return false; } this.act({ body: 'squash', mouth: true }, 1300); this.say(this.t('啊！你回来啦。', 'Oh! You\'re back.')); this.rest(); return true; },
    cheer() { if (this.data.mood >= 5) return; const mood = this.data.mood + 1; this.setData({ mood }); if (mood === 5) setTimeout(() => { sound.fanfare(); this.act({ face: 'love', wings: 'cheer', body: 'jump', mouth: true }, 1600); this.confetti(); this.say(this.t('今天最开心！', 'Best day ever!'), 2600); }, 1100); },
    // ── floating effects ──
    float(item, ms = 1200) { const id = ++fxId; this.setData({ fx: this.data.fx.concat({ id, ...item }) }); setTimeout(() => this.setData({ fx: this.data.fx.filter(f => f.id !== id) }), ms); },
    heart(x, y) { if (this.data.motion) this.float({ kind: 'heart', style: 'left:' + x + 'px;top:' + y + 'px;--dx:' + Math.round((Math.random() - .5) * 60) + 'px' }, 1100); },
    points(text) { const c = this.geo; this.float({ kind: 'text', text, style: 'left:' + (c ? c.cx : 160) + 'px;top:' + (c ? c.top + 10 : 120) + 'px' }, 1300); },
    confetti(n = 16) { if (!this.data.motion) return; const c = this.geo || { cx: 160, cy: 200 }, colors = ['#f2b233', '#ff8a8a', '#fff', '#7fe0b0', '#7f97e6']; const list = []; for (let i = 0; i < n; i++) list.push({ id: ++fxId, kind: 'bit', style: 'left:' + c.cx + 'px;top:' + (c.cy - 30) + 'px;background:' + colors[i % 5] + ';--dx:' + Math.round((Math.random() - .5) * 300) + 'px;--dy:' + Math.round(-40 - Math.random() * 190) + 'px;--rot:' + Math.round(Math.random() * 540) + 'deg' }); const ids = list.map(f => f.id); this.setData({ fx: this.data.fx.concat(list) }); setTimeout(() => this.setData({ fx: this.data.fx.filter(f => !ids.includes(f.id)) }), 1700); },
    // ── where things are on screen (px, relative to the stage) ──
    measure(done) {
      this.createSelectorQuery().select('#ysStage').boundingClientRect().select('#ysYuni').boundingClientRect().exec(res => {
        const s = res && res[0], y = res && res[1]; if (!s || !y) return done && done(null);
        this.geo = { stage: s, left: y.left - s.left, top: y.top - s.top, width: y.width, height: y.height, cx: y.left - s.left + y.width / 2, cy: y.top - s.top + y.height * .42, sl: s.left, st: s.top };
        done && done(this.geo);
      });
    },
    // ── finger in the scene: follow it, and react to how it moves ──
    onStart(e) {
      sound.unlock();
      const p = e.touches[0]; if (!p) return;
      this.touch = { x: p.clientX, y: p.clientY, moved: 0, strokeDist: 0, at: Date.now(), flips: [], dir: 0, high: 0 };
      this.measure(g => { if (this.touch && g) this.touch.onYuni = this.over(p.clientX, p.clientY); });
    },
    over(x, y) { const g = this.geo; if (!g) return false; const px = x - g.sl, py = y - g.st; return px > g.left + g.width * .18 && px < g.left + g.width * .82 && py > g.top + g.height * .06 && py < g.top + g.height * .94; },
    onMove(e) {
      const p = e.touches[0], t = this.touch, g = this.geo; if (!p || !t || !g || this.data.asleep) return;
      const now = Date.now(), px = p.clientX - g.sl, py = p.clientY - g.st, step = Math.hypot(p.clientX - t.x, p.clientY - t.y), dir = Math.sign(p.clientX - t.x);
      t.moved += step; this.rest();
      if (!this.lastLook || now - this.lastLook > 45) { this.lastLook = now; this.lookAt(Math.max(-1, Math.min(1, (px - g.cx) / (g.width * .5))) * 6, Math.max(-1, Math.min(1, (py - g.cy) / (g.height * .45))) * 5); }
      if (this.over(p.clientX, p.clientY)) {
        // 2026-11-17: only rubbing counts as stroking. A finger that slides across Yuni while leading the eyes is not a stroke;
        // rubbing = the finger turns back at least twice on Yuni within 1.5 s (compared over 12px segments, so jitter does not count).
        const r = t.rub || (t.rub = { flips: [], sx: 0, sy: 0, px: 0, py: 0 });
        r.sx += p.clientX - t.x; r.sy += p.clientY - t.y;
        if (Math.hypot(r.sx, r.sy) >= 12) { if (r.px * r.sx + r.py * r.sy < 0) r.flips.push(now); r.px = r.sx; r.py = r.sy; r.sx = 0; r.sy = 0; }
        r.flips = r.flips.filter(x => now - x < 1500);
        // Stroking: shy first, then love.
        if (this.stroke) t.strokeDist += step;
        if (r.flips.length >= 2 && !this.stroke) { this.stroke = 'shy'; sound.giggle(); this.lastPurr = now; this.busy = false; clearTimeout(this.actTimer); this.pose({ face: 'shy', wings: 'shy' }); this.say(pick(this.data.zh ? ['啊……好害羞！', '嘻嘻，好痒。', '别、别在大家面前……'] : ['Ah... I\'m shy!', 'Eep! That tickles.', 'N-not in front of everyone...']), 2000); }
        if (t.strokeDist > 260 && this.stroke === 'shy') { this.stroke = 'love'; sound.coo(); this.lastPurr = now; this.pose({ face: 'love', wings: 'love', body: 'munch' }); this.say(pick(this.data.zh ? ['最喜欢摸摸头了！', '不要停……', '好温暖，好喜欢。'] : ['I love head pats!', 'Don\'t stop...', 'So warm. I love this.']), 2400); this.cheer(); }
        if (this.stroke && now - (this.lastPurr || 0) > (this.stroke === 'love' ? 700 : 950)) { this.lastPurr = now; sound.purr(this.stroke === 'love'); }
        if (this.stroke && now - (this.lastHeart || 0) > (this.stroke === 'love' ? 150 : 420)) { this.lastHeart = now; this.heart(px, py - 10); }
      } else {
        t.rub = null; // left Yuni: a later rub starts counting again
        if (this.stroke || this.F) { t.x = p.clientX; t.y = p.clientY; return; }
        // Shaking the finger side to side makes Yuni dizzy.
        if (dir && dir !== t.dir && step > 5) { t.flips.push(now); t.dir = dir; }
        t.flips = t.flips.filter(x => now - x < 1300);
        if (t.flips.length >= 6 && !this.busy) { t.flips = []; this.act({ face: 'dizzy', body: 'dizzy', mouth: true }, 1900); this.say(this.t('慢一点，我头晕啦！', 'Slow down, I\'m dizzy!')); }
        // Holding the finger above Yuni's head: reach up and hop.
        if (py < g.top - 6 && Math.abs(px - g.cx) < g.width * .7) { t.high = t.high || now; if (now - t.high > 500 && now - (this.reachedAt || 0) > 1500 && !this.busy) { this.reachedAt = now; this.act({ face: 'happy', wings: 'reach', body: 'hop', mouth: true }, 900); this.say(pick(this.data.zh ? ['举高高！', '就差一点点！'] : ['Up high!', 'I can almost reach!']), 1200); } } else t.high = 0;
      }
      t.x = p.clientX; t.y = p.clientY;
    },
    onEnd() {
      const t = this.touch; this.touch = null; if (!t) return;
      const had = this.stroke;
      if (had) { this.stroke = null; this.act({ face: 'happy', wings: had === 'love' ? 'cheer' : '', body: 'squash' }, 1500); this.say(had === 'love' ? this.t('等下还要哦！', 'More later, please!') : this.t('嘿嘿。', 'Hehe.')); if (had === 'shy') this.cheer(); }
      else if (t.moved < 8 && t.onYuni !== false && Date.now() - t.at < 600) { this.measure(() => { if (this.over(t.x, t.y)) this.tap(); }); }
      this.lookAt(0, 0);
    },
    tap() {
      if (this.wake()) return; this.rest();
      const now = Date.now(); this.taps = this.taps.filter(x => now - x < 1500); this.taps.push(now);
      if (this.taps.length >= 4) { this.taps = []; this.act({ face: 'dizzy', body: 'dizzy', mouth: true }, 1900); this.say(this.t('哇，我头晕啦！', 'Whoa, I\'m dizzy!')); return; }
      this[pick(['wave', 'jump', 'spinMove', 'fiveMove'])](); this.cheer();
    },
    wave() { this.act({ face: 'happy', wings: 'wave', body: 'squash', mouth: true }, 1500); this.say(pick([this.t('你好呀！', 'Hi there!'), this.t('见到你真好！', 'Nice to see you!'), this.t('今天过得怎么样？', 'How\'s your day going?'), this.hi('你好呀！', 'Hi there!', '{n}，你好呀！', 'Hi, {n}!')])); },
    jump() { this.act({ face: 'happy', wings: 'cheer', body: 'jump', mouth: true }, 1200); this.say(this.t('随时出发！', 'Ready when you are!')); },
    // Spin: tap again within 1.6 s for a double spin, then a tornado; a 4th makes Yuni dizzy.
    spinMove() {
      const now = Date.now(); this.spinCombo = now - (this.lastSpin || 0) < 1600 ? (this.spinCombo || 0) + 1 : 1; this.lastSpin = now;
      const n = this.spinCombo; clearTimeout(this.landTimer);
      if (n >= 4) { this.spinCombo = 0; this.act({ face: 'dizzy', body: 'dizzy', mouth: true }, 1900); this.say(this.t('转太多啦，好晕……', 'Too much spinning... so dizzy!'), 2000); sound.miss(); return; }
      this.spinAlt = !this.spinAlt;
      this.act({ face: 'happy', wings: 'cheer', body: this.spinAlt ? 'whirl' : 'whirlb' }, 1350);
      this.say(n === 1 ? this.t('转圈圈！', 'Wheee!') : n === 2 ? this.t('再转一圈！', 'Double spin!') : this.t('龙卷风！', 'Tornado!'), 1500);
      sound.whoosh(n); this.measure(g => this.whirlFx(g, n));
      this.landTimer = setTimeout(() => { sound.land(); this.measure(g => this.dustFx(g)); }, 1100);
    },
    // High five: tap again within 2.2 s to build a combo; 5 in a row is a perfect combo with confetti.
    fiveMove() {
      const now = Date.now(); this.fiveCombo = now - (this.lastFive || 0) < 2200 ? (this.fiveCombo || 0) + 1 : 1; this.lastFive = now;
      const n = this.fiveCombo; this.fiveAlt = !this.fiveAlt; clearTimeout(this.slapTimer); this.measure(g => { this.fiveGeo = g ? { ...g } : null; });
      this.act({ face: 'happy', wings: this.fiveAlt ? 'five' : 'fiveb', body: this.fiveAlt ? 'five' : 'fiveb', mouth: true }, 1300);
      this.say(n === 1 ? this.t('击掌！', 'High five!') : n === 2 ? this.t('双连击！', 'Double five!') : n === 3 ? this.t('三连击！', 'Triple five!') : n >= 5 ? this.t('完美连击！', 'Perfect combo!') : this.t(n + ' 连击！', 'Combo x' + n + '!'), 1600);
      this.slapTimer = setTimeout(() => { sound.clap(n); this.slapFx(this.fiveGeo || this.geo, n); if (n >= 5) { this.fiveCombo = 0; setTimeout(() => { sound.fanfare(); this.confetti(30); }, 250); } }, 520);
    },
    // Impact at Yuni's raised wing: a flash, a ring, stars flying out, a short stage shake and the combo count.
    slapFx(g, n) {
      if (!this.data.motion || !g) return;
      /* g is measured before the jump: the raised right wing tip sits near the right edge, a little above the middle. */const x = Math.round(g.cx + g.width * .44), y = Math.round(g.top + g.height * .36), at = 'left:' + x + 'px;top:' + y + 'px;';
      const list = [{ id: ++fxId, kind: 'flash', style: at }, { id: ++fxId, kind: 'ring', style: at + '--s:' + (1 + Math.min(n, 5) * .22) }];
      const count = 8 + Math.min(n, 5) * 2, colors = ['#ffd35c', '#fff', '#ff9a8a', '#8fe3bd'];
      for (let i = 0; i < count; i++) { const a = i / count * Math.PI * 2 + Math.random() * .3, d = 70 + Math.min(n, 5) * 16 + Math.random() * 30; list.push({ id: ++fxId, kind: 'star', style: at + 'color:' + colors[i % 4] + ';--dx:' + Math.round(Math.cos(a) * d) + 'px;--dy:' + Math.round(Math.sin(a) * d) + 'px;--rot:' + Math.round(Math.random() * 360) + 'deg' }); }
      if (n > 1) list.push({ id: ++fxId, kind: 'combo', text: 'x' + n, style: 'left:' + (x + 34) + 'px;top:' + (y - 26) + 'px' });
      const ids = list.map(f => f.id); this.setData({ fx: this.data.fx.concat(list), shake: true });
      setTimeout(() => this.setData({ shake: false }), 380);
      setTimeout(() => this.setData({ fx: this.data.fx.filter(f => !ids.includes(f.id)) }), 1200);
    },
    // Spin: whirlwind rings around Yuni (one more per combo step) and stars spiralling up.
    whirlFx(g, n) {
      if (!this.data.motion || !g) return;
      const list = [], foot = g.top + g.height * .9;
      for (let i = 0; i < Math.min(n, 3); i++) list.push({ id: ++fxId, kind: 'whirl', style: 'left:' + Math.round(g.cx) + 'px;top:' + Math.round(foot - i * g.height * .3) + 'px;--w:' + Math.round(g.width * (1.05 - i * .12)) + 'px;--d:' + (i * 90) + 'ms' });
      const stars = 6 + n * 3;
      for (let i = 0; i < stars; i++) { const a = i / stars * Math.PI * 4, r = g.width * (.45 + Math.random() * .2); list.push({ id: ++fxId, kind: 'spark', style: 'left:' + Math.round(g.cx) + 'px;top:' + Math.round(foot) + 'px;--dx:' + Math.round(Math.cos(a) * r) + 'px;--dy:' + Math.round(-g.height * (.4 + i / stars * .8)) + 'px;--d:' + Math.round(i * 45) + 'ms;color:' + (i % 2 ? '#fff' : '#ffd35c') }); }
      const ids = list.map(f => f.id); this.setData({ fx: this.data.fx.concat(list) });
      setTimeout(() => this.setData({ fx: this.data.fx.filter(f => !ids.includes(f.id)) }), 1500);
    },
    // Landing: little dust puffs at Yuni's feet.
    dustFx(g) {
      if (!this.data.motion || !g) return;
      const list = [], foot = Math.round(g.top + g.height * .92);
      for (let i = 0; i < 6; i++) { const side = i % 2 ? 1 : -1; list.push({ id: ++fxId, kind: 'dust', style: 'left:' + Math.round(g.cx + side * g.width * .18) + 'px;top:' + foot + 'px;--dx:' + Math.round(side * (40 + i * 14)) + 'px;--dy:' + Math.round(-10 - i * 4) + 'px' }); }
      const ids = list.map(f => f.id); this.setData({ fx: this.data.fx.concat(list) });
      setTimeout(() => this.setData({ fx: this.data.fx.filter(f => !ids.includes(f.id)) }), 800);
    },
    danceMove() { sound.dance(); this.act({ face: 'happy', wings: 'dance', body: 'groove', mouth: true }, 2400); this.measure(() => this.confetti()); this.say(this.t('一起跳舞吧！', 'Dance with me!'), 2400); },
    five() { sound.unlock(); this.wake(true); this.rest(); this.fiveMove(); this.cheer(); },
    dance() { sound.unlock(); this.wake(true); this.rest(); this.danceMove(); this.cheer(); },
    spin() { sound.unlock(); this.wake(true); this.rest(); this.spinMove(); this.cheer(); },
    // Sound on/off, remembered on this phone (the same setting the sounds already check).
    toggleSound() {
      const on = !sound.enabled(); store.update(x => { x.yuniSounds = on; }); this.setData({ soundOn: on });
      if (on) { sound.unlock(); sound.coin(); this.say(this.t('音效已打开', 'Sound on'), 1400); } else this.say(this.t('音效已关闭', 'Sound off'), 1400);
    },
    noop() {},
    bumpBucket() { this.holdBucket = null; this.sync(); this.setData({ bucketBump: true }); setTimeout(() => this.setData({ bucketBump: false }), 420); },
    // ── feeding: a caught fish flies to Yuni, and the server then adds its points ──
    feed() {
      sound.unlock();
      // Today's dried fish first: open the Feed Yuni sheet (its own eating animation and the check-in reward).
      if (this.data.dailyFish && !this.F) { this.triggerEvent('dailyfeed'); return; }
      this.wake(true); this.rest();
      // Then a fish from a finished order (its points were added when the order was confirmed).
      if (this.data.orderFish && !this.F) return this.feedOrderFish();
      const play = this.play();
      if (!play.bucket.length) { this.act({ face: this.hungry() ? 'hungry' : 'shy', wings: this.hungry() ? 'belly' : '', body: 'squash' }, 1600); this.say(this.data.hasRod ? this.t('桶里没有鱼啦，去钓一条吧！', 'The bucket is empty. Catch me a fish!') : this.t('想吃鱼！先买一根鱼竿吧。', 'I want fish! Buy a rod first.'), 2600); return; }
      this.feedCaught(0);
    },
    // The eagle friend dives from its perch to the water, then flies the extra fish into the bucket.
    eagleCatch(F, e) {
      const f = catalog.fish(e.fish); if (!f) return; const zh = this.data.zh, g = this.geo;
      const finish = () => {
        this.setData({ eagleDive: null, friendAway: false, bucketBump: true }); this.friendTimer = setTimeout(() => this.friendStep(), 600); setTimeout(() => this.setData({ bucketBump: false }), 420);
        sound.coin(); this.drawGame(); this.act({ face: 'happy', wings: 'cheer', body: 'hop', mouth: true }, 900);
        this.say(zh ? '海鹰也抓到了一条' + f.zh + '！' : 'My eagle caught a ' + f.en.toLowerCase() + ' too!', 2400);
      };
      if (!this.data.motion || !g) return finish();
      this.createSelectorQuery().select('#ysStage').boundingClientRect().select('.ys-friend').boundingClientRect().select('.ys-bucket-btn').boundingClientRect().exec(res => {
        const st = res && res[0], fr = res && res[1], bk = res && res[2]; if (!st || !st.width) return finish();
        const sx = fr ? fr.left - st.left + fr.width / 2 : g.cx + g.width * .5, sy = fr ? fr.top - st.top + fr.height / 2 : g.top;
        const tx = bk ? bk.left - st.left + bk.width / 2 : 40, ty = bk ? bk.top - st.top + bk.height / 2 : st.height - 80;
        const wx_ = (F && F.bx) || st.width * .75, wy = (F && F.by) || st.height * .55;
        sound.whoosh(2);
        clearTimeout(this.friendTimer); clearTimeout(this.friendGlide);
        this.setData({ friendAway: true, eagleDive: { fish: rig.fish(f.id), style: '--sx:' + sx + 'px;--sy:' + sy + 'px;--wx:' + wx_ + 'px;--wy:' + wy + 'px;--tx:' + tx + 'px;--ty:' + ty + 'px' } });
        setTimeout(() => this.splashAt(wx_, wy), 700);
        setTimeout(finish, 1700);
      });
    },
    // Tap the eagle: it does a loop-the-loop and Yuni cheers.
    friendTap() {
      if (this.data.friendLoop) return; sound.whoosh(1);
      this.setData({ friendLoop: true }); setTimeout(() => this.setData({ friendLoop: false }), 1100);
      if (!this.F) { this.act({ face: 'happy', wings: 'cheer', body: 'jump', mouth: true }, 1200); this.say(pick(this.data.zh ? ['好厉害的空翻！', '再来一个！', '我的好伙伴！'] : ['What a loop!', 'Do it again!', 'That\'s my buddy!']), 1800); }
    },
    // ── the eagle's free flight: every leg goes somewhere new, so it never repeats a pattern ──
    friendPlay(on) {
      clearTimeout(this.friendTimer); clearTimeout(this.friendGlide);
      if (!on) { this.setData({ friendStyle: '', friendFace: '', friendTilt: '', friendFlap: false }); return; }
      this.friendTimer = setTimeout(() => this.friendStep(), 300);
    },
    friendBox() { const g = this.geo; if (!g || !g.stage || !g.stage.width) return null; const W = g.stage.width, H = g.stage.height, k = W / 750; return { g, W, H, ew: 220 * k, eh: 132 * k }; },
    friendStep() {
      clearTimeout(this.friendTimer);
      if (!this.data.friend || !this.data.motion) return;
      const b = this.friendBox();
      if (!b || this.data.friendAway) { this.measure(() => {}); this.friendTimer = setTimeout(() => this.friendStep(), 800); return; }
      if (!this.fpos) { this.fpos = { x: -b.ew, y: b.H * .22 }; this.setData({ friendStyle: 'transform:translate3d(' + this.fpos.x + 'px,' + this.fpos.y + 'px,0);transition:none' }); }
      if (this.fperched) this.friendTakeoff(true);
      // While Yuni fishes, hover over the water near the bobber, ready to dive.
      const F = this.F;
      if (F && F.bx && ['cast', 'wait', 'timing', 'stopping', 'hold', 'bite'].includes(F.phase)) {
        const hx = Math.max(6, Math.min(b.W - b.ew - 6, F.bx - b.ew / 2 + (Math.random() - .5) * b.W * .25)), hy = Math.max(b.H * .14, F.by - b.H * (.24 + Math.random() * .08));
        return this.friendFly(hx, hy, { flap: true, ms: 1500 + Math.random() * 900, face: hx + b.ew / 2 > F.bx ? -1 : 1 }, () => { this.friendTimer = setTimeout(() => this.friendStep(), 300 + Math.random() * 600); });
      }
      const free = !this.F && !this.data.mode && !this.busy && Date.now() - (this.lastVisit || 0) > 9000, roll = Math.random();
      if (free && roll < .22) return this.friendVisit(b);
      if (free && roll < .32) return this.friendCircle(b);
      if (free && roll < .46 && Date.now() - (this.lastPerch || 0) > 15000) return this.friendPerch(b);
      // a new random spot in the open sky, between the name line and Yuni's hat
      const px = (this.fpos || { x: 0 }).x; let x = 0;
      for (let i = 0; i < 6; i++) { x = 6 + Math.random() * (b.W - b.ew - 12); if (Math.abs(x - px) > b.W * .32) break; }
      const y = b.H * .15 + Math.random() * b.H * .2;
      this.friendFly(x, y, {}, () => { this.friendTimer = setTimeout(() => this.friendStep(), 150 + Math.random() * 700); });
    },
    // One smooth leg (a GPU transition): face the way it flies, tilt with the slope, flap on climbs, glide down.
    friendFly(x, y, o, done) {
      const b = this.friendBox(); if (!b) return done && done();
      const p0 = this.fpos || { x, y }, dx = x - p0.x, dy = y - p0.y, dist = Math.hypot(dx, dy) || 1;
      const ms = Math.round(o.ms || Math.max(1900, Math.min(5200, dist / (b.W / 750) * 5 + 900)));
      const face = o.face || (Math.abs(dx) > 6 ? (dx < 0 ? -1 : 1) : (this.fface || 1)), tilt = Math.max(-16, Math.min(16, dy / dist * 18));
      const flap = o.flap || dy < -b.H * .03;
      this.fpos = { x, y }; this.fface = face; clearTimeout(this.friendGlide);
      this.setData({ friendStyle: 'transform:translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0);transition:transform ' + ms + 'ms cubic-bezier(.37,0,.25,1)', friendFace: 'transform:scaleX(' + face + ')', friendTilt: 'transform:rotate(' + tilt.toFixed(1) + 'deg)', friendFlap: true });
      if (!flap) this.friendGlide = setTimeout(() => this.setData({ friendFlap: false }), Math.min(700, ms * .3));
      this.friendTimer = setTimeout(() => { this.setData({ friendTilt: 'transform:rotate(0deg)' }); done && done(); }, ms);
    },
    // Hover beside Yuni's head facing Yuni: Yuni looks up and waves or hops, and hearts float between them.
    friendVisit(b) {
      this.lastVisit = Date.now(); const g = b.g, side = Math.random() < .5 ? -1 : 1;
      const x = g.cx + side * g.width * .48 - b.ew / 2, y = Math.max(b.H * .12, g.top - b.eh * .1);
      this.friendFly(x, y, { flap: true, face: -side }, () => {
        if (!this.data.friend || this.F || this.data.mode) return this.friendStep();
        if (this.data.asleep) this.wake(true);
        this.setData({ friendFlap: true }); this.lookAt(side * 8, -4);
        const zh = this.data.zh; this.act(pick([{ face: 'happy', wings: 'wave', body: 'squash', mouth: true }, { face: 'happy', wings: 'cheer', body: 'jump', mouth: true }, { face: 'love', wings: 'reach', body: 'hop', mouth: true }]), 1600);
        this.say(pick(zh ? ['嗨，伙伴！', '一起去钓鱼吧！', '飞得真高！', '带我一起飞！', '你今天好帅！'] : ['Hi, buddy!', 'Let\'s go fishing!', 'You fly so high!', 'Take me flying!', 'Looking sharp today!']), 1900);
        if (this.data.motion) [0, 260, 520, 780].forEach(t => setTimeout(() => this.heart(g.cx + side * g.width * (.18 + Math.random() * .16), g.top + g.height * (.08 + Math.random() * .1)), t));
        this.friendTimer = setTimeout(() => { this.lookAt(0, 0); this.friendStep(); }, 2600);
      });
    },
    // Land on Yuni's hat: wings fold, the eagle stands upright, and Yuni looks up happily. It rests a while.
    friendPerch(b) {
      this.lastPerch = this.lastVisit = Date.now(); const g = b.g;
      const face = Math.random() < .5 ? -1 : 1, x = g.cx - b.ew * (face > 0 ? .6 : .4), y = g.top + g.height * .07 - b.eh * .575;
      this.friendFly(x, y, { flap: true, ms: 2200, face }, () => {
        if (!this.data.friend || this.F || this.data.mode || this.busy) return this.friendStep();
        this.fperched = true; this.setData({ friendPerch: true, friendFlap: false, friendTilt: 'transform:rotate(0deg)' });
        if (this.data.asleep) this.wake(true);
        this.lookAt(0, -6); this.act({ face: 'happy', body: 'squash', mouth: true }, 900);
        this.say(pick(this.data.zh ? ['你在我帽子上休息吗？', '帽子很舒服吧！', '嘿嘿，有点重哦。', '我们一起看风景。'] : ['Resting on my hat?', 'Comfy up there?', 'Hehe, you\'re heavy!', 'Nice view together.']), 2000);
        if (this.data.motion) [300, 700].forEach(t => setTimeout(() => this.heart(g.cx + (Math.random() - .5) * g.width * .3, g.top + g.height * .02), t));
        setTimeout(() => this.lookAt(0, 0), 2200);
        this.friendTimer = setTimeout(() => this.friendTakeoff(), 6000 + Math.random() * 5000);
      });
    },
    // Leave the hat: open the wings and fly up into the sky.
    friendTakeoff(quiet) {
      if (!this.fperched) return; this.fperched = false; clearTimeout(this.friendTimer);
      this.setData({ friendPerch: false, friendFlap: true });
      if (!quiet) { const b = this.friendBox(); if (b && this.fpos) return this.friendFly(this.fpos.x + (Math.random() < .5 ? -1 : 1) * b.W * .2, b.H * .14, { flap: true, ms: 1500 }, () => this.friendStep()); this.friendStep(); }
    },
    // Circle around Yuni: Yuni follows the eagle with their eyes, then spins happily.
    friendCircle(b) {
      this.lastVisit = Date.now(); const g = b.g, r = g.width * .62, cy = g.top + g.height * .12;
      const pts = [[g.cx + r, cy], [g.cx, cy - g.height * .2], [g.cx - r, cy], [g.cx, cy + g.height * .12]].map(([x, y]) => [x - b.ew / 2, Math.max(b.H * .1, y - b.eh / 2)]);
      const look = [[8, -2], [0, -6], [-8, -2], [0, 3]];
      const leg = i => {
        if (i >= pts.length || this.F || this.data.mode) { if (!this.F && !this.data.mode) { this.act({ face: 'happy', wings: 'cheer', body: 'spin' }, 1100); this.say(this.t('转圈圈，好开心！', 'Wheee! Again!'), 1600); } setTimeout(() => this.lookAt(0, 0), 1200); return this.friendStep(); }
        this.lookAt(look[i][0], look[i][1]);
        this.friendFly(pts[i][0], pts[i][1], { ms: 1150, flap: true }, () => leg(i + 1));
      };
      if (this.data.asleep) this.wake(true);
      leg(0);
    },
    // Very rare catch: a bottle with a coupon. It leaps out to Yuni, then a gold card shows the coupon.
    landCoupon(F, c) { this.holdBucket = null;
      const zh = this.data.zh, g = this.geo, done = () => {
        this.F = null; sound.catchFish('super'); setTimeout(() => sound.fanfare(), 400);
        this.setData({ prize: null, casting: false, bobStyle: '', lineStyle: '', card: { r: 'coupon', coupon: true, src: '/assets/yuni-play/bottle.svg', face: c.face, title: c.title, zh: c.zh, name: zh ? '瓶子里有优惠券！' : 'A coupon in a bottle!', sub: zh ? c.zh : c.title, pts: zh ? '已放进我的优惠券 · ' + c.days + ' 天内有效' : 'Saved to My coupons · ' + c.days + ' days' } });
        clearTimeout(this.cardTimer); this.cardTimer = setTimeout(() => { if (!this.sharing) this.setData({ card: null }); }, 20000); this.drawGame(); this.cheer(); this.lookAt(0, 0);
        this.act({ face: 'love', wings: 'cheer', body: 'jump', mouth: true }, 1600); this.confetti(34); this.say(this.t('哇！是优惠券！', 'Whoa! A coupon!'), 2800);
      };
      if (!this.data.motion || !g) return done();
      this.setData({ prize: { src: '/assets/yuni-play/bottle.svg', kind: 'catch', style: '--fx:' + F.bx + 'px;--fy:' + F.by + 'px;--tx:' + g.cx + 'px;--ty:' + (g.cy + 40) + 'px' } });
      setTimeout(done, 880);
    },
    cardTap() { if (this.data.card && this.data.card.coupon) { clearTimeout(this.cardTimer); this.setData({ card: null }); require('../../utils/nav').navigateTo({ url: '/pages/coupons/index' }); } },
    // Share a fished coupon: draw a picture and open WeChat's share-image menu (send to a chat, save, ...).
    async shareCoupon() {
      const c = this.data.card; if (!c || !c.coupon || this.sharing) return;
      const w = typeof wx !== 'undefined' ? wx : null;
      if (!w || !w.showShareImageMenu || !w.createOffscreenCanvas || !w.canvasToTempFilePath) { ui.toast(this.t('请在微信里打开 Uniearn 分享', 'Open Uniearn in WeChat to share')); return; }
      this.sharing = true; if (w.showLoading) w.showLoading({ title: this.t('正在生成图片', 'Making your picture') });
      try {
        const W = 600, H = 800, cv = w.createOffscreenCanvas({ type: '2d', width: W, height: H }), ctx = cv.getContext('2d');
        const img = await new Promise(done => { const im = cv.createImage(); const t = setTimeout(() => done(null), 2500); im.onload = () => { clearTimeout(t); done(im); }; im.onerror = () => { clearTimeout(t); done(null); }; im.src = '/assets/yuni-happy.png'; });
        this.drawShareCard(ctx, W, H, c, img);
        // Save the picture: canvasToTempFilePath first; older WeChat versions fall back to writing the PNG data to a user file.
        const path = await new Promise((done, fail) => w.canvasToTempFilePath({ canvas: cv, x: 0, y: 0, width: W, height: H, destWidth: W, destHeight: H, fileType: 'png', success: r => done(r.tempFilePath), fail })).catch(() => new Promise((done, fail) => { const file = w.env.USER_DATA_PATH + '/yuni-coupon-' + Date.now() + '.png'; w.getFileSystemManager().writeFile({ filePath: file, data: cv.toDataURL('image/png').split(',')[1], encoding: 'base64', success: () => done(file), fail }); }));
        if (w.hideLoading) w.hideLoading();
        w.showShareImageMenu({ path });
      } catch (e) { if (w.hideLoading) w.hideLoading(); ui.toast(this.t('图片生成失败，请截屏分享', 'Could not make the picture. Take a screenshot to share.')); }
      this.sharing = false;
    },
    // The share picture: mint sky, a gold coupon ticket, Yuni on the sea, and Uniearn at the bottom.
    drawShareCard(ctx, W, H, c, img) {
      const zh = this.data.zh, round = (x, y, w, h, r) => { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); };
      let g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#d6f1e6'); g.addColorStop(.68, '#a9dcc7'); g.addColorStop(.68, '#0b7a55'); g.addColorStop(1, '#085c41');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.beginPath(); ctx.arc(500, 110, 70, 0, Math.PI * 2); ctx.fill();
      ctx.textAlign = 'center'; ctx.fillStyle = '#1c2a54';
      ctx.font = '800 26px sans-serif'; ctx.fillText(zh ? 'Uniearn · 和 Yuni 一起钓鱼' : 'Uniearn · Fishing with Yuni', W / 2, 70);
      ctx.font = '900 46px sans-serif'; ctx.fillText(zh ? '我钓到了一张优惠券！' : 'I fished up a coupon!', W / 2, 130);
      // gold ticket with notches
      const tx = 90, ty = 170, tw = 420, th = 260;
      ctx.save(); ctx.shadowColor = 'rgba(122,78,0,.28)'; ctx.shadowOffsetY = 10; ctx.shadowBlur = 0;
      g = ctx.createLinearGradient(tx, ty, tx + tw, ty + th); g.addColorStop(0, '#fff6d6'); g.addColorStop(.6, '#ffe08a'); g.addColorStop(1, '#f2b233');
      round(tx, ty, tw, th, 34); ctx.fillStyle = g; ctx.fill(); ctx.restore();
      ctx.lineWidth = 6; ctx.strokeStyle = '#ffffff'; round(tx, ty, tw, th, 34); ctx.stroke();
      ctx.fillStyle = '#a9dcc7'; [[tx, ty + th / 2], [tx + tw, ty + th / 2]].forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, 22, 0, Math.PI * 2); ctx.fill(); });
      ctx.setLineDash([10, 10]); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(122,78,0,.35)'; ctx.beginPath(); ctx.moveTo(tx + 40, ty + 178); ctx.lineTo(tx + tw - 40, ty + 178); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = '#7a4e00'; ctx.font = '900 120px sans-serif'; ctx.fillText(c.face, W / 2, ty + 140);
      ctx.fillStyle = '#5a3a00'; ctx.font = '800 32px sans-serif'; ctx.fillText(zh ? (c.zh || c.sub) : (c.title || c.sub), W / 2, ty + 228);
      // Yuni on the sea
      ctx.fillStyle = '#f4fbff'; ctx.beginPath(); ctx.ellipse(W / 2, 640, 170, 26, 0, 0, Math.PI * 2); ctx.fill();
      if (img) ctx.drawImage(img, W / 2 - 120, 395, 240, 240);
      ctx.fillStyle = '#ffffff'; ctx.font = '800 30px sans-serif'; ctx.fillText(zh ? '在 Uniearn 和 Yuni 一起钓鱼' : 'Go fishing with Yuni on Uniearn', W / 2, 715);
      ctx.font = '600 22px sans-serif'; ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fillText(zh ? '运气好就能钓到优惠券' : 'With luck, you can reel in a coupon too', W / 2, 752);
    },
    // The bucket: go back to Yuni and feed a fish (the same as the Feed button).
    bucketTap() {
      if (this.F) return;
      if (!this.play().bucket.length) { this.say(this.t('桶还是空的，先钓一条吧！', 'The bucket is empty. Catch a fish first!'), 2000); return; }
      this.leave(); setTimeout(() => this.feed(), 250);
    },
    feedTap(e) { if (!this.F) this.feedCaught(Number(e.currentTarget.dataset.n)); },
    feedCaught(n) {
      const id = this.play().bucket[n], f = catalog.fish(id); if (!f || this.feeding) return; this.feeding = true;
      const pts = catalog.RARITY[f.r].points;
      this.busy = true; this.pose({ wings: 'reach', mouth: true });
      this.measure(g => {
        if (g) this.setData({ prize: { src: rig.fish(id), style: '--fx:' + (g.stage.width / 2) + 'px;--fy:' + (g.stage.height - 60) + 'px;--tx:' + g.cx + 'px;--ty:' + (g.cy + 20) + 'px', kind: 'feed' } });
        setTimeout(async () => {
          this.setData({ prize: null });
          try {
            await orders.act('yuniFeed', { index: n }); this.triggerEvent('changed');
            sound.eat(pts); this.fedNow(); this.act({ face: f.r === 'common' ? 'happy' : 'love', body: 'munch' }, 1700); this.chew(); this.points('+' + pts + this.t(' 积分', ' pts')); this.cheer();
            this.say(f.r === 'super' ? this.t('这是我吃过最棒的鱼！', 'The best fish I ever had!') : f.r === 'rare' ? this.t('唔，稀有的美味！', 'Mmm, a rare treat!') : this.t('好吃！', 'Yum!'), 2000);
            if (f.r !== 'common') this.confetti(f.r === 'super' ? 30 : 14);
          } catch (e) { this.pose(); this.busy = false; ui.toast(e.message || e); }
          this.feeding = false;
        }, this.data.motion ? 760 : 0);
      });
    },
    feedOrderFish() {
      const f = require('../../utils/order-fish').waiting()[0]; if (!f || this.feeding) return; this.feeding = true;
      this.busy = true; this.pose({ wings: 'reach', mouth: true });
      this.measure(g => {
        if (g) this.setData({ prize: { src: '/assets/yuni-feed/fish.png', style: '--fx:' + (g.stage.width / 2) + 'px;--fy:' + (g.stage.height - 60) + 'px;--tx:' + g.cx + 'px;--ty:' + (g.cy + 20) + 'px', kind: 'feed' } });
        setTimeout(() => {
          this.setData({ prize: null }); require('../../utils/order-fish').markFed(f.id); this.sync();
          sound.eat(f.points); this.fedNow(); this.act({ face: 'love', body: 'munch' }, 1700); this.chew(); this.points('+' + f.points + this.t(' 积分', ' pts')); this.cheer();
          this.say(f.role === 'runner' ? this.t('谢谢你帮同学跑单！', 'Thanks for running that order!') : this.t('订单完成啦，真好吃！', 'Order done. Yum!'), 2200);
          this.feeding = false;
        }, this.data.motion ? 760 : 0);
      });
    },
    chew() { let k = 0; clearInterval(this.chewTimer); this.chewTimer = setInterval(() => { this.mouth = !this.mouth; this.drawYuni(); if (++k > 5) { clearInterval(this.chewTimer); this.mouth = false; this.drawYuni(); } }, 150); },
    editName() { this.triggerEvent('editname'); },
    badgeTap() { this.triggerEvent('badge'); },
    pointsTap() { this.triggerEvent('points'); },

    // ── shop ──
    openShop(e) { this.wake(true); this.rest(); this.trying = null; if (typeof wx !== 'undefined' && wx.pageScrollTo) wx.pageScrollTo({ scrollTop: 0, duration: 0 }); this.setData({ mode: 'shop', tab: e && e.rod ? 0 : this.data.tab }); this.drawShop(); this.say(this.t('哇，买点什么好呢？', 'Ooh, what shall I get?')); },
    closeShop() { this.trying = null; this.setData({ mode: '' }); this.sync(); },
    pickTab(e) { this.trying = null; this.setData({ tab: Number(e.currentTarget.dataset.n) }); this.sync(); },
    owns(it) { const p = this.play(); return it.price === 0 || (it.level ? p.level >= it.level : p.owned.includes(it.id)); },
    levelName(n) { const l = require('../../utils/yuni-level').levels[n - 1] || {}; return this.data.zh ? l.zh : l.en; },
    drawShop() {
      const zh = this.data.zh, play = this.play(), tab = catalog.TABS[this.data.tab] || catalog.TABS[0], sel = this.trying ? this.trying.id : '';
      const cards = catalog.ITEMS.filter(i => tab.slots.includes(i.slot)).map(i => {
        const have = this.owns(i), wearing = play.worn[i.slot] === i.id;
        return { id: i.id, name: zh ? i.zh : i.en, tier: i.tier || 0, src: rig.thumb(i.id), swatch: i.sw ? 'background:linear-gradient(' + i.sw[0] + ' 58%,' + i.sw[1] + ' 58%)' : '', odds: i.odds ? (zh ? '超稀有 ' : 'Super rare ') + i.odds[2] + '%' : i.helper ? (zh ? '帮钓 ' : 'Extra fish ') + i.helper.chance + '%' : '', locked: !!i.level && !have, sel: sel === i.id,
          tag: wearing ? (zh ? '使用中' : 'Wearing') : have ? (zh ? '已拥有' : 'Owned') : i.level ? this.levelName(i.level) : i.price + (zh ? ' 积分' : ' pts'), tagClass: wearing ? 'worn' : have ? '' : i.level ? '' : 'price' };
      });
      const patch = { tabs: catalog.TABS.map((x, n) => ({ n, name: zh ? x.zh : x.en, on: n === this.data.tab, star: n === 0 })), cards, sel, balance: play.balance, rodNote: this.data.tab === 0, friendNote: (catalog.TABS[this.data.tab] || {}).slots && catalog.TABS[this.data.tab].slots.includes('friend') };
      const i = this.trying ? catalog.item(this.trying.id) : null;
      if (!i) Object.assign(patch, { buyName: zh ? '点一下就能试穿' : 'Tap anything to try it on', buyNote: zh ? '试穿免费。' : 'Trying is free.', buyLabel: zh ? '选择物品' : 'Pick an item', buyDisabled: true, buyPlain: false });
      else {
        const have = this.owns(i), wearing = play.worn[i.slot] === i.id, required = catalog.REQUIRED.includes(i.slot);
        let label, disabled = false, plain = false, note = i.odds ? (zh ? '稀有 ' + i.odds[1] + '%，超稀有 ' + i.odds[2] + '%' : 'Rare ' + i.odds[1] + '%, super rare ' + i.odds[2] + '%') : i.helper ? (zh ? '钓鱼时在水面盘旋；每次钓到鱼，有 ' + i.helper.chance + '% 机会再帮你抓一条' : 'Circles over the water while you fish; ' + i.helper.chance + '% chance to catch one more each time') : i.level ? (zh ? '等级奖励' : 'A level reward') : have ? (zh ? '已属于你' : 'Yours to keep') : (zh ? 'Yuni 正在试穿' : 'Yuni is trying it on');
        if (i.level && !have) { label = (zh ? '达到 ' : 'Reach ') + this.levelName(i.level); disabled = true; note = zh ? '达到该等级后免费获得。' : 'Free when you reach this level.'; }
        else if (!have && i.price > play.balance) { label = zh ? '还差 ' + (i.price - play.balance) + ' 积分' : 'Need ' + (i.price - play.balance) + ' more pts'; disabled = true; }
        else if (!have) label = zh ? i.price + ' 积分购买' : 'Buy for ' + i.price + ' pts';
        else if (wearing) { if (required) { label = zh ? '使用中' : 'In use'; disabled = true; } else { label = zh ? '脱下' : 'Take off'; plain = true; } }
        else label = i.slot === 'scene' || i.slot === 'ride' ? (zh ? '使用' : 'Use this') : (zh ? '穿上' : 'Wear');
        Object.assign(patch, { buyName: zh ? i.zh : i.en, buyNote: note, buyLabel: label, buyDisabled: disabled, buyPlain: plain });
      }
      this.setData(patch);
    },
    // Team test only: the server refuses this once TEST_POINTS_FOR_TESTING is off.
    async addTestPoints() {
      if (this.addingPoints) return; this.addingPoints = true;
      try { await orders.act('yuniTestPoints', {}); this.triggerEvent('changed'); sound.coin(); this.act({ face: 'love', wings: 'cheer', body: 'jump', mouth: true }, 1400); this.points('+200' + this.t(' 积分', ' pts')); }
      catch (e) { ui.toast(e.message || e); }
      this.addingPoints = false;
    },
    // Team test only: the server refuses this once TEST_ROUNDS_FOR_TESTING is off.
    async addTestRound() {
      if (this.addingRound || this.F) return; this.addingRound = true;
      try { await orders.act('yuniTestRound', {}); this.triggerEvent('changed'); sound.coin(); this.sync(); this.drawGame(); this.act({ face: 'happy', wings: 'cheer', body: 'jump' }, 1000); this.say(this.t('又能钓鱼啦！', 'More tries! Cast again.'), 2000); }
      catch (e) { ui.toast(e.message || e); }
      this.addingRound = false;
    },
    pickItem(e) { this.rest(); const it = catalog.item(e.currentTarget.dataset.id); if (!it) return; this.trying = { slot: it.slot, id: it.id }; this.sync(); if (!this.busy) this.act({ face: 'happy', body: 'squash' }, 700); },
    async buy() {
      const i = this.trying ? catalog.item(this.trying.id) : null; if (!i || this.data.buyDisabled || this.buying) return; this.buying = true; this.rest();
      const zh = this.data.zh, play = this.play(), have = this.owns(i), wearing = play.worn[i.slot] === i.id;
      try {
        if (!have) {
          await orders.act('yuniBuy', { item: i.id }); this.triggerEvent('changed'); sound.coin();
          this.act({ face: 'love', wings: 'cheer', body: 'jump', mouth: true }, 1800); this.measure(() => { this.confetti(18); this.points('-' + i.price + (zh ? ' 积分' : ' pts')); });
          this.say(i.odds ? this.t('新鱼竿！去钓鱼吧。', 'A new rod! Let\'s go fishing.') : pick(zh ? ['好喜欢！', '这真的是给我的吗？', '最棒的礼物！'] : ['I love it!', 'Is this really for me?', 'Best gift ever!']), 2400);
        } else if (wearing) { await orders.act('yuniWear', { slot: i.slot, item: '' }); this.say(this.t('好，先收起来。', 'OK, off it goes.')); }
        else { await orders.act('yuniWear', { slot: i.slot, item: i.id }); this.say(pick(zh ? ['我看起来怎么样？', '眼光不错。', '感觉真好！'] : ['How do I look?', 'Nice choice.', 'Feels good!'])); this.act({ face: 'happy', body: 'spin', wings: 'cheer' }, 1100); }
      } catch (e) { ui.toast(e.message || e); }
      this.buying = false; this.sync();
    },

    // ── fishing game ──
    verb() { return this.play().worn.hand === 'trident' ? this.t('出击', 'Strike') : this.t('拉', 'Pull'); },
    fishing() {
      this.wake(true); this.rest();
      if (!this.data.hasRod) { this.setData({ tab: 0 }); this.openShop({ rod: true }); this.say(this.t('我需要一根鱼竿！', 'I need a fishing rod first!'), 2600); return; }
      sound.gameStart(); if (typeof wx !== 'undefined' && wx.pageScrollTo) wx.pageScrollTo({ scrollTop: 0, duration: 0 });
      this.trying = null; this.setData({ mode: 'fish', card: null, bookOpen: false }); this.drawGame(); this.lookAt(4, 2);
      this.say(this.play().fishing.open ? this.t('来钓晚餐吧！', 'Let\'s catch dinner!') : this.t('现在鱼不咬钩。', 'No bites right now.'), 2400);
    },
    leave() { if (this.F) this.stopFishing(); this.setData({ mode: '', bookOpen: false, card: null }); this.lookAt(0, 0); this.rest(); this.sync(); },
    drawGame() {
      const zh = this.data.zh, play = this.play(), f = play.fishing, left = f.left || 0;
      const patch = { leftText: zh ? (left ? '今天还能钓 ' + left + ' 次' : '今天的次数用完了') : (left === 2 ? '2 tries left today' : left === 1 ? '1 try left today' : 'No tries left today'), bookCount: play.seen.length + '/' + catalog.FISH.length,
        bucket: play.bucket.map((id, n) => { const x = catalog.fish(id) || {}; return { n, id, src: rig.fish(id), pts: '+' + (catalog.RARITY[x.r] || { points: 0 }).points + (zh ? ' 积分' : ' pts') }; }) };
      if (!this.F) Object.assign(patch, { castClass: f.open ? '' : 'off', castLabel: f.open ? (zh ? '抛竿' : 'Cast') : f.nextFrom ? (zh ? f.nextFrom + ':00' : 'Back at') : (zh ? '明天' : 'Back'), castSub: f.open ? '' : f.nextFrom ? (zh ? '再来' : f.nextFrom + ':00') : (zh ? '再来' : 'tomorrow'),
        hint: f.open ? (zh ? '只有一次机会。浮标沉下去时，先在绿色区停下，再连点 ' + catalog.PULLS_NEEDED + ' 次「' + this.verb() + '」。' : 'One try. When the bobber goes under, stop the marker in the green, then tap ' + this.verb() + ' ' + catalog.PULLS_NEEDED + ' times.') : play.bucket.length ? (zh ? '钓到的鱼在桶里。点鱼桶去喂 Yuni。' : 'Your fish are in the bucket. Tap it to feed Yuni.') : (zh ? '午餐和晚餐时间各能钓一次。' : 'One try at lunch and one at dinner.') });
      this.setData(patch);
    },
    openBook() { const zh = this.data.zh, seen = this.play().seen; this.setData({ card: null, bookOpen: true, book: catalog.FISH.map(f => { const k = seen.includes(f.id); return { id: f.id, src: rig.fish(f.id), name: k ? (zh ? f.zh : f.en) : '???', r: f.r, known: k, sub: (zh ? catalog.RARITY[f.r].zh : catalog.RARITY[f.r].en) + ' +' + catalog.RARITY[f.r].points }; }) }); },
    closeBook() { this.setData({ bookOpen: false }); },
    stopFishing() { this.holdBucket = null; this.F = null; clearTimeout(this.biteTimer); clearTimeout(this.missTimer); clearTimeout(this.timingTimer); if (this.data.meter) this.setData({ meter: null }); (this.nibbleTimers || []).forEach(clearTimeout); this.setData({ casting: false, bobStyle: '', bobClass: '', lineStyle: '', shadowClass: '', bang: false, splash: null }); this.drawGame(); },
    splashAt(x, y) { const id = ++fxId; this.setData({ splash: { id, style: 'left:' + x + 'px;top:' + y + 'px' } }); setTimeout(() => { if (this.data.splash && this.data.splash.id === id) this.setData({ splash: null }); }, 900); },
    line(tip, bx, by) { const dx = bx - tip.x, dy = by - tip.y; return 'left:' + tip.x + 'px;top:' + tip.y + 'px;width:' + Math.hypot(dx, dy).toFixed(1) + 'px;transform:rotate(' + Math.atan2(dy, dx).toFixed(4) + 'rad);background:' + (this.play().worn.hand === 'trident' ? '#ffd35c' : '#f4f6f8'); },
    // Stop! and the pulls react the moment the finger touches the button, not when it lifts (a tap waits for the lift).
    castDown() {
      const F = this.F; if (!F || (F.phase !== 'timing' && F.phase !== 'bite')) return;
      this.downAt = Date.now(); if (F.phase === 'timing') this.stopTiming(false); else this.pull();
    },
    cast() {
      if (this.downAt && Date.now() - this.downAt < 800) { this.downAt = 0; return; } // the lift after castDown already acted
      if (this.F) { if (this.F.phase === 'timing') this.stopTiming(false); else if (this.F.phase === 'bite') this.pull(); else if (this.F.phase === 'wait') this.miss(this.t('太早啦！', 'Too soon!')); return; }
      const f = this.play().fishing;
      if (!f.open) { this.act({ body: 'squash' }, 900); this.say(f.window && f.used[f.window] ? (f.nextFrom ? this.t('每餐只能钓一次，' + f.nextFrom + ':00 再来。', 'One try per meal. Next at ' + f.nextFrom + ':00.') : this.t('今天钓完啦，明天见！', 'No tries left today. More tomorrow!')) : this.t('鱼只在午餐和晚餐时间咬钩。', 'Fish only bite at lunch and dinner.'), 3000); return; }
      this.measure(g => {
        if (!g) return;
        const tip = { x: g.left + g.width * (152 - rig.BOX.x) / rig.BOX.w, y: g.top + g.height * (34 - rig.BOX.y) / rig.BOX.h }, bx = g.stage.width * .8, by = g.stage.height * .5 + g.stage.width * .075;
        this.F = { phase: 'cast', tip, bx, by, pulls: 0 }; sound.cast();
        this.act({ wings: 'five', body: 'five' }, 1200); this.lookAt(6, 3);
        this.setData({ casting: true, card: null, castClass: 'waiting', castLabel: this.t('等待', 'Wait...'), castSub: '', bobSrc: rig.bobber(this.play().worn.hand), bobClass: '', bobStyle: 'left:' + tip.x + 'px;top:' + tip.y + 'px;transition:none', lineStyle: '', shadowClass: '', bang: false });
        setTimeout(() => { if (this.F) this.setData({ bobStyle: 'left:' + bx + 'px;top:' + by + 'px' }); }, 40);
        setTimeout(() => {
          if (!this.F) return; this.F.phase = 'wait'; sound.plop(); this.splashAt(bx, by);
          const biteAt = 2800 + Math.random() * 2800;
          this.setData({ bobClass: 'bobbing', lineStyle: this.line(tip, bx, by - 8), shadowClass: 'circling', shadowStyle: 'left:' + bx + 'px;top:' + by + 'px;--circle:' + Math.round(biteAt) + 'ms', hint: this.t('等浮标沉下去……', 'Wait for the bobber to go under...') });
          this.say(this.t('嘘……它来了。', 'Shh... here it comes.'), 2400);
          this.nibbleTimers = [.42, .7].map(k => setTimeout(() => { if (this.F && this.F.phase === 'wait') { sound.nibble(); this.setData({ bobClass: 'nibble' }); setTimeout(() => { if (this.F && this.F.phase === 'wait') this.setData({ bobClass: 'bobbing' }); }, 300); } }, biteAt * k));
          this.biteTimer = setTimeout(() => this.bite(), biteAt);
        }, this.data.motion ? 720 : 60);
      });
    },
    // The bite starts the timing bar: the marker goes there and back twice (4 legs). Stop it in the green.
    // Two chances: the first miss runs the bar again with a new green zone; a second miss lets the fish go.
    bite() {
      if (!this.F) return; const F = this.F; F.perfect = false; sound.bite(); this.splashAt(F.bx, F.by);
      this.setData({ bobClass: 'dip', bang: true, shadowClass: 'hooked', lineStyle: this.line(F.tip, F.bx, F.by + 6) });
      this.act({ mouth: true, body: 'squash' }, 900); this.say(this.t('咬钩了！看准时机！', 'A bite! Time it right!'), 1300);
      this.runTiming(F, 1);
    },
    runTiming(F, round) {
      F.phase = 'timing'; F.round = round;
      const width = .2, start = .18 + Math.random() * (.82 - width - .18); F.zone = [start, start + width]; F.leg = 700; F.t0 = Date.now();
      const last = round > 1;
      this.setData({ castClass: 'bite timing', castLabel: this.t('停！', 'Stop!'), castSub: last ? this.t('最后一次', 'last try') : '', hint: last ? this.t('最后一次机会：停在绿色区才能钓到鱼。', 'Last chance: stop in the green to hook the fish.') : this.t('在绿色区域停下才能钓到鱼。有两次机会。', 'Stop in the green to hook the fish. You get two chances.'),
        meter: { state: 'run', paused: false, zone: 'left:' + (start * 100).toFixed(1) + '%;width:' + (width * 100) + '%', mark: '--leg:' + F.leg + 'ms', label: last ? this.t('最后一次机会！', 'Last chance!') : this.t('在绿色区停下', 'Stop in the green') } }, () => { if (this.F === F && F.round === round) F.t0 = Date.now(); });
      this.timingTimer = setTimeout(() => this.stopTiming(true), F.leg * 4 + 60);
    },
    // Tap: pause the float where it is, read its real position on screen, then judge the green zone from that.
    stopTiming(timeout) {
      const F = this.F; if (!F || F.phase !== 'timing') return; clearTimeout(this.timingTimer);
      if (timeout) return this.finishTiming(F, 0, false, true);
      F.phase = 'stopping'; const guess = this.timedPos(F);
      this.setData({ 'meter.paused': true }, () => {
        if (this.F !== F) return;
        this.createSelectorQuery().select('.ys-meter-zone').boundingClientRect().select('.ys-meter-float').boundingClientRect().exec(res => {
          if (this.F !== F) return;
          const zone = res && res[0], fl = res && res[1], w = F.zone[1] - F.zone[0];
          if (!zone || !fl || !zone.width) return this.finishTiming(F, guess, guess >= F.zone[0] && guess <= F.zone[1], false);
          const inner = zone.width / w, left = zone.left - F.zone[0] * inner, center = fl.left + fl.width / 2;
          const pos = Math.max(0, Math.min(1, (center - left) / inner));
          this.finishTiming(F, pos, center >= zone.left && center <= zone.left + zone.width, false);
        });
      });
    },
    // Fallback when the screen cannot be read: the position from the elapsed time.
    timedPos(F) { const k = (Math.min(Date.now() - F.t0, F.leg * 4) / F.leg) % 2; return k <= 1 ? k : 2 - k; },
    finishTiming(F, pos, hit, timeout) {
      F.perfect = hit; F.phase = 'hold'; sound.zone(hit);
      this.setData({ meter: { ...this.data.meter, paused: false, state: hit ? 'hit' : 'miss', mark: 'transform:translate3d(' + (pos * 100).toFixed(2) + '%,0,0)', label: hit ? this.t('完美！', 'Perfect!') : F.round > 1 ? (timeout ? this.t('太慢了，鱼跑掉了', 'Too slow. It got away') : this.t('没停在绿区，鱼跑掉了', 'Missed the green. It got away')) : (timeout ? this.t('太慢了！再来一次', 'Too slow! One more try') : this.t('没停在绿区！再来一次', 'Missed! One more try')) }, castClass: 'waiting', castLabel: '...', castSub: '' });
      if (hit) this.act({ face: 'happy', wings: 'cheer', body: 'hop', mouth: true }, 700); else this.act({ face: 'shy', body: 'squash' }, 700);
      // Only a stop in the green hooks the fish. The first miss gets one more run of the bar; the second ends this try.
      this.timingTimer = setTimeout(() => {
        if (this.F !== F) return;
        if (hit) return this.startPulls();
        if (F.round < 2) { this.say(this.t('别急，再来一次！', 'Easy... one more chance!'), 1300); return this.runTiming(F, 2); }
        this.miss(timeout ? this.t('太慢了！', 'Too slow!') : this.t('两次都没停在绿区！', 'Missed the green twice!'));
      }, 750);
    },
    // After the timing bar: three quick pulls land the fish.
    startPulls() {
      const F = this.F; if (!F) return; F.phase = 'bite'; F.pulls = 0;
      this.setData({ meter: null, castClass: 'bite', castLabel: this.verb() + '!', castSub: '×' + catalog.PULLS_NEEDED, hint: this.t('快！连点 ' + catalog.PULLS_NEEDED + ' 次', 'Tap ' + this.verb() + ' ' + catalog.PULLS_NEEDED + ' times, fast!') });
      this.say(this.t('快' + this.verb() + '！', this.verb() + '!'), 1000);
      this.missTimer = setTimeout(() => this.miss(F.pulls ? this.t('它脱钩了！', 'It slipped off the hook!') : this.t('它跑掉了！', 'It got away!')), catalog.PULL_WINDOW_MS);
    },
    // Three quick pulls land the fish; each pull reels it a little closer.
    pull() {
      const F = this.F; F.pulls++; sound.reel(F.pulls);
      if (F.pulls >= catalog.PULLS_NEEDED) return this.land();
      const left = catalog.PULLS_NEEDED - F.pulls;
      this.splashAt(F.bx - F.pulls * 8, F.by); this.act({ wings: 'reach', body: 'squash', mouth: true }, 500);
      this.setData({ castSub: '×' + left, castClass: 'bite tug', hint: left === 1 ? this.t('再来一次！', 'One more!') : this.t('再来！', 'Again!') }); setTimeout(() => { if (this.F && this.F.phase === 'bite') this.setData({ castClass: 'bite' }); }, 200);
      this.say(left === 1 ? this.t('快了！再来一次！', 'Almost! One more!') : this.t('它力气好大！再来！', 'It\'s strong! Again!'), 900);
    },
    // A miss uses up this meal's try and lands nothing.
    miss(line) {
      if (!this.F || this.F.phase === 'landing') return; clearTimeout(this.biteTimer); clearTimeout(this.missTimer); clearTimeout(this.timingTimer); (this.nibbleTimers || []).forEach(clearTimeout); this.setData({ meter: null });
      this.F.phase = 'flee'; sound.miss(); orders.act('yuniFish', { landed: false }).catch(() => {});
      this.setData({ bobClass: 'bobbing', bang: false, shadowClass: 'flee', castClass: 'waiting', castLabel: '...', castSub: '' });
      this.act({ face: 'shy', body: 'squash' }, 1700); this.say(line + this.t(' 下次再来。', ' Try again next time.'), 2800); this.lookAt(0, 0);
      setTimeout(() => this.stopFishing(), 800);
    },
    async land() {
      const F = this.F; if (!F || F.phase !== 'bite') return; F.phase = 'landing'; clearTimeout(this.missTimer);
      this.setData({ bang: false, shadowClass: '', bobClass: 'gone', castClass: 'waiting', castLabel: '...', castSub: '' }); this.splashAt(F.bx, F.by);
      this.act({ face: 'happy', wings: 'reach', body: 'squash', mouth: true }, 900);
      // Keep the old bucket count until the fish lands in the bucket.
      this.holdBucket = this.data.bucketCount; let got;
      try { const res = await orders.act('yuniFish', { landed: true, perfect: !!F.perfect }); got = res && (res.fish || res.coupon) ? res : res && res.value; } catch (e) { ui.toast(e.message || e); this.stopFishing(); return; }
      if (got && got.coupon) return this.landCoupon(F, got.coupon);
      if (got && got.eagle) setTimeout(() => this.eagleCatch(F, got.eagle), 1500);
      if (!got || !got.fish) { this.stopFishing(); return; }
      const f = catalog.fish(got.fish), zh = this.data.zh, g = this.geo, done = (shown) => {
        this.F = null; sound.catchFish(f.r);
        this.setData({ prize: null, casting: false, bobStyle: '', lineStyle: '', card: { src: rig.fish(f.id), name: zh ? f.zh : f.en, sub: (zh ? catalog.RARITY[f.r].zh : catalog.RARITY[f.r].en) + (got.isNew ? (zh ? '，图鉴新发现' : ', new in your fish book') : ''), pts: zh ? '喂给 Yuni +' + catalog.RARITY[f.r].points + ' 积分' : 'Feed it for +' + catalog.RARITY[f.r].points + ' pts', r: f.r } });
        if (!shown) { clearTimeout(this.cardTimer); this.cardTimer = setTimeout(() => this.setData({ card: null }), 2800); this.bumpBucket(); } this.drawGame(); this.cheer(); this.lookAt(0, 0);
        if (f.r === 'super') { this.act({ face: 'love', wings: 'cheer', body: 'jump', mouth: true }, 1600); this.confetti(30); this.say(this.t('超稀有！' + f.zh + '！', 'Super rare! A ' + f.en.toLowerCase() + '!'), 2800); }
        else if (f.r === 'rare') { this.act({ face: 'love', wings: 'cheer', body: 'jump', mouth: true }, 1900); this.confetti(16); this.say(this.t('哇，稀有的！', 'Wow, a rare one!'), 2400); }
        else { this.act({ face: 'happy', wings: 'cheer', body: 'jump', mouth: true }, 1500); this.say(this.t('钓到了！可以吃吗？', 'Got one! Can I eat it?'), 2200); }
      };
      if (!this.data.motion || !g) return done();
      // 2026-11-18: show the fish first. It leaps out of the water into the card (where the fish picture sits),
      // stays on show for a moment, then flies from the card into the bucket.
      return this.createSelectorQuery().select('#ysStage').boundingClientRect().select('.ys-bucket-btn').boundingClientRect().exec(res => {
        const st = res && res[0], bk = res && res[1], tx = st && bk ? bk.left - st.left + bk.width / 2 : g.cx, ty = st && bk ? bk.top - st.top + bk.height * .3 : g.cy + 40;
        const win = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync(), rpx = (win.windowWidth || 375) / 750;
        const sx = st ? st.width / 2 : g.cx, sy = 229 * rpx, src = rig.fish(f.id), hold = f.r === 'super' ? 2400 : f.r === 'rare' ? 2000 : 1500;
        const style = '--fx:' + F.bx + 'px;--fy:' + F.by + 'px;--sx:' + sx + 'px;--sy:' + sy + 'px;--tx:' + tx + 'px;--ty:' + ty + 'px';
        this.setData({ prize: { src, kind: 'leap', style } });
        setTimeout(() => {
          done(true);
          clearTimeout(this.cardTimer);
          this.cardTimer = setTimeout(() => {
            this.setData({ prize: { src, kind: 'stash', style }, 'card.leaving': true });
            this.cardTimer = setTimeout(() => { this.setData({ prize: null, card: null }); this.bumpBucket(); }, 700);
          }, hold);
        }, 560);
      });
    }
  }
});
