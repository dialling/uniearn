// 合并版订单通道：把 Uniearn 的 orders.act 映射到西浦跑（XP）的 HTTP 接口。
// 价格由 XP 服务端统一计算（3 元/单，文星 3 楼及以上 +1），客户端只传地址与类型。
const api = require('./api'), store = require('./store'), campus = require('./campus');
const TYPE = { takeout: 'food', parcel: 'express', task: 'other' };
const AREAS = { wenyuan: '文缘', wenxing: '文星', wencui: '文萃', wenhui: '文荟', bafei: '芭菲' };
const AREA_ID = Object.fromEntries(Object.entries(AREAS).map(([id, zh]) => [zh, id]));
const STATION_FROM_ZH = Object.fromEntries(campus.STATIONS.map(x => [x.zh, x.value]));

function splitDorm(text) {
  const s = String(text || '').trim();
  const bafei = campus.buildingsOf('bafei').find(b => s.includes(b)) || '';
  const area = bafei ? AREAS.bafei : Object.values(AREAS).find(a => s.includes(a)) || '';
  const floor = Number((s.match(/(\d{1,2})\s*楼/) || [])[1]) || 0;
  const b = s.toUpperCase().match(/(?:^|[^A-Z0-9])([A-D]\d{2})(?=[^0-9]|$)/);
  const building = b && campus.isBuilding(b[1]) ? b[1] : '';
  if (!area && !building) return { place: true, address: /^接单后可见$/.test(s) ? '' : s };
  let room = '';
  if (building) room = s.slice(s.toUpperCase().indexOf(building, b.index) + building.length).trim();
  else if (bafei) room = s.slice(s.indexOf(bafei) + bafei.length).trim();
  else if (area === '芭菲') room = s.replace(/^芭菲/, '').replace(/\d{1,2}\s*楼/, '').trim();
  return { place: false, area, floor, dorm: building || bafei || (area === '芭菲' ? '芭菲' : ''), room };
}
function nick(name) {
  const en = (store.get() || {}).language === 'en';
  const s = String(name || '');
  return en ? s.replace(/^微信用户\s*(\d*)$/, (_, n) => 'WeChat user' + (n ? ' ' + n : '')) : s;
}

function isEn() { return (store.get() || {}).language === 'en'; }
function say(zh, en) { return isEn() ? en : zh; }
// 服务端错误只带中文 message；英文界面按错误码换成英文，中文界面保留服务端原文。
const ERROR_EN = {
  TRIP_CLOSED: 'This trip has stopped taking orders. Go back and edit your order.',
  RUNNER_REQUIRED: 'This runner can no longer take orders. Choose another trip.',
  SELF_ACCEPT: 'You cannot add your own order to your own trip.',
  TRIP_ROUTE: 'The pickup, destination or order type does not match this trip. Edit your order.',
  TRIP_ORDER_CHANGED: 'The selected order has changed. Refresh and try again.',
  TRIP_ARRIVAL: 'Your food arrives after this runner leaves.',
  TRIP_FULL: 'This trip is full. Go back and edit your order.',
  TOO_MANY_ACTIVE: 'This runner already has the maximum number of active orders.',
  TRIP_NOT_FOUND: 'Trip not found.',
  TRIP_OFFER_GONE: 'This request is no longer available. Refresh the trip.',
  TRIP_INPUT: 'Check the trip route, capacity and selected orders.',
  TRIP_TIME: 'Choose a valid departure time.',
  TRIP_HAS_ORDERS: 'This trip still has orders. Finish them first.',
  TRIP_PICKUP_REQUIRED: 'Pick up every order on this trip before delivering.',
  FORBIDDEN: 'You do not have permission to do this.',
  NOT_COMPLETED: 'The order is not delivered yet, so it cannot be confirmed.',
  COMPLAINT_OPEN: 'A report on this order is being handled. Resolve it first.',
  UNAUTHORIZED: 'Your sign-in has expired. Please sign in again.',
  NETWORK: 'Network error. Check your connection and try again.',
};
function localizeError(e) {
  if (!e || !isEn()) return e;
  const en = ERROR_EN[e.code];
  if (!en) return e;
  const out = e instanceof Error ? e : Object.assign(Error(en), e);
  out.message = en;
  return out;
}
function tripNum(v) {
  const n = Number(String(v == null ? '' : v).replace(/^xp-trip-/, ''));
  return Number.isSafeInteger(n) && n > 0 ? n : 0;
}

