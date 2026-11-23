const assert = require('node:assert/strict');

const storage = {
  token: 'xp-token-1',
  user: { id: 101, nickname: 'Tester', runner_status: 'approved', student_no: '2512345', phone: '13800001111' }
};
const calls = [];
const uploads = [];
let modalOpts = null;
let navigated = '';
let definition = null;

global.Page = p => { definition = p; };
global.wx = {
  getStorageSync: k => storage[k] ?? null,
  setStorageSync: (k, v) => { storage[k] = v; },
  removeStorageSync: k => { delete storage[k]; },
  showToast: () => {},
  showModal: opts => { modalOpts = opts; if (opts.success) opts.success({ confirm: true }); },
  navigateTo: ({ url }) => { navigated = url; },
  redirectTo: ({ url }) => { navigated = url; },
  reLaunch: ({ url }) => { navigated = url; },
  uploadFile({ url, filePath, name, header, success }) {
    uploads.push({ url, filePath, name, header });
    success({ statusCode: 200, data: JSON.stringify({ ok: true, url: 'https://pararouter.cn/uploads/proof.jpg' }) });
  },
  request({ url, method, data, header, success }) {
    calls.push({ url, method, data, header });
    const path = url.replace(/^https?:\/\/[^/]+/, '');
    if (path.startsWith('/api/orders?status=') || (path === '/api/orders' && method === 'GET')) {
      return success({
        statusCode: 200,
        data: {
          ok: true,
          list: path.includes('status=completed') ? [] : [
            { id: 42, publisher_id: 202, publisher: { nickname: '微信用户9295', avatar: '/uploads/avatars/9295.png' }, type: 'food', title: '外卖代取', pickup_location: '文缘外卖柜', delivery_location: '文缘 16 楼 D02 1612', price_cents: 500, status: 'pending', created_at: '2026-11-23 12:00:00' },
            { id: 43, publisher_id: 101, publisher_name: 'Tester', type: 'express', title: '快递代取', pickup_location: 'Station A', delivery_location: 'Dorm 5', room: '118', pickup_code: '11-1-2222,11-1-3333', size: 'large', price_cents: 800, status: 'pending', created_at: '2026-11-23 12:05:00' }
          ]
        }
      });
    }
    if (path === '/api/orders/mine' && method === 'GET') {
      return success({
        statusCode: 200,
        data: {
          ok: true,
          published: [
            { id: 43, publisher_id: 101, publisher_name: 'Tester', type: 'express', title: '快递代取', pickup_location: 'Station A', delivery_location: 'Dorm 5', room: '118', pickup_code: '11-1-2222,11-1-3333', size: 'large', price_cents: 800, status: 'pending', created_at: '2026-11-23 12:05:00' }
          ],
          accepted: []
        }
      });
    }
    if (path === '/api/coupons' && method === 'GET') {
      return success({
        statusCode: 200,
        data: {
          ok: true,
          list: [
            { id: 'c1', title: '50% off', discount_type: 'percentage', pay_rate_bps: 5000, max_discount_cents: 390, status: 'available' },
            { id: 'c2', title: '¥2 off', discount_type: 'fixed', discount_cents: 200, status: 'available' }
          ]
        }
      });
    }
    if (path === '/api/coupons/available' && method === 'GET') {
      return success({ statusCode: 200, data: { ok: true, list: [{ id: 'c1' }, { id: 'c2' }] } });
    }
    if (path === '/api/coupons/redeem' && method === 'POST') {
      return success({ statusCode: 200, data: { ok: true, coupon: { id: 'c3' } } });
    }
    if (path === '/api/admin/stats' && method === 'GET') {
      return success({ statusCode: 200, data: { ok: true, total: 12, waiting: 3, unpaid: 2, completed: 7, users: 20, runners: 5 } });
    }
    if (path.startsWith('/api/admin/orders') && method === 'GET') {
      return success({ statusCode: 200, data: { ok: true, list: [{ id: 42, type: 'food', status: 'pending', pickup_location: 'North gate', delivery_location: 'Dorm 7', price_cents: 500, created_at: '2026-11-23 12:00:00' }] } });
    }
    if (path === '/api/auth/nickname' && method === 'POST') {
      return success({ statusCode: 200, data: { ok: true, user: { ...storage.user, nickname: data.nickname } } });
    }
    if (path === '/api/auth/dorm' && method === 'POST') {
      return success({ statusCode: 200, data: { ok: true, user: { ...storage.user, dorm: data.dorm, dorm_room: data.dorm_room } } });
    }
    if (path === '/api/auth/avatar' && method === 'POST') {
      return success({ statusCode: 200, data: { ok: true } });
    }
    if (path.startsWith('/api/orders/') && path.endsWith('/accept') && method === 'POST') {
      return success({ statusCode: 200, data: { ok: true, order: { id: 42, status: 'accepted' } } });
    }
    if (path.startsWith('/api/messages/peer/') && method === 'POST') {
      return success({ statusCode: 200, data: { ok: true } });
    }
    return success({ statusCode: 200, data: { ok: true } });
  }
};

