const orders = require('../../utils/orders');
const store = require('../../utils/store');
const ui = require('../../utils/ui');

const goldenWeek = {
  id: 'golden2026', bannerLabel: 'EVENT · 1–7 OCT',
  headline: 'Golden Week on campus: free delivery every evening, 18:00–20:00',
  blurb: 'Staying at XJTLU for the holiday? One free delivery a day in the evening window. Runners still get their full fee.'
};
const goldenWeekZh = {
  ...goldenWeek, bannerLabel: '活动 · 10月1日–7日',
  headline: '国庆校园福利：每晚 18:00–20:00 免费配送',
  blurb: '假期留在西浦？每天晚间时段可享一次免费配送，校园帮手的酬劳照常全额发放。'
};
function couponDate(value,zh){
  const date=new Date(value);
  if(!Number.isFinite(date.getTime()))return '';
  if(zh)return (date.getUTCMonth()+1)+'月'+date.getUTCDate()+'日 周'+'日一二三四五六'[date.getUTCDay()];
  const days=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return days[date.getUTCDay()]+' '+date.getUTCDate()+' '+months[date.getUTCMonth()];
}
const examples = [
  {id: 'example-free', face: 'FREE', sub: 'delivery', title: 'Free delivery', description: 'Up to ¥8 off the delivery fee · takeaway or parcels', endLabel: 'after registration'},
  {id: 'example-two', face: '¥2', sub: 'off', title: '¥2 off any order', description: 'For your next order of any size', endLabel: 'after registration'}
];
const examplesZh = [
  {id: 'example-free', face: '免费', sub: '配送', title: '免费配送', description: '最高减免 ¥8 配送费 · 外卖或快递均可', endLabel: '注册后'},
  {id: 'example-two', face: '¥2', sub: '立减', title: '任意订单立减 ¥2', description: '下一笔订单可用，不限大小', endLabel: '注册后'}
];

Page({
  data: {coupons: [], campaigns: [], weekly: {segments: []}, news: [], ready: 0, toCollect: 0, examples, registered: false, zh: false},
  onShow() {
    const zh = store.get().language !== 'en';
    this.setData({zh, examples: zh ? examplesZh : examples});
    if (zh && wx.setNavigationBarTitle) wx.setNavigationBarTitle({title: '动态'});
    orders.bind(this);
    if (store.get().profile.onboarded) orders.act('rewardsInit').catch(ui.toast);
  },
  onHide() { orders.unbind(this); },
  onUnload() { orders.unbind(this); },
  refresh() {
    const state = store.get(), r = state.rewards || {}, campaigns = r.campaigns || [];
    const now = Date.now();
    const event = campaigns.find(c => c.event && (!c.start || now >= Date.parse(c.start)) && (!c.end || now < Date.parse(c.end))) ||
      (now >= Date.parse('2026-10-01T00:00:00+08:00') && now < Date.parse('2026-10-08T00:00:00+08:00') ? (this.data.zh ? goldenWeekZh : goldenWeek) : null);
    const coupons=(r.coupons||[]).map(c=>({...c,displayEnd:couponDate(c.endLabel,this.data.zh)||c.endLabel||'',cash:c.kind==='total'})).sort((a,b)=>Number(!!b.event)-Number(!!a.event));
    this.setData({...r, coupons, campaigns, event,
      returning: campaigns.find(c => c.returning), registered: !!state.profile.onboarded,
      showExamples: !state.profile.onboarded && !(r.coupons || []).length,
      ready: (r.coupons || []).length,
      toCollect: !state.profile.onboarded && event ? 1 : campaigns.filter(c => c.eligible && !c.collected).length},()=>{if(this.couponFocus){this.couponFocus=false;wx.pageScrollTo({selector:'#my-coupons',duration:250});}});
  },
  async collect(e) {
    if (!this.data.registered) return this.register();
    try { await orders.act('collectCoupon', {campaignId: e.currentTarget.dataset.id}); }
    catch (err) { ui.toast(err); }
  },
  register() { wx.reLaunch({url: '/pages/profile/index'}); },
  use(e) { require('../../utils/nav').navigateTo({url: '/pages/takeaway/index?coupon=' + encodeURIComponent(e.currentTarget.dataset.id)}); },
  invite() { this.setData({inviting: true}); },
  close() { this.setData({inviting: false}); },
  input(e) { this.setData({inviteInput: e.detail.value}); },
  async redeem() {
    try { await orders.act('invite', {code: this.data.inviteInput}); this.close(); wx.showToast({title: this.data.zh ? '邀请已绑定' : 'Invitation linked'}); }
    catch (err) { ui.toast(err); }
  },
  copy() { wx.setClipboardData({data: this.data.inviteCode}); },
  onShareAppMessage() { return {title: this.data.zh ? '加入 UniEarn · 校园代取' : 'Join UniEarn · campus pickups', path: '/pages/rewards/index?invite=' + this.data.inviteCode}; },
  onLoad(o={}) {if(o.section==='coupons')this.couponFocus=true;if(o.openInvite==='1')this.setData({inviting:true}); if (o.invite) this.setData({inviteInput: o.invite, inviting: true}); },
  jobs() { wx.reLaunch({url: '/pages/jobs/index'}); }
});
