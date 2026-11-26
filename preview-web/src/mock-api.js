'use strict';
// A stand-in for the team's REST server (https://pararouter.cn, repo xjtlu-run-no-run) so the browser
// preview can sign in and apply to be a runner. The preview's wx.request comes here instead of the network.
// Accounts are shared by the three phones (kept with the simulated cloud in this browser). Endpoints the
// preview does not model yet answer with an empty, valid result so pages still render.
(function () {
  const EMPTY = { list: [], orders: [], trips: [], messages: [], conversations: [], notifications: [], coupons: [], items: [], applications: [], unread: 0, count: 0, total: 0, has_more: false, balance: 0 };

  function users(cloud) { const c = cloud.state.collections; return (c.xp_users = c.xp_users || {}); }
  // The token names the phone's own WeChat user, like a real session token would.
  const tokenFor = openid => 'preview-token.' + openid;
  const openidOf = header => { const m = /^Bearer preview-token\.(.+)$/.exec((header && (header.Authorization || header.authorization)) || ''); return m ? m[1] : ''; };
  function publicUser(u) {
    const { openid, ...rest } = u;
    return rest;
  }

  function handle(cloud, phoneOpenid, method, path, body, header) {
    const all = users(cloud), now = Date.now();
    const route = path.split('?')[0];
    const whoAmI = () => { const id = openidOf(header); return id && all[id]; };
    const save = () => cloud.persist();

    if (route === '/api/auth/login' && method === 'POST') {
      // wx.login's code in the preview is "preview-<openid>"; fall back to the calling phone.
      const openid = String(body.code || '').replace(/^preview-/, '') || phoneOpenid;
      let u = all[openid];
      if (!u) {
        const n = Object.keys(all).length + 1;
        u = all[openid] = { id: n, openid, nickname: body.nickname || '', avatar_url: '', phone: '', dorm: '', dorm_room: '', pickup: '', runner_status: 'none', student_no: '', real_name: '', gender: '', created_at: now };
        // The Runner phone arrives already approved so jobs can be taken straight away.
        if (openid === 'preview-runner') Object.assign(u, { nickname: u.nickname || 'Leo Runner', real_name: 'Leo Runner', student_no: '2251001', gender: 'male', phone: '13800000002', runner_status: 'approved' });
        save();
      } else if (body.nickname && !u.nickname) { u.nickname = body.nickname; save(); }
      return { status: 200, data: { ok: true, token: tokenFor(openid), user: publicUser(u) } };
    }
    if (route.startsWith('/api/auth/admin-login')) return { status: 200, data: { ok: false, error: 'PREVIEW', message: 'Admin sign-in is not available in the preview.' } };

    const u = whoAmI();
    if (route.startsWith('/api/') && !u && !['/api/news', '/api/loyalty/rules', '/api/trips'].includes(route) && !(route === '/api/orders' && method === 'GET') && !/^\/api\/orders\/\d+$/.test(route)) return { status: 401, data: { ok: false, error: 'UNAUTHORIZED', message: '请先登录' } };

    if (route === '/api/auth/me') return { status: 200, data: { ok: true, user: publicUser(u) } };
    if (route === '/api/auth/nickname' && method === 'POST') { u.nickname = String(body.nickname || '').slice(0, 30); save(); return { status: 200, data: { ok: true, user: publicUser(u) } }; }
    if (route === '/api/auth/dorm' && method === 'POST') {
      u.dorm = body.dorm || ''; u.dorm_room = body.dorm_room || ''; u.pickup = body.pickup || ''; if (body.dorm_type) u.dorm_type = body.dorm_type;
      save(); return { status: 200, data: { ok: true, user: publicUser(u) } };
    }
    if (route === '/api/auth/avatar-url' && method === 'POST') { u.avatar_url = String(body.url || ''); save(); return { status: 200, data: { ok: true, user: publicUser(u) } }; }
    if (route === '/api/runner/apply' && method === 'POST') {
      const realName = String(body.real_name || '').trim(), studentNo = String(body.student_no || '').trim(), phone = String(body.phone || '').trim();
      if (!realName || !studentNo) return { status: 200, data: { ok: false, error: 'INVALID', message: '请填写姓名和学号' } };
      if (phone && !/^1\d{10}$/.test(phone)) return { status: 200, data: { ok: false, error: 'INVALID', message: '手机号格式不正确' } };
      Object.assign(u, { real_name: realName, student_no: studentNo, gender: body.gender || '', phone: phone || u.phone, applied_at: now });
      // The preview has no staff to review applications, so they are approved straight away (as before).
      u.runner_status = 'approved'; u.reviewed_at = now;
      save(); return { status: 200, data: { ok: true, user: publicUser(u) } };
    }
    // ---- orders and trips: one shared store for all phones, so an order posted on one phone can be taken on another ----
    const c = cloud.state.collections, trips = (c.xp_trips = c.xp_trips || {}), orders = (c.xp_orders = c.xp_orders || {});
    const msgs = (c.xp_msgs = c.xp_msgs || {});
    const me = u ? u.openid : '';
    const userOf = openid => all[openid] || {};
    const iso = t => (t ? new Date(t).toISOString() : null);
    const DONE = ['confirmed', 'cancelled', 'refunded'];
    const fail = (error, message) => ({ status: 200, data: { ok: false, error, message } });
    const authNeeded = () => ({ status: 401, data: { ok: false, error: 'UNAUTHORIZED', message: '请先登录' } });
    // seed the two sample chats once, as normal orders between the Student and the Runner
    if (!c.xp_orders_seeded && all['preview-student'] && all['preview-runner']) {
      c.xp_orders_seeded = true;
      const at = m => now - m * 60000;
      orders[9001] = { id: 9001, type: 'food', status: 'accepted', title: '外卖代取', description: 'Two bags from KFC, please keep them upright', pickup_location: '丰食汇KFC外卖柜', delivery_location: '文缘 D01 3楼 302', recipient_phone: '13800000001', bags: 2, price_cents: 800, publisher_openid: 'preview-student', acceptor_openid: 'preview-runner', created_at: at(25), accepted_at: at(18) };
      orders[9002] = { id: 9002, type: 'express', status: 'confirmed', title: '快递代取', description: '', pickup_code: '8-3-7279', size: 'small', pickup_location: '翰林妈妈驿站', delivery_location: '文缘 D01 3楼 302', recipient_phone: '13800000001', price_cents: 300, publisher_openid: 'preview-student', acceptor_openid: 'preview-runner', created_at: at(1500), accepted_at: at(1490), picked_up_at: at(1460), completed_at: at(1442), confirmed_at: at(1440) };
      msgs[9001] = [
        { id: 1, from: 'preview-runner', content: 'Hi! I took your order. Heading to the KFC locker now.', at: at(17) },
        { id: 2, from: 'preview-student', content: 'Great, thank you! The code is on the order.', at: at(16) },
        { id: 3, from: 'preview-runner', content: 'Got both bags. Be there in about 8 minutes.', at: at(9) },
        { id: 4, from: 'preview-student', content: '[[uniearn-sticker:yuni-04]]', at: at(8) }
      ];
      msgs[9002] = [
        { id: 1, from: 'preview-runner', content: 'Picked up your parcel from Hanlin Mama station.', at: at(1460) },
        { id: 2, from: 'preview-runner', content: 'Left it at your door, room 302.', at: at(1442) },
        { id: 3, from: 'preview-student', content: 'Got it, thanks a lot!', at: at(1440) }
      ];
      c.xp_order_seq = Math.max(c.xp_order_seq || 0, 9002);
      save();
    }
    const involved = o => !!me && (o.publisher_openid === me || o.acceptor_openid === me);
    const unreadFor = o => (msgs[o.id] || []).filter(m => m.from !== me && !(m.read_by || []).includes(me)).length;
    // the server's order shape, as the app's toRequest() reads it
    const orderOut = o => {
      const pub = userOf(o.publisher_openid), run = o.acceptor_openid ? userOf(o.acceptor_openid) : null;
      const mine = !!me && o.publisher_openid === me, runner = !!me && o.acceptor_openid === me;
      const status = o.status === 'delivered' || o.status === 'confirmed' ? 'completed' : o.status;
      const show = mine || runner || o.status === 'pending';
      return {
        id: o.id, type: o.type, title: o.title, description: o.description || '', pickup_location: o.pickup_location || '',
        delivery_location: show ? (o.delivery_location || '') : '接单后可见', public_delivery_location: o.delivery_location || '',
        recipient_phone: mine || runner ? (o.recipient_phone || '') : '', area: o.area || '', floor: o.floor || 0, shop: o.shop || '',
        dorm_type: o.dorm_type || '', pickup_code: mine || runner ? (o.pickup_code || '') : '', size: o.size || '', size_items: o.size_items || null, bags: o.bags || 1,
        price_cents: o.price_cents, status, await_confirm: o.status === 'delivered', payment_status: 'paid',
        publisher_id: pub.id, publisher: { id: pub.id, nickname: pub.nickname || pub.real_name || '同学', avatar: pub.avatar_url || '' },
        acceptor: run ? { id: run.id, nickname: run.nickname || run.real_name || '跑手' } : null, runner_phone: run && (mine || runner) ? (run.phone || '') : '',
        is_mine: mine, is_runner: runner, unread_chat: involved(o) ? unreadFor(o) : 0,
        created_at: iso(o.created_at), accepted_at: iso(o.accepted_at), picked_up_at: iso(o.picked_up_at), completed_at: iso(o.completed_at), confirmed_at: iso(o.confirmed_at),
        closes_at: iso(o.created_at + 3600000), delivery_photo: o.delivery_photo || '', images: o.images || [],
        trip_id: o.trip_id || null, runner_trip_id: o.runner_trip_id || null,
        offered_trip_id: o.offered_trip_id || null, offer_expires_at: o.offered_trip_id ? iso(o.offer_until) : null, cancel_reason: o.cancel_reason || ''
      };
    };
    const tripOut = t => {
      const ids = t.request_ids.filter(id => orders[id] && !DONE.includes(orders[id].status));
      const used = ids.reduce((n, id) => n + (['food', 'takeout'].includes(orders[id].type) ? (orders[id].bags || 1) : 1), 0);
      const live = t.phase !== 'ended' && !(t.join_until && t.join_until < now && !ids.length && t.when === 'now');
      return { ...t, request_ids: t.request_ids.slice(), is_runner: !!me && t.runner_openid === me, remaining: Math.max(0, t.capacity - used), phase: live ? t.phase : 'ended', runner_openid: undefined };
    };

    if (route === '/api/trips' && method === 'POST') {
      if (!u) return authNeeded();
      // Like the team's server, any signed-in user may start a trip.
      const dup = Object.values(trips).find(t => t.request_key && t.request_key === body.request_key);
      if (dup) return { status: 200, data: { ok: true, ...tripOut(dup) } };
      const minutes = Number(body.duration) || 30;
      let departAt = now;
      if (body.when !== 'now' && /^\d{1,2}:\d{2}$/.test(String(body.time || ''))) {
        const hm = String(body.time).split(':').map(Number), d = new Date(now); d.setHours(hm[0], hm[1], 0, 0);
        departAt = d.getTime() < now ? d.getTime() + 86400000 : d.getTime();
      }
      const id = (c.xp_trip_seq = (c.xp_trip_seq || 0) + 1);
      const t = trips[id] = {
        id, request_key: body.request_key || '', runner_openid: me, runner_name: u.nickname || u.real_name || 'Runner', runner_avatar: u.avatar_url || '',
        category: body.category || 'takeout', route_type: body.category || 'takeout', station: body.station || '', stations: body.stations || [],
        pickup_address: body.pickupAddress || '', waypoint: body.waypoint || '', destination_type: body.destinationType || 'dorm',
        dorm: body.dorm || '', dorms: body.dorms || (body.dorm ? [body.dorm] : []), delivery_address: body.deliveryAddress || '',
        capacity: Math.max(1, Number(body.capacity) || 1), when: body.when || 'now', depart_at: departAt,
        join_until: body.when === 'now' ? now + minutes * 60000 : departAt, note: body.note || '',
        phase: 'collect', request_ids: [], created_at: now
      };
      // waiting orders picked on the Start a trip page are taken straight away
      (body.order_ids || []).map(Number).forEach(oid => {
        const o = orders[oid];
        if (o && o.status === 'pending' && o.publisher_openid !== me) { Object.assign(o, { status: 'accepted', acceptor_openid: me, accepted_at: now, runner_trip_id: id }); t.request_ids.push(oid); }
      });
      save(); return { status: 200, data: { ok: true, ...tripOut(t) } };
    }
    if (route === '/api/trips' && method === 'GET') {
      const list = Object.values(trips).map(tripOut);
      const mine = list.filter(t => t.is_runner && t.phase !== 'ended');
      // like the real server, the public list also includes trips I run (marked is_runner)
      const pub = list.filter(t => t.phase === 'collect' && t.remaining > 0 && (!t.join_until || t.join_until > now));
      // orders sent to my trips that I still have to accept or decline
      const myTripIds = new Set(Object.values(trips).filter(t => me && t.runner_openid === me).map(t => t.id));
      const offers = Object.values(orders).filter(o => o.status === 'pending' && o.offered_trip_id && myTripIds.has(o.offered_trip_id) && (!o.offer_until || o.offer_until > now)).map(orderOut);
      return { status: 200, data: { ok: true, mine, offers, public_trips: pub } };
    }
    const offerAct = /^\/api\/trips\/(\d+)\/offers\/(\d+)$/.exec(route);
    if (offerAct && method === 'POST') {
      const t = trips[offerAct[1]], o = orders[offerAct[2]];
      if (!t || !o || t.runner_openid !== me || o.offered_trip_id !== t.id || o.status !== 'pending') return fail('TRIP_OFFER_GONE', '这笔加入请求已失效，请刷新行程');
      if (body.decision === 'accept') {
        Object.assign(o, { status: 'accepted', acceptor_openid: me, accepted_at: now, runner_trip_id: t.id, offered_trip_id: null });
        if (!t.request_ids.includes(o.id)) t.request_ids.push(o.id);
      } else Object.assign(o, { offered_trip_id: null, offer_until: 0 });   // declined: the order goes to the hall
      save(); return { status: 200, data: { ok: true, order: orderOut(o) } };
    }
    const tripAct = /^\/api\/trips\/(\d+)\/(end|leave)$/.exec(route);
    if (tripAct && method === 'POST') {
      const t = trips[tripAct[1]];
      if (!t) return fail('TRIP_NOT_FOUND', '行程不存在');
      if (t.runner_openid === me) { t.phase = 'ended'; t.ended_at = now; save(); }
      return { status: 200, data: { ok: true, ...tripOut(t) } };
    }

    // ---- orders ----
    if (route === '/api/orders' && method === 'POST') {
      if (!u) return authNeeded();
      const type = ['food', 'takeout', 'express', 'night', 'other'].includes(body.type) ? body.type : 'other';   // the app sends takeaway as 'food'
      const items = body.size_items && typeof body.size_items === 'object' ? Object.values(body.size_items).reduce((n, v) => n + Number(v || 0), 0) : 0;
      const codes = String(body.pickup_code || '').split(',').filter(Boolean).length;
      // the real server prices orders itself; these follow the app's posted prices (¥4 a bag, ¥3 a parcel, ¥3 a task)
      const bags = Math.max(1, Number(body.bags) || 1), parcels = Math.max(1, items || codes || 1);
      const price = Number(body.price_cents) || (type === 'express' ? 300 * parcels : type === 'other' ? (Number(body.price) ? Math.round(Number(body.price) * 100) : 300) : 400 * bags);
      const id = (c.xp_order_seq = Math.max(9002, c.xp_order_seq || 0) + 1);
      const o = orders[id] = {
        id, type, title: String(body.title || ''), description: String(body.description || ''), pickup_location: String(body.pickup_location || ''),
        delivery_location: String(body.delivery_location || ''), recipient_phone: String(body.recipient_phone || ''), area: body.area || '', floor: Number(body.floor) || 0,
        shop: body.shop || '', dorm_type: body.dorm_type || '', pickup_code: String(body.pickup_code || ''), size: body.size || '', size_items: body.size_items || null,
        bags, price_cents: price, status: 'pending', publisher_openid: me, acceptor_openid: '', created_at: now, images: body.images || []
      };
      // joining a trip: the order is offered to that runner first (they accept or decline it in their trip)
      const t = body.trip_id && trips[body.trip_id];
      if (t && t.runner_openid !== me && tripOut(t).phase === 'collect') { o.trip_id = t.id; o.offered_trip_id = t.id; o.offer_until = now + 10 * 60000; }
      save(); return { status: 200, data: { ok: true, order: orderOut(o) } };
    }
    if (route === '/api/orders/mine') {
      if (!u) return authNeeded();
      const list = Object.values(orders).sort((a, b) => b.created_at - a.created_at);
      return { status: 200, data: { ok: true, published: list.filter(o => o.publisher_openid === me).map(orderOut), accepted: list.filter(o => o.acceptor_openid === me).map(orderOut) } };
    }
    if (route === '/api/orders' && method === 'GET') {
      const q = {};
      (path.split('?')[1] || '').split('&').filter(Boolean).forEach(kv => { const p = kv.split('='); q[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || ''); });
      const want = q.status === 'completed' ? ['delivered', 'confirmed'] : [q.status || 'pending'];
      // an order sent to a trip is ALSO in the open hall: the trip's runner can accept it, or any other runner can take it first
      const list = Object.values(orders).filter(o => want.includes(o.status)).sort((a, b) => b.created_at - a.created_at);
      return { status: 200, data: { ok: true, list: list.slice(0, Number(q.limit) || 200).map(orderOut), has_more: false } };
    }
    const one = /^\/api\/orders\/(\d+)(?:\/(accept|status|confirm-complete|cancel))?$/.exec(route);
    if (one) {
      const o = orders[one[1]], act = one[2];
      if (!o) return fail('NOT_FOUND', '订单不存在');
      if (!act && method === 'GET') return { status: 200, data: { ok: true, order: orderOut(o) } };
      if (!u) return authNeeded();
      if (act === 'accept') {
        if (u.runner_status !== 'approved') return fail('NOT_RUNNER', '请先完成跑手认证');
        if (o.publisher_openid === me) return fail('FORBIDDEN', '不能接自己发布的订单');
        if (o.status !== 'pending') return fail('ORDER_TAKEN', '这个订单已被接走');
        Object.assign(o, { status: 'accepted', acceptor_openid: me, accepted_at: now, offered_trip_id: null });
      } else if (act === 'status') {
        if (o.acceptor_openid !== me) return fail('FORBIDDEN', '只有接单的跑手可以更新进度');
        if (body.status === 'picked_up' && o.status === 'accepted') Object.assign(o, { status: 'picked_up', picked_up_at: now });
        else if (body.status === 'completed' && ['accepted', 'picked_up'].includes(o.status)) Object.assign(o, { status: 'delivered', completed_at: now, delivery_photo: body.photo || '', completion_note: body.note || '' });
        else return fail('BAD_STATUS', '订单状态已变化，请刷新');
      } else if (act === 'confirm-complete') {
        if (o.publisher_openid !== me) return fail('FORBIDDEN', '只有发布人可以确认完成');
        if (o.status !== 'delivered') return fail('NOT_COMPLETED', '订单还没送达，不能确认');
        Object.assign(o, { status: 'confirmed', confirmed_at: now });
      } else if (act === 'cancel') {
        if (o.publisher_openid === me && ['pending', 'accepted'].includes(o.status)) Object.assign(o, { status: 'cancelled', cancel_reason: body.cancel_reason || '', cancelled_at: now });
        else if (o.acceptor_openid === me && ['accepted', 'picked_up'].includes(o.status)) {
          Object.values(trips).forEach(t => { t.request_ids = t.request_ids.filter(x => x !== o.id); });
          Object.assign(o, { status: 'pending', acceptor_openid: '', accepted_at: 0, picked_up_at: 0, runner_trip_id: null });
        } else return fail('FORBIDDEN', '这个订单现在不能取消');
      } else return fail('BAD_REQUEST', '不支持的操作');
      save(); return { status: 200, data: { ok: true, order: orderOut(o) } };
    }

    // ---- order chat (any order, between its requester and its runner) ----
    const msgRoute = /^\/api\/messages\/order\/(\d+)(\/read)?$/.exec(route);
    const msgOrder = msgRoute && orders[msgRoute[1]];
    if (msgOrder && involved(msgOrder)) {
      const list = msgs[msgOrder.id] = msgs[msgOrder.id] || [];
      const closed = DONE.includes(msgOrder.status) || (msgOrder.status === 'delivered' && msgOrder.completed_at && now >= msgOrder.completed_at + 86400000);
      if (method === 'POST' && !msgRoute[2] && (body.content || body.photo || body.image)) {
        if (closed) return fail('CHAT_CLOSED', '订单已完成，聊天已关闭');
        list.push({ id: list.length + 1, from: me, content: String(body.content || ''), image: body.photo || body.image || '', at: now });
      }
      list.forEach(m => { if (m.from !== me) m.read_by = [...new Set([...(m.read_by || []), me])]; });
      save();
      return { status: 200, data: { ok: true, closed, messages: list.map(m => ({ id: m.id, content: m.content, image: m.image || '', created_at: iso(m.at), sender_id: userOf(m.from).id })) } };
    }
    if (route === '/api/messages/orders' && u) {
      const list = Object.values(orders).filter(o => involved(o) && (msgs[o.id] || []).length).map(o => {
        const l = msgs[o.id], last = l[l.length - 1];
        return { order_id: o.id, title: o.title, type: o.type, status: orderOut(o).status, last_text: last.image && !last.content ? '[Photo]' : last.content, last_at: iso(last.at), unread: unreadFor(o) };
      });
      return { status: 200, data: { ok: true, list } };
    }
    if (route === '/api/messages/unread' && u) {
      const n = Object.values(orders).filter(involved).reduce((s, o) => s + unreadFor(o), 0);
      return { status: 200, data: { ok: true, unread: n, chat: n, notifications: 0 } };
    }
    if (route === '/api/wallet') return { status: 200, data: { ok: true, balance: 0, frozen: 0, income: 0, withdrawn: 0, list: [] } };
    // Anything else: an empty success, so lists show their empty states.
    return { status: 200, data: { ok: true, ...EMPTY } };
  }

  // A small stand-in for the server's screenshot reader: pickup codes like 97-5608 / 8-3-7279 (preferring ones next to
  // 取件码), and the station line (…驿站 / …店). Returns the same fields the app reads from the real server.
  async function readScreenshot(src) {
    if (!window.PreviewOCR) throw Error('Screenshot reading is not available in this preview.');
    const dets = await window.PreviewOCR.read(String(src || '').replace(/^data:[^,]*,/, ''));
    const lines = dets.map(d => d.DetectedText);
    const text = lines.join('\n'), CODE = /(?:^|[^\d-])([A-Z]?\d{1,3}(?:-\d{1,3})?-\d{3,6})(?![\d-])/g;
    let codes = [], m;
    // 1) Pickup codes are printed BIG (digits and "-" only): take the lines that are clearly taller than normal text.
    const heights = dets.map(d => (d.ItemPolygon && d.ItemPolygon.Height) || 0).filter(Boolean).sort((a, b) => a - b);
    const normal = heights.length ? heights[Math.floor(heights.length / 2)] : 0;
    dets.forEach(d => {
      const t = String(d.DetectedText || '').replace(/\s/g, ''), h = (d.ItemPolygon && d.ItemPolygon.Height) || 0;
      const hit = /([A-Z]?\d{1,3}(?:-\d{1,3})?-\d{3,6})/.exec(t);
      // the line is (almost) only the code, and at least 1.3× the usual text height
      if (hit && normal && h >= normal * 1.3 && hit[1].length >= t.replace(/^[^\dA-Z]+|[^\d]+$/g, '').length - 1) codes.push(hit[1]);
    });
    // 2) then codes right after 取件码, then any other code-shaped text (last group 3-6 digits, so not addresses like 2-1).
    //    Big lines come first; the others are still added because the reader's line heights are not always reliable.
    const near = /(?:取件码|取货码|提货码|pickup code)[:：\s]*([A-Z]?\d{1,3}(?:\s*-\s*\d{1,3})?\s*-\s*\d{3,6})/gi;
    while ((m = near.exec(text))) codes.push(m[1].replace(/\s/g, ''));
    while ((m = CODE.exec(text))) codes.push(m[1]);
    const clean = l => l.replace(/\s+/g, '');
    // the store name, not buttons such as 联系驿站 (contact the station) or the courier line
    const station = lines.map(clean).find(l => l.length >= 5 && /驿站|店|兔喜|菜鸟|妈妈|快递站|快递柜/.test(l) && !/联系|快递员|电话|取件码|复制|快件已送达|地址|欢迎|使用|所有包裹|可查|搜索/.test(l)) || '';
    const flat = text.replace(/\s/g, ''), pickupCodes = [...new Set(codes)].sort((a, b) => flat.indexOf(a) - flat.indexOf(b));   // keep screen order
    return { pickupCode: pickupCodes[0] || '', pickupCodes, pickupPoint: station.replace(/\s+/g, ''), candidates: pickupCodes.map((code, i) => ({ id: String(i), code, point: station.replace(/\s+/g, ''), selected: true })), needsReview: pickupCodes.length ? [] : ['pickupCode'] };
  }

  window.PreviewMockApi = {
    request(phone, o) {
      const url = String(o.url || '');
      const path = url.replace(/^https?:\/\/[^/]+/, '');
      let body = o.data || {};
      if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_) { body = {}; } }
      const method = String(o.method || 'GET').toUpperCase();
      const r = handle(phone.cloud, phone.openid, method, path, body, o.header || {});
      return { statusCode: r.status, data: JSON.parse(JSON.stringify(r.data)), header: { 'Content-Type': 'application/json' } };
    },
    // Uploads (avatars, photos) keep the picture in the browser and hand back a local URL.
    upload(phone, o) {
      const src = phone.files.get(o.filePath) || o.filePath;
      // Screenshot reading (/api/ocr/parcel, /api/ocr/sms): read the picture in the browser and find codes + station.
      if (/\/api\/ocr\//.test(String(o.url || ''))) return readScreenshot(src).then(fields => ({ statusCode: 200, data: JSON.stringify({ ok: true, fields }) }));
      return { statusCode: 200, data: JSON.stringify({ ok: true, url: src }) };
    }
  };
})();
