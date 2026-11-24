// 2026-11-21: a new user must be able to sign up as a runner. The cloud only accepts an application after the
// runner rules are agreed (RULES_REQUIRED), so the 跑手申请 page has to record the rules before it sends the application.
const assert = require('node:assert/strict');
const { createHandler } = require('../legacy/cloudfunctions/studentAccount/handler');
(async () => {
  let records = {};
  const repo = {
    get: async id => records[id] && structuredClone(records[id]),
    patch: async (id, patch) => (records[id] = { ...(records[id] || {}), ...structuredClone(patch) }),
    logout: async id => Object.assign(records[id], { loggedOut: true }),
    findStudent: async () => [], findPhone: async () => [],
    submitApplication: async (id, account, verification) => { records[id] = { ...records[id], verification }; return ''; }
  };
  const cloud = createHandler({ getOpenId: () => 'brand-new-user', repo, env: {}, now: () => 1000 });
  await cloud({ action: 'sessionLogin' });
  await cloud({ action: 'saveProfile', profile: { name: '王小明', phone: '13912345678' } });

  global.wx = { getStorageSync: () => null, setStorageSync() {}, showToast() {}, reLaunch() {}, getSystemInfoSync: () => ({}) };
  let def; global.Page = x => (def = x);
  const store = require('../utils/store'), account = require('../utils/account');
  store.reset();
  const calls = [];
  account.call = async (action, args = {}) => {
    calls.push(action);
    const r = await cloud({ action, ...args });
    if (!r.ok) { const e = Error(r.error); e.code = r.code; throw e; }
    return r;
  };
  require('../pages/student-check/index');
  const page = { ...def, data: structuredClone(def.data), setData(v) { for (const k in v) { if (k.startsWith('form.')) this.data.form[k.slice(5)] = v[k]; else this.data[k] = v[k]; } } };
  page.setData({ 'form.realName': '王小明', 'form.gender': 'male', 'form.phone': '13912345678', 'form.studentId': '2512345' });
  await page.submit();
  assert.equal(page.data.stage, 'rules', 'a complete form moves on to the rules');
  page.rule({ currentTarget: { dataset: { index: -1 } } });
  await page.finish();
  assert.equal(page.data.error, '', 'the application is accepted: ' + page.data.error);
  assert.ok(calls.indexOf('agreeRules') >= 0 && calls.indexOf('agreeRules') < calls.indexOf('apply'), 'rules are recorded before the application: ' + calls.join(','));
  assert.equal(page.data.verificationStatus, 'pending', 'the new runner waits for an admin review');
  console.log('Runner sign-up: form → rules → application accepted (rules recorded first) → pending review.');
})().catch(e => { console.error(e); process.exitCode = 1; });
