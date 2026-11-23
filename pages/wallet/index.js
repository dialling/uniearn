// Chart interpolation reused from the supplied wallet package; CloudBase test API adapter.
const api = require('../../utils/wallet');
const store = require('../../utils/store');
const copy = require('../../utils/wallet-copy');
const yuan = cents => (Number(cents || 0) / 100).toFixed(2);
const cnTime = at => at ? new Date(Number(at) + 28800000).toISOString().replace('T', ' ').slice(0, 16) : '';
function tracePath(ctx, xs, ys) {
  const n = xs.length;
  ctx.moveTo(xs[0], ys[0]);
  if (n < 3) { for (let i = 1; i < n; i++) ctx.lineTo(xs[i], ys[i]); return; }
  const d = [], m = new Array(n);
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], h = a * a + b * b;
    if (h > 9) { const t = 3 / Math.sqrt(h); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
  }
  for (let i = 0; i < n - 1; i++) {
    const dx = (xs[i + 1] - xs[i]) / 3;
    ctx.bezierCurveTo(xs[i] + dx, ys[i] + m[i] * dx, xs[i + 1] - dx, ys[i + 1] - m[i + 1] * dx, xs[i + 1], ys[i + 1]);
  }
}



const DAY = 86400000, OFFSET = 28800000;
const cnDay = at => new Date(Number(at) + OFFSET).toISOString().slice(0, 10);
// 最近 7 天的每日入账 / 提现，用于余额卡下方的柱形图
function weekStats(transactions, zh, now = Date.now()) {
  const days = Array.from({ length: 7 }, (_, i) => cnDay(now - (6 - i) * DAY));
  const rows = Array.from(transactions || [], t => ({ day: cnDay(t.created_at), cents: Number(t.amount_cents) || 0 }));
  const income = days.map(d => rows.filter(r => r.day === d && r.cents > 0).reduce((n, r) => n + r.cents, 0));
  const paid = days.map(d => rows.filter(r => r.day === d && r.cents < 0).reduce((n, r) => n + r.cents, 0));
  const max = Math.max.apply(null, income.concat([1]));
  const labels = ['日', '一', '二', '三', '四', '五', '六'];
  return {
    bars: income.map(c => Math.max(0, Math.round((c / max) * 100))),
    labels: days.map((d, i) => (i === days.length - 1 ? (zh ? '今天' : 'Today') : (zh ? '周' : '') + labels[new Date(d + 'T00:00:00Z').getUTCDay()])),
    count: rows.filter(r => days.includes(r.day)).length,
    income: income.reduce((n, c) => n + c, 0),
    paid: paid.reduce((n, c) => n + c, 0)
  };
}
Page({
 data: {...require('../../utils/motion').data(),version:require('../../package.json').version,ui: copy('zh', require('../../utils/merge-mode').enabled), language: 'zh', loading: true, chartReady: false, withdrawing: false, rulesVisible: false, hideAmount: false, balance: '0.00', balanceCents: 0, todayIncome: '0.00', totalIncome: '0.00', pendingCents: 0, pendingYuan: '0.00', debt: '0.00', debtCents: 0, chartMax: '', chartStart: '', rules: {}, transactions: [], withdrawals: [], pending: [], error: ''},
 onLoad() { this._visible = true; },
 onShow() { this._visible = true; this.load(); },
 onHide() { this._visible = false; this._loadId = (this._loadId || 0) + 1; },
 onUnload() { this.onHide(); },
 onReady() { this._ready = true; this.drawChart(); },
 onPullDownRefresh() { this.load().finally(() => wx.stopPullDownRefresh()); },
 openRules() { this.setData({rulesVisible: true}); },
 closeRules() { this.setData({rulesVisible: false}); },
 noop() {},
 earnings() { require('../../utils/nav').navigateTo({url:'/pages/earnings/index'}); },
 toggleHide() {
  const hide = !this.data.hideAmount, actor = store.get().profile.accountId;
  wx.setStorageSync('wallet_hide_amount:' + actor, hide);
  this.setData({hideAmount: hide}, () => this.drawChart());
 },
 clearWallet() { this._series = []; this.setData({balance:'0.00',balanceCents:0,todayIncome:'0.00',totalIncome:'0.00',pendingCents:0,pendingYuan:'0.00',debt:'0.00',debtCents:0,transactions:[],withdrawals:[],pending:[],chartMax:'',chartStart:'',rules:{},rulesVisible:false,chartReady:false}); },
 async load() {
  const request = this._loadId = (this._loadId || 0) + 1, language = store.get().language === 'en' ? 'en' : 'zh', ui = copy(language, require('../../utils/merge-mode').enabled);
  const actor = store.get().profile.accountId;
  this.setData({loading:true,chartReady:false,error:'',ui,language});
  if (store.get().profile.loggedOut || this._actor && actor !== this._actor) this.clearWallet();
  try {
   const res = await api.overview();
   if (request !== this._loadId || !this._visible) return;
   this._actor = store.get().profile.accountId;
   const week = weekStats(res.transactions, language !== 'en'); this._weekBars = week.bars;
   this._series = Array.from(res.series || [], p => Number(p.cents) || 0);
   if (!this._series.length) this._series = [res.balance_cents || 0];
   this.setData({weekBars:week.bars,weekLabels:week.labels,weekCount:week.count,weekIn:yuan(week.income),weekOut:yuan(Math.abs(week.paid))});
   const max = Math.max(...this._series), min = Math.min(...this._series);
   this.setData({loading:false,balanceCents:res.balance_cents,balance:res.balance_yuan,todayIncome:yuan(res.today_income_cents),totalIncome:yuan(res.total_income_cents),pendingCents:res.pending_cents,pendingYuan:res.pending_yuan,debtCents:res.debt_cents,debt:yuan(res.debt_cents),rules:res.rules,
    hideAmount:!!wx.getStorageSync('wallet_hide_amount:' + this._actor), chartMax:max > min ? yuan(max) : '',chartStart:res.series.length ? res.series[0].date.slice(5).replace('-', '/') : '',
    transactions:Array.from(res.transactions || [], t => ({id:t.id,kindText:ui[t.kind] || t.kind,created_at:cnTime(t.created_at),positive:t.amount_cents >= 0,amountYuan:yuan(Math.abs(t.amount_cents))})),
    withdrawals:Array.from(res.withdrawals || [], w => ({id:w.id,amountYuan:yuan(w.amount_cents),status:w.status,statusText:ui[w.status] || ui.processing,reject_reason:w.status === 'rejected' ? ui.failed : '',created_at:cnTime(w.created_at)})),
    pending:Array.from(res.pending || [], p => ({id:p.order_id,title:p.type==='parcel'?(language==='en'?'Parcel pickup':'快递代取'):p.type==='task'?(language==='en'?'Campus task':'校园任务'):p.night?(language==='en'?'Request a night market purchase':'夜市代买'):(language==='en'?'Takeaway pickup':p.title),amount:yuan(p.amount_cents),detail:p.disputed?ui.disputed:ui.auto+' '+cnTime(p.auto_settle_at)}))
   }, () => this.drawChart());
  } catch (e) { if (request === this._loadId && this._visible) { if (store.get().profile.loggedOut || this._actor && store.get().profile.accountId !== this._actor) this.clearWallet(); this.setData({loading:false,error:e.message || (language === 'en' ? 'Could not load your wallet.' : '钱包加载失败，请重试。')}); } }
 },
  drawChart() {
    if (!this._ready || !this._visible || this.data.loading || this.data.error || !this._series?.length || typeof wx.createSelectorQuery !== 'function') return;
    const values = this._series.slice(), request = this._loadId, draw = this._drawId = (this._drawId || 0) + 1;
    wx.createSelectorQuery().select('#assetChart').fields({ node: true, size: true }).exec((r) => {
      // Canvas queries can return after a refresh or navigation has invalidated this draw.
      if (request !== this._loadId || draw !== this._drawId || !this._visible || this.data.loading || this.data.error) return;
      const hit = r && r[0];
      if (!hit || !hit.node || !(hit.width > 0) || !(hit.height > 0)) return;
      const canvas = hit.node;
      const ctx = canvas.getContext('2d');
      let dpr = 2;
      try { dpr = (wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()).pixelRatio || 2; } catch (_) {}
      const W = hit.width, H = hit.height;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, W, H);

      // Last 7 days as a smooth line with a soft fill; today's point is the solid dot (2026-11-16).
      const padT = 14, padB = 12, padX = 14;
      const pts = Array.from(this._weekBars || [], v => Math.max(0, Math.min(100, Number(v) || 0)));
      while (pts.length < 7) pts.unshift(0);
      const base = H - padB, step = (W - padX * 2) / 6;
      const xy = pts.map((pct, i) => [padX + step * i, base - (base - padT) * (pct / 100)]);
      ctx.setLineDash([2, 4]); ctx.strokeStyle = 'rgba(11,122,85,.16)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(padX, base); ctx.lineTo(W - padX, base); ctx.stroke(); ctx.setLineDash([]);
      const curve = () => { ctx.moveTo(xy[0][0], xy[0][1]); for (let i = 1; i < xy.length; i++) { const [x0, y0] = xy[i - 1], [x1, y1] = xy[i], mx = (x0 + x1) / 2; ctx.bezierCurveTo(mx, y0, mx, y1, x1, y1); } };
      const fill = ctx.createLinearGradient ? ctx.createLinearGradient(0, padT, 0, base) : null;
      if (fill) { fill.addColorStop(0, 'rgba(11,122,85,.22)'); fill.addColorStop(1, 'rgba(11,122,85,0)'); }
      ctx.beginPath(); curve(); ctx.lineTo(xy[xy.length - 1][0], base); ctx.lineTo(xy[0][0], base); ctx.closePath(); ctx.fillStyle = fill || 'rgba(11,122,85,.12)'; ctx.fill();
      ctx.beginPath(); curve(); ctx.strokeStyle = '#0b7a55'; ctx.lineWidth = 2.5; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke();
      xy.forEach(([x, y], i) => { const today = i === xy.length - 1; ctx.beginPath(); ctx.arc(x, y, today ? 5 : 3, 0, Math.PI * 2); ctx.fillStyle = today ? '#0b7a55' : '#fff'; ctx.fill(); if (!today) { ctx.lineWidth = 1.5; ctx.strokeStyle = '#0b7a55'; ctx.stroke(); } });
      this.setData({chartReady:true});
    });
  },

 async withdraw() {
  if (this.data.withdrawing) return;
  // 之前只要页面有过一次错误（比如 token 过期导致的 401），按钮就被禁掉，
  // 用户看到的是「点了没反应」。这里先清错误再继续。
  if (this.data.error) this.setData({error:''});
  if (this.data.loading) { this.load(); return; }
  const ui = this.data.ui, bal = this.data.balanceCents, actor = store.get().profile.accountId;
  if (!(bal > 0)) { wx.showToast({title:ui.noBalance,icon:'none'}); this.load(); return; }
  this.setData({withdrawing:true});
  try {
   const answer = await new Promise((resolve, reject) => wx.showModal({title:ui.confirmTitle,content:ui.confirmText.replace('{n}',this.data.balance),confirmText:ui.confirm,cancelText:ui.cancel,success:resolve,fail:reject}));
   if (!answer.confirm || !this._visible || actor !== store.get().profile.accountId) return;
   const result = await api.withdraw(bal);
   if (!this._visible || actor !== store.get().profile.accountId) return;
   wx.showToast({title:result.withdrawal.status==='approved'?ui.success:ui.failed,icon:'none'});
   await this.load();
  } catch (e) { if(this._visible) { this.clearWallet(); this.setData({error:e.message}); await this.load(); wx.showToast({title:e.message,icon:'none'}); } }
  finally { this.setData({withdrawing:false}); }
 }
});
