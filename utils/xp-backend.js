// Runs the UniEarn client on the XP Express server: every former cloud
// function call is translated to XP REST endpoints, and XP orders are shaped
// back into the request/trip snapshot the pages already render.
const api = require('./xp-api');
const store = require('./store');
const campus = require('./campus');
const loyalty = require('./xp-loyalty');

const EXTRA = 'xp_profile_v1', RECEIPTS = 'xp_receipts_v1', PREFS = 'xp_prefs_v1';
const AREAS = {wenyuan: '文缘', wenxing: '文星', wencui: '文萃', wenhui: '文荟', bafei: '芭菲'};
const SIZE_TO_XP = {small: 'small', medium: 'medium', large: 'large', oversized: 'xlarge'};
const SIZE_FROM_XP = {small: 'small', medium: 'medium', large: 'large', xlarge: 'oversized'};
const SIZE_PRICE = {small: 3, medium: 4, large: 5, oversized: 10};
const REPORT = {'Not received': '未收到货', 'Malicious order': '恶意下单', 'Runner unreachable': '接单后失联', 'Harassment': '言语骚扰', 'Damaged or lost': '物品损坏或丢失', 'Fake proof': '虚假凭证'};
const EN = {
  RUNNER_REQUIRED: 'Your runner approval is not active yet.',
  RUNNER_NEED_APPROVAL: 'Your runner approval is not active yet.', TOO_MANY_ACTIVE: 'You already have the maximum number of active jobs.',
  NOT_PENDING: 'This order is no longer available.', SELF_ACCEPT: 'You cannot take your own order.',
  PAYMENT_REQUIRED: 'This order is not paid yet.', PICKED_UP_NO_CANCEL: 'The runner already collected this order. Contact the runner or support.',
  FLOOR_REQUIRED: 'Choose a valid floor.', BAD_AREA: 'This dorm area is not supported.', BAD_BUILDING: 'The building does not match the dorm area.',
  BAD_REWARD: 'Enter a valid reward amount.', PRICE_CHANGED: 'The amount has changed. Review it before paying.',
  INVITE_INVALID: 'That invite code is invalid.',
  INVITE_SELF: 'You cannot use your own invite code.',
  INVITE_ALREADY_LINKED: 'You already linked an invite code.',
  INVITE_CYCLE: 'You cannot link back to a classmate you invited.',
  TRIP_CLOSED: 'This trip is closed. Return to the form to post your order separately.',
  TRIP_ROUTE: 'The order pickup, destination or type does not match this trip.',
  TRIP_INPUT: 'Check the route, capacity and selected orders.',
  TRIP_TIME: 'Choose a valid trip or pickup time.',
  TRIP_FULL: 'There is no room on this trip. Return to the form to post your order separately.',
  TRIP_ARRIVAL: 'Your food arrives after this runner leaves.',
  TRIP_ORDER_CHANGED: 'A selected order changed. Refresh and choose again.',
  TRIP_HAS_ORDERS: 'Finish the orders before ending the trip.',
  TRIP_OFFER_GONE: 'This request has expired or another runner took it. Refresh your trip.',
  TRIP_PICKUP_REQUIRED: 'Pick up all orders before starting delivery.',
  BAD_TIP: 'Choose one of the listed tip amounts.', BAD_PHONE: 'Enter a valid mobile number.', SIZE_REQUIRED: 'Choose a parcel size.',
  TOO_MANY_ITEMS: 'Up to 12 parcels per order.', SHOP_REQUIRED: 'Add the shop or stall name.', PICKUP_CODE_REQUIRED: 'Enter the pickup code for each parcel.', BAD_AMOUNT: 'Offer increases can be ¥1, ¥2 or ¥3.',
  WXPAY_NOT_CONFIGURED: 'Payment is not available right now.', BANNED: 'This account is blocked.', UNAUTHORIZED: 'Please sign in again.', GUEST: 'Please sign in first.',
  TITLE_TOO_LONG: 'The title is too long.', DESC_TOO_LONG: 'The note is too long (200 characters max).', PICKUP_TOO_LONG: 'The pickup point is too long (40 characters max).',
  REFUND_IN_PROGRESS: 'A refund is in progress. Try again shortly.', NO_PEER: 'Nobody has taken this order yet.', BAD_STUDENT_NO: 'Enter your 7-digit student number.',
  COMPLAINT_OPEN: 'This report is being reviewed. Settlement is paused.', PHOTO_REQUIRED: 'Add a photo for this issue.',
  DUPLICATE: 'You already reported this order. The team will follow up soon.', BAD_REASON: 'Choose a reason.', SELF_REPORT: 'You cannot report yourself.', NO_TARGET: 'Nobody to report on this order yet.',
  NOT_FOUND: 'Not found.', FORBIDDEN: 'You cannot do this on this order.', NETWORK: 'Network error. Check your connection and try again.'
};
const MS_DAY = 86400000;
const RUNNER_RULES = 'xp_runner_rules_v1';

const en = () => store.get().language === 'en';
const say = (zh, english) => en() ? english : zh;
function read(key, fallback) { try { return wx.getStorageSync(key) || fallback; } catch (_) { return fallback; } }
function write(key, value) { try { wx.setStorageSync(key, value); } catch (_) {} }
const extras = () => read(EXTRA, {});
const meId = () => { const u = api.user(); return u && u.id ? 'xp' + u.id : ''; };
function patchExtras(patch) { const next = {...extras(), ...patch}; write(EXTRA, next); return next; }
function business(message) { const e = Error(message); e.business = true; return e; }
const unsupported = () => business(say('该功能暂未开放。', 'This feature is not available yet.'));
function message(e) {
  if (!e) return say('请求失败，请重试。', 'Request failed. Please try again.');
  if (!en()) return e.message || '请求失败，请重试。';
  if (e.english) return e.english;
  if (EN[e.code]) return EN[e.code];
  return /[\u4e00-\u9fff]/.test(e.message || '') ? 'Request failed' + (e.code ? ' (' + e.code + ')' : '') + '.' : (e.message || 'Request failed.');
}
function time(v) {
  if (!v) return 0;
  if (typeof v === 'number') return v;
  const s = String(v).trim();
  if (/^\d+$/.test(s)) return Number(s);
  const at = Date.parse(s.replace(' ', 'T') + (/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? '' : '+08:00'));
  return Number.isFinite(at) ? at : 0;
}
// XP gives new accounts the default nickname "微信用户1234".
const nick = name => en() ? String(name || '').replace(/^微信用户(\d*)$/, (_, n) => 'WeChat user' + (n ? ' ' + n : '')) : String(name || '');
// XP stores Chinese server-generated titles; show an English equivalent in the English UI.
const TITLE_EN = [
  [/^快递代取\s*(\d+)\s*件$/, m => 'Parcel pickup × ' + m[1]],
  [/^外卖代取\s*(\d+)\s*袋$/, m => 'Takeaway pickup × ' + m[1]],
  [/^外卖代取$/, () => 'Takeaway pickup'],
  [/^夜市代买\s*(.*)$/, m => 'Night market run' + (m[1] ? ': ' + m[1] : '')],
];
const titleOf = t => {
  t = String(t || '');
  if (!en()) return t;
  for (const [re, f] of TITLE_EN) { const m = t.match(re); if (m) return f(m); }
  return t;
};
const xpId = id => Number(String(id || '').replace(/^[xt]/, ''));
const yuan = cents => Math.round(Number(cents || 0)) / 100;

