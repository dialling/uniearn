const orders = require('../../utils/orders'), store = require('../../utils/store'), f = require('../../utils/workflow');
Page({
  data: { ...require('../../utils/motion').data(), zh: true, loading: true, threads: [], error: '' },
  onShow() { this.setData({ zh: store.get().language !== 'en' }); this.load(); },
  onPullDownRefresh() { this.load().finally(() => wx.stopPullDownRefresh()); },
  async load() {
    this.setData({ loading: true, error: '' });
    try {
      const list = await orders.messageThreads();
      this.setData({ threads: list.map((t) => ({ ...t, time: t.lastAt ? f.clock(t.lastAt) : '' })), loading: false });
    } catch (e) {
      this.setData({ loading: false, error: e.message || '' });
    }
  },
  open(e) { require('../../utils/nav').navigateTo({ url: '/pages/chat/index?id=' + encodeURIComponent(e.currentTarget.dataset.id) }); }
});