function addressLine(data) {
  return String(data.deliveryAddress || [data.dorm, data.room].filter(Boolean).join(' ') || data.room || '').trim();
}
function titleOf(data) {
  if (data.title) return String(data.title).slice(0, 40);
  if (data.category === 'parcel') return '快递代取';
  if (data.night) return '夜市代买';
  return '外卖代取';
}
function bodyOf(data) {
  const body = {
    type: data.night ? 'night' : (TYPE[data.category] || 'other'),
    title: titleOf(data),
    description: String(data.note || '').slice(0, 200),
    pickup_location: String(data.pickupPoint || data.station || ''),
    delivery_location: addressLine(data),
    recipient_phone: String(data.phone || ''),
    // 服务端白名单是中文名（文缘/文星/文萃/文荟/芭菲），客户端传的是 id（wenyuan…）
    area: (() => { const raw = String(data.area || '').trim(); if (!raw) return '';
      const list = require('./campus').AREAS || [];
      const hit = list.find(a => a.id === raw) || list.find(a => a.zh === raw);
      return hit ? hit.zh : raw; })(),
    floor: Number(data.floor) || 0,
    shop: String(data.shop || ''),
    dorm_type: ['male', 'female'].includes(data.dormGender) ? data.dormGender : '',
    pickup_code: (data.codes || [])[0] || ''
  };
  // 加入顺路行程：服务端只认数字 trip_id，客户端是 'xp-trip-12' 这种
  // 只认字符串/数字：页面曾把布尔标记 joinedTrip=true 当成 tripId 传进来，导致 trip_id 丢失
  if (typeof data.tripId === 'string' || typeof data.tripId === 'number') {
    const n = tripNum(data.tripId);
    if (n) body.trip_id = n;
  }
  if (data.category === 'parcel') {
    if (data.parcelSize) body.size = String(data.parcelSize);
    if (Array.isArray(data.parcelItems)) {
      body.size_items = data.parcelItems.reduce((acc, it) => { acc[it.size] = (acc[it.size] || 0) + 1; return acc; }, {});
      body.pickup_code = data.parcelItems.map(it => it.code).filter(Boolean).join(',');
    }
  }
  return body;
}
function parseTs(v) {
  if (!v) return 0;
  if (typeof v === 'number' && Number.isFinite(v)) return v > 1e11 ? v : v * 1000;
  const s = String(v).trim();
  if (/^\d+$/.test(s)) { const n = Number(s); return n > 1e11 ? n : n * 1000; }
  const iso = s.includes('T') ? s : s.replace(' ', 'T');
  // 服务端时间统一是「北京时间」的 'YYYY-MM-DD HH:MM:SS'，不带时区。
  // 之前补 'Z' 当 UTC 解析，页面上的下单/送达时间整体多了 8 小时。
  const norm = /Z|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : iso + '+08:00';
  const t = Date.parse(norm);
  return Number.isFinite(t) ? t : (Date.parse(s) || 0);
}
function myAccountId() {
  const u = require('./util').getUser() || {};
  const p = (store.get() || {}).profile || {};
  return String(u.id || u.accountId || p.accountId || '');
}
function fullAvatar(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  if (/^(https?:|wxfile:|data:|cloud:|\/assets\/)/.test(s)) return s;
  return require('./config').baseUrl + (s.startsWith('/') ? s : '/' + s);
}
function toRequest(order, opts = {}) {
  const cent = n => Math.round(Number(n || 0));
  const statusMap = {
    pending: 'waiting', accepted: 'taken', picked_up: 'collected',
    // 服务端只有 completed（跑手已送达）；正式版一直把它当「已完成」展示，
    // 这里保持一致，避免体验版一堆历史单挂在「进行中·待确认」。
    completed: 'confirmed', confirmed: 'confirmed', cancelled: 'cancelled',
    refunded: 'refunded', disputed: 'disputed'
  };
  // completed 有两种含义：等发布人确认（await_confirm / offline_unconfirmed），
  // 以及早已确认过的历史单。前者留在「待确认」，后者算已完成。
  const awaiting = order.status === 'completed' && (order.await_confirm || order.offline_unconfirmed);
  const status = order.status === 'completed' ? (awaiting ? 'delivered' : 'confirmed') : (statusMap[order.status] || 'waiting');
  const category = order.type === 'express' ? 'parcel' : (order.type === 'other' ? 'task' : 'takeout');
  const myId = myAccountId();
  const pubId = order.publisher_id != null ? String(order.publisher_id) : (order.user_id != null ? String(order.user_id) : '');
  // 服务端把接单人选在 acceptor 对象里（runner_id 是老字段）
  const runRaw = order.runner_id != null ? order.runner_id
    : (order.acceptor_id != null ? order.acceptor_id : (order.acceptor && order.acceptor.id));
  const runId = runRaw != null ? String(runRaw) : '';
  const isRunner = order.is_runner !== undefined ? !!order.is_runner : (!!myId && !!runId && runId === myId);
  const isMine = order.is_mine !== undefined
    ? !!order.is_mine
    : (pubId ? (!!myId && pubId === myId) : (!!opts.defaultMine && !isRunner));
  const id = 'xp-' + order.id;
  const codes = order.pickup_code
    ? String(order.pickup_code).split(',').map(s => s.trim()).filter(Boolean)
    : (category === 'takeout' ? [''] : []);
  const sizeItems = order.size_items && typeof order.size_items === 'object' ? order.size_items : null;
  const big = sizeItems
    ? (Number(sizeItems.large || 0) + Number(sizeItems.oversized || 0))
    : (['large', 'oversized'].includes(order.size) ? 1 : 0);
  const small = category === 'parcel'
    ? Math.max(0, Math.max(1, codes.length) - big)
    : (category === 'takeout' ? Math.max(1, Number(order.bags || 1)) : 1);
  const collected = ['collected', 'delivered', 'confirmed'].includes(status) ? codes.slice() : [];
  const createdAt = parseTs(order.created_at) || Date.now();
  const riderPhotos = Array.isArray(order.rider_photos) ? order.rider_photos : (order.rider_photo ? [order.rider_photo] : []);
  const orderPictures = Array.isArray(order.images) ? order.images : (Array.isArray(order.order_pictures) ? order.order_pictures : []);
  const realTrip = order.runner_trip_id || order.trip_id;
  const runnerId = realTrip
    ? ('xp-trip-' + realTrip)
    : (runId && ['taken', 'collected', 'delivered', 'confirmed', 'disputed'].includes(status) ? ('xp-trip-' + order.id) : null);
  const where = splitDorm(order.delivery_location);
  const publicLocation = splitDorm(order.public_delivery_location);
  const explicitRoom = String(order.room || order.dorm_room || '').trim();
  const station = STATION_FROM_ZH[order.pickup_location] || order.pickup_location || '';
  const hasDormFields = !where.place || !publicLocation.place || !!order.dorm || !!explicitRoom || /^Dorm\b/i.test(String(order.delivery_location || ''));
  const destinationType = order.destination_type || (hasDormFields || /^接单后可见$/.test(String(order.delivery_location || '').trim()) ? 'dorm' : 'place');
  const dorm = (where.place ? '' : where.dorm) || (!publicLocation.place ? publicLocation.dorm : '') || order.dorm || (destinationType === 'place' ? '' : where.address || '');
  const room = where.place ? (!publicLocation.place ? (publicLocation.room || explicitRoom) : explicitRoom) : (where.room || publicLocation.room || explicitRoom);
  const area = (where.place ? (!publicLocation.place ? AREA_ID[publicLocation.area] : '') : AREA_ID[where.area]) || order.area || '';
  const floor = Number(order.floor || order.delivery_floor) || where.floor || publicLocation.floor || 0;
  const publicRoom = publicLocation.room || '';
  const deliveryAddress = destinationType === 'place' ? (where.place ? where.address : String(order.delivery_location || '')) : String(order.delivery_location || '');
  return {
    unread: Number((order && (order.unread_chat || order.unread)) || 0),
    id, xpId: order.id,
    category,
    night: order.type === 'night',
    title: order.title || '',
    note: order.description || order.note || '',
    shop: order.shop || '',
    station,
    pickupPoint: station,
    dorm,
    room,
    publicRoom,
    deliveryAddress,
    destinationType,
    area,
    floor,
    phone: order.recipient_phone || '',
    reward: cent(
      order.price && order.price.total_cents !== undefined ? order.price.total_cents
      : order.price_cents !== undefined ? order.price_cents
      : order.reward !== undefined ? order.reward
      : (order.reward_cents || 0)) / 100,
    status,
    disputed: status === 'disputed' || !!order.disputed,
    campusId: 'sip',
    dormGender: order.dorm_type || '',
    ids: Array.isArray(order.ids) && order.ids.length ? order.ids : [id],
    codes,
    small,
    big,
    collected,
    arrived: !!order.arrived,
    photo: fullAvatar(order.delivery_photo || order.photo || ''),
    riderPhoto: riderPhotos[0] || '',
    riderPhotos,
    orderPictures,
    closesAt: parseTs(order.closes_at) || (createdAt + 3600000),
    arrivalAt: parseTs(order.food_arrival_at || order.arrival_at) || createdAt,
    createdAt,
    takenAt: parseTs(order.accepted_at || order.taken_at),
    collectedAt: parseTs(order.picked_up_at || order.collected_at),
    deliveredAt: parseTs(order.completed_at || order.delivered_at),
    confirmedAt: parseTs(order.confirmed_at),
    ownerId: pubId || (isMine ? myId : ''),
    runnerUserId: runId,
    runnerId,
    isMine,
    mine: isMine,
    isRunner,
    ownerAvatar: fullAvatar(
      (order.publisher && (order.publisher.avatar || order.publisher.avatar_url || order.publisher.avatarUrl))
      || order.publisher_avatar || order.publisher_avatar_url || order.avatar_url || order.avatar || ''
    ),
    owner: nick(
      (order.publisher && (order.publisher.nickname || order.publisher.name))
      || order.publisher_name || order.nickname || ''
    ),
    runnerName: nick(order.runner_name || (order.acceptor && order.acceptor.nickname) || ''),
    runnerPhone: order.runner_phone || '',
    history: Array.isArray(order.history) ? order.history : [],
    ...(order.offered_trip_id && order.status === 'pending' ? {
      offeredTripId: 'xp-trip-' + order.offered_trip_id,
      offerExpiresAt: parseTs(order.offer_expires_at),
    } : {})
  };
}
async function create(data) {
  const payload = bodyOf(data);
  console.log('[order] create trip_id=', payload.trip_id || 0, 'type=', payload.type);
  const res = await api.post('/api/orders', payload);
  if (!res || res.ok !== true) throw Error((res && res.message) || say('发布失败', 'Could not post the order'));
  let order = res.order || res;
  const request = toRequest(order, { defaultMine: true });
  store.update(s => { s.requests = s.requests || []; if (!s.requests.some(r => r.id === request.id)) s.requests.unshift(request); });

  // 未支付的单不算发布成功：先拉起支付，取消就把这单撤掉，避免大厅里出现空单
  if (order && order.payment_status === 'unpaid') {
    try {
      const paid = await pay(numIdOf(request.id));   // 服务端要数字 id，'xp-123' 会被判订单不存在
      if (paid && paid.paid) {
        // 主动查单：微信回调可能晚到，查单会让服务端立即记为已付，加入行程的请求才会发给跑手
        await api.get('/api/pay/status/' + numIdOf(request.id)).catch(() => null);
        const fresh = await api.get('/api/orders/' + numIdOf(request.id)).catch(() => null);
        if (fresh && (fresh.order || fresh)) order = fresh.order || fresh;
      }
    } catch (e) {
      await api.post('/api/orders/' + numIdOf(request.id) + '/cancel',
        { cancel_reason: '其他：未完成支付' }).catch(() => {});
      store.update((s) => { s.requests = (s.requests || []).filter((r) => numIdOf(r.id) !== numIdOf(request.id)); });
      const unpaid = say('支付未完成，订单未发布', 'Payment was not completed, so the order was not posted');
      const err = Error(/cancel|取消/i.test(String(e && e.message || '')) ? unpaid : (localizeError(e) && localizeError(e).message) || unpaid);
      err.code = 'PAY_CANCELLED';
      throw err;
    }
  }
  await mine().catch(() => []);
  return { id: request.id, order, request };
}
function pay(orderId) {
  return api.post('/api/pay/prepay', { order_id: Number(orderId) }).then(res => {
    if (!res || res.ok !== true) throw Error((res && res.message) || say('支付发起失败', 'Could not start the payment'));
    const payParams = res.pay;
    if (!payParams) return { offline: true };
    return new Promise((resolve, reject) => {
      wx.requestPayment({ ...payParams, success: () => resolve({ paid: true }), fail: e => reject(Error(e && e.errMsg || say('支付取消', 'Payment cancelled'))) });
    });
  });
}
async function hall() {
  // 大厅是公开接口（optionalAuth），游客也能看单；只是不会带「我的」标记
  // 已完成单分页拉全（接口单页上限 200，用 before 游标翻页）
  async function allCompleted() {
    const out = [];
    let before = 0;
    for (let i = 0; i < 10; i++) {
      const q = '/api/orders?status=completed&limit=200' + (before ? '&before=' + before : '');
      const r = await api.get(q).catch(() => ({}));
      const list = (r && (r.list || r.orders)) || [];
      out.push(...list);
      if (!(r && r.has_more) || !list.length) break;
      before = list[list.length - 1].id;
    }
    return { list: out };
  }
  const [openRes, doneRes, accRes, pickRes] = await Promise.all([
    api.get('/api/orders?status=pending').catch(() => ({})),
    allCompleted(),
    api.get('/api/orders?status=accepted&limit=50').catch(() => ({})),
    api.get('/api/orders?status=picked_up&limit=50').catch(() => ({})),
  ]);
  const pick = (r) => (r && (r.list || r.orders)) || [];
  const rows = pick(openRes).map(o => toRequest(o))
    .concat(pick(doneRes).map(o => ({...toRequest(o), status:'confirmed', done:true})))
    // 进行中·公开进度：服务端只给已接单/已取货的公开单
    .concat(pick(accRes).map(o => toRequest(o)))
    .concat(pick(pickRes).map(o => toRequest(o)));
  store.update(s => { s.publicJobs = rows; });
  return rows;
}
function syncTripsFromRequests(s, rows) {
  const existingTrips = Array.isArray(s.trips) ? s.trips : [];
  const byReq = new Map();
  for (const t of existingTrips) {
    for (const rid of (t.requestIds || [])) byReq.set(rid, t.id);
  }
  const tripMap = new Map(existingTrips.map(t => [t.id, { ...t }]));
  for (const r of rows) {
    if (!r.isRunner) continue;
    const tid = byReq.get(r.id) || r.runnerId || ('xp-trip-' + (r.xpId || r.id));
    r.runnerId = tid;
    let t = tripMap.get(tid);
    if (!t) {
      t = {
        id: tid, campusId: r.campusId || 'sip', universityId: 'xjtlu',
        category: r.category || 'takeout', station: r.station || '', dorm: r.dorm || '',
        capacity: 1, depart: 'Now', phase: r.status === 'taken' ? 'collect' : (r.status === 'collected' ? 'deliver' : 'done'),
        requestIds: [r.id], cancelled: false, createdAt: r.takenAt || r.createdAt || Date.now()
      };
      tripMap.set(tid, t);
    } else if (!(t.requestIds || []).includes(r.id)) {
      t.requestIds = (t.requestIds || []).concat(r.id);
      t.capacity = Math.max(t.capacity || 1, t.requestIds.length);
    }
  }
  s.trips = [...tripMap.values()];
}
async function mine() {
  if (!require('./util').getToken()) return [];
  const res = await api.get('/api/orders/mine');
  // 服务端返回的是 { published, accepted }，不是 list；之前只读 list 导致
  // 「我发布的 / 我接的单」都空掉，只剩本地残留的一单。
  const published = (res && res.published) || [];
  const accepted = (res && res.accepted) || [];
  // 同一单可能既是我发布、又被我自己接下（顺路行程里自己加自己的单）。
  // 之前 accepted 会整行覆盖 published，isMine 变 false，导致「我发布的」里看不到。
  const merged = new Map();
  published.forEach((o) => { const r = toRequest(o, { defaultMine: true }); merged.set(r.id, r); });
  accepted.forEach((o) => {
    const r = toRequest(o, { defaultMine: false });
    const existing = merged.get(r.id);
    if (existing) { existing.isRunner = true; existing.runnerId = r.runnerId || existing.runnerId; }
    else { r.isRunner = true; r.mine = false; merged.set(r.id, r); }
  });
  const rows = [...merged.values()];
  store.update(s => {
    const existingTrips = Array.isArray(s.trips) ? s.trips : [];
    const byReq = new Map();
    for (const t of existingTrips) {
      for (const rid of (t.requestIds || [])) byReq.set(rid, t.id);
    }
    rows.forEach(r => { if (byReq.has(r.id)) r.runnerId = byReq.get(r.id); });
    s.requests = rows;
    syncTripsFromRequests(s, rows);
  });
  return rows;
}
// 聊天对象＝订单里的另一方。runnerId 可能是 'xp-trip-12' 这类本地 id，
// 传给 /api/messages/peer 前必须还原成数字用户 ID。
function peerOf(row) {
  if (!row) return 0;
  const raw = row.isRunner ? row.ownerId : (row.runnerUserId || row.runnerId);
  const n = Number(String(raw == null ? '' : raw).replace(/[^0-9]/g, ''));
  return Number.isSafeInteger(n) && n > 0 ? n : 0;
}