// ---------- account ----------
async function accountView() {
  const x = extras();
  // Never signed in (preview mode) looks like signed out: pages show their browse-only state.
  if (x.loggedOut || !api.signedIn()) return {id: '', loggedOut: true, guest: !api.signedIn(), hasProfile: false, profile: null, verification: {status: 'unverified'}};
  const [me, rs] = await Promise.all([api.get('/api/auth/me'), api.get('/api/runner/status').catch(() => ({}))]);
  const u = me.user || {};
  api.setUser(u);
  const status = {approved: 'verified', pending: 'pending', rejected: 'rejected'}[rs.runner_status || u.runner_status] || 'unverified';
  const phone = rs.phone || x.phone || '';
  // A signed-in XP user always has a profile; the campus stays empty until the campus page picks one.
  const profile = {
    name: rs.real_name || x.name || nick(u.nickname), displayName: x.displayName || nick(u.nickname),
    avatarUrl: u.avatar ? api.absolute(u.avatar) : '', phone, universityId: x.universityId || '', campusId: x.campusId || '',
    dorm: x.dorm || '', room: x.room || '', pickup: x.pickup || ''
  };
  return {id: 'xp' + u.id, loggedOut: false, hasProfile: true, profile, wechatPhone: phone,
    runnerRulesAccepted: status === 'verified' || read(RUNNER_RULES, {})['xp' + u.id] === true,
    verification: {status, method: 'xp', studentName: rs.real_name || '', phone, gender: u.gender || '', reason: rs.reject_reason || '', submittedAt: 0, checkedAt: 0}};
}
async function account(action, d) {
  if (action === 'logout') { api.logout(); patchExtras({loggedOut: true}); return {account: await accountView()}; }
  if (['sessionLogin', 'wechatLogin'].includes(action)) { patchExtras({loggedOut: false}); await api.login(); if (d.name) patchExtras({name: String(d.name).slice(0, 60)}); }
  else if (action === 'selectCampus') {
    if (d.universityId !== 'xjtlu' || d.campusId !== 'sip') throw business(say('目前只开放西浦独墅湖校区。', 'Only XJTLU SIP campus is open for now.'));
    patchExtras({universityId: 'xjtlu', campusId: 'sip', loggedOut: false});
  } else if (action === 'saveDorm') patchExtras({dorm: String(d.dorm || ''), room: String(d.room || ''), pickup: String(d.pickup || '')});
  else if (action === 'saveDisplayName') { const name = String(d.displayName || '').trim(); await api.post('/api/auth/nickname', {nickname: name}); patchExtras({displayName: name}); }
  else if (action === 'saveAvatar') { if (d.avatarUrl) { const local = files.get(d.avatarUrl); if (!local) throw business(say('请重新选择头像。', 'Choose the photo again.')); await api.upload('/api/auth/avatar', local); } }
  else if (action === 'apply') {
    const f = d.application || {};
    await api.post('/api/runner/student-info', {real_name: String(f.realName || '').trim(), student_no: String(f.studentId || '').replace(/\s/g, ''), phone: String(f.phone || '').replace(/\s/g, '')});
    if (['male', 'female'].includes(f.gender)) await api.post('/api/auth/dorm', {gender: f.gender}).catch(() => {});
    await api.post('/api/runner/apply', {mode: 'info', real_name: String(f.realName || '').trim()});
    patchExtras({phone: String(f.phone || '').replace(/\s/g, '')});
  } else if (action === 'agreeRules') {
    const view = await accountView();
    if (!view.hasProfile || !api.user() || !api.user().id) {
      throw business(say('请先登录再同意跑手规则。', 'Sign in before accepting the runner rules.'));
    }
    if (d.accepted !== true) throw business(say('请先同意全部跑手规则。', 'Accept all runner rules first.'));
    try { wx.setStorageSync(RUNNER_RULES, {...read(RUNNER_RULES, {}), [view.id]: true}); }
    catch (_) { throw business(say('无法保存规则确认，请重试。', 'Could not save your acceptance. Please try again.')); }
    return {account: {...view, runnerRulesAccepted: true}};
  } else if (action === 'campusInterest' || action === 'requestSchool') {
    const name = action === 'campusInterest' ? '西交利物浦大学太仓校区' : String(d.school || '').trim().slice(0, 100);
    if (!name) throw business(say('请输入学校名称。', 'Enter your school name.'));
    await api.post('/api/cs/messages', {topic:'campus', content:name});
  } else if (['status', 'saveProfile'].includes(action)) {
    if (action === 'saveProfile' && d.profile) patchExtras({name: d.profile.name, phone: d.profile.phone});
  } else throw unsupported();
  return {account: await accountView()};
}

// ---------- orders ----------
// XP stores "文缘 7 楼 D04 701"; the public hall only gets "文缘 7 楼" or a "visible after accept" placeholder.
function splitDorm(text) {
  const s = String(text || '').trim();
  // 芭菲 buildings contain another area's name ("文缘芭菲"), so they are matched before the areas.
  const bafei = campus.buildingsOf('bafei').find(b => s.includes(b)) || '';
  const area = bafei ? AREAS.bafei : Object.values(AREAS).find(a => s.includes(a)) || '';
  const floor = Number((s.match(/(\d{1,2})\s*楼/) || [])[1]) || 0;
  const b = s.toUpperCase().match(/(?:^|[^A-Z0-9])([A-D]\d{2})(?=[^0-9]|$)/);
  const building = b && campus.isBuilding(b[1]) ? b[1] : '';
  if (!area && !building) return {place: true, address: /^接单后可见$/.test(s) ? '' : s};
  let room = '';
  if (building) room = s.slice(s.toUpperCase().indexOf(building, b.index) + building.length).trim();
  else if (bafei) room = s.slice(s.indexOf(bafei) + bafei.length).trim();
  else if (area === '芭菲') room = s.replace(/^芭菲/, '').replace(/\d{1,2}\s*楼/, '').trim();
  return {place: false, area, floor, dorm: building || bafei || (area === '芭菲' ? '芭菲' : ''), room};
}
const AREA_ID = Object.fromEntries(Object.entries(AREAS).map(([id, zh]) => [zh, id]));
const STATION_FROM_ZH = Object.fromEntries(campus.STATIONS.map(x => [x.zh, x.value]));
function items(o) {
  let counts = o.size_items;
  if (typeof counts === 'string') { try { counts = JSON.parse(counts); } catch (_) { counts = {}; } }
  if (!counts || !Object.keys(counts).length) counts = o.size ? {[o.size]: 1} : {};
  const list = [];
  for (const [k, n] of Object.entries(counts)) for (let i = 0; i < Number(n || 0); i++) { const size = SIZE_FROM_XP[k] || 'small'; list.push({size, price: SIZE_PRICE[size], code: ''}); }
  return list;
}
function status(o) {
  if (o.status === 'pending') return 'waiting';
  if (o.status === 'accepted') return 'taken';
  if (o.status === 'picked_up') return 'collected';
  if (o.status === 'completed') return o.await_confirm || o.offline_unconfirmed ? 'delivered' : 'confirmed';
  return 'cancelled';
}

