const store = require('./store');
const {ensureCloud} = require('./cloud');
function ms(v){const n=Number(v);if(Number.isFinite(n)&&n>1e11)return n;const t=Date.parse(String(v||'').replace(' ','T')+'Z');return Number.isFinite(t)?t:0;}
async function overview() {
  if (require('./merge-mode').enabled) {
    const api = require('./api');
    await require('./account').call('status');
    const res = await api.get('/api/wallet');
    if (!res || res.ok === false) throw Error((res && res.message) || '钱包暂时无法加载，请重试。');
    const cents = Number(res.balance_cents || 0);
    return {
      mode: 'test',
      balance_cents: cents,
      balance_yuan: (cents / 100).toFixed(2),
      pending_cents: Number(res.pending_cents || 0),
      pending_yuan: (Number(res.pending_cents || 0) / 100).toFixed(2),
      pending: res.pending || [],
      debt_cents: 0,
      total_income_cents: Number(res.total_income_cents || 0),
      today_income_cents: Number(res.today_income_cents || 0),
      // 服务端返回 'YYYY-MM-DD HH:MM:SS'（UTC）；页面按毫秒时间戳格式化，先转成 ms。
      transactions: (res.transactions || []).map((t) => ({
        id: t.id, kind: t.kind, amount_cents: t.amount_cents, balance_after: t.balance_after,
        remark: t.remark, created_at: ms(t.created_at), order_no: t.order_id,
      })),
      withdrawals: (res.withdrawals || []).map((w) => ({...w, created_at: ms(w.created_at)})),
      series: res.series || [],
      rules: res.rules || [],
    };
  }
  await require('./account').call('status');
  const actor = store.get().profile.accountId;
  if (!actor || store.get().profile.loggedOut) throw Error(store.get().language === 'en' ? 'Log in to open your wallet.' : '请先登录再查看钱包。');
  const {result} = await ensureCloud().callFunction({name: 'orderService', data: {action: 'wallet', lang: store.get().language}});
  if (!result || !result.ok) throw Error(result && result.error || '钱包暂时无法加载，请重试。');
  if (store.get().profile.accountId !== actor || store.get().profile.loggedOut) throw Error('Account changed. Reopen your wallet.');
  if (!result.snapshot || result.snapshot.accountId !== actor) throw Error('Wallet account does not match. Reopen your wallet.');
  const value = result.value;
  if (!value || value.mode !== 'test') throw Error('请先部署包含测试钱包的 orderService 云函数。');
  store.update(s => {s.walletSummary = result.snapshot.walletSummary;});
  return value;
}
async function withdraw(amount) {
  // Existing order queue persists the operation ID across response loss and retries.
  return require('./orders').act('walletWithdraw', {amount_cents: amount});
}
module.exports = {overview, withdraw};
