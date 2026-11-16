// 2026-11-16: first-time tip (spotlight + Yuni card), same look as the Jobs page app guide.
// <coach-tip name="trip" when="{{ready}}"/> starts once per account when `when` turns true.
const store = require('../../utils/store'), coach = require('../../utils/coach');
Component({
  properties: { name: { type: String, value: '' }, when: { type: Boolean, value: false, observer: 'tryStart' } },
  data: { i: -1, focus: null, tip: null, dots: [], cardStyle: '', last: 0, zh: true, dir: 'next' },
  lifetimes: { attached() { this.tryStart(); }, detached() { clearTimeout(this.timer); } },
  pageLifetimes: { hide() { clearTimeout(this.timer); } },
  methods: {
    tryStart() {
      clearTimeout(this.timer);
      if (!this.data.when || this.data.i >= 0 || !this.data.name || coach.seen(this.data.name)) return;
      const p = store.get().profile || {}; if (!p.onboarded || p.loggedOut) return;
      this.timer = setTimeout(() => { if (this.data.when && !coach.seen(this.data.name)) this.start(); }, 650);
    },
    start() {
      const zh = store.get().language !== 'en', list = coach.steps(this.data.name, zh ? 'zh' : 'en');
      if (!list.length) return;
      this.list = list; this.setData({ i: 0, zh, dir: 'next', focus: null, last: list.length - 1, dots: list.map((_, k) => k) }); this.show(0);
    },
    next() { const k = this.data.i + 1; if (k > this.data.last) return this.finish(); this.setData({ i: k, dir: 'next' }); this.show(k); },
    back() { const k = Math.max(0, this.data.i - 1); this.setData({ i: k, dir: 'back' }); this.show(k); },
    finish() { clearTimeout(this.timer); coach.mark(this.data.name); this.setData({ i: -1, focus: null }); this.triggerEvent('done'); },
    noop() {},
    // Measure the target in the screen that holds this tip; scroll it into view first if it is off screen.
    show(k, scrolled) {
      const item = this.list[k]; if (!item) return; this.setData({ tip: item });
      const owner = this.selectOwnerComponent ? this.selectOwnerComponent() : null; if (!owner) return this.setData({ focus: null, cardStyle: '' });
      const split = item.target.split(' >>> '), host = split.length > 1 ? owner.selectComponent(split[0]) : owner;
      if (!host || !host.createSelectorQuery) return this.setData({ focus: null, cardStyle: '' });
      const vh = (wx.getSystemInfoSync && wx.getSystemInfoSync().windowHeight) || 700;
      host.createSelectorQuery().select(split.length > 1 ? split[1] : item.target).boundingClientRect().selectViewport().scrollOffset().exec(res => {
        if (this.data.i !== k) return; const rect = res && res[0], view = res && res[1];
        if (!rect) return this.setData({ focus: null, cardStyle: '' });
        // in-page targets: bring the top of the target near the top of the screen so the card fits below it
        if (!item.fixed && !scrolled && split.length === 1 && (rect.top < 60 || rect.top > 150) && wx.pageScrollTo) {
          wx.pageScrollTo({ selector: item.target, offsetTop: -90, duration: 0 });
          this.timer = setTimeout(() => this.show(k, true), 260); return;
        }
        // 2026-11-17: measure the real card, then put it just below the target, else just above; if neither fits, trim the spotlight.
        const pad = 6, gap = 12, w = rect.width + pad * 2, top = rect.top - pad, full = rect.height + pad * 2;
        this.createSelectorQuery().select('.cg-card').boundingClientRect(card => {
          if (this.data.i !== k) return;
          const ch = (card && card.height) || 240;
          let h = full, cardTop;
          if (top + h + gap + ch <= vh - 12) cardTop = top + h + gap;
          else if (top - gap - ch >= 12) cardTop = top - gap - ch;
          else { h = Math.max(80, vh - 12 - ch - gap - top); cardTop = top + h + gap; }
          this.setData({ cardStyle: 'top:' + cardTop + 'px;bottom:auto', focus: { top, left: rect.left - pad, width: w, height: h, radius: 18 } });
          // sheets and bars may still be sliding in: measure once more when they have settled
          if (item.fixed && scrolled !== 'again') this.timer = setTimeout(() => { if (this.data.i === k) this.show(k, 'again'); }, 450);
        }).exec();
      });
    }
  }
});
