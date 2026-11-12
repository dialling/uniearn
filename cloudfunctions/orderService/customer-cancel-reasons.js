// Publisher cancel reasons, aligned with XP跑了么's canonical cancel vocabulary
// (admin CANCEL_EN: 信息填错 / 我自己取了 / 不需要了 / 跑手太慢 / 没人接单 / 测试 / 其他).
// Stored as the Chinese key; 其他 keeps an optional note as 其他：<note>.
const NOTE_MAX = 200;
const REASONS = [
  {key: '信息填错', en: 'Wrong details in the order'},
  {key: '不需要了', en: 'Changed my mind'},
  {key: '我自己取了', en: 'Collected it myself'},
  {key: '跑手太慢', en: 'Runner too slow to pick up'},
  {key: '没人接单', en: 'No one took the order'},
  {key: '测试', en: 'Test order'},
  {key: '其他', en: 'Other', note: true}
];

function list() {
  return REASONS;
}

function options(order, zh) {
  return REASONS.map(item => ({value: item.key, label: zh ? item.key : item.en, note: !!item.note}));
}

function label(stored, zh) {
  const value = String(stored || '');
  if (value.startsWith('其他：')) {
    const extra = value.slice('其他：'.length);
    return zh ? value : 'Other: ' + extra;
  }
  const item = REASONS.find(row => row.key === value);
  return item ? (zh ? item.key : item.en) : '';
}

function check(reason, note) {
  const item = REASONS.find(row => row.key === reason);
  if (!item) throw Error('Choose a cancel reason');
  const text = String(note || '').trim();
  if (text.length > NOTE_MAX) throw Error('Keep the note under 200 characters');
  const extra = item.note ? text : '';
  return {key: item.key, note: extra, stored: extra ? item.key + '：' + extra : item.key};
}

function ready(reason, note) {
  try { check(reason, note); return true; }
  catch (e) { return false; }
}

function isOther(reason) {
  return reason === '其他';
}

module.exports = {NOTE_MAX, REASONS, list, options, label, check, ready, isOther};
