// Adapted from the supplied wallet reuse package to the existing CloudBase test ledger.
// No real funds or merchant transfers are created by this module.
const crypto = require('crypto');
const DAY = 86400000, OFFSET = 28800000;
const day = at => new Date(at + OFFSET).toISOString().slice(0, 10);
const yuan = cents => (cents / 100).toFixed(2);
const copy = value => JSON.parse(JSON.stringify(value));
function check(ok, message) { if (!ok) throw Error(message); }
function money(cents) { check(Number.isSafeInteger(cents) && cents > 0, 'Amount must be a positive whole number of cents.'); return cents; }
function get(s, actor) {
  s.wallets = s.wallets || {};
  return s.wallets[actor] || (s.wallets[actor] = {balance_cents: 0, transactions: [], withdrawals: []});
}
function post(w, {key, amount, kind, at, orderId = '', remark = ''}) {
  if (w.transactions.some(t => t.idem_key === key)) return false;
  check(Number.isSafeInteger(amount) && amount !== 0, 'Invalid ledger amount.');
  const balance = w.balance_cents + amount;
  check(Number.isSafeInteger(balance), 'Wallet amount is too large.');
  w.transactions.push({id: key, idem_key: key, order_id: orderId, kind, amount_cents: amount, balance_after: balance, remark, created_at: at});
  w.balance_cents = balance;
  return true;
}
function credit(s, actor, cents, key, at, orderId = '', kind = 'payout') {
  return post(get(s, actor), {key, amount: money(cents), kind, at, orderId,
    remark: kind === 'opening_balance' ? '历史测试收益迁入' : '结单入账'});
}
// Called in the SAME database transaction as order confirmation, and before archiving.
function settle(s, now = Date.now()) {
  for (const [actor, member] of Object.entries(s.members || {})) {
    const cents = Math.round(Number((member.archived || {}).paid || 0) * 100);
    const existing = (s.wallets || {})[actor];
    // Only orders archived before wallet installation become an opening entry.
    if ((!existing || !existing.migrated) && cents > 0) credit(s, actor, cents, 'legacy-opening', now, '', 'opening_balance');
    if (existing || cents > 0) get(s, actor).migrated = true;
  }
  for (const r of s.requests || []) {
    if (r.status !== 'confirmed') continue;
    const trip = (s.trips || []).find(t => t.id === r.runnerId);
    if (!trip || !trip.runnerAccountId) continue;
    const actor = trip.runnerAccountId, w = get(s, actor);
    w.migrated = true;
    const cents = Math.round((Number(r.reward || 0) + Number(r.runnerBonus || 0)) * 100);
    if (cents > 0) credit(s, actor, cents, 'order-' + r.id + '-' + (r.createdAt || 0), r.confirmedAt || now, r.id);
  }
  for (const a of s.adjustments || []) {
    const cents = Math.round(Number(a.amount || 0) * 100);
    if (a.runnerAccountId && cents > 0) post(get(s, a.runnerAccountId), {key: 'adjustment-' + a.id, amount: -money(cents), kind: 'deduction', at: a.at || now, orderId: a.requestId || '', remark: String(a.note || '订单审核扣回')});
  }
}
function rules(en = false) {
  return {min_cents: 1, min_yuan: '0.01', unlimited: true,
    scope: en ? 'Withdraw all available test balance, from ¥0.01.' : '测试余额满 ¥0.01 可模拟提取全部可用余额。',
    limit_text: en ? 'No daily limit in test mode' : '测试环境不限制每日次数',
    time_window: en ? 'Available 24/7' : '全天 24 小时',
    arrive: en ? 'Simulation completes immediately. No money reaches WeChat.' : '模拟流程立即完成，不会转入微信零钱。',
    channel: en ? 'Test ledger only; no real transfer' : '仅操作测试账本，不发起真实转账',
    fee: en ? 'No test withdrawal fee' : '模拟提现无手续费',
    notice: en ? 'Confirmed orders credit once; otherwise they auto-credit 2 hours after delivery. Disputed orders remain pending. Failed simulations return the balance automatically.' : '送达后进入待入账，确认后立即入账；未确认的订单在送达 2 小时后自动入账。同一订单只入账一次；争议订单暂停入账。模拟提现失败会自动退回余额。'};
}
function pending(s, actor) {
  const tripIds = new Set((s.trips || []).filter(t => t.runnerAccountId === actor).map(t => t.id));
  return (s.requests || []).filter(r => tripIds.has(r.runnerId) && ['delivered', 'disputed'].includes(r.status)).map(r => ({
    order_id: r.id, title: r.title || (r.category === 'parcel' ? '快递代取' : r.night ? '夜市代买' : r.category === 'task' ? '校园任务' : '外卖代取'), type: r.category,
    amount_cents: Math.round((Number(r.reward || 0) + Number(r.runnerBonus || 0)) * 100),
    completed_at: r.deliveredAt || 0, auto_settle_at: r.status === 'disputed' ? 0 : (r.deliveredAt || 0) + require('./workflow').hours(r) * 3600000,
    disputed: r.status === 'disputed'
  }));
}
function summary(s, actor) {
  const w = (s.wallets || {})[actor] || {balance_cents: 0};
  return {mode: 'test', balance_cents: Math.max(0, w.balance_cents), debt_cents: Math.max(0, -w.balance_cents), pending_cents: pending(s, actor).reduce((n, p) => n + p.amount_cents, 0)};
}
function series(w, now, days = 30) {
  const today = day(now), start = Date.parse(today + 'T00:00:00+08:00') - (days - 1) * DAY;
  const rows = w.transactions.slice().sort((a, b) => a.created_at - b.created_at);
  // Reconstruct from signed amounts, including withdrawals and failed-withdrawal returns.
  let balance = w.balance_cents - rows.reduce((n, t) => n + t.amount_cents, 0), index = 0;
  return Array.from({length: days}, (_, i) => {
    const label = day(start + i * DAY);
    while (index < rows.length && day(rows[index].created_at) <= label) balance += rows[index++].amount_cents;
    return {date: label, cents: Math.max(0, i === days - 1 ? w.balance_cents : balance)};
  });
}
function overview(s, actor, now = Date.now(), en = false) {
  const w = (s.wallets || {})[actor] || {balance_cents: 0, transactions: [], withdrawals: []}, stats = summary(s, actor);
  const income = w.transactions.filter(t => ['payout', 'opening_balance'].includes(t.kind));
  return {...stats, balance_yuan: yuan(stats.balance_cents), pending_yuan: yuan(stats.pending_cents),
    today_income_cents: income.filter(t => t.kind === 'payout' && day(t.created_at) === day(now)).reduce((n, t) => n + t.amount_cents, 0),
    total_income_cents: income.reduce((n, t) => n + t.amount_cents, 0),
    transactions: copy(w.transactions.slice().reverse().sort((a,b) => b.created_at-a.created_at).slice(0,50)), withdrawals: copy(w.withdrawals.slice(-20).reverse()),
    series: series(w, now), pending: pending(s, actor), rules: rules(en)};
}
function startWithdraw(s, actor, cents, operationId, now = Date.now()) {
  money(cents);
  const w = get(s, actor), id = 'WD' + crypto.createHash('sha256').update(actor + ':' + operationId).digest('hex').slice(0, 28);
  const previous = w.withdrawals.find(x => x.id === id);
  if (previous) { check(previous.amount_cents === cents, 'Withdrawal operation was reused.'); return previous; }
  check(cents <= w.balance_cents, 'Insufficient test balance.');
  const withdrawal = {id, amount_cents: cents, status: 'processing', transfer_state: 'SIMULATING', created_at: now, reject_reason: ''};
  post(w, {key: 'withdraw-' + id, amount: -cents, kind: 'withdraw', at: now, remark: '模拟提现'});
  w.withdrawals.push(withdrawal);
  return withdrawal;
}
function refundWithdraw(s, actor, withdrawalId, now = Date.now()) {
  const w = get(s, actor), wd = w.withdrawals.find(x => x.id === withdrawalId);
  check(!!wd, 'Withdrawal not found.');
  if (wd.status === 'rejected') return wd;
  check(wd.status === 'processing', 'A completed withdrawal cannot be refunded.');
  post(w, {key: 'refund-' + wd.id, amount: wd.amount_cents, kind: 'withdraw_refund', at: now, remark: '模拟提现失败退回'});
  Object.assign(wd, {status: 'rejected', transfer_state: 'SIMULATED_FAIL', reject_reason: '模拟转账失败，余额已退回', processed_at: now});
  return wd;
}
function withdraw(s, actor, cents, operationId, now, fail = false) {
  const wd = startWithdraw(s, actor, cents, operationId, now);
  if (wd.status === 'processing') {
    if (fail) refundWithdraw(s, actor, wd.id, now);
    else Object.assign(wd, {status: 'approved', transfer_state: 'SIMULATED_SUCCESS', processed_at: now});
  }
  return {mode: 'test', withdrawal: copy(wd), ...summary(s, actor)};
}
module.exports = {settle, summary, overview, withdraw, startWithdraw, refundWithdraw, credit, series, rules};