const completedTime = order => time(order.completed_at_ms) || time(order.completed_at);

function toRequest(o, meId, photos) {
  const p = o.publisher || {}, a = o.acceptor || {};
  const isMine = !!meId && p.id === meId, isRunner = !!meId && a.id === meId;
  const assignedTrip = (isMine || isRunner) && o.runner_trip_id ? 'rt' + o.runner_trip_id : '';
  const category = o.type === 'express' ? 'parcel' : ['food', 'night'].includes(o.type) ? 'takeout' : 'task';
  const where = splitDorm(o.delivery_location), place = where.place;
  const publicLocation = splitDorm(o.public_delivery_location);
  const station = STATION_FROM_ZH[o.pickup_location] || o.pickup_location || '';
  const parcelItems = category === 'parcel' ? items(o) : null;
  const codes = String(o.pickup_code || '').split(/[,，、\s]+/).filter(Boolean);
  const big = parcelItems ? parcelItems.filter(x => ['large', 'oversized'].includes(x.size)).length : 0;
  const bags = o.type === 'food' && String(o.title || '').match(/^外卖代取\s*(\d+)\s*袋$/);
  const count = parcelItems ? parcelItems.length : o.bag_count || (bags ? Math.max(1, Math.min(5, Number(bags[1]))) : 1);
  const images = (o.images || []).map(u => { photos[u] = api.absolute(u); return u; });
  if (o.delivery_photo) photos[o.delivery_photo] = api.absolute(o.delivery_photo);
  const riderPhotos = (o.rider_photos || []).map(url => { photos[url] = api.absolute(url); return url; });
  const dueAt = Number(o.task_due_at) || 0;
  const created = o.created_at_ms || time(o.created_at), st = status(o);
  const completedAt = o.status === 'completed' ? completedTime(o) : 0;
  const r = {
    id: 'x' + o.id, xpId: o.id, orderNo: o.order_no || '', category, status: st, campusId: 'sip', universityId: 'xjtlu',
    station, pickupPoint: station, dorm: place ? '' : where.dorm, room: place ? '' : where.room,
    destinationType: place ? 'place' : 'dorm', deliveryAddress: place ? where.address : '', area: place ? '' : AREA_ID[where.area] || '', placeName: '',
    dormGender: o.dorm_type || '', floor: o.delivery_floor || where.floor || 0,
    small: count - big, big, codes: isMine || isRunner ? (codes.length ? codes : Array(count).fill('')) : Array(count).fill(''),
    parcelItems: parcelItems && parcelItems.map((x, i) => ({...x, code: isMine || isRunner ? codes[i] || '' : ''})),
    reward: yuan(o.reward), tip: yuan(o.tip_cents), raised: yuan(o.raise_cents), serviceFee: yuan(o.service_fee_cents),
    title: titleOf(o.title), note: o.description || '', publicNote: o.public_note || '', publicRoom: publicLocation.room || '', taskMode: category === 'task' ? o.task_mode || 'offline' : undefined,
    dueAt, riderPhotos, sealReportedAt: Number(o.seal_reported_at) || 0,
    night: o.type === 'night', shop: o.shop || '', arrived: !o.food_arrival_at || o.food_arrival_at <= Date.now(), purchaseStatus: o.type === 'night' ? 'ordered' : undefined,
    owner: isMine || isRunner ? nick(o.recipient_name || p.nickname) : 'Request', ownerAvatar: p.avatar ? api.absolute(p.avatar) : '',
    publisherName: isMine || isRunner || ((category === 'parcel' || category === 'takeout') && st === 'waiting') ? nick(p.nickname) : '',
    phone: isMine || isRunner ? o.recipient_phone || p.phone || '' : '',
    orderPictures: isMine || isRunner ? images : [], photo: o.delivery_photo || '', collected: st === 'taken' ? [] : Array(count).fill(true),
    runnerId: a.id ? (assignedTrip || 't' + o.id) : null, runnerName: nick(a.nickname), runnerAvatar: a.avatar ? api.absolute(a.avatar) : '', runnerPhone: a.phone || '',
    offeredTripId: o.offered_trip_id ? 'rt' + o.offered_trip_id : '', offerExpiresAt: o.offer_expires_at || 0,
    createdAt: created, takenAt: time(o.accepted_at), collectedAt: o.status === 'picked_up' || o.status === 'completed' ? time(o.accepted_at) : 0,
    xpCompleted: o.status === 'completed', completedAt,
    deliveredAt: completedAt, confirmedAt: st === 'confirmed' ? completedAt : 0,
    closesAt: dueAt || o.expires_at_ms || 0, arrivalAt: o.food_arrival_at || created, deadline: '', refundAmount: o.payment_status === 'refunded' ? yuan(o.pay_amount_cents) : 0,
    paymentStatus: o.payment_status || '', paymentPending: o.status === 'pending' && o.payment_status === 'unpaid',
    payAmountText: yuan(o.pay_amount_cents).toFixed(2),
    cancelReason: o.cancel_reason || '', disputed: !!o.disputed,
    messages: [], unread: 0, events: [], ownerId: isMine ? 'xp' + meId : '', isMine, isRunner
  };
  if (o.status === 'cancelled' && o.payment_status === 'refunded') r.refundedAt = time(o.updated_at) || created;
  return r;
}

function publicOrderSummary(order) {
  const row = toRequest(order, null, {});
  // Retain only public fields, even when the API caller is an order participant or administrator.
  return {
    id: row.id, xpId: row.xpId, orderNo: row.orderNo, xpCompleted: row.xpCompleted,
    category: row.category, status: row.status, campusId: row.campusId, universityId: row.universityId,
    station: row.station, pickupPoint: row.pickupPoint, publicNote: row.publicNote, publicRoom: row.publicRoom, destinationType: row.area ? 'dorm' : 'place',
    area: row.area, floor: row.floor, dormGender: row.dormGender, small: row.small, big: row.big,
    reward: row.reward, title: row.title, night: row.night, shop: row.shop, purchaseStatus: row.purchaseStatus,
    createdAt: row.createdAt, takenAt: row.takenAt, collectedAt: row.collectedAt,
    completedAt: row.completedAt, deliveredAt: row.deliveredAt, confirmedAt: row.confirmedAt,
  };
}

