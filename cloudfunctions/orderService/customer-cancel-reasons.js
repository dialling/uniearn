// Student cancel reasons from the live sister app's cancel screen, as recorded
// in admin-web/dist/app.js (REASONS + the posted vs taken lists). "Other"
// asks for a short note. Keys are the English labels stored on the order.
const NOTE_MAX = 200;
const POSTED = [
  {key: 'No one took the order', zh: '没人接单'},
  {key: 'Collected it myself', zh: '我自己取了'},
  {key: 'Changed my mind', zh: '不需要了'},
  {key: 'Wrong details in the order', zh: '信息填错了'},
  {key: 'Other', zh: '其他', note: true}
];
const TAKEN = [
  {key: 'Collected it myself', zh: '我自己取了'},
  {key: 'Runner too slow to pick up', zh: '跑腿员太慢'},
  {key: 'Other', zh: '其他', note: true}
];

function stage(order) {
  if (!order) return '';
  if (order.status === 'waiting' && !order.runnerId) return 'posted';
  if (order.status === 'taken' || order.status === 'collected') return 'taken';
  return '';
}

function list(order) {
  const where = stage(order);
  if (where === 'posted') return POSTED;
  if (where === 'taken') return TAKEN;
  return [];
}

function options(order, zh) {
  return list(order).map(item => ({value: item.key, label: zh ? item.zh : item.key, note: !!item.note}));
}

function label(key, zh) {
  const item = POSTED.concat(TAKEN).find(row => row.key === key);
  return item ? (zh ? item.zh : item.key) : '';
}

function check(order, reason, note) {
  const item = list(order).find(row => row.key === reason);
  if (!item) throw Error('Choose a cancel reason');
  const text = String(note || '').trim();
  if (item.note) {
    if (!text) throw Error('Add a short note');
    if (text.length > NOTE_MAX) throw Error('Keep the note under 200 characters');
  }
  return {reason: item.key, note: item.note ? text : ''};
}

function ready(order, reason, note) {
  try { check(order, reason, note); return true; }
  catch (e) { return false; }
}

module.exports = {NOTE_MAX, POSTED, TAKEN, stage, list, options, label, check, ready};
