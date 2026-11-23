// 合并版订单通道：把 Uniearn 的 orders.act 映射到西浦跑（XP）的 HTTP 接口。
// 价格由 XP 服务端统一计算（3 元/单，文星 3 楼及以上 +1），客户端只传地址与类型。
const api = require('./api'), store = require('./store');
const TYPE = { takeout: 'food', parcel: 'express', task: 'other' };

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
  const norm = /Z|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : iso + 'Z';
  const t = Date.parse(norm);
  return Number.isFinite(t) ? t : (Date.parse(s) || 0);
}
function myAccountId() {
  const u = require('./util').getUser() || {};
  const p = (store.get() || {}).profile || {};
  return String(u.id || u.accountId || p.accountId || '');
}
function toRequest(order, opts = {}) {
  const cent = n => Math.round(Number(n || 0));
  const statusMap = {
    pending: 'waiting', accepted: 'taken', picked_up: 'collected',
    completed: 'delivered', confirmed: 'confirmed', cancelled: 'cancelled',
    refunded: 'refunded', disputed: 'disputed'
  };
  const status = statusMap[order.status] || 'waiting';
  const category = order.type === 'express' ? 'parcel' : (order.type === 'other' ? 'task' : 'takeout');
  const myId = myAccountId();
  const pubId = order.publisher_id != null ? String(order.publisher_id) : (order.user_id != null ? String(order.user_id) : '');
  const runId = order.runner_id != null ? String(order.runner_id) : '';
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
  return {
    id, xpId: order.id,
    category,
    night: order.type === 'night',
    title: order.title || '',
    note: order.description || order.note || '',
    shop: order.shop || '',
    station: order.pickup_location || '',
    pickupPoint: order.pickup_location || '',
    dorm: order.delivery_location || '',
    room: order.room || order.dorm_room || '',
    deliveryAddress: order.delivery_location || '',
    destinationType: order.destination_type || 'dorm',
    area: order.area || '',
    floor: Number(order.floor) || 0,
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
    owner: order.publisher_name || '',
    runnerName: order.runner_name || '',
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
async function sync() {
  const [h, m] = await Promise.all([hall(), mine()]);
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
    for (const one of reqIds) results.push(await api.post('/api/orders/' + numIdOf(one) + '/accept', {}));
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
  if (action === 'message') {
    const content = payload.text || payload.photo || '';
    const reqRow = (store.get().requests || []).find(r => r.id === reqId);
    const peer = payload.peer || payload.with || (reqRow && (reqRow.isMine ? reqRow.runnerUserId : reqRow.ownerId)) || '';
    if (peer) {
      return api.post('/api/messages/peer/' + encodeURIComponent(String(peer)), {
        content,
        order_id: id || undefined,
        ...(payload.photo ? { photo: payload.photo } : {})
      });
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
    return api.post('/api/cs/messages', { content: payload.text || payload.topic || '' });
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
function upload(filePath) {
  const token = require('./util').getToken();
  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url: require('./config').baseUrl + '/api/orders/upload',
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
module.exports = { act, create, pay, mine, hall, sync, upload, toRequest, bodyOf };