function publicProgressSummary(order) {
  const row = publicOrderSummary(order), publisher = order.publisher || {};
  const location = splitDorm(order.delivery_location);
  const arrivalAt = Number(order.food_arrival_at) || row.createdAt;
  return {...row, dorm: location.dorm || '', floor: 0, collectedAt: time(order.picked_up_at),
    arrivalAt, arrived: !arrivalAt || arrivalAt <= Date.now(),
    title: row.category === 'task' ? say('校园任务', 'Campus task') : row.title,
    publisherName: nick(publisher.nickname), ownerAvatar: api.absolute(publisher.avatar)};
}

async function progressPages(url) {
  const orders = new Map();
  let before = 0;
  while (true) {
    const page = await api.get(url + (before ? '&before=' + before : ''));
    if (!Array.isArray(page.list)) throw business(say('公开进度加载失败，请重试。', 'Could not load public progress.'));
    let next = 0;
    for (const order of page.list) {
      if (!Number.isSafeInteger(order.id) || order.id < 1) continue;
      orders.set(order.id, order);
      next = next ? Math.min(next, order.id) : order.id;
    }
    if (!page.has_more) return [...orders.values()];
    if (!next || (before && next >= before)) throw business(say('公开进度分页失败，请重试。', 'Could not load the next page of public progress.'));
    before = next;
  }
}

async function publicProgress(history) {
  // 西浦跑后端没有 /api/orders/progress 聚合接口，直接按状态各取一次。
  const pages = await Promise.all(['accepted', 'picked_up'].map(status => progressPages('/api/orders?status=' + status + '&limit=200')));
  return pages.flat().concat((history.list || []).filter(order => order.await_confirm));
}

async function linkedPublicOrder(id) {
  const value = String(id || '');
  const number = Number(value.slice(1));
  if (!/^x[1-9]\d*$/.test(value) || !Number.isSafeInteger(number)) return null;
  const {order} = await api.get('/api/orders/' + number).catch(error => {
    if (error.status === 404 || error.status === 403) return {};
    throw error;
  });
  if (!order || Number(order.id) !== number) return null;
  const inHall = order.status === 'pending' && ['paid', 'none'].includes(order.payment_status);
  return order.status === 'completed' || inHall ? publicOrderSummary(order) : null;
}

const COMPLETED_URL = '/api/orders?status=completed&limit=200';
let completedById = new Map();
let completedLoad;
async function fetchCompletedHistory() {
  const rows = new Map();
  let before = 0;
  while (true) {
    const page = await api.get(COMPLETED_URL + (before ? '&before=' + before : ''));
    if (!Array.isArray(page.list)) throw business(say('已完成订单加载失败，请重试。', 'Could not load completed orders. Try again.'));
    let next = 0;
    for (const order of page.list) {
      const id = Number(order.id);
      if (!Number.isSafeInteger(id) || id <= 0) continue;
      next = next ? Math.min(next, id) : id;
      if (order.status === 'completed') rows.set('x' + id, publicOrderSummary(order));
    }
    if (!page.has_more) break;
    if (!next || (before && next >= before)) throw business(say('已完成订单分页失败，请重试。', 'Could not load the next page. Try again.'));
    before = next;
  }
  completedById = rows;
  return [...rows.values()];
}

function completedHistory() {
  if (!completedLoad) completedLoad = fetchCompletedHistory().finally(() => { completedLoad = null; });
  return completedLoad;
}
function toTrip(r, me) {
  return {id: r.runnerId, runnerAccountId: 'xp' + me.id, runnerName: nick(me.nickname), runnerPhone: '', category: r.category === 'task' ? 'other' : r.category,
    station: r.station, dorm: r.dorm, destinationType: r.destinationType, deliveryAddress: r.deliveryAddress, campusId: 'sip', capacity: r.small + r.big,
    depart: 'now', phase: r.status === 'taken' ? 'collect' : 'deliver', requestIds: [r.id], joinUntil: 0, departAt: r.takenAt, cancelled: false, isRunner: true};
}
async function messagesFor(r, meId) {
  try {
    const d = await api.get('/api/messages/order/' + r.xpId + '?mark_read=0');
    r.unread = (d.messages || []).filter(m => m.receiver_id === meId && !m.read).length;
    r.messages = (d.messages || []).map(m => ({id: m.id, text: m.content || '', ...(m.image ? {photo: api.absolute(m.image)} : {}), at: time(m.created_at), mine: m.sender_id === meId}));
  } catch (_) {}
}
function tripId(value) {
  const text = String(value || '');
  const id = /^rt[1-9]\d*$/.test(text) ? Number(text.slice(2)) : 0;
  return Number.isSafeInteger(id) ? id : 0;
}
function tripView(row, me) {
  const owners = row.is_runner && me;
  const address = row.delivery_address || '';
  return {
    id: 'rt' + row.id, isRunner: !!owners, runnerAccountId: owners ? 'xp' + me.id : '',
    runnerName: nick(row.runner_name), runnerAvatar: api.absolute(row.runner_avatar), category: row.category, routeType: row.route_type,
    station: row.station, pickupAddress: row.pickup_address, waypoint: row.waypoint,
    destinationType: row.destination_type, deliveryAddress: address,
    dorm: row.dorm || require('./trip-route').placeDorm(address),
    dorms: Array.isArray(row.dorms) ? row.dorms : require('./trip-route').tripDorms({ dorm: row.dorm, dorms: row.dorms }),
    campusId: 'sip', universityId: 'xjtlu', capacity: row.capacity, remaining: row.remaining,
    departAt: row.depart_at, depart: require('./workflow').clock(row.depart_at), phase: row.phase,
    joinUntil: row.join_until, cancelled: false, requestIds: (row.request_ids || []).map(id => 'x' + id)
  };
}
async function tripsFor(include) {
  const id = tripId(include);
  // 西浦跑后端没有 /api/trips 路由，直接返回空，别再每次刷新打一条 404。
  if (!id) return {};
  return api.get('/api/trips' + (id ? '?include=' + id : '')).catch(error => {
    if (error.status === 404) return {};
    throw error;
  });
}
function supportData(feedback, conversation, photos) {
  const image = url => {
    if (!url) return '';
    photos[url] = api.absolute(url);
    return url;
  };
  const tickets = (feedback.tickets || []).map(ticket => ({
    id: 'feedback-' + ticket.id, orderId: 'x' + ticket.order_id,
    status: ticket.status === 'open' ? 'open' : 'closed', createdAt: time(ticket.created_at),
    messages: (ticket.messages || []).map((m, i) => ({
      id: m.id, mine: m.direction === 'user', text: m.content,
      reason: i === 0 && m.direction === 'user' ? ticket.reason_key : '',
      photo: image(m.image), at: time(m.created_at),
    })),
  }));
  if (conversation) tickets.push({
    id: 'xp-support', status: 'open',
    messages: (conversation.list || []).map(m => ({
      id: m.id, mine: m.direction === 'user', text: m.content || '',
      photo: image(m.image), at: time(m.created_at),
    })),
  });
  return tickets;
}