// 没有本地行时回退到订单详情，用 publisher_id / acceptor_id 算出对方
async function resolvePeer(reqId, row) {
  let peer = peerOf(row);
  if (peer) return peer;
  const me = Number((require('./util').getUser() || {}).id) || 0;
  const data = await api.get('/api/orders/' + numIdOf(reqId)).catch(() => null);
  const o = (data && (data.order || data)) || {};
  const acc = Number(o.acceptor_id != null ? o.acceptor_id : (o.acceptor && o.acceptor.id)) || 0;
  const pub = Number(o.publisher_id != null ? o.publisher_id : (o.publisher && o.publisher.id)) || 0;
  if (acc && acc !== me) return acc;
  if (pub && pub !== me) return pub;
  // 订单 id 可能来自行程（不是订单号）或已查不到：退回会话列表，
  // 用订单号匹配，退不到就取唯一那条会话。
  const conv = await api.get('/api/messages/conversations').catch(() => null);
  const list = (conv && (conv.list || conv.conversations)) || [];
  const target = numIdOf(reqId);
  const hit = list.find((c) => Array.isArray(c.orderIds) && c.orderIds.includes(target))
    || list.find((c) => c.latestOrder && c.latestOrder.id === target)
    || (list.length === 1 ? list[0] : null);
  return hit && hit.peerId ? Number(hit.peerId) : 0;
}

