// Publisher cancel reasons from XP跑了么 miniprogram/pages/detail/detail.js doCancel():
// const REASONS = ['测试', '信息填错', '没人接单', '其他'];
// The same four apply before and after acceptance. A non-其他 choice is stored
// as that Chinese string. 其他 is stored alone, or as 其他： plus a trimmed note.
const NOTE_MAX = 200;
const REASONS = [
  {key: '测试', en: 'Test'},
  {key: '信息填错', en: 'Wrong details'},
  {key: '没人接单', en: 'No one took the order'},
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
