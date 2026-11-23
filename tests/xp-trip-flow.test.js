// The full "start a trip -> a friend joins -> accept -> pick up -> deliver -> customer confirms" flow
// against the XP HTTP API (merge mode), in English and Chinese.
const assert = require('node:assert/strict');

const storage = { token: 'runner-token', user: { id: 101, nickname: 'Runner', runner_status: 'approved' } };
const calls = [];
let definition = null;
const NOW = Date.now();
const server = { trips: [], offers: [], accepted: [], published: [], public: [], fail: {} };

function tripView(extra) {
  return { id: 57, is_runner: true, runner_name: 'Runner', runner_avatar: '', category: 'takeout', route_type: 'takeout',
    station: '丰食汇KFC外卖柜', pickup_address: '', waypoint: '', destination_type: 'dorm', dorm: 'D02', dorms: ['D02'],
    delivery_address: '', capacity: 5, remaining: 5, depart_at: NOW + 600000, join_until: NOW + 600000, phase: 'collect', request_ids: [], ...extra };
}
function joinedOrder(extra) {
  return { id: 900, publisher_id: 202, publisher: { id: 202, nickname: '微信用户9295' }, type: 'food', title: '外卖代取',
    pickup_location: '丰食汇KFC外卖柜', delivery_location: '文缘 D02 1612', price_cents: 300, status: 'pending', payment_status: 'paid',
    created_at: '2026-11-24 00:00:00', food_arrival_at: NOW - 60000, ...extra };
}

global.Page = p => { definition = p; };
global.getApp = () => ({ globalData: {} });
global.wx = {
  getStorageSync: k => storage[k] ?? null,
  setStorageSync: (k, v) => { storage[k] = v; },
  removeStorageSync: k => { delete storage[k]; },
  showToast: () => {}, showShareMenu: () => {}, setNavigationBarTitle: () => {},
  showModal: opts => { if (opts.success) opts.success({ confirm: true }); },
  navigateTo: () => {}, redirectTo: () => {}, reLaunch: () => {},
  request({ url, method, data, success }) {
    const path = url.replace(/^https?:\/\/[^/]+/, '');
    calls.push({ path, method, data });
    const ok = body => success({ statusCode: 200, data: { ok: true, ...body } });
    if (server.fail[path]) return success({ statusCode: 409, data: { ok: false, ...server.fail[path] } });
    if (path.startsWith('/api/trips') && method === 'GET') return ok({ mine: server.trips, offers: server.offers, public_trips: server.public });
    const ended = path.match(/^\/api\/trips\/(\d+)\/end$/);
    if (ended) { server.trips = server.trips.filter(t => t.id !== Number(ended[1])); return ok({}); }
    if (path === '/api/trips' && method === 'POST') { server.trips = [tripView()]; return ok({ id: 57 }); }
    if (path === '/api/orders/mine') return ok({ published: server.published, accepted: server.accepted });
    if (path.startsWith('/api/orders?')) return ok({ list: [] });
    if (path === '/api/orders' && method === 'POST') return ok({ order: joinedOrder({ id: 901, publisher_id: 101, payment_status: 'none', trip_id: undefined }) });
    return ok({});
  }
};

const store = require('../utils/store');
const orders = require('../utils/orders');
const xp = require('../utils/xp-orders');

function loadPage(name, opts = {}) {
  delete require.cache[require.resolve('../pages/' + name + '/index')];
  require('../pages/' + name + '/index');
  const p = { ...definition, data: structuredClone(definition.data), setData(patch) { Object.assign(this.data, patch); } };
  if (p.onLoad) p.onLoad(opts);
  return p;
}
const settle = () => new Promise(r => setTimeout(r, 20));
const tap = dataset => ({ currentTarget: { dataset } });

