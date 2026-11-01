module.exports = function contactIdentity(order, runner, zh) {
  const role = runner ? (zh ? '跑手' : 'Runner') : (zh ? '发布者' : 'Requester');
  const name = (runner ? order.runnerName : order.owner) || role;
  const jobs = runner && order.runnerStats && order.runnerStats.jobsDone;
  const detail = Number.isInteger(jobs)
    ? role + (zh ? ' · 已完成 ' + jobs + ' 单' : ' · ' + jobs + ' completed')
    : role;
  return { name, detail, avatar: runner ? order.runnerAvatar || '' : '',
    initial: (Array.from(name.trim())[0] || '·').toUpperCase() };
};
