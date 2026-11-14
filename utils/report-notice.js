// 2026-11-14 (user decision): the other participant sees the reason the reporter picked,
// e.g. "Runner reported: Customer not responding". Never the reporter's own words or photos.
function text(reason, isCustomer, zh) {
  if (!reason) return '';
  const label = require('./report-reasons').label(reason, zh);
  if (!label) return '';
  return zh ? (isCustomer ? '跑手反馈：' : '顾客反馈：') + label : (isCustomer ? 'Runner reported: ' : 'Customer reported: ') + label;
}

module.exports = { text };
