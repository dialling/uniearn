// Order report reasons, chosen by who is reporting and how far the order has gone.
// The server (cloudfunctions/orderService/order-feedback.js) accepts the same ids per role.
const PHOTO_REQUIRED = ['Spilled or damaged', 'Seal broken'];

const COPY = {
  'Runner not responding': ['跑手联系不上', 'Runner not responding', '电话、消息都没有回应', 'No reply to calls or messages'],
  'Runner very late': ['跑手太慢', 'Runner very late', '远超约定时间还没取到或送到', 'Far past the agreed time'],
  'Not received': ['未收到物品', 'Not received', '没有收到物品，或找不到送达的物品', 'The item has not arrived or cannot be found'],
  'Wrong bag': ['物品不符', 'Wrong item', '收到的物品与订单内容不符', 'The delivered item differs from your order'],
  'Spilled or damaged': ['物品损坏或洒漏', 'Spilled or damaged', '物品破损、洒漏或影响正常使用（需拍照）', 'Damage or spills (photo needed)'],
  'Food not ready': ['外卖没到或找不到', 'Food not ready or not there', '外卖柜里没有，或外卖还没送到', 'Not in the locker yet, or cannot be found'],
  'Seal broken': ['封口已破', 'Seal already broken', '取件时封口已经破损（需拍照）', 'The seal was broken at pickup (photo needed)'],
  'Customer not responding': ['顾客联系不上', 'Customer not responding', '电话、消息都没有回应', 'No reply to calls or messages'],
  'Cannot find address': ['找不到送达地点', 'Can’t find the address', '地址不清楚或找不到', 'The address is unclear or cannot be found'],
  'Customer unsafe or rude': ['顾客行为不当', 'Customer rude or unsafe', '言语骚扰、威胁或让你感到不安全', 'Harassment, threats or feeling unsafe'],
  'Task not completed': ['任务未完成', 'Task not completed', '尚未完成，或没有收到约定的结果', 'The agreed task or result is still missing'],
  'Result differs': ['完成情况不符', 'Result differs from request', '完成结果与约定要求不符', 'The result differs from what was agreed'],
  'Report response': ['关于这条反馈', 'About this report', '告诉团队你这边的情况', 'Tell the team your side of what happened'],
  'Something else': ['其他问题', 'Something else', '联系、费用或其他需要协助的情况', 'Contact, payment or another concern']
};

function ids(order = {}, isRunner = false) {
  // Someone who sees an order issue they did not report can answer it first.
  const responding = !!order.feedbackOpen && !order.canResolveFeedback;
  const base = baseIds(order, isRunner);
  return responding ? ['Report response', ...base] : base;
}

function baseIds(order = {}, isRunner = false) {
  const status = order.status, task = order.category === 'task';
  const afterDelivery = ['delivered', 'disputed', 'confirmed'].includes(status);
  if (isRunner) {
    // 2026-11-14 (user decision): "Customer rude or unsafe" is no longer a topic; the team notes such customers separately.
    if (task) return ['Customer not responding', 'Something else'];
    if (status === 'taken') return ['Food not ready', 'Seal broken', 'Customer not responding', 'Something else'];
    return ['Cannot find address', 'Customer not responding', 'Something else'];
  }
  if (task) return afterDelivery ? ['Task not completed', 'Result differs', 'Something else'] : ['Runner not responding', 'Runner very late', 'Something else'];
  return afterDelivery ? ['Not received', 'Wrong bag', 'Spilled or damaged', 'Something else'] : ['Runner not responding', 'Runner very late', 'Something else'];
}

function list(order, isRunner, zh) {
  return ids(order, isRunner).map(id => {
    const c = COPY[id];
    return { id, label: zh ? c[0] : c[1], hint: zh ? c[2] : c[3], photo: PHOTO_REQUIRED.includes(id) };
  });
}

function label(id, zh) { const c = COPY[id]; return c ? (zh ? c[0] : c[1]) : ''; }

module.exports = { ids, list, label, PHOTO_REQUIRED };