(async () => {
  store.reset();
  store.update(s => { s.language = 'en'; s.profile = { ...s.profile, accountId: '101', campusId: 'sip', onboarded: true, studentVerified: true }; });

  // A joined order must carry the trip number; a boolean "joined" flag is not a trip id.
  assert.equal(xp.bodyOf({ category: 'takeout', tripId: true }).trip_id, undefined);
  assert.equal(xp.bodyOf({ category: 'takeout', tripId: 'xp-trip-57' }).trip_id, 57);
  await orders.act('create', { data: { category: 'takeout', tripId: true, pickupPoint: '丰食汇KFC外卖柜' }, tripId: 'xp-trip-57' });
  let post = calls.filter(c => c.path === '/api/orders' && c.method === 'POST').pop();
  assert.equal(post.data.trip_id, 57, 'the page-level trip id is sent to the server');
  await orders.act('create', { data: { category: 'takeout', tripId: 'xp-trip-57' }, tripId: '' });
  post = calls.filter(c => c.path === '/api/orders' && c.method === 'POST').pop();
  assert.equal(post.data.trip_id, undefined, 'choosing "post to job board" drops the trip');
  assert.equal(calls.filter(c => c.path === '/api/pay/prepay').length, 0, 'offline orders never open a second payment');
  server.published = [];

  // 1. The runner starts a trip: the share card is open and the title is in English.
  const started = await orders.act('startTrip', { data: { category: 'takeout', station: '丰食汇KFC外卖柜', dorm: 'D02', dorms: ['D02'], destinationType: 'dorm', capacity: 5, when: 'now', duration: 10 } });
  assert.equal(started.id, 'xp-trip-57');
  const trip = loadPage('trip', { id: 'xp-trip-57' });
  trip.onShow(); await settle(); trip.refresh();
  assert.equal(trip.data.trip.id, 'xp-trip-57');
  assert.equal(trip.data.joinOpen, true, 'share card shows while joining is open');
  assert.equal(trip.data.minutes, 10);
  assert.equal(trip.data.remaining, 5);
  assert.equal(trip.data.tripStationLabel, 'Fengshihui KFC takeaway locker');
  assert.equal(trip.data.requests.length, 0);
  assert.equal(trip.data.offers.length, 0);
  store.update(s => { s.language = 'zh'; }); trip.refresh();
  assert.equal(trip.data.tripStationLabel, '丰食汇KFC外卖柜');
  store.update(s => { s.language = 'en'; });

  // 2a. A friend opens the shared link: the join page finds the trip and it is open.
  storage.user = { id: 202, nickname: 'Customer' };
  const runnerTrips = server.trips; server.trips = [];
  server.public = [tripView({ is_runner: false, request_ids: [] })];
  const join = loadPage('join', { id: 'xp-trip-57' });
  join.refresh(); await settle(); join.refresh();
  assert.equal(join.data.open, true, 'the shared trip can be joined');
  assert.equal(join.data.tripStationLabel, 'Fengshihui KFC takeaway locker');
  assert.equal(join.data.minutes, 10);
  assert.ok(calls.some(c => c.path === '/api/trips?include=57'), 'the shared trip is fetched by its number');
  storage.user = { id: 101, nickname: 'Runner' }; server.trips = runnerTrips; server.public = [];

  // 2. A friend joins: the runner sees the request with the timer from the server.
  server.offers = [joinedOrder({ offered_trip_id: 57, offer_expires_at: NOW + 15 * 60000 })];
  await orders.sync(); trip.refresh();
  assert.equal(trip.data.offers.length, 1, 'the join request shows on the trip page');
  const offer = trip.data.offers[0];
  assert.equal(offer.type, 'Takeaway');
  assert.equal(offer.count, '1 bag');
  assert.equal(offer.when, 'Food is there now');
  assert.equal(offer.from, 'Fengshihui KFC takeaway locker');
  assert.equal(offer.to, 'D02');
  assert.equal(offer.reward, '3.00');
  assert.ok(offer.left === 15 || offer.left === 14);
  assert.equal(trip.data.requests.length, 0, 'an unanswered request is not yet on the trip');

  // 3. The runner accepts it.
  server.offers = [];
  server.accepted = [joinedOrder({ status: 'accepted', acceptor_id: 101, acceptor: { id: 101, nickname: 'Runner' }, runner_trip_id: 57, recipient_phone: '13800001111' })];
  server.trips = [tripView({ remaining: 4, request_ids: [900] })];
  await trip.offerDecide(tap({ id: 'xp-900', decision: 'accept' }));
  const decide = calls.find(c => c.path === '/api/trips/57/offers/900');
  assert.deepEqual(decide.data, { decision: 'accept' });
  assert.equal(trip.data.offers.length, 0);
  assert.equal(trip.data.requests.length, 1, 'the accepted order is on the trip');
  assert.equal(trip.data.requests[0].id, 'xp-900');
  assert.equal(trip.data.requests[0].status, 'taken');

  // 4. Pick up: the trip is closed on the server and moves to delivery.
  server.accepted = [{ ...server.accepted[0], status: 'picked_up' }];
  await trip.collectAndDeliver(tap({ id: 'xp-900', ids: 'xp-900' }));
  assert.ok(calls.some(c => c.path === '/api/orders/900/status' && c.data.status === 'picked_up'));
  assert.ok(calls.some(c => c.path === '/api/trips/57/leave' && c.method === 'POST'), 'the trip is closed on the server after the last pickup');
  server.trips = [tripView({ phase: 'deliver', join_until: 0, remaining: 4, request_ids: [900] })];
  await orders.sync(); trip.refresh();
  assert.equal(trip.data.trip.phase, 'deliver');

  // 5. Deliver with one photo; the runner waits for the customer, there is no confirm button for the runner.
  trip.deliveryIds = ['xp-900']; trip.setData({ deliveryId: 'xp-900', deliveryPhoto: 'https://pararouter.cn/uploads/p.jpg' });
  server.accepted = [{ ...server.accepted[0], status: 'completed', await_confirm: true, delivery_photo: '/uploads/p.jpg' }];
  await trip.sendDelivery();
  assert.ok(calls.some(c => c.path === '/api/orders/900/status' && c.data.status === 'completed'));
  await orders.sync(); trip.refresh();
  const delivered = trip.data.requests[0];
  assert.equal(delivered.status, 'delivered');
  assert.equal(delivered.isMine, false);
  assert.equal(delivered.singlePhoto.length, 1, 'only one photo on the card');
  const wxml = require('node:fs').readFileSync(require.resolve('../pages/trip/index.wxml'), 'utf8');
  assert.ok(!/bindtap="confirmDone"/.test(wxml), 'runners do not confirm on the trip page');
  assert.ok(wxml.includes('Waiting for the customer to confirm'));
  assert.ok(!/Team test|演示|Demo/.test(wxml));

  // 6. The customer confirms in "I requested".
  storage.user = { id: 202, nickname: 'Customer' };
  store.update(s => { s.profile = { ...s.profile, accountId: '202' }; });
  server.published = [{ ...server.accepted[0] }]; server.accepted = []; server.trips = [];
  await orders.sync();
  const mine = store.get().requests.find(r => r.id === 'xp-900');
  assert.equal(mine.isMine, true);
  assert.equal(mine.status, 'delivered');
  const request = loadPage('request', { id: 'xp-900' });
  if (request.onShow) request.onShow();
  request.refresh && request.refresh();
  await request.confirm();
  assert.ok(calls.some(c => c.path === '/api/orders/900/confirm-complete' && c.method === 'POST'));
  assert.equal(store.get().requests.find(r => r.id === 'xp-900').status, 'confirmed');
  const reqWxml = require('node:fs').readFileSync(require.resolve('../pages/request/index.wxml'), 'utf8');
  assert.ok(!/模拟|预览版|演示|Demo |in this preview/.test(reqWxml));

  // 7. Ending a trip that still has orders explains why, in the chosen language.
  storage.user = { id: 101, nickname: 'Runner' };
  store.update(s => { s.profile = { ...s.profile, accountId: '101' }; });
  server.trips = [tripView({ request_ids: [900] })];
  await orders.sync();
  server.fail['/api/trips/57/end'] = { error: 'TRIP_HAS_ORDERS', message: '行程中有订单，请先处理订单' };
  await assert.rejects(orders.act('endEmpty', { id: 'xp-trip-57' }), e => /This trip still has orders/.test(e.message));
  store.update(s => { s.language = 'zh'; });
  await assert.rejects(orders.act('endEmpty', { id: 'xp-trip-57' }), e => /行程中有订单/.test(e.message));
  delete server.fail['/api/trips/57/end'];

  // 8. An empty trip whose joining time ran out is over, not "in progress".
  server.trips = [tripView({ id: 58, join_until: NOW - 1000 })];
  await orders.sync();
  const old = store.get().trips.find(t => t.id === 'xp-trip-58');
  assert.equal(old.cancelled, true);
  // Ending an empty trip marks it ended locally right away.
  server.trips = [tripView({ id: 59 })];
  await orders.sync();
  await orders.act('endEmpty', { id: 'xp-trip-59' });
  assert.equal(store.get().trips.find(t => t.id === 'xp-trip-59').cancelled, true);

  console.log('XP trip flow: join with trip id, offers, accept, pickup, deliver, customer confirm and bilingual errors passed.');
})().catch(e => { console.error(e); process.exitCode = 1; });
