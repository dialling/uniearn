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


Page({
 data: {ui: copy('zh'), language: 'zh', loading: true, chartReady: false, withdrawing: false, rulesVisible: false, hideAmount: false, balance: '0.00', balanceCents: 0, todayIncome: '0.00', totalIncome: '0.00', pendingCents: 0, pendingYuan: '0.00', debt: '0.00', debtCents: 0, chartMax: '', chartStart: '', rules: {}, transactions: [], withdrawals: [], pending: [], error: ''},
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
  const request = this._loadId = (this._loadId || 0) + 1, language = store.get().language === 'en' ? 'en' : 'zh', ui = copy(language);
  const actor = store.get().profile.accountId;
  this.setData({loading:true,chartReady:false,error:'',ui,language});
  if (store.get().profile.loggedOut || this._actor && actor !== this._actor) this.clearWallet();
  try {
   const res = await api.overview();
   if (request !== this._loadId || !this._visible) return;
   this._actor = store.get().profile.accountId;
   this._series = Array.from(res.series || [], p => Number(p.cents) || 0);
   if (!this._series.length) this._series = [res.balance_cents || 0];
   const max = Math.max(...this._series), min = Math.min(...this._series);
   this.setData({loading:false,balanceCents:res.balance_cents,balance:res.balance_yuan,todayIncome:yuan(res.today_income_cents),totalIncome:yuan(res.total_income_cents),pendingCents:res.pending_cents,pendingYuan:res.pending_yuan,debtCents:res.debt_cents,debt:yuan(res.debt_cents),rules:res.rules,
    hideAmount:!!wx.getStorageSync('wallet_hide_amount:' + this._actor), chartMax:max > min ? yuan(max) : '',chartStart:res.series.length ? res.series[0].date.slice(5).replace('-', '/') : '',
    transactions:Array.from(res.transactions || [], t => ({id:t.id,kindText:ui[t.kind] || t.kind,created_at:cnTime(t.created_at),positive:t.amount_cents >= 0,amountYuan:yuan(Math.abs(t.amount_cents))})),
    withdrawals:Array.from(res.withdrawals || [], w => ({id:w.id,amountYuan:yuan(w.amount_cents),status:w.status,statusText:ui[w.status] || ui.processing,reject_reason:w.status === 'rejected' ? ui.failed : '',created_at:cnTime(w.created_at)})),
    pending:Array.from(res.pending || [], p => ({id:p.order_id,title:p.type==='parcel'?(language==='en'?'Parcel pickup':'快递代取'):p.type==='task'?(language==='en'?'Campus task':'校园任务'):(language==='en'?'Takeaway pickup':p.title),amount:yuan(p.amount_cents),detail:p.disputed?ui.disputed:ui.auto+' '+cnTime(p.auto_settle_at)}))
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

      const padT = 8, padB = 8, padX = 4;
      const pts = values.length === 1 ? [values[0], values[0]] : values;
      const max = Math.max.apply(null, pts), min = Math.min.apply(null, pts);
      const span = max - min;
      const x = (i) => padX + (W - padX * 2) * (i / (pts.length - 1));
      // 全程没变化时把线放在偏下的位置，像 OKX 那样一条平线，而不是贴着顶
      const y = (v) => span ? padT + (H - padT - padB) * (1 - (v - min) / span) : H * 0.72;

      ctx.setLineDash([2, 4]);
      ctx.strokeStyle = 'rgba(11,122,85,.14)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(padX, padT); ctx.lineTo(padX, H - padB); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(padX, H - padB); ctx.lineTo(W - padX, H - padB); ctx.stroke();
      ctx.setLineDash([]);

      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, 'rgba(11,122,85,.22)');
      grad.addColorStop(1, 'rgba(11,122,85,0)');
      const xs = pts.map((_, i) => x(i)), ys = pts.map(y);
      ctx.beginPath();
      tracePath(ctx, xs, ys);
      ctx.lineTo(x(pts.length - 1), H); ctx.lineTo(x(0), H); ctx.closePath();
      ctx.fillStyle = grad; ctx.fill();

      ctx.beginPath();
      tracePath(ctx, xs, ys);
      ctx.strokeStyle = '#0b7a55'; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.stroke();

      const ex = x(pts.length - 1) - 4, ey = y(pts[pts.length - 1]);
      ctx.beginPath(); ctx.arc(ex, ey, 7, 0, Math.PI * 2); ctx.fillStyle = 'rgba(11,122,85,.16)'; ctx.fill();
      ctx.beginPath(); ctx.arc(ex, ey, 3.5, 0, Math.PI * 2); ctx.fillStyle = '#0b7a55'; ctx.fill();
      ctx.lineWidth = 1.5; ctx.strokeStyle = '#fff'; ctx.stroke();
      this.setData({chartReady:true});
    });
  },

 async withdraw() {
  if (this.data.withdrawing || this.data.loading || this.data.error) return;
  const ui = this.data.ui, bal = this.data.balanceCents, actor = store.get().profile.accountId;
  if (bal <= 0) { wx.showToast({title:ui.noBalance,icon:'none'}); return; }
  this.setData({withdrawing:true});
  try {
   const answer = await new Promise((resolve, reject) => wx.showModal({title:ui.confirmTitle,content:ui.confirmText.replace('{n}',this.data.balance),confirmText:ui.confirm,cancelText:ui.cancel,success:resolve,fail:reject}));
   if (!answer.confirm || !this._visible || actor !== store.get().profile.accountId) return;
   const result = await api.withdraw(bal);
   if (!this._visible || actor !== store.get().profile.accountId) return;
   wx.showToast({title:result.withdrawal.status==='approved'?ui.success:ui.failed,icon:'none'});
   await this.load();
  } catch (e) { if(this._visible) { this.setData({error:e.message}); await this.load(); wx.showToast({title:e.message,icon:'none'}); } }
  finally { this.setData({withdrawing:false}); }
 }
});
