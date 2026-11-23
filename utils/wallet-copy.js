const words = {
 title: ['我的钱包', 'My wallet'], balance: ['可用余额（元）', 'Available balance (CNY)'], range: ['最近 7 天', 'Last 7 days'], week: ['最近 7 天', 'Last 7 days'], entries: ['笔收支', 'entries'], weekIn: ['已入账', 'In'], weekOut: ['已提现', 'Out'],
 today: ['今日入账', 'Todayʼs income'], total: ['累计入账', 'Total income'], pending: ['待入账', 'Pending'], todayAxis: ['今天', 'Today'],
 test: ['测试钱包', 'Test wallet'], testNote: ['余额仅用于测试，模拟提现不会转入微信零钱。', 'Test funds only. Simulated withdrawals do not reach WeChat.'],
 withdraw: ['模拟提现', 'Simulate withdrawal'], rules: ['提现规则', 'Withdrawal rules'], view: ['查看', 'View'],
 ruleHint: ['满 ¥0.01 可模拟提现 · 不限次数 · 全天可用', 'Simulate from ¥0.01 · no daily limit · 24/7'],
 scope: ['可提现额度', 'Available amount'], limit: ['每日次数', 'Daily limit'], time: ['提现时间', 'Availability'], arrive: ['完成时间', 'Completion'],
 channel: ['提现方式', 'Method'], fee: ['手续费', 'Fee'], notice: ['说明', 'Note'], close: ['知道了', 'Got it'],
 records: ['提现记录', 'Withdrawals'], transactions: ['收支明细', 'Transactions'], loading: ['加载中…', 'Loading…'],
 empty: ['暂无记录，订单确认后收益会入账到这里。', 'No transactions yet. Confirmed jobs will credit here.'],
 receive: ['收', 'In'], spend: ['支', 'Out'], debt: ['待抵扣金额', 'Amount to offset'],
 debtHint: ['后续入账将优先抵扣订单审核扣回金额。', 'Future earnings will first offset reviewed deductions.'],
 confirmTitle: ['模拟提现', 'Simulate withdrawal'], confirm: ['确认模拟', 'Confirm'], cancel: ['取消', 'Cancel'],
 confirmText: ['将全部可用测试余额 ¥{n} 模拟提现，不会发生真实转账。', 'Simulate withdrawing all ¥{n} of your available test balance. No real money moves.'],
 success: ['模拟提现完成', 'Simulation completed'], failed: ['模拟失败，余额已退回', 'Simulation failed; balance returned'],
 processing: ['模拟处理中', 'Simulation processing'], approved: ['模拟提现完成', 'Simulation completed'], rejected: ['模拟失败，已退回', 'Failed; balance returned'],
 disputed: ['争议处理中，赏金已冻结，24 小时内审核处理', 'Payment is on hold while the issue is reviewed within 24 hours.'], auto: ['最迟自动入账', 'Auto-confirm by'],
 payout: ['跑腿费入账', 'Job earnings'], opening_balance: ['历史测试收益迁入', 'Previous test earnings'], withdraw_refund: ['模拟提现失败退回', 'Failed simulation returned'],
 deduction: ['订单审核扣回', 'Reviewed deduction'], refresh: ['重新加载', 'Reload'], noBalance: ['暂无可提现的测试余额', 'No test balance to withdraw'],
 earnings: ['查看收益详情', 'View earnings details']
};
// 真实钱包（合并模式）的文案：不再提“模拟/测试”，避免体验版看起来像演示。
const live = {
  test: ['钱包', 'Wallet'],
  testNote: ['余额来自跑腿报酬，提现按平台规则处理。', 'Your balance comes from delivery earnings and is paid out under our payout rules.'],
  withdraw: ['提现', 'Withdraw'],
  rules: ['提现规则', 'Payout rules'],
  ruleHint: ['满 ¥0.01 可提现 · 每日一次 · 工作日处理', 'Withdraw from ¥0.01 · once a day · processed on working days'],
  confirmTitle: ['提现', 'Withdraw'],
  confirm: ['确认提现', 'Confirm withdrawal'],
  cancel: ['取消', 'Cancel'],
  confirmText: ['将可用余额 ¥{n} 提现，1–3 个工作日内处理。', 'Withdraw ¥{n}; processed within 1–3 working days.'],
  success: ['提现申请已提交', 'Withdrawal submitted'],
  failed: ['提现失败，余额已退回', 'Withdrawal failed; balance returned'],
  processing: ['处理中', 'Processing'],
  approved: ['已到账', 'Paid out'],
  rejected: ['已退回', 'Returned'],
  noBalance: ['暂无可提现金额', 'Nothing to withdraw'],
  opening_balance: ['历史收益迁入', 'Previous earnings'],
  withdraw_refund: ['提现失败退回', 'Failed withdrawal returned'],
};
module.exports = (language, liveMode) => {
  const lang = language === 'en' ? 1 : 0;
  const base = Object.fromEntries(Object.entries(words).map(([k, pair]) => [k, pair[lang]]));
  if (!liveMode) return base;
  for (const [k, pair] of Object.entries(live)) base[k] = pair[lang];
  return base;
};