const mergeMode = require('../utils/merge-mode');
assert.equal(mergeMode.enabled, true, 'merge-mode defaults to enabled');

const store = require('../utils/store');
const orders = require('../utils/orders');
const account = require('../utils/account');
const rewards = require('../utils/rewards');
const xpOrders = require('../utils/xp-orders');
const xpRewards = require('../utils/xp-rewards');
const util = require('../utils/util');

function loadPage(name, opts = {}) {
  delete require.cache[require.resolve('../pages/' + name + '/index')];
  require('../pages/' + name + '/index');
  const p = { ...definition, data: structuredClone(definition.data), setData(patch) { Object.assign(this.data, patch); } };
  if (p.onLoad) p.onLoad(opts);
  return p;
}

(async () => {
  store.reset();
  store.update(s => { s.language = 'en'; s.profile = { ...s.profile, accountId: '101', campusId: 'sip', onboarded: true }; });

  // 1. orders.upload uses config.baseUrl (not config.config.baseUrl)
  const uploadedUrl = await orders.upload('/tmp/proof.jpg');
  assert.equal(uploadedUrl, 'https://pararouter.cn/uploads/proof.jpg');
  assert.match(uploads[0].url, /^https:\/\/pararouter\.cn\/api\/orders\/upload$/);
  assert.equal(uploads[0].header.Authorization, 'Bearer xp-token-1');

  // 2. orders.sync loads hall, mine, coupons, and notifies subscribers
  let notified = 0;
  const unsub = orders.subscribe(() => { notified++; });
  await orders.sync();
  unsub();
  assert.equal(notified, 1);

  const otherOrder = store.get().publicJobs.find(r => r.id === 'xp-42');
  const ownOrder = store.get().requests.find(r => r.id === 'xp-43');
  assert.equal(otherOrder.isMine, false, 'hall orders from another user are not marked isMine');
  assert.equal(otherOrder.ownerId, '202');
  assert.equal(otherOrder.owner, 'WeChat user 9295');
  assert.equal(otherOrder.ownerAvatar, 'https://pararouter.cn/uploads/avatars/9295.png');
  assert.equal(otherOrder.area, 'wenyuan');
  assert.equal(otherOrder.dorm, 'D02');
  assert.equal(otherOrder.floor, 16);
  assert.equal(otherOrder.room, '1612');
  assert.equal(otherOrder.station, 'Wenyuan takeaway locker');
  const jobsPage = loadPage('jobs');
  jobsPage.refresh();
  const xpHallCard = jobsPage.data.cards.find(c => c.key === 'xp-42');
  assert.equal(xpHallCard.originLabel, 'Wenyuan takeaway locker');
  assert.equal(xpHallCard.destinationLabel, 'Wenyuan D02 Room 1612');
  assert.equal(xpHallCard.publisherName, 'WeChat user 9295');
  assert.equal(xpHallCard.pickupCard, true);
  store.update(s => { s.language = 'zh'; });
  jobsPage.refresh();
  const xpHallCardZh = jobsPage.data.cards.find(c => c.key === 'xp-42');
  assert.equal(xpHallCardZh.originLabel, '文缘外卖柜');
  assert.equal(xpHallCardZh.destinationLabel, '文缘 D02 1612室');
  assert.equal(xpHallCardZh.publisherName, '微信用户9295');
  store.update(s => { s.language = 'en'; });
  assert.equal(ownOrder.isMine, true);
  assert.equal(ownOrder.ownerId, '101');
  assert.deepEqual(ownOrder.codes, ['11-1-2222', '11-1-3333']);
  assert.equal(ownOrder.small, 1);
  assert.equal(ownOrder.big, 1);

  // 3. accept({ ids }) creates a trip and returns t.id
  const accepted = await orders.act('accept', { ids: ['xp-42'] });
  assert.ok(accepted.id, 'accept returns trip id');
  assert.ok(store.get().trips.some(t => t.id === accepted.id), 'trip is stored locally for trip page');
  const acceptCall = calls.find(c => c.url.endsWith('/api/orders/42/accept'));
  assert.ok(acceptCall);

  // 4. message maps { id, text } to peer endpoint with { content, order_id }
  await orders.act('message', { id: 'xp-42', text: 'On my way' });
  const msgCall = calls.find(c => c.url.includes('/api/messages/peer/202'));
  assert.ok(msgCall);
  assert.deepEqual(msgCall.data, { content: 'On my way', order_id: 42 });

  // 5. account.call saveDisplayName / saveDorm / saveAvatar / admin*
  await account.call('saveDisplayName', { displayName: 'Yichen' });
  assert.equal(store.get().profile.displayName, 'Yichen');
  assert.equal(store.get().profile.name, 'Yichen');

  await account.call('saveDorm', { dorm: 'Dorm 5', room: '118', pickup: 'North gate' });
  const dormCall = calls.find(c => c.url.endsWith('/api/auth/dorm'));
  assert.deepEqual(dormCall.data, { dorm: 'Dorm 5', dorm_room: '118', pickup: 'North gate' });
  assert.equal(store.get().profile.dorm, 'Dorm 5');
  assert.equal(store.get().profile.room, '118');
  assert.equal(store.get().profile.pickup, 'North gate');

  await account.call('saveAvatar', { avatarUrl: 'https://cdn.example/avatar.jpg' });
  assert.equal(store.get().profile.avatarUrl, 'https://cdn.example/avatar.jpg');

  const adminStatus = await account.call('adminStatus');
  assert.equal(adminStatus.admin, true);
  const dash = await account.call('adminDashboard');
  assert.equal(dash.stats.total, 12);
  assert.deepEqual(dash.applications, []);
  const adminOrders = await account.call('adminOrders', { bucket: 'all' });
  assert.equal(adminOrders.orders[0].reward.toFixed(2), '5.00');

  // 6. xp-rewards maps percentage coupon to deliveryPercent
  const coupons = await xpRewards.load();
  assert.equal(coupons[0].kind, 'deliveryPercent');
  assert.equal(coupons[0].percent, 50);
  assert.equal(coupons[1].kind, 'delivery');
  const quoted = rewards.quote(coupons[0].id, 3, 0);
  assert.equal(quoted.discount, '1.50');
  assert.equal(quoted.total, '1.50');

  // 7. util.requireLogin redirects guests to /pages/welcome/index
  const prevToken = storage.token;
  delete storage.token;
  navigated = '';
  assert.equal(util.requireLogin(), false);
  assert.equal(navigated, '/pages/welcome/index');
  storage.token = prevToken;

  // 8. invite promoInputChange & redeemPromo
  const invite = loadPage('invite');
  invite.promoInputChange({ detail: { value: 'SPRING50' } });
  assert.equal(invite.data.promoInput, 'SPRING50');
  await invite.redeemPromo();
  assert.ok(calls.some(c => c.url.endsWith('/api/coupons/redeem') && c.data.code === 'SPRING50'));
  assert.equal(invite.data.promoInput, '');

  // 9. Share localization across welcome / coupons / levels / profile
  store.update(s => { s.language = 'en'; });
  for (const name of ['welcome', 'coupons', 'levels', 'profile']) {
    const p = loadPage(name);
    if (p.onShow && name !== 'profile') p.onShow();
    else p.setData({ language: 'en' });
    assert.equal(p.onShareAppMessage().title, 'Uniearn · campus errands', name + ' shareInfo uses English');
    assert.equal(p.onShareTimeline().title, 'Uniearn · campus errands', name + ' shareTimeline uses English');
    p.setData({ language: 'zh' });
    assert.equal(p.onShareAppMessage().title, 'Uniearn｜校园跑腿，同学帮同学', name + ' shareInfo uses Chinese');
    if (p.onUnload) p.onUnload();
  }

  // 10. trip page has no duplicate preview methods
  const tripSrc = require('node:fs').readFileSync(require.resolve('../pages/trip/index'), 'utf8');
  assert.equal(tripSrc.match(/previewOrderPhoto\(e\)\{/g).length, 1);
  assert.equal(tripSrc.match(/previewRiderPhotos\(e\)\{/g).length, 1);

  console.log('XP merge-mode integration: upload, hall/mine sync, accept, message, profile saves, admin shaping, coupon quote, requireLogin, promo redeem and bilingual share passed.');
})().catch(e => { console.error(e); process.exitCode = 1; });
