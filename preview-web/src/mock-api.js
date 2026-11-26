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
    const me = () => { const id = openidOf(header); return id && all[id]; };
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

    const u = me();
    if (route.startsWith('/api/') && !u && !['/api/news', '/api/loyalty/rules'].includes(route)) return { status: 401, data: { ok: false, error: 'UNAUTHORIZED', message: '请先登录' } };

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
    // ---- trips: a runner starts one, everyone sees open ones, the runner can end it ----
    const c = cloud.state.collections, trips = (c.xp_trips = c.xp_trips || {});
    const tripOut = t => {
      const live = t.phase !== 'ended' && !(t.join_until && t.join_until < now && !t.request_ids.length && t.when === 'now');
      return { ...t, is_runner: t.runner_openid === u.openid, remaining: Math.max(0, t.capacity - t.request_ids.length), phase: live ? t.phase : 'ended', runner_openid: undefined };
    };
    if (route === '/api/trips' && method === 'POST') {
      // Like the team's server (see pages/trip-start a6c6685), any signed-in user may start a trip.
      const dup = Object.values(trips).find(t => t.request_key && t.request_key === body.request_key);
      if (dup) return { status: 200, data: { ok: true, ...tripOut(dup) } };
      const minutes = Number(body.duration) || 30;
      let departAt = now;
      if (body.when !== 'now' && /^\d{1,2}:\d{2}$/.test(String(body.time || ''))) {
        const [h, m] = String(body.time).split(':').map(Number), d = new Date(now); d.setHours(h, m, 0, 0);
        departAt = d.getTime() < now ? d.getTime() + 86400000 : d.getTime();
      }
      const id = (c.xp_trip_seq = (c.xp_trip_seq || 0) + 1);
      const t = trips[id] = {
        id, request_key: body.request_key || '', runner_openid: u.openid, runner_name: u.nickname || u.real_name || 'Runner', runner_avatar: u.avatar_url || '',
        category: body.category || 'takeaway', route_type: body.category || 'takeaway', station: body.station || '', stations: body.stations || [],
        pickup_address: body.pickupAddress || '', waypoint: body.waypoint || '', destination_type: body.destinationType || 'dorm',
        dorm: body.dorm || '', dorms: body.dorms || (body.dorm ? [body.dorm] : []), delivery_address: body.deliveryAddress || '',
        capacity: Math.max(1, Number(body.capacity) || 1), when: body.when || 'now', depart_at: departAt,
        join_until: body.when === 'now' ? now + minutes * 60000 : departAt, note: body.note || '',
        phase: 'collect', request_ids: (body.order_ids || []).map(Number).filter(Boolean), created_at: now
      };
      save(); return { status: 200, data: { ok: true, ...tripOut(t) } };
    }
    if (route === '/api/trips' && method === 'GET') {
      const list = Object.values(trips).map(tripOut);
      const mine = list.filter(t => t.is_runner && t.phase !== 'ended');
      // like the real server, the public list also includes trips I run (marked is_runner)
      const pub = list.filter(t => t.phase === 'collect' && t.remaining > 0 && (!t.join_until || t.join_until > now));
      return { status: 200, data: { ok: true, mine, offers: [], public_trips: pub } };
    }
    const tripAct = /^\/api\/trips\/(\d+)\/(end|leave)$/.exec(route);
    if (tripAct && method === 'POST') {
      const t = trips[tripAct[1]];
      if (!t) return { status: 200, data: { ok: false, error: 'NOT_FOUND', message: '行程不存在' } };
      if (t.runner_openid === u.openid) { t.phase = 'ended'; t.ended_at = now; save(); }
      return { status: 200, data: { ok: true, ...tripOut(t) } };
    }
    // ---- sample orders between the Student and the Runner, so order chat can be tried in the preview ----
    // 9001 is in progress (chat open); 9002 finished yesterday (chat closed: readable, no new messages).
    const student = all['preview-student'], runner = all['preview-runner'];
    const ago = m => new Date(now - m * 60000).toISOString();
    if (student && runner && !c.xp_demo_orders) {
      delete c.xp_demo_order; delete c.xp_demo_messages;
      c.xp_demo_orders = [
        { id: 9001, type: 'takeout', status: 'accepted', description: 'Two bags from KFC, please keep them upright',
          pickup_location: '丰食汇KFC外卖柜', delivery_location: '文缘 D01 3楼 302', bags: 2, price_cents: 800, created_at: ago(25), accepted_at: ago(18) },
        { id: 9002, type: 'express', status: 'completed', description: '', pickup_code: '8-3-7279', size: 'small',
          pickup_location: '翰林妈妈驿站', delivery_location: '文缘 D01 3楼 302', price_cents: 300, created_at: ago(1500), accepted_at: ago(1490), completed_at: ago(1440) }
      ];
      c.xp_demo_messages = {
        9001: [
          { id: 1, sender: 'runner', content: 'Hi! I took your order. Heading to the KFC locker now.', created_at: ago(17) },
          { id: 2, sender: 'student', content: 'Great, thank you! The code is on the order.', created_at: ago(16) },
          { id: 3, sender: 'runner', content: '', image: '/assets/yuni-feed/fish.png', created_at: ago(9) },
          { id: 4, sender: 'runner', content: 'Got both bags. Be there in about 8 minutes.', created_at: ago(9) },
          { id: 5, sender: 'student', content: '[[uniearn-sticker:yuni-04]]', created_at: ago(8) }
        ],
        9002: [
          { id: 1, sender: 'runner', content: 'Picked up your parcel from Hanlin Mama station.', created_at: ago(1460) },
          { id: 2, sender: 'runner', content: 'Left it at your door, room 302.', created_at: ago(1442) },
          { id: 3, sender: 'student', content: 'Got it, thanks a lot!', created_at: ago(1440) }
        ]
      };
      save();
    }
    const demoOrders = (student && runner && c.xp_demo_orders) || [];
    const roleOf = who => who === student ? 'student' : who === runner ? 'runner' : '';
    const unreadFor = (o, who) => (c.xp_demo_messages[o.id] || []).filter(m => m.sender !== roleOf(who) && !(m.read_by || []).includes(who.openid)).length;
    const demoFor = (o, who) => roleOf(who) ? {
      ...o, publisher_id: student.id, publisher: { id: student.id, nickname: student.nickname || student.real_name || 'Mia' },
      acceptor: { id: runner.id, nickname: runner.nickname || 'Leo Runner' }, runner_phone: runner.phone || '', recipient_phone: student.phone || '',
      is_mine: who === student, is_runner: who === runner, unread_chat: unreadFor(o, who)
    } : null;
    const closedOrder = o => ['completed', 'confirmed', 'cancelled', 'refunded'].includes(o.status);
    if (route === '/api/orders/mine') {
      const rows = roleOf(u) ? demoOrders.map(o => demoFor(o, u)) : [];
      return { status: 200, data: { ok: true, published: rows.filter(o => o.is_mine), accepted: rows.filter(o => o.is_runner) } };
    }
    const msgRoute = /^\/api\/messages\/order\/(\d+)(\/read)?$/.exec(route);
    const msgOrder = msgRoute && demoOrders.find(o => o.id === Number(msgRoute[1]));
    if (msgOrder && roleOf(u)) {
      const list = c.xp_demo_messages[msgOrder.id] = c.xp_demo_messages[msgOrder.id] || [], role = roleOf(u);
      if (method === 'POST' && !msgRoute[2] && (body.content || body.photo || body.image)) {
        if (closedOrder(msgOrder)) return { status: 200, data: { ok: false, error: 'CHAT_CLOSED', message: '订单已完成，聊天已关闭' } };
        list.push({ id: list.length + 1, sender: role, content: String(body.content || ''), image: body.photo || body.image || '', created_at: new Date(now).toISOString() });
      }
      list.forEach(m => { if (m.sender !== role) m.read_by = [...new Set([...(m.read_by || []), u.openid])]; });
      save();
      return { status: 200, data: { ok: true, closed: closedOrder(msgOrder), messages: list.map(m => ({ id: m.id, content: m.content, image: m.image || '', created_at: m.created_at, sender_id: m.sender === 'student' ? student.id : runner.id })) } };
    }
    if (route === '/api/messages/orders') {
      const titles = { 9001: 'KFC locker → D01', 9002: 'Hanlin Mama station → D01' };
      const list = roleOf(u) ? demoOrders.map(o => {
        const msgs = c.xp_demo_messages[o.id] || [], last = msgs[msgs.length - 1];
        return { order_id: o.id, title: titles[o.id] || '', status: o.status, last_text: last ? (last.image && !last.content ? '[Photo]' : last.content) : '', last_at: last && last.created_at, unread: unreadFor(o, u) };
      }) : [];
      return { status: 200, data: { ok: true, list } };
    }
    if (route === '/api/wallet') return { status: 200, data: { ok: true, balance: 0, frozen: 0, income: 0, withdrawn: 0, list: [] } };
    if (route === '/api/messages/unread') return { status: 200, data: { ok: true, unread: 0, chat: 0, notifications: 0 } };
    // Anything else: an empty success, so lists show their empty states.
    return { status: 200, data: { ok: true, ...EMPTY } };
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
      return { statusCode: 200, data: JSON.stringify({ ok: true, url: src }) };
    }
  };
})();
