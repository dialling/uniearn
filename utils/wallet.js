const store = require('./store');
const {ensureCloud} = require('./cloud');
async function overview() {
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
