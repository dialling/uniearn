// 页面没定义 onShareAppMessage 时，微信右上角菜单里的「转发」和「分享」是灰的，
// 提示「当前页面不可转发」。这里给主页面一个统一的分享内容。
function shareInfo(zh) {
  return {
    title: zh === false ? 'Uniearn · campus errands' : 'Uniearn｜校园跑腿，同学帮同学',
    path: '/pages/jobs/index',
  };
}

function shareTimeline(zh) {
  return { title: zh === false ? 'Uniearn · campus errands' : 'Uniearn｜校园跑腿，同学帮同学' };
}

module.exports = { shareInfo, shareTimeline };