async function loadMessages(reqId, peerId, keepLocal) {
  if (!require('./util').getToken()) return [];
  const myId = Number((require('./util').getUser() || {}).id) || 0;
  // 聊天按订单隔离：先走 /api/messages/order/:id，只有拿不到订单号时才退回按人
  const orderId = numIdOf(reqId);
  let res = orderId ? await api.get('/api/messages/order/' + orderId).catch(() => null) : null;
  if (!res || !(res.messages || res.list)) {
    if (!peerId) return [];
    res = await api.get('/api/messages/peer/' + encodeURIComponent(String(peerId))).catch(() => ({}));
  }
  const rows = (res && (res.messages || res.list)) || [];
  const out = rows.map((m) => ({
    id: m.id, text: m.content || '', photo: fullAvatar(m.image || ''),
    at: parseTs(m.created_at), mine: Number(m.sender_id) === myId,
  }));
  if (!out.length && keepLocal) return out;   // 服务端还没读到时别把刚发的气泡抹掉
  const target = numIdOf(reqId);
  store.update((s) => {
    (s.requests || []).forEach((r) => {
      if (numIdOf(r.id) !== target) return;
      r.messages = out;
      // 打开会话即视为已读：清掉红点计数
      r.unread = 0; r.supportUnread = 0;
    });
  });
  return out;
}

