module.exports = page => {
  const zh = page.data.zh;
  wx.showModal({
    title: zh ? '自定义加价' : 'Custom increase',
    editable: true,
    placeholderText: zh ? '输入加价金额，最多两位小数' : 'Amount, up to 2 decimal places',
    confirmText: zh ? '下一步' : 'Next',
    success(result) {
      if (!result.confirm) return;
      const text = String(result.content || '').trim();
      const amount = Number(text);
      const remaining = Math.max(0, 100.88 - Number(page.data.request.raised || 0));
      if (!/^\d+(\.\d{1,2})?$/.test(text) || amount <= 0 || amount > remaining) {
        wx.showToast({
          title: zh ? '请输入 ¥0.01–' + remaining.toFixed(2) : 'Enter ¥0.01–' + remaining.toFixed(2),
          icon: 'none'
        });
        return;
      }
      page.raise({ currentTarget: { dataset: { amount } } });
    }
  });
};
