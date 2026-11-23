const store = require('./store');
const {ensureCloud} = require('./cloud');
function ms(v){const n=Number(v);if(Number.isFinite(n)&&n>1e11)return n;const t=Date.parse(String(v||'').replace(' ','T')+'Z');return Number.isFinite(t)?t:0;}
async function overview() {
  if (require('./merge-mode').enabled) {
    const api = require('./api');
    await require('./account').call('status');
    const res = await api.get('/api/wallet?intraday=1&_t=' + Date.now());   // 防微信 GET 缓存，提现后必须拿到新余额
    if (!res || res.ok === false) throw Error((res && res.message) || '钱包暂时无法加载，请重试。');
    const cents = Number(res.balance_cents || 0);
    store.update((st) => {
      st.walletSummary = { balance_cents: cents, pending_cents: Number(res.pending_cents || 0) };
      st.profile = { ...(st.profile || {}), walletBalance: (cents / 100).toFixed(2) };
    });
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
      mchId: res.mch_id || '', appId: res.app_id || '',
      source: res,
      // 同步到全局摘要，「我的」页等位置直接读它，避免显示上一次的余额
      __syncStore: true,
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
const api = require('./api');

function withdrawalStatus(row) {
  if (!row) return 'processing';
  if (row.status === 'rejected') return 'rejected';
  if (row.state === 'SUCCESS' || (row.status === 'approved' && !row.out_bill_no)) return 'approved';
  return 'processing';
}

async function finishWithdrawal(wallet, transfer) {
  let current = transfer;
  if (transfer && transfer.package_info && wx.requestMerchantTransfer && wallet.mchId) {
    await new Promise((resolve) => wx.requestMerchantTransfer({
      mchId: wallet.mchId, appId: wallet.appId, package: transfer.package_info, complete: resolve,
    }));
    current = await api.get('/api/wallet/withdrawals/' + transfer.withdrawal_id + '/status').catch(() => transfer);
  }
  return { withdrawal: {
    id: (current && current.withdrawal_id) || (transfer && transfer.withdrawal_id),
    status: withdrawalStatus(current),
    canConfirm: current && current.state === 'WAIT_USER_CONFIRM',
  } };
}

async function withdraw(amount) {
  if (require('./merge-mode').enabled) {
    const wallet = await overview();
    const transfer = await api.post('/api/wallet/withdraw', {amount_cents: Number(amount)});
    return finishWithdrawal(wallet, transfer);
  }
  // Existing order queue persists the operation ID across response loss and retries.
  return require('./orders').act('walletWithdraw', {amount_cents: amount});
}
module.exports = {overview, withdraw};