async function loadSupport() {
  if (!require('./util').getToken()) return [];
  const res = await api.get('/api/cs/messages').catch(() => ({}));
  const rows = (res && res.list) || [];
  const messages = rows.map((r) => ({
    id: r.id, text: r.content || '', photo: fullAvatar(r.image || ''),
    at: parseTs(r.created_at), mine: r.direction === 'user',
  }));
  store.update((s) => { s.supportTickets = [{ id: 'cs', orderId: null, messages }]; });
  return messages;
}
async function syncLoyalty() {
  if (!require('./util').getToken()) return null;
  const state = store.get();
  const accountId = state.profile && state.profile.accountId;
  if (!accountId) return null;
  // 直接打 /api/loyalty/sync：xp-loyalty 在本地已有缓存的场景会走早退分支，
  // 不带回 yuni，鱼桶就会一直停在旧快照（角标永远是 1）。
  const data = await api.post('/api/loyalty/sync', {}).catch(() => null);
  if (!data) return null;
  store.update((s) => {
    if (data.progression) { s.progression = data.progression; s.progressionAccountId = accountId; }
    if (data.yuni) s.yuniPlay = data.yuni;
    if (data.rewards) s.rewards = data.rewards;
  });
  return data;
}
function tripRow(t, now) {
  const joinUntil = parseTs(t.join_until);
  const requestIds = (t.request_ids || []).map((id) => 'xp-' + id);
  // 无人加入、开放时间已过的空行程：服务端仍是 collect，但实际已结束，不再挂在「我接的单」里
  const expiredEmpty = t.is_runner && t.phase === 'collect' && !requestIds.length && !(joinUntil > now);
  return {
    id: 'xp-trip-' + t.id, xpId: Number(t.id), serverTrip: true,
    campusId: 'sip', universityId: 'xjtlu',
    category: t.category, routeType: t.route_type || t.category,
    station: t.station || '', pickupAddress: t.pickup_address || '', waypoint: t.waypoint || '',
    destinationType: t.destination_type || 'dorm', dorm: t.dorm || '', dorms: t.dorms || [],
    deliveryAddress: t.delivery_address || '',
    capacity: Number(t.capacity) || 1, remaining: Number(t.remaining) || 0,
    departAt: parseTs(t.depart_at), joinUntil, depart: 'Now',
    phase: expiredEmpty ? 'ended' : t.phase, cancelled: expiredEmpty,
    runnerName: nick(t.runner_name || ''), runnerAvatar: fullAvatar(t.runner_avatar || ''),
    isRunner: !!t.is_runner, requestIds,
  };
}
// GET /api/trips：我的行程（含订单列表）、发给我的加入请求、可加入的公开行程
async function loadTrips(strict) {
  const want = tripNum((store.get() || {}).viewTripId);
  let data;
  try { data = await api.get('/api/trips' + (want ? '?include=' + want : '')); }
  catch (e) { if (strict) throw e; return null; }
  if (!data) return null;
  const now = Date.now();
  const signedIn = !!require('./util').getToken();
  const mineTrips = (data.mine || []).map((t) => tripRow(t, now));
  const offers = signedIn ? (data.offers || []).map((o) => ({ ...toRequest(o), fromOffer: true })) : [];
  const seen = new Set();
  const publicTrips = (data.public_trips || []).filter((t) => (seen.has(t.id) ? false : (seen.add(t.id), true)))
    .map((t) => tripRow(t, now));
  store.update((s) => {
    const byId = new Map(mineTrips.map((t) => [t.id, t]));
    const claimed = new Set(mineTrips.flatMap((t) => t.requestIds));
    const kept = (s.trips || []).filter((t) => !byId.has(t.id)).map((t) => {
      // 服务端不再返回的真实行程已结束（mine 只排除 ended）
      if (signedIn && t.serverTrip && !t.cancelled) return { ...t, phase: 'ended', cancelled: true, joinUntil: 0 };
      // 同一单已归到服务端的真实行程，就别再挂在本地拼出来的行程上
      const ids = (t.requestIds || []).filter((id) => !claimed.has(id));
      return ids.length === (t.requestIds || []).length ? t : { ...t, requestIds: ids };
    }).filter((t) => t.serverTrip || (t.requestIds || []).length);
    const merged = (s.trips || []).filter((t) => byId.has(t.id)).map((t) => ({ ...t, ...byId.get(t.id) }));
    const fresh = mineTrips.filter((t) => !(s.trips || []).some((x) => x.id === t.id));
    if (signedIn) s.trips = merged.concat(fresh, kept);
    (s.requests || []).forEach((r) => { if (claimed.has(r.id)) r.runnerId = mineTrips.find((t) => t.requestIds.includes(r.id)).id; });
    const offerIds = new Set(offers.map((o) => o.id));
    s.requests = (s.requests || []).filter((r) => !(r.fromOffer && !offerIds.has(r.id)));
    for (const o of offers) {
      const i = s.requests.findIndex((r) => r.id === o.id);
      if (i < 0) s.requests.push(o);
      else if (s.requests[i].fromOffer) s.requests[i] = o;
      else Object.assign(s.requests[i], { offeredTripId: o.offeredTripId, offerExpiresAt: o.offerExpiresAt });
    }
    const pubIds = new Set(publicTrips.map((t) => t.id));
    s.openTrips = publicTrips;
    s.publicTrips = publicTrips;
    // 通过分享链接打开、但不是我的行程：放进 trips，加入页/下单页才能找到它
    if (want && pubIds.has('xp-trip-' + want) && !(s.trips || []).some((t) => t.id === 'xp-trip-' + want)) {
      s.trips = (s.trips || []).concat(publicTrips.filter((t) => t.id === 'xp-trip-' + want));
    }
  });
  return data;
}
async function sync() {
  const [h, m] = await Promise.all([hall(), mine(), loadSupport().catch(() => [])]);
  // 行程要在 mine() 之后合并：mine() 会整体替换 requests，加入请求要叠加在它上面
  await loadTrips();
  await syncLoyalty().catch(() => null);
  return { hall: h, mine: m };
}
function numIdOf(v) { return Number(String(v || '').replace(/^xp-/, '')); }
function idOf(payload) { return numIdOf(payload && payload.id); }
function normalizeXpIds(payload) {
  if (Array.isArray(payload && payload.ids) && payload.ids.length) return payload.ids.map(String);
  if (Array.isArray(payload && payload.refs) && payload.refs.length) {
    return [...new Set(payload.refs.map(x => String((x && x.requestId) || '')).filter(Boolean))];
  }
  if (payload && payload.id) return [String(payload.id)];
  return [];
}
function acceptLocally(reqIds, results) {
  const firstOrder = results && results[0] && (results[0].order || results[0]);
  const tripId = 'xp-trip-' + (firstOrder && firstOrder.trip_id ? firstOrder.trip_id : numIdOf(reqIds[0]));
  let trip;
  store.update(s => {
    s.requests = s.requests || [];
    s.publicJobs = s.publicJobs || [];
    s.trips = s.trips || [];
    const matched = [];
    for (const reqId of reqIds) {
      let row = s.requests.find(r => r.id === reqId);
      const pub = s.publicJobs.find(r => r.id === reqId);
      if (!row && pub) { row = { ...pub }; s.requests.unshift(row); }
      if (row) {
        row.status = 'taken'; row.isRunner = true; row.runnerId = tripId; row.takenAt = Date.now();
        matched.push(row);
      }
      if (pub) { pub.status = 'taken'; pub.isRunner = true; pub.runnerId = tripId; pub.takenAt = Date.now(); }
    }
    const first = matched[0] || {};
    trip = {
      id: tripId, campusId: first.campusId || 'sip', universityId: 'xjtlu',
      category: first.category || 'takeout', station: first.station || '', dorm: first.dorm || '',
      capacity: Math.max(1, reqIds.length), depart: 'Now', phase: 'collect',
      requestIds: reqIds.slice(), cancelled: false, createdAt: Date.now()
    };
    s.trips = [trip, ...s.trips.filter(t => t.id !== tripId)];
  });
  return trip;
}
function updateRequestLocally(reqId, patch) {
  store.update(s => {
    const updateRow = r => { if (r && r.id === reqId) Object.assign(r, patch); };
    (s.requests || []).forEach(updateRow);
    (s.publicJobs || []).forEach(updateRow);
  });
}
async function act(action, payload = {}) {
  try { return await runAct(action, payload); }
  catch (e) { throw localizeError(e); }
}
async function runAct(action, payload = {}) {
  const id = idOf(payload);
  const reqId = payload && payload.id ? String(payload.id) : (id ? 'xp-' + id : '');
  if (action === 'create') {
    // create() 内部已经拉起支付，这里不能再付第二次。
    // 外层 tripId 是页面最终决定（外卖晚到时可能改成发到大厅），优先于 data 里的。
    const data = { ...(payload.data || payload) };
    if (payload.data && Object.prototype.hasOwnProperty.call(payload, 'tripId')) data.tripId = payload.tripId || '';
    return create(data);
  }
  if (action === 'payOrder') return pay(id);
  if (action === 'accept' || action === 'acceptBoxes') {
    const reqIds = normalizeXpIds(payload);
    if (!reqIds.length) throw Error(say('缺少订单 ID', 'Missing order ID'));
    const results = [];
    for (const one of reqIds) {
      try {
        results.push(await api.post('/api/orders/' + numIdOf(one) + '/accept', {}));
      } catch (e) {
        // 连点/重复接单：服务端回 ALREADY_ACCEPTED 或 409。已经接过的直接当成功，
        // 顺手把大厅和我的订单刷一遍，避免卡片停在「待接单」再点又报状态已变化。
        const already = (e && (e.code === 'ALREADY_ACCEPTED' || e.status === 409))
          || /已接单|已被接|ALREADY/i.test((e && e.message) || '');
        if (!already) throw e;
        results.push({ ok: true, already: true, order: { id: numIdOf(one) } });
      }
    }
    await mine().catch(() => []);
    await hall().catch(() => []);
    const trip = acceptLocally(reqIds, results);
    return { id: trip.id, trip, results, ok: true };
  }
  if (action === 'tripOffer') {
    const row = (store.get().requests || []).find(r => r.id === reqId) || {};
    const trip = tripNum(payload.tripId || row.offeredTripId);
    if (!trip || !id) throw Error(say('这笔加入请求已失效，请刷新行程', 'This request is no longer available. Refresh the trip.'));
    const decision = payload.decision === 'accept' ? 'accept' : 'decline';
    const res = await api.post('/api/trips/' + trip + '/offers/' + id, { decision });
    if (decision === 'decline') {
      store.update(s => { s.requests = (s.requests || []).filter(r => !(r.id === reqId && r.fromOffer)); });
    }
    await mine().catch(() => []);
    await loadTrips();
    return res;
  }
  if (action === 'pickup') {
    const res = await api.post('/api/orders/' + id + '/status', { status: 'picked_up' });
    const row = (store.get().requests || []).find(r => r.id === reqId);
    const codes = row && Array.isArray(row.codes) ? row.codes.slice() : [];
    updateRequestLocally(reqId, { status: 'collected', collectedAt: Date.now(), collected: codes });
    store.update(s => {
      const t = (s.trips || []).find(x => (x.requestIds || []).includes(reqId));
      if (t && t.requestIds.every(rid => { const r = (s.requests || []).find(x => x.id === rid); return r && r.status === 'collected'; })) {
        t.phase = 'deliver';
      }
    });
    return res;
  }
  if (action === 'deliver' || action === 'taskDone') {
    const res = await api.post('/api/orders/' + id + '/status', { status: 'completed', photo: payload.photo || '', note: payload.note || '' });
    updateRequestLocally(reqId, { status: 'delivered', deliveredAt: Date.now(), ...(payload.photo ? { photo: payload.photo } : {}), ...(payload.note ? { completionNote: payload.note } : {}) });
    return res;
  }
  if (action === 'confirm') {
    const res = await api.post('/api/orders/' + id + '/confirm-complete', {});
    updateRequestLocally(reqId, { status: 'confirmed', confirmedAt: Date.now() });
    // 结单后立刻同步积分/小鱼干，喂食页和「我的」角标不用等下次冷启动
    await syncLoyalty().catch(() => null);
    return res;
  }
  if (action === 'cancel') {
    const res = await api.post('/api/orders/' + id + '/cancel', { cancel_reason: payload.reason || payload.cancelReason || '' });
    updateRequestLocally(reqId, { status: 'cancelled', cancelledAt: Date.now() });
    return res;
  }
  if (action === 'runnerCancel') {
    const res = await api.post('/api/orders/' + id + '/cancel', { cancel_reason: payload.reason || payload.cancelReason || '' });
    updateRequestLocally(reqId, { status: 'waiting', runnerId: null, isRunner: false, collected: [] });
    store.update(s => {
      for (const t of (s.trips || [])) {
        if ((t.requestIds || []).includes(reqId)) {
          t.requestIds = t.requestIds.filter(x => x !== reqId);
          if (!t.requestIds.length) t.cancelled = true;
        }
      }
    });
    return res;
  }
  if (action === 'startTrip') {
    const data = payload.data || {};
    if (data.selfRequestId) throw Error(say('请先处理自己的待接单，再发起行程。', 'Handle your own waiting order before starting a trip.'));
    const ids = (data.requestIds || []).map(numIdOf).filter(Boolean);
    const body = {
      request_key: payload.operationId || ('trip-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8)),
      order_ids: ids,
      category: data.category,
      station: data.station, stations: Array.isArray(data.stations) ? data.stations : undefined,
      pickupAddress: data.pickupAddress || '', waypoint: data.waypoint || '',
      destinationType: data.destinationType || 'dorm',
      dorm: data.dorm, dorms: Array.isArray(data.dorms) ? data.dorms : undefined,
      deliveryAddress: data.deliveryAddress || '',
      capacity: data.capacity,
      // 服务端按 when/time/duration 计算出发与截止时间（不认 depart 字段）
      when: data.when, time: data.time, duration: data.duration,
      note: data.note,
    };
    const trip = await api.post('/api/trips', body);
    const localId = 'xp-trip-' + (trip && trip.id);
    // 新建行程还没有订单，mine() 不会把它带回来；本地先存一份，行程页才能打开
    const minutes = Number(body.duration) || 0;
    store.update((st) => {
      st.trips = st.trips || [];
      st.trips = [{
        id: localId, xpId: Number(trip && trip.id) || 0, serverTrip: true, isRunner: true,
        campusId: (st.profile || {}).campusId || 'sip',
        category: body.category, station: body.station || '', dorm: body.dorm || '',
        dorms: body.dorms || (body.dorm ? [body.dorm] : []), destinationType: body.destinationType,
        deliveryAddress: body.deliveryAddress, capacity: body.capacity || 1, remaining: body.capacity || 1,
        joinUntil: body.when === 'now' && minutes ? Date.now() + minutes * 60000 : 0,
        depart: 'Now', phase: 'collect',
        requestIds: (ids || []).map((n) => 'xp-' + n), cancelled: false, createdAt: Date.now(),
      }, ...st.trips.filter((t) => t.id !== localId)];
    });
    await mine().catch(() => []);
    await loadTrips();
    return { id: localId, trip };
  }
  if (action === 'leave' || action === 'endEmpty') {
    const tripRow = (store.get().trips || []).find(t => t.id === reqId) || {};
    // 直接从大厅接的单没有服务端行程（本地按订单号拼的 xp-trip-N），不能拿去调行程接口
    const tripId = tripNum(tripRow.xpId || reqId);
    if (tripId && (tripRow.serverTrip || !tripRow.id)) {
      await api.post('/api/trips/' + tripId + (action === 'leave' ? '/leave' : '/end'), {});
    }
    store.update((st) => {
      st.openTrips = (st.openTrips || []).filter((t) => t.id !== reqId);
      st.publicTrips = (st.publicTrips || []).filter((t) => t.id !== reqId);
      st.trips = (st.trips || []).map((t) => (t.id !== reqId ? t
        : action === 'leave' ? { ...t, phase: 'deliver', joinUntil: 0 }
        : { ...t, phase: 'ended', cancelled: true, joinUntil: 0 }));
    });
    await loadTrips();
    return { ok: true };
  }
  // Yuni 钓鱼/喂食/衣柜：老版客户端就是这么调的（/api/loyalty/yuni/:action）
  if (['yuniBuy', 'yuniWear', 'yuniFish', 'yuniFeed', 'yuniTestPoints', 'yuniTestRound'].includes(action)) {
    const map = { yuniBuy: 'buy', yuniWear: 'wear', yuniFish: 'fish', yuniFeed: 'feed', yuniTestPoints: 'test-points', yuniTestRound: 'test-round' };
    // 3 秒内同参数只发一次：连点/动画重入会拿到同一个 request_key，
    // 服务端直接回放上次结果，而不是第二次报「这条鱼已经喂过」。
    const slot = Math.floor(Date.now() / 3000);
    const sig = [action, payload.index, payload.fish, payload.item, payload.slot].join(':');
    const request_key = payload.operationId || ('yuni-' + action + '-' + slot + '-' + sig.length + '-' + Math.abs(sig.split('').reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7)));
    try {
      const res = await api.post('/api/loyalty/yuni/' + map[action], {
        request_key,
        item: payload.item, slot: payload.slot, landed: payload.landed, perfect: payload.perfect,
        index: payload.index, fish: payload.fish,
      });
      await syncLoyalty().catch(() => null);
      return res;
    } catch (e) {
      if (payload.operationId && e && (e.code === 'YUNI_FISH' || e.status === 409)) {
        await syncLoyalty().catch(() => null);
        return { already: true };
      }
      throw e;
    }
  }
  if (action === 'messages') {
    const row = (store.get().requests || []).find(r => numIdOf(r.id) === numIdOf(reqId)) || {};
    return loadMessages(reqId, await resolvePeer(reqId, row));
  }
  if (action === 'message') {
    const isPhoto = !!payload.photo;
    const content = isPhoto ? '' : (payload.text || '');
    const reqRow = (store.get().requests || []).find(r => r.id === reqId);
    const peer = (await resolvePeer(reqId, reqRow)) || payload.peer || payload.with || '';
    if (id || peer) {
      // 按订单发消息（同一个人的历史对话不会串到新订单）
      const body = { content, ...(isPhoto ? { image: payload.photo } : {}) };
      await api.post(id ? '/api/messages/order/' + id : '/api/messages/peer/' + encodeURIComponent(String(peer)), body);
      // 先乐观上屏，GET 失败也不会让气泡消失
      store.update((st) => {
        (st.requests || []).forEach((r) => {
          if (numIdOf(r.id) !== numIdOf(reqId)) return;
          const list = Array.isArray(r.messages) ? r.messages : [];
          list.push({ id: 'local-' + Date.now(), text: isPhoto ? '' : content, photo: isPhoto ? payload.photo : '', at: Date.now(), mine: true });
          r.messages = list;
          r.unread = 0; r.supportUnread = 0;
        });
      });
      await loadMessages(reqId, peer, true);
      return { ok: true };
    }
    if (id) return api.post('/api/messages/order/' + id, { content, photo: payload.photo || '' });
    throw Error(say('缺少聊天对象', 'No one to message on this order'));
  }
  if (action === 'walletWithdraw') return api.post('/api/wallet/withdraw', { amount_cents: Number(payload.amount_cents) || 0 });
  if (action === 'upload') return upload(payload.filePath || payload.path);
  if (action === 'report' || action === 'orderFeedbackSubmit') {
    // 服务端只接受中文原因白名单；客户端传的是英文 id，这里做一次映射
    const RMAP = {
      'Not received': '未收到货', 'Food not ready': '未收到货',
      'Wrong bag': '其它', 'Result differs': '其它', 'Task not completed': '其它',
      'Spilled or damaged': '物品损坏或丢失', 'Seal broken': '物品损坏或丢失',
      'Runner not responding': '接单后失联', 'Customer not responding': '接单后失联',
      'Runner very late': '其它', 'Cannot find address': '其它',
      'Customer unsafe or rude': '言语骚扰',
      'Report response': '其它', 'Something else': '其它',
    };
    const rawReason = payload.reason || '';
    const serverReason = RMAP[rawReason] || (/^[\u4e00-\u9fa5]/.test(rawReason) ? rawReason : '其它');
    return api.post('/api/reports', { order_id: id, reason: serverReason, detail: payload.note || payload.detail || '', images: payload.photos || [] });
  }
  if (action === 'supportRequest' || action === 'supportMessage' || action === 'supportReply') {
    const res = await api.post('/api/cs/messages', {
      content: payload.text || '',
      image: payload.photo || '',
      type: payload.photo ? 'image' : 'text',
      topic: payload.topic || '',
    });
    await loadSupport();
    return res;
  }
  if (action === 'rewardsInit') {
    const coupons = await require('./xp-rewards').load();
    return { ok: true, coupons };
  }
  if (action === 'redeemPromo') {
    const res = await api.post('/api/coupons/redeem', { code: String(payload.code || '').trim() });
    await require('./xp-rewards').load().catch(() => []);
    return res;
  }
  if (action === 'preferences') {
    store.update(s => { s.preferences = { ...(s.preferences || {}), ...(payload.values || {}) }; });
    return { ok: true, preferences: store.get().preferences };
  }
  if (action === 'orderFeedbackRead') {
    updateRequestLocally(reqId, { supportUnread: 0 });
    return { ok: true };
  }
  if (action === 'ackLoyaltyNotice') {
    store.update(s => {
      if (s.progression && Array.isArray(s.progression.notices)) {
        s.progression.notices = s.progression.notices.filter(n => n.id !== payload.id);
      }
    });
    return { ok: true };
  }
  if (action === 'deleteAccount') {
    store.update(s => { s.profile = { ...s.profile, loggedOut: true }; });
    return { ok: true, local: true };
  }
  if (action === 'raise') throw Error('加价需要服务端接口（当前未提供）');
  if (action === 'collectCoupon' || action === 'invite') throw Error('优惠券/邀请需要服务端接口（当前未提供）');
  throw Error('该操作尚未接入西浦跑后端：' + action);
}
function upload(filePath, kind) {
  if (!filePath) return Promise.resolve('');   // 没有照片就不要发起上传（空路径必然失败）
  const token = require('./util').getToken();
  return new Promise((resolve, reject) => {
    wx.uploadFile({
      // 送达凭证必须走 /api/orders/proof（存到 /uploads/proofs/），
      // 混用 /upload 会被服务端判为 BAD_PROOF「凭证照片地址不合法」。
      url: require('./config').baseUrl + (kind === 'proof' ? '/api/orders/proof' : kind === 'avatar' ? '/api/auth/avatar' : '/api/orders/upload'),
      filePath,
      name: 'file',
      header: token ? { Authorization: 'Bearer ' + token } : {},
      success(res) {
        try {
          const d = JSON.parse(res.data || '{}');
          if (d && d.ok && d.url) resolve({ url: d.url, fileID: d.url });
          else reject(Error((d && d.message) || '上传失败'));
        } catch (e) { reject(e); }
      },
      fail(e) { reject(Error((e && e.errMsg) || '上传失败')); }
    });
  });
}
async function messageThreads(){
  const res = await api.get('/api/messages/orders').catch(() => ({ list: [] }));
  return (res.list || []).map((t) => ({
    orderId: String(t.order_id), id: 'xp-' + t.order_id, title: t.title || '',
    status: t.status || '', lastText: t.last_text || '', lastAt: parseTs(t.last_at) || 0, unread: Number(t.unread) || 0
  }));
}
module.exports = { act, create, pay, mine, hall, sync, loadTrips, support: loadSupport, upload, messageThreads, toRequest, bodyOf };
