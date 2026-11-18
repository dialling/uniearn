// 2026-11-18: order numbers sit quietly in Order details with a copy icon. Copies the number as shown (e.g. R212).
function copy(id, zh) {
  const value = String(id || '').toUpperCase();
  if (!value) return;
  wx.setClipboardData({
    data: value,
    success: () => wx.showToast({ title: zh === false ? 'Order no. copied' : '已复制订单号', icon: 'none' })
  });
}
module.exports = { copy };
