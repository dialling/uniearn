const orders = require('../../utils/orders');
function measure(page){try{if(wx.nextTick)wx.nextTick(()=>require('../../utils/analytics').observe(page));}catch(_){}}
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
  blurb: '假期留在西浦？每天晚间时段可享一次免费配送，跑手的赏金照常全额发放。'
};
function couponDate(value,zh){
  const date=new Date(value);
  if(!Number.isFinite(date.getTime()))return '';
  if(zh)return (date.getUTCMonth()+1)+'月'+date.getUTCDate()+'日 周'+'日一二三四五六'[date.getUTCDay()];
  const days=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return days[date.getUTCDay()]+' '+date.getUTCDate()+' '+months[date.getUTCMonth()];
}
function shortDate(ts,zh){const d=new Date(ts+28800000);return zh?(d.getUTCMonth()+1)+'月'+d.getUTCDate()+'日':['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getUTCMonth()]+' '+d.getUTCDate();}
function validity(c,zh){if(!c.issuedAt||!c.expiresAt)return '';return (zh?'有效期 ':'Valid ')+shortDate(c.issuedAt,zh)+' – '+shortDate(c.expiresAt-1,zh)+(c.stored?(zh?' · 余额 ¥':' · ¥')+Number(c.balance||0).toFixed(2)+(zh?'':' left'):'');}
const examples = [
  {id: 'example-free', face: 'FREE', sub: 'delivery', title: 'Free delivery', description: 'Up to ¥8 off the delivery fee · takeaway or parcels', endLabel: 'after registration'},
  {id: 'example-two', face: '¥2', sub: 'off', title: '¥2 off any order', description: 'For your next order of any size', endLabel: 'after registration'}
];
const examplesZh = [
  {id: 'example-free', face: '免费', sub: '配送', title: '免费配送', description: '最高减免 ¥8 配送费 · 外卖或快递均可', endLabel: '注册后'},
  {id: 'example-two', face: '¥2', sub: '立减', title: '任意订单立减 ¥2', description: '下一笔订单可用，不限大小', endLabel: '注册后'}
];

const activity=require('../../utils/news-activity');
Page({
  data: {screen:'home',activityTab:'tasks',activityTasks:[],activityRewards:[],selectedNews:null,coupons: [], campaigns: [], weekly: {segments: []}, news: [], ready: 0, toCollect: 0, examples, registered: false, zh: false},
  onShow() {
    const zh = store.get().language !== 'en';
    this.setData({zh, examples: zh ? examplesZh : examples});
    require('../../utils/appearance').apply(this);
    this.localizeActivity(zh);
    if(wx.setNavigationBarTitle)wx.setNavigationBarTitle({title:zh?'资讯':'News'});
    orders.bind(this);
    if(this.stopNews)this.stopNews();
    this.setData({newsLoading:true,newsError:''});
    this.stopNews=require('../../utils/news').subscribe(news=>this.setData({news,newsLoading:false,newsError:''},()=>measure(this)),e=>this.setData({newsLoading:false,newsError:e.message}),zh);
    if (store.get().profile.onboarded) orders.act('rewardsInit').catch(ui.toast);
  },
  onHide() { orders.unbind(this);if(this.stopNews)this.stopNews(); },
  onUnload() { orders.unbind(this);if(this.stopNews)this.stopNews(); },
  refresh() {
    const state = store.get(), r = state.rewards || {}, campaigns = r.campaigns || [];
    const now = Date.now();
    const event = campaigns.find(c => c.event && (!c.start || now >= Date.parse(c.start)) && (!c.end || now < Date.parse(c.end))) ||
      (now >= Date.parse('2026-10-01T00:00:00+08:00') && now < Date.parse('2026-10-08T00:00:00+08:00') ? (this.data.zh ? goldenWeekZh : goldenWeek) : null);
    const zh=this.data.zh,coupons=(r.coupons||[]).map(c=>({...c,title:zh&&c.titleZh||c.title,description:zh&&c.descriptionZh||c.description,sub:zh&&c.subZh||c.sub,displayEnd:couponDate(c.endLabel,zh)||c.endLabel||'',validity:validity(c,zh),cash:c.kind==='total'})).sort((a,b)=>Number(!!b.event)-Number(!!a.event));
    const {news:legacyNews,...rewardData}=r;
    this.setData({...rewardData, coupons, campaigns, event,
      returning: campaigns.find(c => c.returning), campaignCards:campaigns.filter(c=>(!event||c.id!==event.id)&&(c.eligible||c.collected)).map(c=>({...c,title:zh&&c.titleZh||c.title,description:zh&&c.descriptionZh||c.description})),  registered: !!state.profile.onboarded,
      showExamples: !state.profile.onboarded && !(r.coupons || []).length,
      ready: (r.coupons || []).length,
      toCollect: !state.profile.onboarded && event ? 1 : campaigns.filter(c => c.eligible && !c.collected).length},()=>{measure(this);if(this.couponFocus){this.couponFocus=false;wx.pageScrollTo({selector:'#my-coupons',duration:250});}});
  },
  async collect(e) {
    if (!this.data.registered) return this.register();
    try { await orders.act('collectCoupon', {campaignId: e.currentTarget.dataset.id}); }
    catch (err) { ui.toast(err); }
  },
  register() { wx.reLaunch({url: '/pages/profile/index'}); },
  use(e) { require('../../utils/nav').navigateTo({url: '/pages/takeaway/index?coupon=' + encodeURIComponent(e.currentTarget.dataset.id)}); },
  invite(e) { require('../../utils/nav').navigateTo({url: '/pages/invite/index' + (e && e.code ? '?invite=' + encodeURIComponent(e.code) : '')}); },
  onShareAppMessage() { return {title: this.data.zh ? '加入 UniEarn · 校园代取' : 'Join UniEarn · campus pickups', path: '/pages/invite/index?invite=' + this.data.inviteCode}; },
  onLoad(o={}) {if(o.section==='coupons'){this.couponFocus=true;this.setData({screen:'offers'});}if(o.openInvite==='1'||o.invite)this.invite({code:o.invite||''}); },
  localizeActivity(zh){
    const lang=zh?'zh':'en';
    this.setData({activityTasks:activity.tasks.map(t=>({...t,label:t.title[lang],detail:t.description[lang],firstLabel:t.firstCompletion?(zh?'首单共 20 分，用户与跑手分别计算':'First completion: 20 total; each role separately'):''})),activityRewards:activity.rewards.map(r=>({range:r.rankFrom===r.rankTo?String(r.rankFrom):r.rankFrom+'~'+r.rankTo,prize:(r.physical?r.physical[lang]+' + ':'')+(r.coupon.discountRate===0?(zh?'免单':'Free order'):zh?Math.round(r.coupon.discountRate*10)+' 折券':Math.round((1-r.coupon.discountRate)*100)+'% off'),cap:(zh?'最高抵扣 ¥':'Up to ¥')+r.coupon.maxDiscount}))});
  },
  openSection(e){const screen=e.currentTarget.dataset.screen;if(!['home','offers','university','uniearn','activity'].includes(screen))return;this.setData({screen,selectedNews:null});wx.pageScrollTo({scrollTop:0,duration:0});measure(this);},
  backToNews(){this.setData({screen:'home',selectedNews:null});wx.pageScrollTo({scrollTop:0,duration:0});},
  switchActivity(e){const tab=e.currentTarget.dataset.tab;if(['tasks','ranking'].includes(tab))this.setData({activityTab:tab});},
  openArticle(e){const item=this.data.news.find(n=>n._id===e.currentTarget.dataset.id);if(item){this.setData({selectedNews:item,screen:'article'});wx.pageScrollTo({scrollTop:0,duration:0});}},
  closeArticle(){this.setData({selectedNews:null,screen:'uniearn'});},
  openCoupons(){require('../../utils/nav').navigateTo({url:'/pages/coupons/index'});},
  jobs() { wx.reLaunch({url: '/pages/jobs/index'}); }
});
