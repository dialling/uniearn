const orders = require('../../utils/orders');
const store = require('../../utils/store');
const ui = require('../../utils/ui');

const goldenWeek = {
  id: 'golden2026', bannerLabel: 'EVENT · 1–7 OCT',
  headline: 'Golden Week on campus: free delivery every evening, 18:00–20:00',
  blurb: 'Staying at XJTLU for the holiday? One free delivery a day in the evening window. Runners still get their full fee.'
};
function couponDate(value){
  const date=new Date(value);
  if(!Number.isFinite(date.getTime()))return '';
  const days=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return days[date.getUTCDay()]+' '+date.getUTCDate()+' '+months[date.getUTCMonth()];
}
const examples = [
  {id: 'example-free', face: 'FREE', sub: 'delivery', title: 'Free delivery', description: 'Up to ¥8 off the delivery fee · takeaway or parcels', endLabel: 'after registration'},
  {id: 'example-two', face: '¥2', sub: 'off', title: '¥2 off any order', description: 'For your next order of any size', endLabel: 'after registration'}
];

Page({
  data: {coupons: [], campaigns: [], weekly: {segments: []}, news: [], ready: 0, toCollect: 0, examples, registered: false},
  onShow() {
    orders.bind(this);
    if (store.get().profile.onboarded) orders.act('rewardsInit').catch(ui.toast);
  },
  onHide() { orders.unbind(this); },
  onUnload() { orders.unbind(this); },
  refresh() {
    const state = store.get(), r = state.rewards || {}, campaigns = r.campaigns || [];
    const now = Date.now();
    const event = campaigns.find(c => c.event && (!c.start || now >= Date.parse(c.start)) && (!c.end || now < Date.parse(c.end))) ||
      (now >= Date.parse('2026-10-01T00:00:00+08:00') && now < Date.parse('2026-10-08T00:00:00+08:00') ? goldenWeek : null);
    const coupons=(r.coupons||[]).map(c=>({...c,displayEnd:couponDate(c.endLabel)||c.endLabel||'',cash:c.kind==='total'})).sort((a,b)=>Number(!!b.event)-Number(!!a.event));
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
  use(e) { wx.navigateTo({url: '/pages/takeaway/index?coupon=' + encodeURIComponent(e.currentTarget.dataset.id)}); },
  invite() { this.setData({inviting: true}); },
  close() { this.setData({inviting: false}); },
  input(e) { this.setData({inviteInput: e.detail.value}); },
  async redeem() {
    try { await orders.act('invite', {code: this.data.inviteInput}); this.close(); wx.showToast({title: 'Invitation linked'}); }
    catch (err) { ui.toast(err); }
  },
  copy() { wx.setClipboardData({data: this.data.inviteCode}); },
  onShareAppMessage() { return {title: 'Join UniEarn · campus pickups', path: '/pages/rewards/index?invite=' + this.data.inviteCode}; },
  onLoad(o={}) {if(o.section==='coupons')this.couponFocus=true;if(o.openInvite==='1')this.setData({inviting:true}); if (o.invite) this.setData({inviteInput: o.invite, inviting: true}); },
  jobs() { wx.reLaunch({url: '/pages/jobs/index'}); }
});
