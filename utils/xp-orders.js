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
    area: String(data.area || ''),
    floor: Number(data.floor) || 0,
    shop: String(data.shop || ''),
    dorm_type: ['male', 'female'].includes(data.dormGender) ? data.dormGender : '',
    pickup_code: (data.codes || [])[0] || ''
  };
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
  const runnerId = order.trip_id
    ? ('xp-trip-' + order.trip_id)
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
    photo: order.delivery_photo || order.photo || '',
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
    history: Array.isArray(order.history) ? order.history : []
  };
}
async function create(data) {
  const res = await api.post('/api/orders', bodyOf(data));
  if (!res || res.ok !== true) throw Error((res && res.message) || '发布失败');
  const order = res.order || res;
  const request = toRequest(order, { defaultMine: true });
  store.update(s => { s.requests = s.requests || []; if (!s.requests.some(r => r.id === request.id)) s.requests.unshift(request); });
  return { id: request.id, order, request };
}
function pay(orderId) {
  return api.post('/api/pay/prepay', { order_id: Number(orderId) }).then(res => {
    if (!res || res.ok !== true) throw Error((res && res.message) || '支付发起失败');
    const payParams = res.pay;
    if (!payParams) return { offline: true };
    return new Promise((resolve, reject) => {
      wx.requestPayment({ ...payParams, success: () => resolve({ paid: true }), fail: e => reject(Error(e && e.errMsg || '支付取消')) });
    });
  });
}
async function hall() {
  // 没登录就别打接口，避免启动时一串 401
  if (!require('./util').getToken()) return [];
  const [openRes, doneRes] = await Promise.all([
    api.get('/api/orders?status=pending').catch(() => ({})),
    api.get('/api/orders?status=completed&limit=50').catch(() => ({})),
  ]);
  const pick = (r) => (r && (r.list || r.orders)) || [];
  const rows = pick(openRes).map(o => toRequest(o))
    .concat(pick(doneRes).map(o => ({...toRequest(o), status:'confirmed', done:true})));
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
  const rows = published.map(o => toRequest(o, { defaultMine: true }))
    .concat(accepted.map(o => {
      const r = toRequest(o, { defaultMine: false });
      r.isRunner = true; r.mine = false;
      return r;
    }));
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
  if (!require('./util').getToken() || !peerId) return [];
  const myId = Number((require('./util').getUser() || {}).id) || 0;
  const res = await api.get('/api/messages/peer/' + encodeURIComponent(String(peerId))).catch(() => ({}));
  const rows = (res && (res.messages || res.list)) || [];
  const out = rows.map((m) => ({
    id: m.id, text: m.content || '', photo: m.image || '',
    at: parseTs(m.created_at), mine: Number(m.sender_id) === myId,
  }));
  if (!out.length && keepLocal) return out;   // 服务端还没读到时别把刚发的气泡抹掉
  const target = numIdOf(reqId);
  store.update((s) => {
    (s.requests || []).forEach((r) => { if (numIdOf(r.id) === target) r.messages = out; });
  });
  return out;
}

async function loadSupport() {
  if (!require('./util').getToken()) return [];
  const res = await api.get('/api/cs/messages').catch(() => ({}));
  const rows = (res && res.list) || [];
  const messages = rows.map((r) => ({
    id: r.id, text: r.content || '', photo: r.image || '',
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
async function sync() {
  const [h, m] = await Promise.all([hall(), mine(), loadSupport().catch(() => [])]);
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
  const id = idOf(payload);
  const reqId = payload && payload.id ? String(payload.id) : (id ? 'xp-' + id : '');
  if (action === 'create') {
    const made = await create(payload.data || payload);
    try { await pay(made.order.id); } catch (e) { made.payError = String((e && e.message) || e); }
    return made;
  }
  if (action === 'payOrder') return pay(id);
  if (action === 'accept' || action === 'acceptBoxes') {
    const reqIds = normalizeXpIds(payload);
    if (!reqIds.length) throw Error('缺少订单 ID');
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
    return res;
  }
  if (action === 'cancel') {
    const res = await api.post('/api/orders/' + id + '/cancel', { reason: payload.reason || '' });
    updateRequestLocally(reqId, { status: 'cancelled', cancelledAt: Date.now() });
    return res;
  }
  if (action === 'runnerCancel') {
    const res = await api.post('/api/orders/' + id + '/cancel', { reason: payload.reason || '' });
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
  if (action === 'leave' || action === 'endEmpty') {
    store.update(s => {
      const t = (s.trips || []).find(x => x.id === payload.id);
      if (t) {
        if (action === 'leave') { t.phase = 'deliver'; t.joinUntil = 0; }
        else t.cancelled = true;
      }
    });
    return { ok: true };
  }
  if (action === 'startTrip') {
    const data = payload.data || {};
    if (data.selfRequestId) throw Error('请先处理自己的待接单，再发起行程。');
    const ids = (data.requestIds || []).map(numIdOf).filter(Boolean);
    const body = {
      request_key: payload.operationId || ('trip-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8)),
      order_ids: ids,
      category: data.category, station: data.station, dorm: data.dorm,
      capacity: data.capacity, depart: data.depart, note: data.note,
    };
    const trip = await api.post('/api/trips', body);
    await mine().catch(() => []);
    return { id: 'xp-trip-' + (trip && trip.id), trip };
  }
  if (action === 'leave' || action === 'endEmpty') {
    const tripRow = (store.get().trips || []).find(t => t.id === reqId) || {};
    const tripId = String(tripRow.xpId || reqId).replace(/^xp-trip-/, '');
    if (tripId && /^\d+$/.test(tripId)) {
      await api.post('/api/trips/' + tripId + (action === 'leave' ? '/leave' : '/end'), {}).catch(() => {});
    }
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
    const content = payload.text || payload.photo || '';
    const reqRow = (store.get().requests || []).find(r => r.id === reqId);
    const peer = (await resolvePeer(reqId, reqRow)) || payload.peer || payload.with || '';
    if (peer) {
      await api.post('/api/messages/peer/' + encodeURIComponent(String(peer)), {
        content,
        order_id: id || undefined,
        ...(payload.photo ? { photo: payload.photo } : {})
      });
      // 先乐观上屏，GET 失败也不会让气泡消失
      store.update((st) => {
        (st.requests || []).forEach((r) => {
          if (numIdOf(r.id) !== numIdOf(reqId)) return;
          const list = Array.isArray(r.messages) ? r.messages : [];
          list.push({ id: 'local-' + Date.now(), text: content, photo: payload.photo || '', at: Date.now(), mine: true });
          r.messages = list;
        });
      });
      await loadMessages(reqId, peer, true);
      return { ok: true };
    }
    if (id) return api.post('/api/messages/order/' + id, { content, photo: payload.photo || '' });
    throw Error('缺少聊天对象');
  }
  if (action === 'walletWithdraw') return api.post('/api/wallet/withdraw', { amount_cents: Number(payload.amount_cents) || 0 });
  if (action === 'upload') return upload(payload.filePath || payload.path);
  if (action === 'report' || action === 'orderFeedbackSubmit') {
    return api.post('/api/reports', { order_id: id, reason: payload.reason || '', detail: payload.note || payload.detail || '', images: payload.photos || [] });
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
module.exports = { act, create, pay, mine, hall, sync, support: loadSupport, upload, toRequest, bodyOf };