function attachOrderFeedback(byId, feedback) {
  for (const entry of feedback.active || []) {
    const r = byId.get(entry.order_id);
    if (!r || !r.isMine && !r.isRunner) continue;
    r.feedbackOpen = true;
    if (entry.mine) r.canResolveFeedback = true;
    if (!entry.mine && !r.reportNotice) r.reportNotice = entry.reason_key;
    if (entry.holds_settlement && r.status === 'delivered') {
      r.status = 'disputed';
      r.disputed = true;
    }
  }
  for (const entry of feedback.unread || []) {
    const r = byId.get(entry.order_id);
    if (!r || !r.isMine && !r.isRunner) continue;
    r.supportUnread = entry.count;
    r.supportPreview = entry.preview;
  }
}

async function snapshot(viewTripId, viewChatId, pointsResult) {
  const x = extras(), now = Date.now(), photos = {};
  const signed = !x.loggedOut && api.signedIn();
  const me = signed ? (api.user() || (await api.get('/api/auth/me')).user) : null;
  const accountId = me && me.id ? 'xp' + me.id : '';
  const [hall, mine, wallet, history, tripFeed, points, feedback, conversation] = await Promise.all([
    api.get('/api/orders?status=pending&limit=100'),
    signed ? api.get('/api/orders/mine') : null,
    signed ? api.get('/api/wallet').catch(() => null) : null,
    api.get(COMPLETED_URL), tripsFor(viewTripId || store.get().viewTripId),
    accountId ? pointsResult || loyalty.sync(accountId, now) : null,
    accountId ? api.get('/api/reports/order-feedback?order_id=' + (xpId(viewChatId) || 0)).catch(() => ({})) : {},
    accountId && viewChatId === 'support' ? api.get('/api/cs/messages').catch(() => null) : null
  ]);
  const meId = me && me.id, byId = new Map();
  for (const o of (mine && mine.published || []).concat(mine && mine.accepted || [])) byId.set(o.id, toRequest(o, meId, photos));
  for (const o of hall.list || []) if (!byId.has(o.id)) byId.set(o.id, toRequest(o, meId, photos));
  for (const order of tripFeed.offers || []) {
    const existing = byId.get(order.id);
    if (!existing || existing.status === 'waiting') byId.set(order.id, toRequest(order, meId, photos));
  }
  const publicCompleted = (history.list || []).map(publicOrderSummary);
  const progress = await publicProgress(history).then(rows => rows.filter(order => {
    const request = byId.get(order.id);
    return !request || !request.isMine && !request.isRunner;
  }).map(publicProgressSummary)).catch(() => {
    const cached = store.get();
    return cached.profile.accountId === accountId ? cached.publicProgress || [] : [];
  });
  for (const row of publicCompleted) if (!byId.has(row.xpId)) byId.set(row.xpId, row);
  const viewedOrderId = xpId(viewChatId);
  if (viewedOrderId && !byId.has(viewedOrderId)) {
    const result = await api.get('/api/orders/' + viewedOrderId).catch(() => null);
    if (result && result.order) {
      const r = toRequest(result.order, meId, photos);
      if (r.isMine || r.isRunner) byId.set(viewedOrderId, r);
    }
  }
  attachOrderFeedback(byId, feedback);
  const requests = [...byId.values()].sort((a, b) => b.createdAt - a.createdAt);
  const live = requests.filter(r => (r.isMine || r.isRunner) && r.runnerId && (['taken', 'collected'].includes(r.status) || r.deliveredAt > now - MS_DAY)).slice(0, 8);
  const viewedChat = requests.find(r => r.id === viewChatId && (r.isMine || r.isRunner) && r.runnerId);
  if (viewedChat && !live.includes(viewedChat)) live.push(viewedChat);
  await Promise.all(live.map(r => messagesFor(r, meId)));
  const liveTrips = (tripFeed.mine || []).map(row => tripView(row, me));
  const assigned = new Map();
  for (const trip of liveTrips) for (const id of trip.requestIds) assigned.set(id, trip.id);
  for (const row of requests) if (row.isRunner && assigned.has(row.id)) row.runnerId = assigned.get(row.id);
  const trips = liveTrips.concat(requests.filter(r => r.isRunner && !assigned.has(r.id)
    && ['taken', 'collected', 'delivered', 'disputed'].includes(r.status)).map(r => toTrip(r, me)));
  const publicTrips = (tripFeed.public_trips || []).map(row => tripView(row, null));
  const done = requests.filter(r => r.isRunner && ['delivered', 'confirmed'].includes(r.status));
  return {
    walletSummary: wallet ? {mode: 'live', balance_cents: wallet.balance_cents || 0, debt_cents: 0, pending_cents: wallet.pending_cents || 0} : null,
    progression: points ? points.progression : null, yuni: points && points.yuni || null, revision: now, serverTime: now, capabilities: {restoreDormGenders: false, riderPhotos: (mine && mine.rider_photos_supported) === true, inviteRewards: points ? points.inviteAvailable : undefined, pointsSyncError: !!(points && points.syncError)},
    publicJobs: requests.filter(r => r.status !== 'cancelled' && !r.paymentPending && !r.xpCompleted)
      .map(({id, category, station, dorm, small, big, reward, status, createdAt, title, night, shop, arrivalAt, publisherName, ownerAvatar, pickupPoint, publicNote, publicRoom}) => ({
        id, category, station, dorm, small, big, reward, status, createdAt, title, night, shop, pickupPoint, publicNote, publicRoom, campusId: 'sip', universityId: 'xjtlu',
        ...((category === 'parcel' || category === 'takeout') && status === 'waiting' ? {arrivalAt, publisherName, ownerAvatar} : {})
      })).concat(publicCompleted),
    publicProgress: progress,
    xpCompletedTotal: Number.isSafeInteger(history.total) ? history.total : null,
    deliveredThisWeek: requests.filter(r => r.deliveredAt > now - 7 * MS_DAY).length,
    requests, trips, publicTrips, accountId, supportInbox: [], adjustments: [], rewards: points && points.rewards || null,
    preferences: read(PREFS, {}), supportTickets: supportData(feedback, conversation, photos), photoURLs: photos,
    stats: {jobsDone: done.length, paid: done.reduce((n, r) => n + r.reward, 0), marks: []}
  };
}

// ---------- payments ----------
function wxPay(params) {
  return new Promise((resolve, reject) => wx.requestPayment({...params, success: resolve, fail: e => reject(business(/cancel/i.test(e && e.errMsg || '') ? say('已取消支付。', 'Payment cancelled.') : say('支付失败。', 'Payment failed.')))}));
}
async function payOrder(id, expectedPayCents) {
  const payload = {order_id: id};
  if (expectedPayCents !== undefined) payload.expected_amount_cents = expectedPayCents;
  let prepay;
  try {
    prepay = await api.post('/api/pay/prepay', payload);
  } catch (error) {
    if (error.code === 'ALREADY_PAID') return true;
    if (error.code !== 'WXPAY_NOT_CONFIGURED') throw error;
    await api.post('/api/pay/mock-paid', {order_id: id});
    return true;
  }
  if (prepay.payment_status === 'paid') return true;
  let cashierError;
  try { await wxPay(prepay.pay); } catch (error) { cashierError = error; }
  const status = await api.get('/api/pay/status/' + id).catch(() => null);
  if (status && ['paid', 'paid_out'].includes(status.payment_status)) return true;
  if (cashierError) throw cashierError;
  return false;
}

