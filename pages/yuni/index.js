// 2026-11-16: everything about Yuni in one place, opened from Me › Settings › Yuni:
// sounds, tips and animations, the app guide, levels, and how to play.
const store = require('../../utils/store');
const AVATARS = ['star', 'helper', 'pro', 'ace', 'captain'];
Page({
  data: { ...require('../../utils/motion').data(), zh: true, soundOn: true, tipsOn: true, levelName: '', levelNo: 1, avatar: '/assets/yuni-adventure-star.png', nextText: '' },
  onShow() { this.refresh(); },
  refresh() {
    const s = store.get(), zh = s.language !== 'en', y = require('../../utils/yuni-level').view(s.progression || {});
    const lv = Math.min(Math.max(1, y.level || 1), 5);
    this.setData({
      zh, soundOn: s.yuniSounds !== false, tipsOn: s.yuniTips !== false, levelNo: lv,
      levelName: zh ? y.nameZh : y.nameEn, avatar: '/assets/yuni-adventure-' + AVATARS[lv - 1] + '.png',
      nextText: y.next ? (zh ? '再得 ' + y.next.remaining + ' 积分升到' + y.next.zh : y.next.remaining + ' pts to ' + y.next.en) : (zh ? '已是最高等级' : 'Top level reached')
    });
    if (wx.setNavigationBarTitle) wx.setNavigationBarTitle({ title: 'Yuni' });
  },
  sound(e) {
    const on = !!e.detail.value; store.update(s => { s.yuniSounds = on; }); this.setData({ soundOn: on });
    if (on) { const snd = require('../../utils/yuni-sound'); snd.unlock(); snd.coin(); }
  },
  tips(e) { const on = !!e.detail.value; store.update(s => { s.yuniTips = on; }); this.setData({ tipsOn: on }); },
  // Replay the Yuni guide on the Me page.
  yuniGuide() { store.update(x => { x.yuniGuideReplay = true; }); wx.reLaunch({ url: '/pages/profile/index' }); },
  // The 5-step tour on the Jobs page.
  guide() { require('../../utils/coach').reset(); wx.reLaunch({ url: '/pages/jobs/index?guide=1' }); },
  levels() { require('../../utils/nav').navigateTo({ url: '/pages/levels/index' }); },
  play() { wx.reLaunch({ url: '/pages/profile/index' }); }
});
