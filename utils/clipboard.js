// 复制到剪贴板：走隐私授权流程，拒绝时给手动复制兜底。
// 微信从基础库 2.32.3 起把剪贴板列为隐私接口，未同意《用户隐私保护指引》时
// wx.setClipboardData 会直接 fail，所以这里先问一次授权，失败不静默。
function manual(text, zh = true) {
  wx.showModal({
    title: zh ? '无法自动复制' : 'Copy unavailable',
    content: (zh ? '长按下方文字手动复制：\n' : 'Long-press to copy:\n') + text,
    showCancel: false,
  });
}

function copy(text, opts = {}) {
  const zh = opts.zh !== false;
  const done = () => wx.setClipboardData({
    data: String(text),
    success: () => wx.showToast({ title: zh ? '已复制' : 'Copied', icon: 'success' }),
    fail: () => manual(text, zh),
  });
  if (typeof wx.getPrivacySetting !== 'function') return done();
  wx.getPrivacySetting({
    success(r) {
      if (!r || !r.needAuthorization) return done();
      wx.requirePrivacyAuthorize({ success: done, fail: () => manual(text, zh) });
    },
    fail: () => done(),
  });
}

module.exports = { copy };