// ---------- create ----------
function area(data) {
  if (AREAS[data.area]) return AREAS[data.area];
  const a = campus.areaOfBuilding(data.dorm);
  return a ? AREAS[a.id] : Object.values(AREAS).find(x => String(data.dorm || '').startsWith(x)) || '';
}
function body(data) {
  const cat = data.category, place = data.destinationType === 'place';
  const dorm = String(data.dorm || '').trim(), room = String(data.room || '').trim();
  const zone = place ? '' : area(data), floor = Number(data.floor) || 0;
  const b = {
    public_note: data.notePublic === true ? String(cat === 'parcel' ? data.description || '' : data.note || '').trim().slice(0,500) : '',
    hall_room_visible: !place && data.roomPublic === true,
    title: '', description: [data.note, data.dropNote, data.pickupNote, data.description].filter(Boolean).join(' / ').slice(0, 200),
    pickup_location: String(data.pickupPoint || data.station || '').slice(0, 40),
    delivery_location: place ? String(data.deliveryAddress || '').trim() : [zone, floor ? floor + ' 楼' : '', dorm, room].filter(Boolean).join(' '),
    recipient_name: String(data.owner || '').slice(0, 20), recipient_phone: String(data.phone || '').replace(/\s/g, ''),
    area: zone, floor,
    dorm_type: ['male', 'female'].includes(data.dormGender) ? data.dormGender : '',
    images: (data.orderPictures || []).concat(data.noticePhoto ? [data.noticePhoto] : []).filter(u => /^\/uploads\/orders\//.test(u)).slice(0, 3)
  };
  if (cat === 'parcel') {
    const counts = {};
    (data.parcelItems || []).forEach(p => { const k = SIZE_TO_XP[p.size]; if (k) counts[k] = (counts[k] || 0) + 1; });
    Object.assign(b, {type: 'express', size_items: counts, tip_cents: Math.round(Number(data.tip || 0) * 100),
      pickup_code: (data.parcelItems || []).map(p => p.code).filter(Boolean).join(' ').slice(0, 40),
      title: '快递代取 ' + (data.parcelItems || []).length + ' 件'});
  } else if (cat === 'takeout') {
    Object.assign(b, data.night
      ? {type: 'night', shop: String(data.shop || '').trim(), pickup_code: String(data.pickupCode || '').slice(0, 40), title: '夜市代买 ' + String(data.shop || '').trim()}
      : {type: 'food', title: '外卖代取' + (Number(data.bags) > 1 ? ' ' + data.bags + ' 袋' : '')});
    b.unit_reward_cents = Math.round(Number(data.price) * 100);
    if (!data.night) b.bag_count = Number(data.bags || 1);
    if (Number(data.bags) > 1) b.description = ('共 ' + data.bags + ' 袋 / ' + b.description).slice(0, 200);
  } else if (cat === 'task') {
    Object.assign(b, {type: 'other', unit_reward_cents: Math.round(Number(data.price) * 100), title: String(data.title || '').trim().slice(0, 4000), pickup_location: '', delivery_location: '',
      task_mode: data.taskMode === 'online' ? 'online' : 'offline', task_due_at: Number(data.dueAt) || 0});
  } else throw unsupported();
  return b;
}
async function create(d) {
  const data = d.data || {};
  const payload = body(data);
  const displayedTotal = data.total == null ? data.price : data.total;
  const expectedPayCents = displayedTotal === undefined ? undefined : Math.round(Number(displayedTotal) * 100);
  if (d.couponId) {
    const match = /^xpCoupon([1-9]\d*)$/.exec(d.couponId);
    if (!match) throw business(say('优惠券已失效，请重新选择。', 'Choose a valid coupon.'));
    payload.user_coupon_id = Number(match[1]);
  }
  if (d.operationId) payload.create_request_key = d.operationId;
  if (d.tripId) {
    payload.trip_id = tripId(d.tripId);
    if (!payload.trip_id) throw business(say('这个行程已失效。', 'This trip is unavailable.'));
  }
  if (payload.type === 'food' && !data.arrived && data.arrivalTime) {
    payload.food_arrival_at = require('./workflow').todayAt(data.arrivalTime);
  }
  if (expectedPayCents !== undefined) {
    if (!Number.isSafeInteger(expectedPayCents)) throw business(say('请填写有效的订单金额。', 'Enter a valid order amount.'));
    payload.expected_amount_cents = expectedPayCents;
  }
  const r = await api.post('/api/orders', payload);
  const order = r.order;
  const id = 'x' + order.id;
  if (r.replayed && order.status === 'cancelled') return {id, paymentPending: true};
  if (!r.replayed && expectedPayCents !== undefined && order.pay_amount_cents !== expectedPayCents) {
    await api.post('/api/orders/' + order.id + '/cancel', {cancel_reason: '其他：订单金额不一致'}).catch(() => {});
    throw business(say('订单金额与页面显示不一致，请刷新后重试。', 'The order amount differs from the displayed total. Refresh and try again.'));
  }
  if (order.payment_status !== 'unpaid') return {id};
  try {
    const paid = await payOrder(order.id, expectedPayCents);
    return {id, paymentPending: !paid};
  } catch (_) {
    // The cashier may have accepted payment before the connection was lost.
    // Keep the same order and let its owner check or continue payment.
    return {id, paymentPending: true};
  }
}

// ---------- uploads ----------
const files = new Map();
async function uploadFile({cloudPath, filePath}) {
  const d = await api.upload('/api/orders/upload', filePath);
  files.set(d.url, filePath);
  return {fileID: d.url};
}
async function proof(fileID) {
  if (!fileID) return '';
  const local = files.get(fileID);
  if (!local) throw business(say('请重新拍摄送达照片。', 'Take the delivery photo again.'));
  return (await api.upload('/api/orders/proof', local)).url;
}

// ---------- actions ----------
async function orderAction(d) {
  const a = d.action, id = xpId(d.id);
  switch (a) {
    case 'sync': case 'rewardsInit': case 'ackLoyaltyNotice': case 'restoreDormGenders': return {};
    case 'readMessages': await api.get('/api/messages/order/' + id); return {};
    case 'prepareUpload': return {cloudPath: 'xp/' + Date.now().toString(36) + Math.random().toString(36).slice(2) + '.jpg'};
    case 'collectCoupon': {
      const campaign = /^xpCampaign([1-9]\d*)$/.exec(d.campaignId || '');
      if (!campaign) throw business(say('该活动券目前无法领取。', 'This coupon campaign is unavailable.'));
      return api.post('/api/coupons/campaigns/' + campaign[1] + '/claim', {});
    }
    case 'invite': return api.post('/api/loyalty/invite', {code: d.code});
    case 'yuniBuy': case 'yuniWear': case 'yuniFish': case 'yuniFeed': case 'yuniTestPoints': case 'yuniTestRound': {
      const action = {yuniBuy:'buy', yuniWear:'wear', yuniFish:'fish', yuniFeed:'feed', yuniTestPoints:'test-points', yuniTestRound:'test-round'}[a];
      return api.post('/api/loyalty/yuni/' + action, {
        request_key:d.operationId, item:d.item, slot:d.slot, landed:d.landed, perfect:d.perfect, index:d.index, fish:d.fish,
      });
    }
    case 'profileComplete': return loyalty.sync(meId(), Date.now());
    case 'preferences': write(PREFS, {...read(PREFS, {}), ...(d.values || {})}); return {};
    case 'startTrip': {
      const data = d.data || {};
      if (data.selfRequestId) throw business(say('请先处理自己的待接单，再发起行程。', 'Resolve your own open order before starting a trip.'));
      const ids = (data.requestIds || []).map(xpId);
      const trip = await api.post('/api/trips', {...data, request_key: d.operationId, order_ids: ids}).catch(error => {
        if (error.status === 404) throw business(say('服务器正在更新行程功能，请稍后再试。', 'Trip service is being updated. Try again later.'));
        throw error;
      });
      return {id: 'rt' + trip.id};
    }
    case 'leave': case 'endEmpty': {
      const trip = tripId(d.id);
      if (trip) await api.post('/api/trips/' + trip + '/' + (a === 'leave' ? 'leave' : 'end'), {});
      return {};
    }
    case 'tripOffer': {
      const trip = tripId(d.tripId);
      if (!trip || !Number.isSafeInteger(id) || id < 1) throw business(say('这笔加入请求已失效。', 'This trip request is unavailable.'));
      await api.post('/api/trips/' + trip + '/offers/' + id, {decision: d.decision});
      return {};
    }
    case 'create': return create(d);
    case 'editTask': return api.post('/api/orders/' + id + '/task-title', {title: d.title});
    case 'changeTaskDeadline': return api.post('/api/orders/' + id + '/task-deadline', {due_at: d.dueAt});
    case 'foodArrived': return api.post('/api/orders/' + id + '/food-arrived', {});
    case 'riderPhoto': return api.post('/api/orders/' + id + '/rider-photos', {photos: d.photos});
    case 'sealBroken': return api.post('/api/orders/' + id + '/seal-broken', {});
    case 'payOrder': return {paid: await payOrder(id, d.expected_amount_cents)};
    case 'accept': case 'acceptBoxes': {
      const ids = a === 'accept' ? d.ids || [] : [...new Set((d.refs || []).map(x => x.requestId))];
      if (!ids.length) throw business(say('请选择订单。', 'Choose an order.'));
      for (const one of ids) await api.post('/api/orders/' + xpId(one) + '/accept', {});
      return {id: 't' + xpId(ids[0])};
    }
    case 'pickup': {
      const o = (await api.get('/api/orders/' + id)).order;
      if (o.status === 'accepted') await api.post('/api/orders/' + id + '/status', {status: 'picked_up'});
      return {};
    }
    case 'deliver': case 'taskDone': {
      let o = (await api.get('/api/orders/' + id)).order;
      if (a === 'taskDone' && o.status === 'accepted') { await api.post('/api/orders/' + id + '/status', {status: 'picked_up'}); o = {status: 'picked_up'}; }
      const photo = await proof(d.photo);
      await api.post('/api/orders/' + id + '/status', {status: 'completed', ...(photo ? {photo} : {})});
      return {};
    }
    case 'confirm': await api.post('/api/orders/' + id + '/confirm-complete', {}); return {};
    case 'cancel': await api.post('/api/orders/' + id + '/cancel', {cancel_reason: ('其他：' + [d.reason, d.note].filter(Boolean).join(' ')).slice(0, 80)}); return {};
    case 'deleteAccount': {
      const user = api.user();
      if (!user || !user.id || 'xp' + user.id !== d.expectedAccountId) {
        throw business(say('请重新登录后再注销。', 'Sign in again before closing your account.'));
      }
      if (d.closeOrders) await api.post('/api/orders/close-mine', {});
      const result = await api.post('/api/auth/close-account', {confirm:d.confirm, account_id:user.id}, {noRelogin:true}).catch(error => {
        if (error.code === 'ACCOUNT_CLOSED') return {already:true};
        throw error;
      });
      api.logout();
      write(EXTRA, {loggedOut:true});
      return result;
    }
    case 'closeMyOrders': return api.post('/api/orders/close-mine', {});
    case 'missingParcel': return api.post('/api/orders/' + id + '/missing-parcel', {index:d.index, expected_codes:d.expectedCodes, request_key:d.operationId});
    case 'runnerCancel': await api.post('/api/orders/' + id + '/quit', {}); return {};
    case 'raise': {
      const cents = Math.round(Number(d.amount) * 100);
      let prepay;
      try {
        prepay = await api.post('/api/pay/raise', {order_id: id, amount_cents: cents});
      } catch (error) {
        if (error.code !== 'WXPAY_NOT_CONFIGURED') throw error;
        const mock = await api.post('/api/pay/mock-raise-paid', {order_id: id, amount_cents: cents});
        return {credited: !!mock.credited};
      }
      let cashierError;
      try { await wxPay(prepay.pay); } catch (error) { cashierError = error; }
      const state = await api.get('/api/pay/raise/' + prepay.raise_id + '/status').catch(() => null);
      if (state && state.credited) return {credited: true};
      if (state && state.status === 'refunded') return {refunded: true};
      if (cashierError && state && state.status === 'unpaid') throw cashierError;
      return {credited: false};
    }
    case 'orderFeedbackSubmit': return api.post('/api/reports/order-feedback/' + id, {
      reason: d.reason, content: d.note, image: d.photo, request_key: d.operationId,
    });
    case 'orderFeedbackRead': return api.post('/api/reports/order-feedback/' + id + '/read', {});
    case 'orderFeedbackResolve': {
      const result = await api.post('/api/reports/order-feedback/' + id + '/resolve', {});
      if (result.confirm) await api.post('/api/orders/' + id + '/confirm-complete', {});
      return {completed: result.confirm};
    }
    case 'supportRequest':
    case 'supportMessage': {
      if (d.photo) {
        const image = (await api.upload('/api/cs/upload', d.photo)).url;
        await api.post('/api/cs/messages', {type: 'image', image, topic: d.topic});
      } else {
        await api.post('/api/cs/messages', {content: d.text, topic: d.topic});
      }
      return {ticket: {id: 'xp-support'}};
    }
    // The legacy report action retains its time-limited settlement hold.
    case 'report': await api.post('/api/reports', {order_id: id, reason: REPORT[d.reason] || '其它', detail: String(d.note || '').slice(0, 500), images: /^\/uploads\/orders\//.test(d.photo || '') ? [d.photo] : []}); return {};
    case 'message': {
      const content = String(d.text || '').trim(), image = String(d.photo || '').trim();
      if (!content && !image) throw business(say('请输入消息或选择照片。', 'Enter a message or choose a photo.'));
      await api.post('/api/messages/order/' + id, {content, ...(image ? {image} : {})});
      return {};
    }
    case 'wallet': return walletView(await api.get('/api/wallet'));
    case 'walletWithdraw': return withdraw(d.amount_cents);
    case 'walletConfirmWithdrawal': return confirmWithdrawal(d.withdrawal_id);
    default: throw unsupported();
  }
}
// Wallet rows come straight from SQLite datetime('now'), i.e. UTC without a zone.
const utc = v => v ? time(String(v).trim() + (/[zZ]|[+-]\d\d:?\d\d$/.test(String(v)) ? '' : 'Z')) : 0;
const RULES_EN = {
  scope: 'Any balance above ¥0 can be withdrawn. Each withdrawal takes your whole balance, with no fee.',
  limit_text: 'No limit on how often you withdraw.', time_window: 'Available 24/7.',
  arrive: 'The transfer starts right away. Confirm it in WeChat and it reaches your WeChat balance, usually within a minute.',
  channel: 'Only to your own WeChat balance (the WeChat account you signed in with).', fee: 'Free. The platform pays the WeChat transfer fee.',
  notice: 'If you do not confirm in time, the transfer is returned to your balance. WeChat has a minimum transfer amount (usually ¥0.30).'
};
function walletView(w) {
  const rules = w.rules || {};
  return {mode: 'live', balance_cents: w.balance_cents || 0, balance_yuan: w.balance_yuan || '0.00', debt_cents: 0,
    pending_cents: w.pending_cents || 0, pending_yuan: w.pending_yuan || '0.00', today_income_cents: w.today_income_cents || 0, total_income_cents: w.total_income_cents || 0,
    transactions: (w.transactions || []).map(t => ({...t, created_at: utc(t.created_at)})),
    withdrawals: (w.withdrawals || []).map(x => ({
      ...x, status: withdrawalStatus(x, x.transfer_state),
      canConfirm: x.transfer_state === 'WAIT_USER_CONFIRM' && !!x.package_info, created_at: utc(x.created_at)
    })),
    series: w.series || [], pending: (w.pending || []).map(p => ({...p, type: p.type === 'express' ? 'parcel' : p.type === 'other' ? 'task' : p.type, night: p.type === 'night', auto_settle_at: utc(p.auto_settle_at)})),
    rules: en() ? {...rules, ...RULES_EN} : rules, mchId: w.mch_id || '', appId: w.app_id || ''};
}
function withdrawalStatus(row, transferState) {
  if (row.status === 'rejected') return 'rejected';
  if (transferState === 'SUCCESS' || (!row.out_bill_no && row.status === 'approved')) return 'approved';
  return 'processing';
}
function withdrawalState(id) {
  return api.get('/api/wallet/withdrawals/' + id + '/status');
}
async function finishWithdrawal(wallet, transfer) {
  let current = transfer;
  if (transfer.package_info && wx.requestMerchantTransfer) {
    await new Promise(resolve => wx.requestMerchantTransfer({
      mchId: wallet.mch_id, appId: wallet.app_id, package: transfer.package_info, complete: resolve
    }));
    current = await withdrawalState(transfer.withdrawal_id).catch(() => transfer);
  }
  return {withdrawal: {
    id: current.withdrawal_id,
    status: withdrawalStatus(current, current.state),
    canConfirm: current.state === 'WAIT_USER_CONFIRM'
  }};
}
async function withdraw(cents) {
  const wallet = await api.get('/api/wallet');
  const transfer = await api.post('/api/wallet/withdraw', {amount_cents: Number(cents)});
  return finishWithdrawal(wallet, transfer);
}
async function confirmWithdrawal(id) {
  const [wallet, transfer] = await Promise.all([api.get('/api/wallet'), withdrawalState(id)]);
  return finishWithdrawal(wallet, transfer);
}

// Mutations are replayed by orders.js with the same operationId after a timeout;
// remember each outcome so a replay never posts or pays twice.
const inflight = new Map();
function receipts() { const all = read(RECEIPTS, {}), now = Date.now(), kept = {}; for (const [k, v] of Object.entries(all)) if (now - v.at < MS_DAY) kept[k] = v; return kept; }
async function once(operationId, run) {
  if (!operationId) return run();
  const done = receipts()[operationId];
  if (done) return done.value;
  if (inflight.has(operationId)) return inflight.get(operationId);
  const p = run().then(value => { const all = receipts(); all[operationId] = {at: Date.now(), value}; write(RECEIPTS, all); return value; });
  inflight.set(operationId, p);
  const clear = () => inflight.delete(operationId);
  p.then(clear, clear);
  return p;
}

async function dispatch(name, data) {
  if (name === 'orderService') {
    const value = await once(data.action === 'sync' || data.action === 'wallet' ? '' : data.operationId, () => orderAction(data));
    if (data.action === 'deleteAccount') return {ok:true, value, snapshot:null};
    const state = await snapshot(data.viewTripId, data.action === 'message' ? data.id : data.viewChatId, data.action === 'profileComplete' ? value : null);
    const placed = data.action === 'create' && data.tripId && !value.paymentPending
      && state.requests.find(row => row.id === value.id && row.isMine);
    if (placed && placed.runnerId !== data.tripId && placed.offeredTripId !== data.tripId) {
      value.tripFallback = true;
    }
    return {ok: true, value, snapshot: state};
  }
  if (name === 'studentAccount') return {ok: true, ...(await account(data.action, data))};
  if (name === 'newsService') {
    if (data.action === 'activityConfig') return {ok: true, config: await loyalty.activityConfig()};
    return data.action === 'newsList' ? {ok: true, items: []} : {ok: true};
  }
  throw unsupported();
}
async function callFunction({name, data = {}}) {
  try { return {result: await dispatch(name, data)}; }
  catch (e) {
    // Network failures stay thrown so orders.js can retry; everything else is a business answer.
    if (e && e.code === 'NETWORK') throw e;
    if (!e || !e.business) console.error('XP backend', name, data.action, e);
    return {result: {ok: false, error: message(e)}};
  }
}

module.exports = {
  callFunction, uploadFile, linkedPublicOrder, completedHistory, completedHistoryRow: id => completedById.get(id),
  deleteFile: async () => ({fileList: []}),
  getTempFileURL: async ({fileList = []}) => ({fileList: fileList.map(x => { const id = typeof x === 'string' ? x : x.fileID; return {fileID: id, tempFileURL: api.absolute(id)}; })}),
  _test: {toRequest, body, status, splitDorm, walletView, payOrder}
};
