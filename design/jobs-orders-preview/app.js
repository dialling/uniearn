'use strict';
// Interaction logic for the Jobs / My orders design preview. Plain DOM, no framework,
// so every block maps one-to-one onto a WXML template + setData in the mini program.
(function () {
  const { AREAS, dest, build, MIN, DAY } = window.UE_DATA;
  const A = '../../assets/';
  const G = { lang: 'en', scenario: 'busy', data: null, base: 0, t0: 0, phones: [] };
  const CANCEL_MS = 3 * MIN; // docs/cancel-window-20261107.md
  const TIPS = [1.88, 2.66, 5.55, 6.66, 8.88];
  const REASONS = [['信息填错', 'Wrong details in the order'], ['不需要了', 'Changed my mind'], ['我自己取了', 'Collected it myself'], ['跑手太慢', 'Runner too slow to pick up'], ['没人接单', 'No one took the order'], ['测试', 'Test order'], ['其他', 'Other']];
  const SORTS = [['closing', 'Closing soon', '即将截止'], ['pay', 'Highest pay', '赏金最高'], ['new', 'Newest', '最新发布']];
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const now = () => G.base + (Date.now() - G.t0);
  const L = (en, zh) => (G.lang === 'en' ? en : zh);
  const tx = o => (o ? (G.lang === 'en' ? o.en : o.zh) : '');
  const pad = n => String(n).padStart(2, '0');
  const clock = ts => { const d = new Date(ts); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
  const money = n => Number(n).toFixed(2);
  const sod = ts => { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); };
  const dayLabel = ts => { const k = Math.round((sod(now()) - sod(ts)) / DAY); if (k === 0) return L('Today', '今天'); if (k === 1) return L('Yesterday', '昨天'); const d = new Date(ts); return G.lang === 'en' ? d.getDate() + ' ' + MON[d.getMonth()] : (d.getMonth() + 1) + '月' + d.getDate() + '日'; };
  const dateTime = ts => dayLabel(ts) + ' ' + clock(ts);
  function left(ts, f) { const ms = Math.max(0, ts - now()); if (f === 'ms') { const s = Math.ceil(ms / 1000); return Math.floor(s / 60) + ':' + pad(s % 60); } const m = Math.ceil(ms / MIN); if (f === 'h' && m >= 90) return Math.round(m / 60) + L(' h', ' 小时'); return m + L(' min', ' 分钟'); }
  const cd = (ts, f, flip) => `<b data-cd="${ts}" data-f="${f}"${flip ? ' data-flip' : ''}>${left(ts, f)}</b>`;
  function byDay(list, at) { const out = []; for (const x of list.slice().sort((a, b) => at(b) - at(a))) { const k = dayLabel(at(x)); if (!out.length || out[out.length - 1][0] !== k) out.push([k, []]); out[out.length - 1][1].push(x); } return out; }

  // Line icons in the same 24px / 1.7 stroke style as assets/*-outline.svg
  const PATH = {
    takeout: '<path d="M5 8h14l-2 13H7L5 8Z"/><path d="M9 8V5a3 3 0 0 1 6 0v3"/>',
    parcel: '<path d="M3 7l9-5 9 5v10l-9 5-9-5zM3 7l9 5 9-5M12 12v10"/>',
    night: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z"/>',
    task: '<path d="M10 6h10M10 12h10M10 18h10M4 6l1.2 1.2L7.5 5M4 12l1.2 1.2L7.5 11M4 18l1.2 1.2L7.5 17"/>',
    print: '<path d="M7 8V3h10v5M7 17H5a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M7 14h10v7H7z"/>',
    shop: '<path d="M3 4h2l2.4 11h10.3L20 7H6.2"/><circle cx="9" cy="19.5" r="1.2"/><circle cx="17" cy="19.5" r="1.2"/>',
    book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5v-15ZM20 18v3H6.5"/>',
    online: '<path d="M4 5h16v11H10l-5 4v-4H4V5Z"/><path d="M8 9h8M8 12h5"/>',
    move: '<path d="M4 4h3l3 12h9"/><path d="M11 8h8v6h-6.5z"/><circle cx="9" cy="19.5" r="1.4"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    filter: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
    chev: '<path d="m9 6 6 6-6 6"/>', check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>', x: '<path d="M6 6l12 12M18 6 6 18"/>',
    lock: '<path d="M6 11h12v9H6z"/><path d="M8.5 11V8a3.5 3.5 0 0 1 7 0v3"/>',
    chat: '<path d="M4 5h16v11H10l-5 4v-4H4V5Z"/>', camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4V8Z"/><circle cx="12" cy="13" r="3.2"/>',
    shield: '<path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.500 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-4"/>',
    users: '<circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0M16 5.500a3 3 0 0 1 0 5.500M17 14.500a6 6 0 0 1 4 5.500"/>',
    sort: '<path d="M7 5v14M7 19l-3-3M7 19l3-3M17 19V5M17 5l-3 3M17 5l3 3"/>',
    pin: '<path d="M12 21s7-6.100 7-11a7 7 0 1 0-14 0c0 4.900 7 11 7 11Z"/><circle cx="12" cy="10" r="2.500"/>',
    coin: '<circle cx="12" cy="12" r="9"/><path d="M9 8l3 4 3-4M12 12v5M9 13h6"/>'
  };

  // 3D-style category icons. Each is one small SVG, so the mini program can ship them as image files.
  const ICON3D = {
    takeout: '<defs><linearGradient id="tk-f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffc27d"/><stop offset="1" stop-color="#f0802e"/></linearGradient><linearGradient id="tk-s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e2772a"/><stop offset="1" stop-color="#c25a14"/></linearGradient></defs><ellipse cx="25" cy="43.500" rx="15" ry="2.600" fill="#000" opacity=".13"/><path d="M17 17v-4.500a7 7 0 0 1 14 0V17" fill="none" stroke="#a8480f" stroke-width="2.600" stroke-linecap="round"/><path d="M9 17h26l-2 25H11L9 17Z" fill="url(#tk-f)"/><path d="M35 17l5.500-3-2.500 24.500L33 42l2-25Z" fill="url(#tk-s)"/><path d="M9 17l5.500-3h26L35 17H9Z" fill="#ffe0b5"/><path d="M12.500 20.500h4.500l-1 18h-2.300l-1.200-18Z" fill="#fff" opacity=".28"/><path d="M22 34.500c-3.600-2.400-5.400-4.400-5.400-6.600a3 3 0 0 1 5.400-1.700 3 3 0 0 1 5.400 1.700c0 2.200-1.800 4.200-5.400 6.600Z" fill="#fff" opacity=".92"/>',
    parcel: '<defs><linearGradient id="pc-l" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e3b06b"/><stop offset="1" stop-color="#cf9450"/></linearGradient><linearGradient id="pc-r" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c58a48"/><stop offset="1" stop-color="#a86f33"/></linearGradient></defs><ellipse cx="24" cy="43.500" rx="15" ry="2.600" fill="#000" opacity=".13"/><path d="M24 7l18 8-18 8L6 15l18-8Z" fill="#f6d9a8"/><path d="M6 15l18 8v19L6 34V15Z" fill="url(#pc-l)"/><path d="M24 23l18-8v19l-18 8V23Z" fill="url(#pc-r)"/><path d="M17.500 9.900l18 8v6.300l-5 2.200v-6.300l-18-8 5-2.200Z" fill="#fff" opacity=".78"/><path d="M27.500 31.500l8-3.600v5l-8 3.600v-5Z" fill="#fff" opacity=".85"/><path d="M8.500 19l3 1.300v11l-3-1.300V19Z" fill="#fff" opacity=".22"/>',
    night: '<defs><linearGradient id="nt-m" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff0a8"/><stop offset=".55" stop-color="#ffcf4a"/><stop offset="1" stop-color="#f09a1a"/></linearGradient><radialGradient id="nt-b" cx=".35" cy=".3" r=".9"><stop offset="0" stop-color="#5a56c9"/><stop offset="1" stop-color="#2b2970"/></radialGradient></defs><ellipse cx="24" cy="43.500" rx="14" ry="2.600" fill="#000" opacity=".13"/><circle cx="24" cy="23" r="18" fill="url(#nt-b)"/><path d="M9.500 14.500A18 18 0 0 1 30 6" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".25"/><path d="M29.500 11.500a12.500 12.500 0 1 0 6.500 20.500 10.500 10.500 0 0 1-6.500-20.500Z" fill="url(#nt-m)"/><path d="M27 14a10 10 0 0 0-9.500 9.500" fill="none" stroke="#fff" stroke-width="1.800" stroke-linecap="round" opacity=".6"/><path d="M34 14l1 2.600 2.600 1-2.600 1-1 2.600-1-2.600-2.600-1 2.600-1 1-2.600Z" fill="#fff"/><circle cx="13" cy="15" r="1.300" fill="#fff" opacity=".9"/><circle cx="36.500" cy="26" r="1" fill="#fff" opacity=".8"/>',
    task: '<defs><linearGradient id="ts-b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd76a"/><stop offset="1" stop-color="#eaa51c"/></linearGradient><linearGradient id="ts-c" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c9ced6"/><stop offset="1" stop-color="#8d95a1"/></linearGradient></defs><ellipse cx="24" cy="43.500" rx="14" ry="2.600" fill="#000" opacity=".13"/><rect x="11.500" y="9.500" width="28" height="33" rx="4.500" fill="#b97a0c"/><rect x="9" y="8" width="28" height="33" rx="4.500" fill="url(#ts-b)"/><rect x="13" y="13" width="20" height="24" rx="2.500" fill="#fffdf7"/><rect x="17" y="5" width="12" height="7.500" rx="2.500" fill="url(#ts-c)"/><path d="M16 20.500l2 2 3.600-3.800" fill="none" stroke="#0b9a68" stroke-width="2.200" stroke-linecap="round" stroke-linejoin="round"/><path d="M16 29l2 2 3.600-3.800" fill="none" stroke="#0b9a68" stroke-width="2.200" stroke-linecap="round" stroke-linejoin="round"/><path d="M24.500 21h6M24.500 29.500h6" stroke="#cdbf9f" stroke-width="2.200" stroke-linecap="round"/><path d="M11.500 11.500v25" stroke="#fff" stroke-width="1.600" stroke-linecap="round" opacity=".45"/>'
  };
  const TASK_KINDS = ['print', 'shop', 'book', 'online', 'move'];
  const ic3 = (n, s) => '<svg class="i3" width="' + Math.round(s * 1.5) + '" height="' + Math.round(s * 1.5) + '" viewBox="0 0 48 48">' + ICON3D[n] + '</svg>';
  const ic = (n, s = 18, w = 1.8) => ICON3D[n] ? ic3(n, s) : s >= 18 && TASK_KINDS.includes(n) ? ic3('task', s) : `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${PATH[n] || PATH.task}</svg>`;
  const yuni = pose => `${A}yuni-${pose}.png`;

  const CAT = {
    takeout: { en: 'Takeaway', zh: '外卖代取', unit: ['bag', 'bags', '袋'] },
    parcel: { en: 'Parcel', zh: '快递代取', unit: ['parcel', 'parcels', '件'] },
    night: { en: 'Night market', zh: '夜市代买', unit: ['order', 'orders', '单'] },
    task: { en: 'Task', zh: '其他任务', unit: ['task', 'tasks', '项'] }
  };
  const catIcon = o => (o.cat === 'task' ? (o.kind && PATH[o.kind] ? o.kind : 'task') : o.cat);
  const catName = o => tx(CAT[o.cat]);
  const units = (cat, n) => n + ' ' + (G.lang === 'en' ? CAT[cat].unit[n === 1 ? 0 : 1] : CAT[cat].unit[2]);
  const qtyLabel = o => (o.cat === 'task' ? (o.mode === 'online' ? L('Online help', '线上帮助') : L('Offline help', '线下帮助')) : o.sizes ? tx(o.sizes) : units(o.cat, o.qty));
  const areaName = id => tx(AREAS[id]);
  const jobTo = j => areaName(j.area) + ' ' + j.building;
  const jobFrom = j => (j.cat === 'night' ? tx(j.shop) : tx(j.from));
  const genderChip = g => (g ? `<span class="chip ${g}">${g === 'male' ? L('Male dorm', '男寝') : L('Female dorm', '女寝')}</span>` : '');
  const bucket = s => (s === 'waiting' ? 'pending' : s === 'confirmed' ? 'completed' : s === 'cancelled' || s === 'refunded' ? 'cancelled' : 'progress');
  const isPast = o => ['confirmed', 'cancelled', 'refunded'].includes(o.status);
  const endAt = o => o.t.confirmed || o.t.cancelled || o.t.refunded || o.t.created;

  // ---------------- Jobs ----------------
  function jobWhen(j) {
    if (j.cat === 'takeout') return j.arrived ? { ok: true, text: L('Food is there now', '外卖已到') + (j.deliverBy ? L(' · door by ', ' · 希望送达 ') + clock(j.deliverBy) : '') } : { text: L('Food arrives ', '预计到达 ') + clock(j.arrivalAt) };
    if (j.cat === 'night') return { text: (j.purchase === 'needs' ? L('Buy at the stall', '需到摊位下单') : L('Already ordered', '已下单')) + L(' · deliver by ', ' · 期待送达 ') + clock(j.deliverBy) };
    if (j.cat === 'parcel') return { text: L('Deliver by ', '送达截止 ') + tx(j.deadline) };
    return { text: j.dueAt ? L('Done by ', '完成截止 ') + clock(j.dueAt) : L('Time is flexible · agree in chat', '具体时间可沟通') };
  }
  const jobAt = j => j.arrivalAt || j.dueAt || j.deliverBy || now();
  function jobScope(P, ignoreArea) {
    const f = P.f, me = G.data.me, n = now();
    return G.data.jobs.filter(j => j.status === 'waiting' && (ignoreArea || ((!f.area || j.area === f.area) && (!f.building || j.building === f.building))) && (!f.gender || j.gender === f.gender) && (f.time === 'any' || jobAt(j) <= n + Number(f.time) * MIN) && (!f.limit || j.reward <= me.limit));
  }
  function jobList(P) {
    const list = jobScope(P).filter(j => P.cat === 'all' || j.cat === P.cat);
    const close = (a, b) => (a.closesAt || Infinity) - (b.closesAt || Infinity) || (b.raised || 0) - (a.raised || 0);
    return list.sort(P.sort === 'pay' ? (a, b) => b.reward - a.reward : P.sort === 'new' ? (a, b) => b.postedAt - a.postedAt : close);
  }
  function ring(frac, hot) { const c = 2 * Math.PI * 8; return `<svg class="ring" width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="10" r="8" fill="none" stroke="#e8e6df" stroke-width="2.5"/><circle cx="10" cy="10" r="8" fill="none" stroke="${hot ? '#c2410c' : '#0b7a55'}" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="${(c * Math.max(.04, Math.min(1, frac))).toFixed(1)} ${c.toFixed(1)}"/></svg>`; }
  function dueLine(j) {
    const n = now();
    if (!j.closesAt) return `<div class="due">${ic('clock', 16)}<span>${L('Posted ', '发布于 ')}${Math.max(1, Math.round((n - j.postedAt) / MIN))}${L(' min ago', ' 分钟前')}</span></div>`;
    const hot = j.closesAt - n < 15 * MIN;
    return `<div class="due ${hot ? 'hot' : ''}">${ring((j.closesAt - n) / (j.closesAt - j.postedAt), hot)}<span>${L('', '还剩 ')}${cd(j.closesAt, 'min')}${L(' left to accept', ' 可接单')}</span></div>`;
  }
  function jobChips(j) {
    const c = [];
    if (j.lobby) c.push(`<span class="chip green">${L('Lobby drop-off OK · any gender', '可送至一楼大厅 · 男女均可接')}</span>`);
    if (j.purchase === 'needs') c.push(`<span class="chip orange">${L('Upfront payment needed', '需跑手垫付')}</span>`);
    if (j.soup) c.push(`<span class="chip">${L('Soup or drinks', '含汤或饮品')}</span>`);
    if (j.fragile) c.push(`<span class="chip">${L('Fragile', '易碎')}</span>`);
    return c.length ? `<div class="chips">${c.join('')}</div>` : '';
  }
  const noteLine = j => (j.note ? `<div class="note"><b>${L('Note', '备注')}</b>${tx(j.note)}</div>` : '');
  const priceBox = j => `<div class="price"><i>¥</i>${money(j.reward)}${j.raised ? `<small>+${money(j.raised)} ${L('raised', '已加价')}</small>` : ''}</div>`;
  function jobCard(j) {
    const w = jobWhen(j), hot = j.closesAt && j.closesAt - now() < 15 * MIN;
    return `<div class="card tap" data-a="job" data-id="${j.id}">
      <div class="c-top"><div class="tile ${j.cat}">${ic(catIcon(j), 20)}</div><div class="c-kind"><b>${catName(j)}</b><span>${qtyLabel(j)}</span></div>${priceBox(j)}</div>
      ${j.cat === 'task' ? `<div class="task-title">${tx(j.title)}</div>` : `<div class="route"><div class="a">${jobFrom(j)}</div><div class="b">${jobTo(j)}${genderChip(j.gender)}</div></div>`}
      <div class="meta">${w.text}</div>
      ${jobChips(j)}${noteLine(j)}
      <div class="c-foot"><div class="due ${hot ? 'hot' : ''}">${j.closesAt ? L('Accept by ', '接单截止 ') + '<b>' + clock(j.closesAt) + '</b>' : ''}</div><button class="take" data-a="take" data-ids="${j.id}">${L('Take', '接单')}${ic('chev', 15, 2.4)}</button></div>
    </div>`;
  }
  // Your own waiting post, shown in the hall like today: dashed outline, cannot be taken.
  function ownCard(o) {
    return `<div class="card own tap" data-a="order" data-id="${o.id}">
      <div class="c-top"><div class="tile ${o.cat}">${ic(catIcon(o), 20)}</div><div class="c-kind"><b>${catName(o)}</b><span>${L('Your post', '你发布的')}</span></div><div class="price"><i>¥</i>${money(o.total)}</div></div>
      ${o.cat === 'task' ? `<div class="task-title">${tx(o.title)}</div>` : `<div class="route"><div class="a">${orderTitle(o)}</div><div class="b">${tx(o.to)}</div></div>`}
      <div class="meta">${L('Other runners can see it. You can’t take your own post.', '其他跑手能看到，自己的订单不能接。')}</div>
      <div class="c-foot"><div class="due"></div><span class="link">${L('Waiting for a runner · open your order ›', '等待跑手接单 · 查看订单 ›')}</span></div>
    </div>`;
  }
  // A job you already took, listed under “In progress” like today.
  function hallRun(r) {
    const it = r.items[0], m = runMeta(it);
    return `<div class="card tap" data-a="run" data-id="${r.id}">
      <div class="c-top"><div class="tile ${r.cat}">${ic(catIcon({ cat: r.cat, kind: it.kind }), 20)}</div><div class="c-kind"><b>${tx(CAT[r.cat])}</b><span>${m.label}</span></div><div class="price"><i>¥</i>${money(runTotal(r))}</div></div>
      ${it.title ? `<div class="task-title">${tx(it.title)}</div>` : `<div class="route"><div class="a">${tx(it.from)}</div><div class="b">${tx(it.to)}${r.items.length > 1 ? ' +' + (r.items.length - 1) : ''}</div></div>`}
      <div class="c-foot"><div class="due"></div><button class="take" data-a="run" data-id="${r.id}">${it.status === 'delivered' ? L('View order', '查看订单') : L('Continue', '继续配送')}${ic('chev', 15, 2.4)}</button></div>
    </div>`;
  }
  function groupCard(members, P) {
    const first = members[0], picked = members.filter(j => P.picked.has(j.id)), sum = picked.reduce((n, j) => n + j.reward, 0);
    const span = Math.ceil((Math.max(...members.map(j => j.arrivalAt)) - Math.min(...members.map(j => j.arrivalAt))) / MIN);
    return `<div class="card group">
      <div class="c-top"><div class="tile ${first.cat}">${ic(catIcon(first), 20)}</div><div class="c-kind"><b>${catName(first)} · ${members.length} ${L('orders', '单')}</b><span>${L('Same route · ' + span + ' min apart', '同路线 · 相差 ' + span + ' 分钟')}</span></div><span class="g-tag">${ic('users', 13, 2)}${L('ONE TRIP', '可拼单')}</span></div>
      <div class="route"><div class="a">${jobFrom(first)}</div><div class="b">${jobTo(first)}${genderChip(first.gender)}</div></div>
      ${members.map(j => `<button class="g-row ${P.picked.has(j.id) ? 'on' : ''}" data-a="pick" data-id="${j.id}" role="checkbox" aria-checked="${P.picked.has(j.id)}"><span class="box">${ic('check', 13, 3)}</span><span class="grow">${clock(j.arrivalAt)} ${L('pickup', '可取')} · ${units(j.cat, j.qty)}${j.note ? `<span>${tx(j.note)}</span>` : ''}</span><span class="fee">¥${money(j.reward)}</span></button>`).join('')}
      <div class="c-foot"><div class="due">${picked.length ? `<span>${L('Selected ' + picked.length + ' · ', '已选 ' + picked.length + ' 单 · ')}<b>¥${money(sum)}</b></span>` : `<span>${L('Tick the orders you can carry', '勾选你能顺路带的订单')}</span>`}</div><button class="take" data-a="take" data-ids="${picked.map(j => j.id).join(',')}" ${picked.length ? '' : 'disabled'}>${L('Take selected', '接所选订单')}</button></div>
    </div>`;
  }
  function yuniWay(P) {
    const me = G.data.me, f = P.f;
    if (!me.runner) return `<div class="yuni-way"><img src="${yuni('earn')}" alt=""><div class="t">${L('Earn on your way', '顺路赚点零花钱')}</div><div class="d">${L('One quick student check, then you can take any job here.', '完成一次学生认证，就能在这里接单。')}</div><button class="way-cta" data-a="gate">${L('Become a runner', '成为跑手')}</button></div>`;
    const pool = jobScope(P, true).filter(j => P.cat === 'all' || j.cat === P.cat);
    const chips = Object.keys(AREAS).map(id => `<button class="${f.area === id ? 'on' : ''}" data-a="way" data-area="${id}">${areaName(id)}<em>${pool.filter(j => j.area === id).length}</em></button>`).join('');
    return f.area
      ? `<div class="yuni-way"><img src="${yuni('happy')}" alt=""><div class="t">${L('On your way to ' + areaName(f.area), '顺路去' + areaName(f.area))}</div><div class="d">${L('Showing jobs that end there. Tap again to see everything.', '只显示送到这里的任务，再点一次查看全部。')}</div><div class="way-chips">${chips}</div></div>`
      : `<div class="yuni-way"><img src="${yuni('go')}" alt=""><div class="t">${L('Where are you heading?', '你要往哪儿走？')}</div><div class="d">${L('I’ll show the jobs on your way.', '我帮你找顺路的任务。')}</div><div class="way-chips">${chips}</div></div>`;
  }
  function jobsPage(P) {
    const D = G.data, f = P.f, open = P.jobsTab === 'open';
    const scope = jobScope(P), list = jobList(P), filterCount = [f.area, f.building, f.gender, f.time !== 'any'].filter(Boolean).length;
    const mine = filterCount ? [] : D.orders.filter(o => o.status === 'waiting' && (P.cat === 'all' || o.cat === P.cat));
    const running = filterCount || P.cat !== 'all' ? [] : D.runs.filter(r => !r.done);
    const openCount = list.length + mine.length;
    const head = `<div class="hd"><div class="hd-row"><div><div class="h1">${L('Jobs', '接单大厅')}</div><div class="sub">${open ? (openCount ? L(openCount + (openCount === 1 ? ' job open' : ' jobs open'), openCount + ' 个任务待接单') : L('No jobs available yet', '暂无待接任务')) : L(D.done.length + ' jobs completed', D.done.length + ' 个任务已完成')} · ${L('now', '当前')} <span data-now>${clock(now())}</span></div></div>
      <button class="filter-btn" data-a="filter">${ic('filter', 16)}${L('Filter', '筛选')}${filterCount ? `<b>${filterCount}</b>` : ''}</button></div>
      ${glass(P, 'jobsTab', [['open', L('Open', '待接单'), openCount], ['done', L('Done', '已完成'), D.done.length]])}</div>`;
    if (!open) {
      return head + (D.done.length ? `<div class="list-hd"><span>${L('Completed jobs appear here, newest first.', '已完成的任务按完成时间排列，最新的显示在前。')}</span></div><div class="rows">${D.done.slice().sort((a, b) => b.at - a.at).map(x => `<div class="row"><div class="tile sm ${x.cat}">${ic(catIcon(x), 18)}</div><div class="grow"><b>${x.cat === 'task' ? tx(x.title) : tx(x.from) + ' → ' + tx(x.to)}</b><span class="ok">✓ ${x.cat === 'task' ? L('Completed', '已完成') : L('Delivered', '已送达')} ${dateTime(x.at)}</span></div><div class="amt">¥${money(x.reward)}</div></div>`).join('')}</div>` : emptyBox('happy', L('No deliveries yet', '还没有完成的任务'), L('Completed jobs appear here as they are confirmed.', '已完成的任务会按时间显示在这里。')));
    }
    // The existing Type filter, moved out of the Filter panel so it is one tap away.
    const types = [['all', L('All', '全部')], ['takeout', L('Takeaway', '外卖代取')], ['parcel', L('Parcel', '快递代取')], ['night', L('Night market', '夜市代买')], ['task', L('Other', '其他')]];
    const rail = `<div class="rail">${types.map(([k, label]) => `<button class="cat ${k === 'all' ? 'plain' : ''} ${P.cat === k ? 'on' : ''}" data-a="cat" data-v="${k}">${k === 'all' ? '' : `<span class="ci ${k}">${ic(k, 14, 2)}</span>`}${label}</button>`).join('')}</div>`;
    const cards = [], seen = {};
    for (const j of list) { if (j.group) { if (seen[j.group]) { seen[j.group].push(j); continue; } seen[j.group] = [j]; cards.push(seen[j.group]); } else cards.push(j); }
    let body = cards.map(c => (Array.isArray(c) ? (c.length > 1 ? groupCard(c, P) : jobCard(c[0])) : jobCard(c))).join('') + mine.map(ownCard).join('');
    if (running.length) body += `<div class="sec">${L('In progress', '进行中')}<span>${running.length} ${L(running.length === 1 ? 'job' : 'jobs', '个任务')}</span></div>` + running.map(hallRun).join('');
    if (!openCount && !running.length) body = filterCount || P.cat !== 'all'
      ? emptyBox('think', L('No matching jobs', '没有符合条件的任务'), L('Try changing or clearing your filters.', '试试调整或清除筛选条件。'), `<button class="btn light" data-a="f-clear">${L('Clear filters', '清除筛选')}</button>`)
      : emptyBox('happy', L('Be the first to post', '来发布第一个任务吧'), L('Need a takeaway pickup, parcel pickup or a hand with something else? Post a task for campus runners to see.', '需要取外卖、拿快递，或有其他事情想请同学帮忙？发布后，跑手就能在这里看到。'), `<button class="btn" data-a="create">${L('Post a pick-up', '发布代取')}</button>`);
    const quiet = !G.data.jobs.some(j => j.status === 'waiting') && !mine.length;
    return head + (quiet ? '' : rail) + body;
  }
  function emptyBox(pose, title, text, extra) { return `<div class="empty"><img src="${yuni(pose)}" alt=""><div class="t">${title}</div><div class="d">${text}</div>${extra ? `<div style="display:flex">${extra}</div>` : ''}</div>`; }
  function glass(P, key, tabs) {
    const i = tabs.findIndex(t => t[0] === P[key]), from = P.thumb[key] === undefined ? i : P.thumb[key];
    P.thumb[key] = i;
    return `<div class="glass"><span class="thumb" data-to="${i}" style="transform:translateX(${from * 100}%)"></span>${tabs.map(t => `<button class="${t[0] === P[key] ? 'on' : ''}" data-a="${key}" data-v="${t[0]}">${t[1]}<em>${t[2]}</em></button>`).join('')}</div>`;
  }

  // ---------------- My orders: customer side ----------------
  const stepsFor = o => (o.cat === 'task' ? [L('Posted', '已发布'), L('Taken', '已接单'), L('Finished', '已提交'), L('Confirmed', '已确认')] : [L('Posted', '已发布'), L('Taken', '已接单'), L('Picked up', '已取件'), L('Delivered', '已送达'), L('Done', '已完成')]);
  const inWindow = o => o.status === 'taken' && now() < o.t.taken + CANCEL_MS;
  function orderMeta(o) {
    const task = o.cat === 'task', deliveredStep = task ? 2 : 3, r = o.runner || '';
    switch (o.status) {
      case 'waiting': return o.returnedBy
        ? { cls: 'wait', pose: 'look', step: 0, moving: true, label: L('Finding another runner', '正在重新匹配跑手'), hint: L(o.returnedBy + ' returned this order. It is still active at the same offer, not cancelled.', o.returnedBy + ' 已把订单退回大厅。订单仍在进行，并未取消，赏金不变。') }
        : { cls: 'wait', pose: 'wave', step: 0, moving: true, label: L('Waiting for a runner', '等待跑手接单'), hint: o.closesAt ? L('On the job board now. Auto-cancels in ', '已出现在接单大厅。') + (G.lang === 'en' ? `<span class="hot">${cd(o.closesAt, 'min')}</span> if nobody takes it.` : `<span class="hot">${cd(o.closesAt, 'min')}</span>内无人接单将自动取消。`) : L('On the job board now. Parcel orders stay open until someone takes them.', '已出现在接单大厅。快递订单会一直保留到有人接单。') };
      case 'taken': return { cls: 'go', pose: 'go', step: 1, moving: true, label: L('Runner accepted', '跑手已接单'), hint: inWindow(o) ? L(r + ' accepted. You can still cancel for ', r + ' 已接单，') + (G.lang === 'en' ? cd(o.t.taken + CANCEL_MS, 'ms', true) + '.' : cd(o.t.taken + CANCEL_MS, 'ms', true) + ' 内仍可取消。') : task ? L(r + ' is on it · done by ' + clock(o.dueAt), r + ' 正在处理 · 完成截止 ' + clock(o.dueAt)) : L(r + ' is arranging pickup · door by ' + clock(o.doorBy), r + ' 正在安排取件 · 希望送达 ' + clock(o.doorBy)) };
      case 'collected': return { cls: 'go', pose: 'deliver', step: 2, moving: true, label: L('On the way', '配送中'), hint: L(r + ' picked it up at ' + clock(o.t.collected) + ' · door by ' + clock(o.doorBy), r + ' ' + clock(o.t.collected) + ' 已取件 · 希望送达 ' + clock(o.doorBy)) };
      case 'delivered': return { cls: 'act', pose: 'happy', step: deliveredStep, need: true, label: L('Delivered · please check', '已送达 · 请确认'), hint: L('Delivered ' + clock(o.t.delivered) + (o.drop ? ' · ' + tx(o.drop).toLowerCase() : '') + '. Auto-confirms in ', clock(o.t.delivered) + ' 已送达' + (o.drop ? ' · ' + tx(o.drop) : '') + '，') + cd(o.autoAt, 'h') + L('.', '后自动确认。') };
      case 'disputed': return { cls: 'warn', pose: 'worried', step: deliveredStep, warn: true, label: L('Issue under review', '已反馈问题 · 审核中'), hint: L('“' + tx(o.issue) + '” reported. The payout is held and we’ll resolve it by ' + dateTime(o.holdUntil) + '.', '已反馈「' + tx(o.issue) + '」，赏金已冻结，我们将在 ' + dateTime(o.holdUntil) + ' 前处理。') };
      case 'confirmed': return { cls: 'go', pose: 'party', step: stepsFor(o).length - 1, label: o.auto ? L('Automatically confirmed', '已自动确认') : L('Completed', '已完成'), hint: L('This order is complete. You can find it in your order history.', '本单已完成，可在历史订单中查看记录。') };
      case 'cancelled': return { cls: 'mute', pose: 'sleep', label: L('Cancelled', '已取消'), hint: L('Cancel reason: ' + tx(o.reason) + '. Demo refund ¥' + money(o.total) + '.', '取消原因：' + tx(o.reason) + '。模拟退款 ¥' + money(o.total) + '。') };
      default: return { cls: 'mute', pose: 'oops', label: o.why === 'review' ? L('Review resolved · refunded', '审核完成 · 已退款') : L('No runner · auto-cancelled', '无人接单 · 已自动取消'), hint: o.why === 'review' ? L('Our review ended with a simulated refund of ¥' + money(o.total) + '.', '审核完成，已模拟退款 ¥' + money(o.total) + '。') : L('No runner took it within 1 hour. Demo refund ¥' + money(o.total) + '.', '1 小时无人接单，已自动取消。模拟退款 ¥' + money(o.total) + '。') };
    }
  }
  function track(labels, m) { return `<div class="track">${labels.map((l, i) => `<div class="st ${i < m.step ? 'done' : ''} ${i === m.step ? 'now' + (m.moving ? ' moving' : '') + (m.warn ? ' warn' : '') : ''}">${i === m.step ? `<img src="${yuni(m.pose)}" alt="">` : ''}${l}</div>`).join('')}</div>`; }
  const orderTitle = o => (o.cat === 'task' ? tx(o.title) : o.cat === 'night' ? tx(o.shop) : tx(o.from));
  const orderSub = o => catName(o) + (o.cat === 'task' ? '' : ' · ' + qtyLabel(o));
  function msgNotice(o) { return o.unread ? `<div class="msg"><span class="grow"><b>${o.runner}:</b> ${tx(o.unread)}</span><button class="reply" data-a="reply" data-id="${o.id}">${L('Got it, thanks!', '收到，谢谢！')}</button></div>` : ''; }
  function orderCard(o) {
    const m = orderMeta(o);
    return `<div class="card tap" data-a="order" data-id="${o.id}">
      <div class="o-top"><span class="status ${m.cls}"><i></i>${m.label}</span><span class="o-time">${L('Posted ', '发布于 ')}${clock(o.t.created)}</span></div>
      <div class="c-top"><div class="tile sm ${o.cat}">${ic(catIcon(o), 18)}</div><div class="o-title"><b>${orderTitle(o)}</b><span>${orderSub(o)}</span></div><div class="price sm"><i>¥</i>${money(o.total)}</div></div>
      ${track(stepsFor(o), m)}
      <div class="next"><span>${m.hint}</span></div>${msgNotice(o)}
      ${o.status === 'delivered' ? `<div class="acts"><button class="btn" data-a="order" data-id="${o.id}">${L('Check and confirm', '查看并确认')}</button></div>` : ''}</div>`;
  }
  function pastRow(o) {
    const done = o.status === 'confirmed';
    const text = done ? `<span class="ok">✓ ${o.auto ? L('Auto-confirmed', '已自动确认') : L('Completed', '已完成')} ${dateTime(endAt(o))}</span>` : `<span>${o.status === 'cancelled' ? L('Cancelled · ', '已取消 · ') + tx(o.reason) : o.why === 'review' ? L('Review resolved · simulated refund', '审核完成 · 模拟退款') : L('No runner in 1 hour · auto-cancelled', '1 小时无人接单，已自动取消')}</span>`;
    return `<div class="row" data-a="order" data-id="${o.id}"><div class="tile sm ${done ? o.cat : 'mute'}">${ic(catIcon(o), 18)}</div><div class="grow"><b>${orderTitle(o)}</b>${text}</div><div><div class="amt ${done ? '' : 'zero'}">¥${done ? money(o.total) : '0.00'}</div>${o.cat !== 'task' ? `<button class="again" data-a="again">↻ ${L('Again', '再来一单')}</button>` : ''}</div></div>`;
  }
  function chipRail(P, items) { return `<div class="rail">${items.filter(c => c[0] === 'all' || c[2]).map(c => `<button class="cat plain ${P.chip === c[0] ? 'on' : ''}" data-a="chip" data-v="${c[0]}">${c[1]}<em>${c[2]}</em></button>`).join('')}</div>`; }
  function ordersPage(P) {
    const D = G.data, own = D.orders, runs = D.runs, req = P.ordersTab === 'requested';
    const head = `<div class="hd"><div class="h1">${L('My orders', '我的订单')}</div><div class="sub">${req ? L('Things you asked other students to bring', '你请其他同学帮忙代取的订单') : L('Jobs you took for other students', '你帮其他同学接的任务')}</div>
      ${glass(P, 'ordersTab', [['requested', L('I requested', '我发布的'), own.filter(o => !isPast(o)).length], ['running', L('I’m running', '我接的单'), runs.filter(r => !r.done).length]])}</div>`;
    return head + (req ? requestedTab(P) : runningTab(P));
  }
  function requestedTab(P) {
    const own = G.data.orders;
    if (!own.length) return `<div class="empty"><img src="${yuni('party')}" alt=""><div class="t">${L('No orders yet', '还没有订单')}</div><div class="d">${L('Post one and follow it here, step by step. Finished orders keep their receipt.', '发布订单后，可以在这里一步步查看进度。完成的订单会保留记录。')}</div>
      <div class="howto"><div><b>1</b>${L('Posted', '已发布')}</div><div><b>2</b>${L('Taken', '已接单')}</div><div><b>3</b>${L('Picked up', '已取件')}</div><div><b>4</b>${L('Delivered', '已送达')}</div></div>
      <button class="entry" data-a="post"><span class="tile sm takeout">${ic('takeout', 18)}</span>${L('Bring my takeaway', '外卖代取')}<span>${L('¥4 a bag', '每袋 ¥4')}</span></button>
      <button class="entry" data-a="post"><span class="tile sm parcel">${ic('parcel', 18)}</span>${L('Bring my parcel', '快递代取')}<span>${L('from ¥3 a box', '每件 ¥3 起')}</span></button>
      <button class="entry" data-a="post"><span class="tile sm night">${ic('night', 18)}</span>${L('Night market', '夜市代买')}<span>${L('¥4 an order', '每单 ¥4')}</span></button>
      <button class="entry" data-a="post"><span class="tile sm task">${ic('task', 18)}</span>${L('Something else', '其他需求')}<span>${L('your price', '赏金自定')}</span></button></div>`;
    P.pastFilter = P.pastFilter || 'all';
    const rank = o => (o.status === 'delivered' ? 0 : 1);
    const active = own.filter(o => !isPast(o)).sort((a, b) => rank(a) - rank(b));
    const past = own.filter(o => isPast(o) && (P.pastFilter === 'all' || o.status === 'confirmed')).sort((a, b) => endAt(b) - endAt(a));
    let body = '';
    if (active.length) body += `<div class="sec">${L('Active', '进行中')}<span>${active.length}</span></div>` + active.map(orderCard).join('');
    body += `<div class="sec">${L('Past', '历史订单')}<span>${L('Tap ↻ to post again', '点 ↻ 再来一单')}</span></div><div style="padding:0 16px">${glass(P, 'pastFilter', [['all', L('All', '全部'), ''], ['completed', L('Completed', '已完成'), '']])}</div>`;
    if (past.length) body += `<div class="rows">${past.map(pastRow).join('')}</div>`;
    return body;
  }

  // ---------------- My orders: runner side ----------------
  const runSteps = it => (it.title ? [L('Accepted', '已接单'), L('Finished', '已提交'), L('Confirmed', '已确认')] : [L('Accepted', '已接单'), L('Picked up', '已取件'), L('Delivered', '已送达'), L('Confirmed', '已确认')]);
  function runMeta(it) {
    const task = !!it.title;
    if (it.status === 'taken') return { cls: 'go', pose: 'go', step: 0, moving: true, label: task ? L('In progress', '进行中') : L('To collect', '待取件'), cta: task ? L('Submit completion', '提交完成说明') : L('Mark picked up', '确认已取件'),
      hint: task ? (it.dueAt ? L('Done by ' + clock(it.dueAt) + '. Send a photo and a short note when finished.', '完成截止 ' + clock(it.dueAt) + '。完成后提交照片和说明。') : L('Agree the time in chat, then send a photo and a short note.', '在聊天里约好时间，完成后提交照片和说明。')) : it.arrivalAt && it.arrivalAt > now() ? L('Food arrives ' + clock(it.arrivalAt) + '. Pickup details are inside.', '外卖预计 ' + clock(it.arrivalAt) + ' 到达，取餐信息见详情。') : it.deadline ? L('Deliver by ' + tx(it.deadline) + '. Pickup codes are inside.', '送达截止 ' + tx(it.deadline) + '，取件码见详情。') : L('Food is there now. Pickup details are inside.', '外卖已到，取餐信息见详情。') };
    if (it.status === 'collected') return { cls: 'go', pose: 'deliver', step: 1, moving: true, label: L('Delivering', '配送中'), cta: L('Deliver · add photo', '送达并拍照'), hint: it.deadline ? L('Deliver by ' + tx(it.deadline) + ', then add the delivery photo.', '送达截止 ' + tx(it.deadline) + '，送达后上传照片。') : L('Deliver by ' + clock(it.t.collected + 15 * MIN) + ', then add the delivery photo.', '请在 ' + clock(it.t.collected + 15 * MIN) + ' 前送达并上传照片。') };
    if (it.status === 'delivered') return { cls: 'wait', pose: 'happy', step: task ? 1 : 2, label: L('Awaiting confirmation', '等待确认'), hint: L('Waiting for the student to confirm. Auto-confirms in ', '等待同学确认，') + cd(it.autoAt, 'h') + L(', then ¥' + money(it.reward) + ' is recorded.', '后自动确认，届时记入 ¥' + money(it.reward) + '。') };
    return { cls: 'go', pose: 'party', step: runSteps(it).length - 1, label: L('Completed', '已完成'), hint: '' };
  }
  const runTotal = r => r.items.reduce((n, it) => n + it.reward, 0);
  const runTitle = it => (it.title ? tx(it.title) : tx(it.to));
  function runCard(r) {
    const total = runTotal(r);
    if (r.items.length === 1) {
      const it = r.items[0], m = runMeta(it);
      return `<div class="card tap" data-a="run" data-id="${r.id}">
        <div class="o-top"><span class="status ${m.cls}"><i></i>${m.label}</span><span class="o-time">${L('Taken ', '接单于 ')}${clock(it.t.taken)}</span></div>
        <div class="c-top"><div class="tile sm ${r.cat}">${ic(catIcon({ cat: r.cat, kind: it.kind }), 18)}</div><div class="o-title"><b>${runTitle(it)}</b><span>${tx(CAT[r.cat])}${it.title ? '' : ' · ' + units(r.cat, it.qty) + L(' · from ', ' · 取自 ') + tx(it.from)}</span></div><div class="price sm earn-c"><i>¥</i>${money(total)}</div></div>
        ${track(runSteps(it), m)}
        <div class="next">${ic('clock', 14)}<span>${m.hint}</span></div>
        ${[it.fragile ? L('Fragile', '易碎') : '', it.soup ? L('Soup or drinks', '含汤或饮品') : ''].filter(Boolean).map(c => `<span class="chip" style="margin-top:8px;display:inline-block">${c}</span>`).join('')}
        <div class="acts">${m.cta ? `<button class="btn" data-a="run" data-id="${r.id}">${L('Open job', '查看任务')}</button>` : `<button class="btn line" data-a="run" data-id="${r.id}">${L('Open job', '查看任务')}</button>`}</div></div>`;
    }
    return `<div class="card tap group" data-a="run" data-id="${r.id}">
      <div class="o-top"><span class="status go"><i></i>${L('Group trip · ' + r.items.length + ' orders', '拼单行程 · ' + r.items.length + ' 单')}</span><span class="o-time">${L('Taken ', '接单于 ')}${clock(r.items[0].t.taken)}</span></div>
      <div class="c-top"><div class="tile sm ${r.cat}">${ic(r.cat, 18)}</div><div class="o-title"><b>${tx(r.items[0].from)}</b><span>${tx(CAT[r.cat])} · ${L('one pickup, ' + r.items.length + ' doors', '一次取件，送 ' + r.items.length + ' 户')}</span></div><div class="price sm earn-c"><i>¥</i>${money(total)}</div></div>
      ${r.items.map((it, i) => { const m = runMeta(it); return `<div class="o-item"><div class="r">${tx(it.to)} <span>· ${units(r.cat, it.qty)} · ¥${money(it.reward)}</span></div><div class="s"><b>${m.label}</b><span>${it.status === 'taken' ? (it.arrivalAt && it.arrivalAt > now() ? L('food arrives ', '预计到达 ') + clock(it.arrivalAt) : L('food is there now', '外卖已到')) : it.status === 'collected' ? L('deliver by ', '送达截止 ') + clock(it.t.collected + 15 * MIN) : ''}</span></div></div>`; }).join('')}
      <div class="acts"><button class="btn" data-a="run" data-id="${r.id}">${L('Open job', '查看任务')}</button></div></div>`;
  }
  function runningTab(P) {
    const D = G.data, me = D.me, runs = D.runs;
    if (!me.runner) return `<div class="empty"><img src="${yuni('earn')}" alt=""><div class="t">${L('You haven’t run any jobs', '你还没有接过任务')}</div><div class="d">${L('Bring other students’ takeaway or parcels when you’re going that way anyway, and earn the price shown on each job.', '顺路帮其他同学代取外卖或快递，就能赚到每个任务标明的赏金。')}</div><div style="display:flex;gap:8px"><button class="btn light" data-a="nav" data-p="jobs">${L('Browse jobs', '看看任务')}</button><button class="btn" data-a="gate">${L('Become a runner', '成为跑手')}</button></div></div>`;
    const live = runs.filter(r => !r.done), past = runs.filter(r => r.done);
    let body = '';
    if (live.length) body += `<div class="sec">${L('Running now', '进行中')}<span>${live.length}</span></div>` + live.map(runCard).join('');
    else if (past.length) body += `<div class="list-hd"><span>${L('No jobs running right now. Your completed trips are below.', '目前没有进行中的任务，已完成的行程在下方。')}</span></div>`;
    else body += emptyBox('look', L('You haven’t run any jobs', '你还没有接过任务'), L('Bring other students’ takeaway or parcels when you’re going that way anyway.', '顺路帮其他同学代取外卖或快递，就能赚到赏金。'), `<button class="btn" data-a="nav" data-p="jobs">${L('Find a job', '去接单')}</button>`);
    if (past.length) body += `<div class="sec">${L('Completed trips', '已完成的行程')}<span>${past.length}</span></div><div class="rows">${past.slice().sort((a, b) => b.at - a.at).map(r => `<div class="row" data-a="say" data-en="Opens the finished trip, same as today." data-zh="打开已完成的行程，与现在相同。"><div class="tile sm ${r.cat}">${ic(catIcon({ cat: r.cat, kind: r.items[0].kind }), 18)}</div><div class="grow"><b>${runTitle(r.items[0])}${r.items.length > 1 ? ' +' + (r.items.length - 1) : ''}</b><span class="ok">✓ ${L('Confirmed', '已确认')} ${dateTime(r.at)}</span></div><div class="amt plus">+¥${money(runTotal(r))}</div></div>`).join('')}</div>`;
    return body;
  }

  // ---------------- Sheets ----------------
  const kv = (k, v, cls) => (v ? `<div class="kv"><span>${k}</span><b class="${cls || ''}">${v}</b></div>` : '');
  const sheetWrap = (P, title, body, foot) => `<div class="overlay ${P.still ? 'still' : ''}"><div class="mask" data-a="close"></div><div class="sheet"><div class="handle"></div>${title ? `<div class="sh-hd"><span>${title}</span><button class="x" data-a="close" aria-label="Close">${ic('x', 14, 2.4)}</button></div>` : ''}<div class="sh-body">${body}</div>${foot ? `<div class="sh-foot">${foot}</div>` : '<div style="height:22px;flex:none"></div>'}</div></div>`;
  function jobSheet(P, j) {
    const me = G.data.me, task = j.cat === 'task', w = jobWhen(j), over = me.runner && j.reward > me.limit;
    const steps = task ? [['chat', L('Agree details in chat', '聊天确认细节')], ['check', L('Do the task', '完成任务')], ['camera', L('Send photo + note', '提交照片和说明')]] : [['pin', L('Collect at the pickup point', '到取件点取件')], ['camera', L('Deliver and take a photo', '送达并拍照')], ['coin', L('Paid once they confirm', '对方确认后结算')]];
    const body = `<div class="c-top"><div class="tile ${j.cat}">${ic(catIcon(j), 20)}</div><div class="c-kind"><b>${catName(j)}</b><span>${L('Open · waiting for a runner', '待接单')}</span></div>${priceBox(j)}</div>
      ${task ? `<div class="task-title">${tx(j.title)}</div>` : `<div class="panel" style="padding:12px 14px"><div class="route" style="margin:0"><div class="a">${jobFrom(j)}</div><div class="b">${jobTo(j)}${genderChip(j.gender)}</div></div></div>`}
      ${jobChips(j)}
      <div class="panel">${kv(L('Quantity', '数量'), task ? '' : units(j.cat, j.qty) + (j.sizes ? ' · ' + tx(j.sizes) : ''))}${kv(L('Help type', '帮助方式'), task ? qtyLabel(j) : '')}${kv(task ? L('Timing', '时间') : j.cat === 'parcel' ? L('Deliver by', '送达要求') : L('Food', '外卖状态'), w.text)}${kv(L('Accept by', '接单截止'), j.closesAt ? clock(j.closesAt) : '')}${kv(L('Posted at', '发布时间'), clock(j.postedAt))}</div>
      ${j.note ? `<div class="lab">${L('Public note', '公开备注')}</div><div class="note" style="margin-top:6px;color:#454d43">${tx(j.note)}</div>` : ''}
      <div class="lab">${L('What you’ll do', '接单后要做什么')}</div><div class="steps3">${steps.map(s => `<div>${ic(s[0], 20)}${s[1]}</div>`).join('')}</div>
      <div class="privacy">${ic('shield', 15)}<span>${L('Names, rooms, phone numbers, photos and pickup codes stay private until you accept.', '姓名、房间号、手机号、照片和取件码在接单后才可见。')}</span></div>`;
    return sheetWrap(P, L('Public order details', '订单公开详情'), body, `<button class="btn line small" data-a="close">${L('Close', '关闭')}</button>${over ? `<button class="btn" disabled>${L('Over your ¥' + me.limit + ' limit', '超过 ¥' + me.limit + ' 额度')}</button>` : `<button class="btn" data-a="take" data-ids="${j.id}">${L('Take this order', '接单')} · ¥${money(j.reward)}</button>`}`);
  }
  function filterSheet(P) {
    const f = P.f, n = jobList(P).length;
    const pills = (act, items, cur) => `<div class="pills">${items.map(i => `<button class="pill ${i[2] || ''} ${cur === i[0] ? 'on' : ''}" data-a="${act}" data-v="${i[0]}">${i[1]}</button>`).join('')}</div>`;
    const body = `<div class="frow" style="margin-top:2px"><b>${L('Gender', '性别')}</b>${pills('f-gender', [['', L('All', '全部')], ['male', L('Male dorm', '男寝'), 'male'], ['female', L('Female dorm', '女寝'), 'female']], f.gender)}</div>
      <div class="frow"><b>${L('Dorm area', '宿舍区')}</b>${pills('f-area', [['', L('All', '全部')], ...Object.keys(AREAS).map(id => [id, areaName(id)])], f.area)}</div>
      ${f.area ? `<div class="frow"><b>${L('Building', '楼栋')}</b>${pills('f-building', [['', L('All', '全部')], ...AREAS[f.area].buildings.map(b => [b, b])], f.building)}</div>` : ''}
      <div class="frow"><b>${L('Time', '时间')}</b>${pills('f-time', [['any', L('Any time', '不限')], ['30', L('Next 30 min', '30 分钟内')], ['60', L('Next hour', '1 小时内')]], f.time)}</div>`;
    return sheetWrap(P, L('Filter', '筛选'), body, `<button class="btn line small" data-a="f-clear">${L('Clear filters', '清除筛选')}</button><button class="btn" data-a="close">${L('Show ' + n + (n === 1 ? ' job' : ' jobs'), '查看 ' + n + ' 个任务')}</button>`);
  }
  function orderSheet(P, o) {
    const m = orderMeta(o), task = o.cat === 'task', t = o.t, past = isPast(o);
    const line = (label, at, extra) => `<div class="${at ? 'done' : ''}">${label}${extra && at ? ' · ' + extra : ''}<span>${at ? dateTime(at) : '—'}</span></div>`;
    let tl = line(L('Posted', '已发布'), t.created);
    if (o.status === 'cancelled') tl += line(L('Cancelled by you', '你已取消'), t.cancelled);
    else if (o.status === 'refunded' && o.why !== 'review') tl += line(L('Closed · no runner', '已关闭 · 无人接单'), t.refunded);
    else { tl += line(L('Taken by a verified student', '已由认证学生接单'), t.taken, o.runner); if (!task) tl += line(L('Picked up', '已取件'), t.collected); tl += line(task ? L('Finished · proof sent', '任务已完成 · 已提交凭证') : L('Delivered · photo', '已送达 · 附照片'), t.delivered); if (t.reported) tl += line(L('Issue reported · settlement paused', '已反馈问题 · 暂停结算'), t.reported); tl += o.status === 'refunded' ? line(L('Review resolved · simulated refund', '审核完成 · 模拟退款'), t.refunded) : line(L('Confirmed', '已确认'), t.confirmed); }
    const base = o.total - (o.raised || 0);
    const body = `<div class="hero ${m.cls}"><img src="${yuni(m.pose)}" alt=""><div><b>${m.label}</b><span>${m.hint}</span></div></div>
      <div class="lab">${L('Progress', '进度')}</div><div class="tl">${tl}</div>
      ${t.delivered && !task ? `<div class="proof"><div>${ic('camera', 22)}</div><span>${L('Delivery photo from ' + (o.runner || 'the runner') + '. Tap to view full size.', (o.runner || '跑手') + ' 的送达照片，点击查看大图。')}</span></div>` : ''}
      <div class="lab">${L('Order', '订单')}</div><div class="panel">${kv(task ? L('Task', '任务') : o.cat === 'night' ? L('Shop', '店铺') : L('Pickup', '取件点'), orderTitle(o))}${kv(L('Deliver to', '送达地点'), task ? '' : tx(o.to))}${kv(L('Items', '数量'), task ? '' : qtyLabel(o))}${kv(L('Runner', '跑手'), o.runner ? o.runner + L(' · verified student', ' · 已认证学生') : '')}</div>
      <div class="lab">${L('Payment', '费用')}</div><div class="panel">${kv(L('Reward', '赏金'), '¥' + money(base))}${kv(L('Offer raised', '加价'), o.raised ? '+¥' + money(o.raised) : '')}${kv(L('Service fee', '服务费'), L('¥0.00 · free', '¥0.00 · 免收'))}${kv(L('Total', '合计'), '¥' + money(o.total), 'total')}</div>
      <div class="privacy">${ic('shield', 15)}<span>${L('Team test: payments and refunds are simulated.', '团队测试：付款与退款均为模拟。')}</span></div>`;
    let foot = '', tip = '';
    const chat = `<button class="btn" data-a="say" data-en="Opens the order chat with ${o.runner}." data-zh="打开与 ${o.runner} 的订单聊天。">${L('Chat with ' + o.runner, '联系 ' + o.runner)}</button>`;
    if (o.status === 'waiting') { foot = `<button class="btn line" data-a="cancel" data-id="${o.id}">${L('Cancel order', '取消订单')}</button><button class="btn" data-a="raise" data-id="${o.id}">${L('Raise offer', '加价')}</button>`; tip = L('No runner has accepted yet — you can cancel anytime.', '还没有跑手接单，可以随时取消。'); }
    else if (o.status === 'taken') { const open = inWindow(o); foot = `<button class="btn line" ${open ? `data-a="cancel" data-id="${o.id}"` : 'disabled'}>${L('Cancel order', '取消订单')}</button>${chat}`; tip = open ? L('A runner has accepted. You can still cancel for ', '跑手已接单，') + cd(t.taken + CANCEL_MS, 'ms', true) + L('', ' 内仍可取消') : L('A runner has accepted — cancel window ended.', '跑手已接单，取消时间已过。'); }
    else if (o.status === 'collected') { foot = `<button class="btn line" disabled>${L('Cancel order', '取消订单')}</button>${chat}`; tip = L('Your items are picked up — cancel window ended.', '物品已取到，取消时间已过。'); }
    else if (o.status === 'delivered') foot = `<button class="btn line" data-a="say" data-en="Opens the existing ‘Report a problem’ form." data-zh="打开现有的「报问题」表单。">${L('Report a problem', '报问题')}</button><button class="btn" data-a="confirm" data-id="${o.id}">${L('Confirm receipt', '确认收货')}</button>`;
    else if (o.status === 'disputed') foot = `<button class="btn" data-a="say" data-en="Opens the existing feedback page for this order." data-zh="打开这笔订单现有的反馈页面。">${L('View feedback progress', '查看反馈进度')}</button>`;
    else foot = `<button class="btn line small" data-a="close">${L('Close', '关闭')}</button>${task ? '' : `<button class="btn" data-a="again">↻ ${L('Post again', '再来一单')}</button>`}`;
    return sheetWrap(P, orderSub(o), body + (tip ? `<div class="tip">${tip}</div>` : ''), foot);
  }
  function runSheet(P, r) {
    const blocks = r.items.map(it => {
      const m = runMeta(it), task = !!it.title;
      return `<div class="hero ${m.cls}" style="margin-top:${r.items.length > 1 ? 12 : 0}px"><img src="${yuni(m.pose)}" alt=""><div><b>${m.label}${r.items.length > 1 ? ' · ¥' + money(it.reward) : ''}</b><span>${m.hint}</span></div></div>
        <div class="reveal">${kv(task ? L('Task', '任务') : L('Pickup', '取件点'), task ? tx(it.title) : tx(it.from))}${kv(L('Pickup info', '取件信息'), tx(it.code))}${kv(L('Deliver to', '送达地点'), task ? '' : tx(it.to) + (it.gender ? ' · ' + (it.gender === 'male' ? L('male dorm', '男寝') : L('female dorm', '女寝')) : ''))}${kv(L('Items', '数量'), task ? '' : units(r.cat, it.qty))}${kv(L('Note', '备注'), tx(it.note))}</div>
        ${m.cta ? `<div class="acts"><button class="btn" data-a="advance" data-run="${r.id}" data-item="${it.id}">${it.status === 'collected' || task ? ic('camera', 16, 2).replace('<svg', '<svg style="display:inline;vertical-align:-3px;margin-right:6px"') : ''}${m.cta}</button></div>` : ''}`;
    }).join('');
    const canReturn = r.items.every(it => it.status === 'taken');
    return sheetWrap(P, tx(CAT[r.cat]) + ' · ¥' + money(runTotal(r)), blocks + (canReturn ? `<div class="tip"><span data-a="say" data-en="Opens the existing return reasons. Returning a job can count against your credit." data-zh="打开现有的退回原因。退回订单可能影响信用。" style="text-decoration:underline;cursor:pointer">${L('Can’t make it? Return to the board', '去不了？退回大厅')}</span></div>` : ''), `<button class="btn line small" data-a="close">${L('Close', '关闭')}</button><button class="btn light" data-a="say" data-en="Opens the order chat." data-zh="打开订单聊天。">${L('Chat with the student', '联系同学')}</button>`);
  }
  function overlay(P) {
    const s = P.sheet, D = G.data;
    let html = '';
    // A sheet that was already open re-renders in place instead of sliding up again.
    P.still = !!s && P.lastSheet === s.type; P.lastSheet = s ? s.type : '';
    if (s) {
      if (s.type === 'job') { const j = D.jobs.find(x => x.id === s.id); html = j ? jobSheet(P, j) : ''; }
      else if (s.type === 'filter') html = filterSheet(P);
      else if (s.type === 'order') { const o = D.orders.find(x => x.id === s.id); html = o ? orderSheet(P, o) : ''; }
      else if (s.type === 'run') { const r = D.runs.find(x => x.id === s.id); html = r ? runSheet(P, r) : ''; }
      else if (s.type === 'gate') html = sheetWrap(P, '', `<div class="celebrate"><img src="${yuni('hello')}" alt=""><b>${L('One quick check before you earn', '接单前先完成学生认证')}</b><span>${L('Runners are verified XJTLU students. It keeps every order safe.', '跑手都是经过认证的西浦学生，让每一单更安心。')}</span></div><div class="steps3"><div>${ic('users', 20)}${L('Real name', '真实姓名')}</div><div>${ic('chat', 20)}${L('Phone number', '手机号')}</div><div>${ic('shield', 20)}${L('Student ID', '学号')}</div></div><div class="tip">${L('An admin reviews your application. You can keep browsing meanwhile.', '管理员审核后即可接单，期间可以继续浏览。')}</div>`, `<button class="btn line small" data-a="close">${L('Not now', '暂不')}</button><button class="btn" data-a="say" data-en="Opens the existing student check page." data-zh="打开现有的学生认证页面。">${L('Start student check', '开始认证')}</button>`);
      else if (s.type === 'taken') { const r = D.runs.find(x => x.id === s.id), it = r.items[0]; html = sheetWrap(P, '', `<div class="celebrate"><img src="${yuni('party')}" alt=""><b>${L('You’ve got it!', '接单成功！')}</b><span>${L('Private details are now unlocked for this job.', '这单的私密信息现在对你可见。')}</span></div><div class="reveal">${kv(L('Deliver to', '送达地点'), it.title ? '' : tx(it.to))}${kv(L('Task', '任务'), it.title ? tx(it.title) : '')}${kv(L('Pickup info', '取件信息'), tx(it.code) || (it.title ? '' : L('Shown in the job', '见任务详情')))}${kv(L('Contact', '联系方式'), L('Chat and phone unlocked', '聊天和电话已开放'))}${kv(L('You earn', '可得赏金'), '¥' + money(runTotal(r)), 'total')}</div>`, `<button class="btn line" data-a="close">${L('Keep browsing', '继续浏览')}</button><button class="btn" data-a="goRun">${L('Open job', '查看任务')}</button>`); }
      else if (s.type === 'thanks') { const o = D.orders.find(x => x.id === s.id); html = sheetWrap(P, '', `<div class="celebrate"><img src="${yuni('party')}" alt=""><b>${L('All done!', '订单完成！')}</b><span>${L(o.runner + ' earned ¥' + money(o.total) + '. Thanks for confirming quickly.', o.runner + ' 获得 ¥' + money(o.total) + '。感谢你及时确认。')}</span></div>`, `<button class="btn line" data-a="close">${L('Close', '关闭')}</button>${o.cat === 'task' ? '' : `<button class="btn" data-a="again">↻ ${L('Post again', '再来一单')}</button>`}`); }
      else if (s.type === 'raise') { const o = D.orders.find(x => x.id === s.id); html = sheetWrap(P, L('Raise your offer', '加价'), `<div class="tip" style="text-align:left;margin-top:0">${L('A higher offer is the fastest way to get picked. Runners see “Offer raised” on your order. The extra is paid once, for the whole order.', '加价是最快被接单的方式，跑手会看到「已加价」。加价按整单计一次。')}</div><div class="amounts">${TIPS.map(a => `<button class="${s.amt === a ? 'on' : ''}" data-a="raise-amt" data-v="${a}">+¥${money(a)}</button>`).join('')}</div><div class="panel">${kv(L('Current offer', '当前赏金'), '¥' + money(o.total))}${kv(L('New offer', '加价后'), s.amt ? '¥' + money(o.total + s.amt) : '—', 'total')}</div>`, `<button class="btn line small" data-a="close">${L('Back', '返回')}</button><button class="btn" data-a="raise-ok" ${s.amt ? '' : 'disabled'}>${s.amt ? L('Raise by ¥' + money(s.amt), '加价 ¥' + money(s.amt)) : L('Choose an amount', '请选择金额')}</button>`); }
      // Approved cancel sheet (AGENTS.md): choosing a reason only selects it; Back then becomes Cancel order.
      else if (s.type === 'cancel') html = sheetWrap(P, L('Why are you cancelling?', '为什么取消？'), `<div class="tip" style="text-align:left;margin-top:0">${L('Choose one reason.', '请选择一个原因。')}</div>${REASONS.map(r => `<button class="opt ${s.reason === r[0] ? 'on' : ''}" data-a="cancel-reason" data-v="${r[0]}"><i></i>${L(r[1], r[0])}</button>`).join('')}`, s.reason ? `<button class="btn" data-a="cancel-ok">${L('Cancel order', '取消订单')}</button>` : `<button class="btn line" data-a="close">${L('Back', '返回')}</button>`);
      else if (s.type === 'proof' || s.type === 'rcancel') html = flowSheet(P, s);
      else if (s.type === 'create') html = sheetWrap(P, L('What do you want to do?', '你想做什么？'), `<div class="lab" style="margin-top:0">${L('For customers', '为顾客')}</div><button class="choice" style="border-color:#c2410c;background:#fff1e6" data-a="post"><span class="tile" style="background:#c2410c">${ic('takeout', 20)}</span><span><b>${L('I need help! Post a pick-up', '我需要！发布代取')}</b><span>${L('Takeaway from the gate or a parcel from the station, brought to your door', '请跑手取外卖、拿快递，送到你的门口。')}</span></span></button><button class="choice" style="border-color:#1e40af;background:#eef3fe" data-a="post"><span class="tile" style="background:#1e40af">${ic('task', 20)}</span><span><b>${L('Something else', '其他需求')}</b><span>${L('A pillow, a textbook, printing, signing in — your time and price', '买枕头、取课本、打印、代签到…… 时间赏金自己定。')}</span></span></button><div class="lab">${L('For runners', '为跑手')}</div><button class="choice" style="border-color:#0b7a55;background:#e7f3ed" data-a="post"><span class="tile" style="background:#0b7a55">${ic('coin', 20)}</span><span><b>${L('On my way! Start a trip', '我顺路！发起行程')}</b><span>${L('Going to the gate or a station anyway? Bring others’ orders back and earn', '刚好去取外卖或快递？顺路帮同学带回来，赚点零花钱。')}</span></span></button>`);
    }
    const mo = P.modal;
    if (mo) html += `<div class="modal-wrap"><div class="modal"><b>${mo.title}</b><p>${mo.text}</p><div><button data-a="modal-no">${mo.no}</button><button data-a="modal-yes">${mo.yes}</button></div></div></div>`;
    if (P.toast) html += `<div class="toast">${P.toast}</div>`;
    return html;
  }

  // ---------------- Full pages after tapping an order or taking a job ----------------
  // These follow pages/trip, pages/request and pages/task: same sections, same buttons, same order.
  const NAMES = ['Mia', 'Chen Yu', 'Lily', 'Haoran', 'Sofia', 'Zhang Wei'];
  function prep(r) {
    if (!r) return r;
    r.items.forEach(it => {
      if (it.owner) return;
      let h = 0; for (const c of it.id) h += c.charCodeAt(0);
      it.owner = NAMES[h % NAMES.length]; it.phone = '138 5521 ' + String(1000 + (h * 37) % 9000);
      if (r.cat === 'parcel') { const found = (it.code ? it.code.en : '').match(/[A-Z0-9]+-[A-Z0-9-]+/g) || []; it.parcels = Array.from({ length: it.qty || 1 }, (_, k) => ({ code: found[k] || (k + 3) + '-' + (k + 1) + '-' + String(1000 + (h * 53 + k * 811) % 9000), done: it.status !== 'taken' })); }
    });
    return r;
  }
  const phase = r => (r.items.every(it => ['delivered', 'confirmed'].includes(it.status)) ? 'done' : r.items.some(it => it.status === 'taken') ? 'collect' : 'deliver');
  const bld = it => (G.lang === 'en' ? it.to.en.split(' · ')[0] : it.to.zh.split(' ').slice(0, 2).join(' '));
  const roomOf = it => ((it.to.en.match(/Room (\w+)/) || [])[1] || '');
  const autoHours = (cat, task) => (task ? 24 : cat === 'parcel' ? 48 : 1);
  const avatar = name => `<span class="av">${Array.from(name)[0].toUpperCase()}</span>`;
  const contactBtns = () => `<span class="cbtns"><button class="cbtn" data-a="say" data-en="Opens the order chat page (unchanged)." data-zh="打开订单聊天页面（不变）。"><img src="${A}message.svg" alt="chat"></button><button class="cbtn" data-a="say" data-en="Calls the number through WeChat (unchanged)." data-zh="通过微信拨打电话（不变）。"><img src="${A}phone.svg" alt="call"></button></span>`;
  const prog3 = ph => `<div class="prog">${[[L('1 · Pick up', '1 · 取件'), true], [L('2 · Deliver', '2 · 送达'), ph !== 'collect'], [L('3 · Done', '3 · 完成'), ph === 'done']].map(s => `<div class="${s[1] ? 'on' : ''}">${s[0]}</div>`).join('')}</div>`;
  const proofBox = text => `<div class="proof"><div>${ic('camera', 22)}</div><span>${text}</span></div>`;

  function tripPage(P) {
    const r = prep(G.data.runs.find(x => x.id === P.view.id));
    if (!r || !r.items.length) return `<div class="pg"><div class="card"><b>${L('Trip ended', '行程已结束')}</b><div class="acts"><button class="btn" data-a="findJob">${L('Find another job', '再找一单')}</button></div></div></div>`;
    const ph = phase(r), parcel = r.cat === 'parcel', night = r.cat === 'night', n = r.items.length, qty = r.items.reduce((s, it) => s + (it.qty || 1), 0);
    const delivered = r.items.filter(it => ['delivered', 'confirmed'].includes(it.status)).length, full = P.view.full || {};
    let h = `<div class="pg"><div class="h1">${tx(r.items[0].from)} → ${n > 1 ? bld(r.items[0]) : tx(r.items[0].to)}</div><div class="sub">${night ? L('Night market', '夜市代买') : parcel ? L('Parcels', '快递代取') : L('Takeaway', '外卖代取')} · ${n} ${L(n === 1 ? 'order,' : 'orders,', '个订单，')} ${qty} ${parcel ? L(qty === 1 ? 'box' : 'boxes', '件') : L(qty === 1 ? 'bag' : 'bags', '袋')}</div>${prog3(ph)}<div class="pv-label">${L('Team test · cloud sync · no real payment', '团队测试 · 云端同步 · 不产生真实付款')}</div>`;
    if (ph === 'done') h += `<div class="card center"><div class="bigcheck">${ic('check', 26, 3)}</div><div class="h1">${L('Trip complete', '行程已完成')}</div><div class="sub">${L('Money will be transferred into your wallet.', '款项将转入你的钱包。')}</div><div class="bigmoney">¥${money(runTotal(r))}</div><div class="sub">${L(qty + ' items to ' + n + (n === 1 ? ' person' : ' people'), '共 ' + qty + ' 件，送给 ' + n + ' 位同学')}</div></div>`;
    if (ph === 'collect') h += `<div class="gnote">${L('Names, rooms and phone numbers are now visible. Match the number on each bag before taking it.', '现在可以查看姓名、房间号和手机号。取走前请核对每一件上的号码。')}</div>`;
    if (parcel && ph === 'collect') {
      r.items.forEach(it => it.parcels.forEach((p, i) => {
        const canCancel = !it.parcels.some(x => x.done);
        h += `<div class="card ${p.done ? 'isdone' : ''}"><div class="plate"><div><span>${p.done ? L('✓ Collected', '✓ 已取件') : L('Pickup code', '取件码')}</span><b>${p.code}</b></div><em>${L('Box ' + (i + 1), '第 ' + (i + 1) + ' 件')}</em></div>
          <div class="line"><span class="licon">${ic('pin', 16)}</span><div><span>${L('Pickup station', '取件驿站')}</span><b>${tx(it.from)}</b></div></div>
          ${it.fragile ? `<div class="warn">${L('Fragile · handle with care', '易碎 · 请轻拿轻放')}</div>` : ''}
          <div class="person">${avatar(it.owner)}<div class="grow"><b>${it.owner}</b><span>${L('Room ', '房间号 ')}${roomOf(it)}</span></div>${contactBtns()}</div>
          ${it.note ? `<div class="memo"><span>${L('Note from the publisher', '发布人备注')}</span>${tx(it.note)}</div>` : ''}
          <div class="acts"><button class="btn" data-a="got" data-run="${r.id}" data-item="${it.id}" data-i="${i}" ${p.done ? 'disabled' : ''}>${p.done ? L('✓ Collected', '✓ 已取件') : L('Got it', '已取到')}</button>${!p.done && canCancel ? `<button class="btn light" data-a="tcancel" data-run="${r.id}" data-item="${it.id}">${L('Cancel job', '取消接单')}</button>` : ''}</div>
          ${p.done ? '' : `<button class="textlink" data-a="say" data-en="Opens the existing “Can’t find it” steps for a missing parcel." data-zh="打开现有的「找不到」处理流程。">${L('Can’t find it', '找不到')}</button><div class="lockhint">${ic('lock', 13)}<span>${L('After you tap Got it, the publisher can no longer cancel', '点「已取到」后，发布人将无法取消订单')}</span></div>`}</div>`;
      }));
    }
    if (ph === 'deliver') h += `<div class="gnote">${L('All collected · ' + delivered + ' of ' + n + ' delivered · lowest floor first', '已全部取件 · 已送达 ' + delivered + ' / ' + n + ' · 从低楼层开始')}</div>`;
    if (!(parcel && ph === 'collect')) r.items.forEach(it => {
      const live = it.status === 'taken' || it.status === 'collected';
      const badge = it.status === 'confirmed' ? L('Paid (demo)', '已结算（演示）') : it.status === 'delivered' ? L('Waiting', '待确认') : it.status === 'collected' ? '' : parcel ? L('To collect', '待取件') : it.arrivalAt && it.arrivalAt > now() ? L('Arrives ', '预计到达 ') + clock(it.arrivalAt) : night ? L('To buy', '待代买') : L('Food is there now', '外卖已到');
      h += `<div class="card"><div class="person">${avatar(it.owner)}<div class="grow"><b class="addr">${tx(it.to)}</b></div>${badge ? `<span class="chip ${it.status === 'confirmed' ? 'green' : ''}">${badge}</span>` : ''}</div>
        <div class="person tight"><div class="grow"><span>${it.owner} · ${units(parcel ? 'parcel' : 'takeout', it.qty || 1)}</span></div>${contactBtns()}</div>
        ${it.soup ? `<div class="gnote">${L('↑ Soup or drinks inside · keep it upright', '↑ 内有汤或饮品 · 请保持直立')}</div>` : ''}
        ${live ? `${night ? `<div class="sub" style="margin-top:8px">${L('Order status: ', '订单状态：')}${it.purchase === 'needs' ? L('Not ordered · runner pays upfront', '未下单（需跑手垫付）') : L('Already ordered', '已下单')}</div>` : ''}
          ${!parcel ? `<div class="softbox"><span>${night ? L('Shop / stall', '店名 / 摊位') : L('Takeaway locker', '外卖柜')}</span><b>${tx(it.from)}</b></div><div class="softbox"><span>${L('Phone number on the bag', '外卖袋上的手机号')}</span><div class="rowline"><b>${full[it.id] ? it.phone : '••• ' + it.phone.slice(-4)}</b><button class="link" data-a="full" data-id="${it.id}">${full[it.id] ? L('Hide', '隐藏') : L('Full number', '完整号码')}</button></div></div>` : `<div class="softbox"><span>${L('Pickup codes · ' + it.parcels.length + ' · all picked up', '取件码 · ' + it.parcels.length + ' 个 · 已全部取到')}</span><div class="chips">${it.parcels.map(p => `<span class="chip">${p.code}</span>`).join('')}</div></div>`}
          ${it.note ? `<div class="sub" style="margin-top:8px">${L('Note: ', '备注：')}${tx(it.note)}</div>` : ''}${!parcel && it.code ? `<div class="rowline" style="margin-top:8px"><span class="sub">${night ? L('Meal code', '取餐码') : L('Order code', '取餐码')}</span><b>${tx(it.code).replace(/^[^\d]*/, '')}</b></div>` : ''}` : ''}
        ${it.status === 'taken' ? `<div class="acts"><button class="btn" data-a="pickup" data-run="${r.id}" data-item="${it.id}">${L('Picked up, go deliver', '已取物，去送达')}</button><button class="btn light small" data-a="tcancel" data-run="${r.id}" data-item="${it.id}">${L('Cancel job', '取消接单')}</button></div>` : ''}
        ${it.status === 'collected' && ph === 'collect' ? `<div class="acts"><button class="btn" disabled>${L('Picked up, go deliver', '已取物，去送达')}</button><button class="btn light small" disabled>${L('Cancel job', '取消接单')}</button></div>` : ''}
        ${it.status === 'collected' && ph === 'deliver' ? `<div class="acts"><button class="btn" data-a="photo" data-run="${r.id}" data-item="${it.id}">${ic('camera', 16, 2).replace('<svg', '<svg style="display:inline;vertical-align:-3px;margin-right:6px"')}${L('Take delivery photo', '拍送达照片')}</button></div>` : ''}
        ${it.t.delivered ? `${proofBox(L('At the door · ', '放在门口 · ') + clock(it.t.delivered))}${it.status === 'delivered' ? `<div class="sub" style="margin-top:8px">${L('Automatically confirms after ' + autoHours(r.cat) + (autoHours(r.cat) === 1 ? ' hour.' : ' hours.'), autoHours(r.cat) + ' 小时后自动确认。')}</div><button class="link" style="margin-top:6px" data-a="say" data-en="Opens the order details page for this order (unchanged)." data-zh="打开这笔订单的详情页（不变）。">${L('View order details →', '查看订单详情 →')}</button>` : ''}` : ''}</div>`;
    });
    if (ph === 'done') { const paid = r.items.filter(it => it.status === 'confirmed').reduce((s, it) => s + it.reward, 0); h += `<div class="card"><b>${L('Payments (simulated)', '结算（模拟）')}</b><div class="sub" style="margin-top:6px">${L('¥' + money(paid) + ' confirmed · ¥' + money(runTotal(r) - paid) + ' waiting', '已确认 ¥' + money(paid) + ' · 待确认 ¥' + money(runTotal(r) - paid))}</div><div class="sub">${L('Each order settles separately after confirmation. Reports pause settlement.', '每个订单在确认后单独结算。有反馈时暂停结算。')}</div><div class="acts"><button class="btn" data-a="findJob">${L('Find another job →', '再找一单 →')}</button></div></div>`; }
    return h + '</div>';
  }

  function offerPanel(o) { return `<div class="offer"><div class="rowline"><b>${L('Add to your offer', '提高赏金')}</b><span class="sub">${L('Your offer', '当前赏金')} <b style="color:var(--orange)">¥${money(o.total)}</b></span></div><div class="sub">${L('Added once to the whole order. Available before acceptance only.', '加价仅对整笔订单计算一次，接单后不可加价。')}</div><div class="amounts">${TIPS.map(a => `<button data-a="raise-now" data-id="${o.id}" data-v="${a}">+¥${money(a)}</button>`).join('')}<button data-a="say" data-en="Opens the existing custom amount box." data-zh="打开现有的自定义金额输入框。">${L('Custom', '自定义')}</button></div></div>`; }
  function cancelCard(o) {
    if (!['waiting', 'taken', 'collected'].includes(o.status)) return '';
    const open = o.status === 'waiting' || inWindow(o);
    const tip = o.status === 'waiting' ? L('No runner has accepted yet — you can cancel anytime.', '还没有跑手接单，可以随时取消。') : open ? L('A runner has accepted. You can still cancel for ', '跑手已接单，') + cd(o.t.taken + CANCEL_MS, 'ms', true) + L('', ' 内仍可取消') : L('A runner has accepted — cancel window ended.', '跑手已接单，取消时间已过。');
    return `<div class="card center"><button class="btn line wide" ${open ? `data-a="cancel" data-id="${o.id}"` : 'disabled'}>${L('Cancel order', '取消订单')}</button><div class="tip">${tip}</div></div>`;
  }
  const runnerCard = o => (o.runner ? `<div class="card"><div class="person">${avatar(o.runner)}<div class="grow"><b>${o.runner}</b></div>${contactBtns()}</div></div>` : '');
  function confirmCard(o) {
    if (o.status !== 'delivered') return '';
    const hrs = autoHours(o.cat, o.cat === 'task');
    return `<div class="card"><div class="softbox sub">${L('Demo total ¥' + money(o.total) + '. Confirming settles ¥' + money(o.total) + ' to the runner in this preview.', '模拟合计 ¥' + money(o.total) + '。确认后，预览版将向跑手结算 ¥' + money(o.total) + '。')}</div>
      <div class="acts"><button class="btn line" data-a="say" data-en="Opens the existing “Something’s wrong” report form." data-zh="打开现有的「有问题」反馈表单。">${L('Something’s wrong', '有问题')}</button></div>
      <div class="acts"><button class="btn orange" data-a="confirm" data-id="${o.id}">${L('Got it · confirm ¥', '已收到 · 确认 ¥')}${money(o.total)}</button></div>
      <div class="sub" style="margin-top:10px">${L('Confirm or report a problem within ' + hrs + (hrs === 1 ? ' hour' : ' hours') + ' of delivery; otherwise it auto-credits the runner at ' + dateTime(o.autoAt) + '. A report freezes the payout and we will resolve it within 24 hours.', '送达 ' + hrs + ' 小时内可确认或投诉；未确认将在 ' + dateTime(o.autoAt) + ' 自动入账给跑手。投诉后赏金冻结，我们将在 24 小时内处理。')}</div></div>`;
  }
  function ticket(o) {
    const m = orderMeta(o), task = o.cat === 'task';
    return `<div class="ticket"><div class="band"><b>UniEarn</b><i>|</i>${L('Order journey', '订单旅程')}<img src="${A}journey-anchor.svg" alt=""></div><div class="tbody">
      <div class="thero"><img src="${yuni(m.pose)}" alt=""><div><b>${m.label}</b><span>${m.hint}</span></div></div>
      ${m.step === undefined ? '' : track(stepsFor(o), { ...m, pose: m.pose })}
      ${task ? '' : `<div class="troute"><span><img src="${A}journey-location.svg" alt="">${orderTitle(o)}</span><em>→</em><span><img src="${A}journey-location.svg" alt="">${bld(o)}</span></div>`}
      <div class="ttimes"><span>${L('Posted: ', '发布：')}${dateTime(o.t.created)}</span>${o.closesAt ? `<span>${L('Deadline: ', '截止：')}${clock(o.closesAt)}</span>` : o.dueAt ? `<span>${L('Done by: ', '完成截止：')}${clock(o.dueAt)}</span>` : ''}</div>
      ${o.status === 'waiting' && o.closesAt ? `<div class="tnote">• ${L('Auto-refund if not taken by ' + clock(o.closesAt) + '.', '若 ' + clock(o.closesAt) + ' 前无人接单，将全额退款。')}</div>` : ''}
      ${o.status === 'waiting' ? offerPanel(o) : ''}</div></div>`;
  }
  function requestPage(P) {
    const o = G.data.orders.find(x => x.id === P.view.id), take = o.cat === 'takeout' || o.cat === 'night';
    let h = `<div class="pg"><div class="h1">${L('My request', '我的订单')}</div><div class="sub">${orderSub(o)} · ${tx(o.to)}</div>${ticket(o)}`;
    if (o.cat === 'night') h += `<div class="card"><b>${L('Order status', '订单状态')}</b><div class="sub" style="margin-top:4px">${o.purchase === 'needs' ? L('Not ordered · runner pays upfront', '未下单（需跑手垫付）') : L('Already ordered', '已下单')}</div></div>`;
    h += runnerCard(o);
    if (take && (o.status === 'waiting' || o.status === 'taken')) h += `<div class="card"><div class="person"><span class="av sq">${ic('camera', 18)}</span><div class="grow"><b>${o.cat === 'night' ? L('Upload related order photos', '上传相关订单照片') : L('Placement photos (optional)', '放置位置照片（选填）')}</b><span>${o.cat === 'night' ? L('Optional', '可选') : L('Optional · Show where the bag is', '选填 · 告诉跑手外卖放在哪里')}</span></div><button class="btn light small" data-a="say" data-en="Opens the photo album, up to 3 photos (unchanged)." data-zh="打开相册，最多 3 张（不变）。">＋ ${L('Upload', '上传')}</button></div><div class="sub" style="margin-top:8px">${L('Album · up to 3 photos', '相册上传 · 最多 3 张')}</div></div>`;
    if (o.t.delivered) h += `<div class="card">${proofBox(L('Delivery photo', '送达照片') + ' · ' + clock(o.t.delivered) + (o.drop ? ' · ' + tx(o.drop) : ''))}</div>`;
    h += confirmCard(o);
    if (o.status === 'disputed') h += `<div class="card"><b>${tx(o.issue)}</b><div class="sub" style="margin-top:4px">${L('Reported ' + dateTime(o.t.reported) + '. The payout is held while we review.', dateTime(o.t.reported) + ' 已反馈，审核期间赏金冻结。')}</div><div class="acts"><button class="btn line" disabled>${L('Something’s wrong', '有问题')}</button></div></div>`;
    h += `<div class="card"><b>${L('Order details', '订单详情')}</b><div class="drow"><span>${o.cat === 'night' ? L('Shop', '店铺') : L('Pickup', '取件点')}</span><b>${orderTitle(o)}</b></div><div class="drow"><span>${L('Deliver to', '送达地点')}</span><b>${tx(o.to)}</b></div>${o.cat === 'takeout' ? `<div class="drow"><span>${L('Food arrival', '外卖到达')}</span><b>${L('Food is there now', '外卖已到')}</b></div>` : ''}${o.cat === 'parcel' ? `<div class="drow"><span>${L('Parcels', '包裹')}</span><b>${tx(o.sizes)}</b></div>` : ''}<div class="drow"><span>${L('Price', '赏金')}</span><b style="color:var(--orange);font-size:16px">¥${money(o.total)}</b></div></div>`;
    h += cancelCard(o);
    if (o.reason) h += `<div class="card"><b>${L('Cancellation reason', '取消原因')}</b><div style="margin-top:4px">${tx(o.reason)}</div></div>`;
    if (isPast(o)) h += `<div class="pgact"><button class="btn line wide" data-a="again">${L('Post again', '再来一单')}</button></div>`;
    return h + '</div>';
  }
  function taskPage(P) {
    const v = P.view;
    if (v.run) {
      const r = prep(G.data.runs.find(x => x.id === v.run)), it = r && r.items[0];
      if (!it) return `<div class="pg"><div class="card"><b>${L('Task returned to the board', '任务已退回大厅')}</b><div class="acts"><button class="btn" data-a="findJob">${L('Find another job', '再找一单')}</button></div></div></div>`;
      const m = runMeta(it);
      let h = `<div class="pg"><div class="h1">${tx(it.title)}</div><div class="sub">${L('Task', '任务')} · ¥${money(it.reward)} · ${m.label}</div><div class="card">${track(runSteps(it), m)}<div class="next"><span>${m.hint}</span></div></div>
        <div class="card"><div class="person">${avatar(it.owner)}<div class="grow"><b>${it.owner}</b><span>${L('Publisher', '发布人')}</span></div>${contactBtns()}</div>${it.note ? `<div class="memo"><span>${L('Note from the publisher', '发布人备注')}</span>${tx(it.note)}</div>` : ''}${it.dueAt ? `<div class="drow"><span>${L('Complete by', '完成截止')}</span><b>${clock(it.dueAt)}</b></div>` : ''}</div>`;
      if (it.status === 'taken') h += `<div class="card"><b>${L('Completion proof', '完成凭证')}</b><div class="sub" style="margin-top:4px">${L('A photo and a short note (3–500 characters) are both required.', '需要一张照片和一段说明（3–500 字）。')}</div>
          ${v.photo ? proofBox(L('Photo added. Tap to replace.', '已添加照片，点击可更换。')).replace('<div class="proof"', '<div class="proof" data-a="tphoto"') : `<button class="dash" data-a="tphoto">${L('Take / choose a photo', '拍摄或选择照片')}</button>`}
          <textarea data-note placeholder="${L('What did you do? Where did you leave it?', '说明你完成了什么、放在哪里')}">${v.note || ''}</textarea>
          <div class="acts"><button class="btn" data-a="tdone" ${v.photo ? '' : 'disabled'}>${L('Send photo and note', '提交照片和说明')}</button></div></div>
        <div class="card center"><button class="btn line wide" data-a="giveback" data-run="${r.id}" data-item="${it.id}">${L('Give the task back', '退回任务')}</button><button class="textlink" data-a="giveback" data-run="${r.id}" data-item="${it.id}">${L('The details don’t match what was posted', '任务信息与实际不符')}</button></div>`;
      else h += `<div class="card">${proofBox(L('Photo and note sent · ', '已提交照片和说明 · ') + clock(it.t.delivered || now()))}<div class="gnote" style="margin:10px 0 0">${it.status === 'confirmed' ? L('Confirmed. This task is complete.', '已确认，任务完成。') : L('Completion submitted. Waiting for the customer to confirm.', '完成说明已提交，等待发布者确认。')}</div></div>`;
      return h + '</div>';
    }
    const o = G.data.orders.find(x => x.id === v.id);
    let h = `<div class="pg"><div class="h1">${tx(o.title)}</div><div class="sub">${L('Task', '任务')} · ¥${money(o.total)}</div>${ticket(o)}${runnerCard(o)}`;
    if (o.status === 'taken') h += `<div class="card"><div class="rowline"><div><b>${L('Add a tip', '添加小费')}</b><div class="sub">${L('Optional. Goes to your runner with this task.', '选填，随任务一起给跑手。')}</div></div><button class="btn light small" data-a="say" data-en="Opens the existing tip amount box." data-zh="打开现有的小费金额输入框。">${L('Add tip', '添加小费')}</button></div></div>`;
    if (o.t.delivered) h += `<div class="card">${proofBox(L('Completion photo and note from ', '完成照片和说明 · ') + o.runner + ' · ' + clock(o.t.delivered))}</div>`;
    h += confirmCard(o) + cancelCard(o);
    if (o.reason) h += `<div class="card"><b>${L('Cancellation reason', '取消原因')}</b><div style="margin-top:4px">${tx(o.reason)}</div></div>`;
    return h + '</div>';
  }
  const viewPage = P => (P.view.type === 'trip' ? tripPage(P) : P.view.type === 'task' ? taskPage(P) : requestPage(P));
  const viewTitle = P => (P.view.type === 'trip' ? L('Pick up & deliver', '取件与送达') : P.view.type === 'task' ? L('Task', '任务') : L('Order', '订单'));
  function flowSheet(P, s) {
    if (s.type === 'proof') return sheetWrap(P, L('Delivery proof', '送达凭证'), `${s.sent ? '' : `<button class="dash" data-a="proof-pick">${s.photo ? L('Replace photo', '更换照片') : L('Take / choose a photo', '拍摄或选择照片')}</button>`}${s.photo ? proofBox(L('Photo ready (sample).', '照片已选择（示例）。')) : ''}${s.sent ? `<div class="gnote">${L('Delivery proof submitted. This view stays open until you return.', '送达凭证已提交。点击下方按钮返回行程。')}</div>` : ''}`, `${s.sent ? '' : `<button class="btn" data-a="proof-send" ${s.photo ? '' : 'disabled'}>${L('Send delivery proof', '提交送达凭证')}</button>`}<button class="btn line ${s.sent ? '' : 'small'}" data-a="close">${s.sent ? L('Return to trip', '返回行程') : L('Back', '返回')}</button>`);
    const food = (G.data.runs.find(x => x.id === s.run) || {}).cat !== 'parcel';
    const opts = [['missing', food ? L('Can’t find the food', '找不到外卖') : L('Can’t find the parcel', '找不到快递'), L('No mark. No waiting required.', '不记录取消，无需等待。')], ['quantity', L('Number of items doesn’t match', '数量不符'), L('No mark. The student can see the cancellation reason.', '不记录。发布人可以看到取消原因。')], ['personal', L('I can’t do it anymore', '我无法继续完成'), L('Adds a mark to your runner record.', '会在你的跑手记录中记一次。')]];
    return sheetWrap(P, L('Why are you cancelling?', '为什么取消？'), opts.map(o => `<button class="opt ${s.reason === o[0] ? 'on' : ''}" data-a="rc-reason" data-v="${o[0]}"><i></i><span><b style="font-weight:600">${o[1]}</b><span class="sub" style="display:block">${o[2]}</span></span></button>`).join(''), `<button class="btn line small" data-a="close">${L('Back', '返回')}</button><button class="btn" data-a="rc-ok" ${s.reason ? '' : 'disabled'}>${L('Confirm reason', '确认原因')}</button>`);
  }
  function giveBack(P, runId, itemId) {
    const D = G.data, r = D.runs.find(x => x.id === runId); if (!r) return;
    r.items = r.items.filter(x => x.id !== itemId);
    const j = D.jobs.find(x => x.id === itemId); if (j) j.status = 'waiting';
    if (!r.items.length) D.runs = D.runs.filter(x => x !== r);
    P.sheet = null; renderAll(); toast(P, L('Returned to the board. The order is active again.', '已退回大厅，订单重新开放接单。'));
  }
  const findItem = d => { const r = G.data.runs.find(x => x.id === d.run); return { r, it: r && r.items.find(x => x.id === d.item) }; };

  // ---------------- Rendering ----------------
  function tabbar(P) {
    const unread = G.data.orders.some(o => o.unread);
    const tab = (key, icon, label, extra) => `<button class="tab ${P.page === key ? 'on' : ''}" ${extra}><img src="${A}${icon}" alt=""><span>${label}</span>${key === 'orders' && unread ? '<i class="dot"></i>' : ''}</button>`;
    return `<div class="tabbar">${tab('jobs', P.page === 'jobs' ? 'jobs-active.png' : 'jobs.png', L('Jobs', '接单大厅'), 'data-a="nav" data-p="jobs"')}${tab('orders', P.page === 'orders' ? 'orders-active.png' : 'orders.png', L('My orders', '我的订单'), 'data-a="nav" data-p="orders"')}<button class="tab" data-a="create"><span class="plus"><img src="${A}icons/plus-white.svg" alt=""></span><span>${L('Post', '发布')}</span></button>${tab('news', 'rewards.png', L('News', '动态'), 'data-a="say" data-en="News is not part of this preview." data-zh="「动态」不在本次预览范围内。"')}${tab('me', 'profile.png', L('Me', '我的'), 'data-a="say" data-en="Me is not part of this preview." data-zh="「我的」不在本次预览范围内。"')}</div>`;
  }
  function render(P, opts = {}) {
    const old = P.el.querySelector('.scroll'), top = old && !opts.top ? old.scrollTop : 0, shTop = (P.el.querySelector('.sh-body') || {}).scrollTop || 0;
    // overlay() decides whether the sheet animates in, so build it before the page markup is written.
    const page = P.view ? viewPage(P) : P.page === 'jobs' ? jobsPage(P) : ordersPage(P);
    P.el.innerHTML = `<div class="sb"><span data-now>${clock(now())}</span><span>●●● ▭</span></div><div class="wxnav">${P.view ? `<button class="back" data-a="back" aria-label="Back">${ic('chev', 20, 2.2)}</button>` : ''}${P.view ? viewTitle(P) : P.page === 'jobs' ? L('Jobs', '接单大厅') : L('My orders', '我的订单')}<span class="capsule">•••<i></i>◉</span></div><div class="scroll ${opts.enter ? 'enter' : ''}">${page}</div>${P.view ? '' : tabbar(P)}${overlay(P)}`;
    P.el.querySelector('.scroll').scrollTop = top;
    const sh = P.el.querySelector('.sh-body'); if (sh && P.still) sh.scrollTop = shTop;
    P.el.querySelectorAll('.thumb').forEach(th => requestAnimationFrame(() => requestAnimationFrame(() => { th.style.transform = `translateX(${th.dataset.to * 100}%)`; })));
  }
  const renderAll = () => G.phones.forEach(P => render(P));
  function toast(P, text) { P.toast = text; render(P); clearTimeout(P.toastTimer); P.toastTimer = setTimeout(() => { P.toast = ''; render(P); }, 2400); }

  // ---------------- Actions ----------------
  function doTake(P, ids) {
    const D = G.data, jobs = ids.map(id => D.jobs.find(j => j.id === id)).filter(j => j && j.status === 'waiting'), n = now();
    if (!jobs.length) return;
    const run = { id: 'run' + n, cat: jobs[0].cat, items: jobs.map(j => ({ id: j.id, kind: j.kind, title: j.title, from: j.cat === 'night' ? j.shop : j.from, to: j.cat === 'task' ? null : dest(j.area, j.building, j.priv && j.priv.room), gender: j.gender, qty: j.qty, reward: j.reward, status: 'taken', purchase: j.purchase, arrived: j.arrived, arrivalAt: j.arrivalAt, deadline: j.deadline, dueAt: j.dueAt, note: j.note, code: j.priv && j.priv.code, soup: j.soup, fragile: j.fragile, t: { taken: n } })) };
    jobs.forEach(j => { j.status = 'taken'; P.picked.delete(j.id); });
    D.runs.unshift(run);
    P.sheet = null; P.view = run.cat === 'task' ? { type: 'task', id: run.items[0].id, run: run.id } : { type: 'trip', id: run.id };
  }
  const ACT = {
    nav(P, d) { if (P.page === d.p) return; P.page = d.p; P.sheet = null; P.chip = 'all'; render(P, { enter: true, top: true }); },
    jobsTab(P, d) { if (P.jobsTab !== d.v) { P.jobsTab = d.v; render(P, { enter: true, top: true }); } },
    ordersTab(P, d) { if (P.ordersTab !== d.v) { P.ordersTab = d.v; P.chip = 'all'; render(P, { enter: true, top: true }); } },
    cat(P, d) { P.cat = d.v; render(P, { enter: true }); },
    chip(P, d) { P.chip = d.v; render(P, { enter: true }); },
    way(P, d) { P.f.area = P.f.area === d.area ? '' : d.area; P.f.building = ''; render(P, { enter: true }); },
    sort(P) { P.sort = SORTS[(SORTS.findIndex(s => s[0] === P.sort) + 1) % SORTS.length][0]; render(P, { enter: true }); },
    filter(P) { P.sheet = { type: 'filter' }; render(P); },
    'f-area'(P, d) { P.f.area = d.v; P.f.building = ''; render(P); },
    'f-building'(P, d) { P.f.building = d.v; render(P); },
    'f-gender'(P, d) { P.f.gender = d.v; render(P); },
    'f-time'(P, d) { P.f.time = d.v; render(P); },
    'f-sort'(P, d) { P.sort = d.v; render(P); },
    'f-limit'(P) { P.f.limit = !P.f.limit; render(P); },
    'f-clear'(P) { P.f = { area: '', building: '', gender: '', time: 'any', limit: false }; P.cat = 'all'; render(P); },
    close(P) { P.sheet = null; render(P); },
    job(P, d) { P.sheet = { type: 'job', id: d.id }; render(P); },
    pick(P, d) { if (P.picked.has(d.id)) P.picked.delete(d.id); else P.picked.add(d.id); render(P); },
    gate(P) { P.sheet = { type: 'gate' }; render(P); },
    take(P, d) {
      const ids = String(d.ids || '').split(',').filter(Boolean), D = G.data; if (!ids.length) return;
      if (!D.me.runner) { P.sheet = { type: 'gate' }; return render(P); }
      const sum = ids.reduce((n, id) => n + D.jobs.find(j => j.id === id).reward, 0);
      // Same wording as utils/accept-confirm.js
      P.modal = { title: L('Take this job?', '确定接单吗？'), text: L('You are accepting ' + ids.length + ' order(s) for ¥' + money(sum) + '. Please confirm you can complete the pickup and delivery.', '即将接取 ' + ids.length + ' 单，预计赏金 ¥' + money(sum) + '。请确认你能完成取件和送达。'), no: L('Cancel', '暂不接单'), yes: L('Take job', '确认接单'), run: () => doTake(P, ids) };
      render(P);
    },
    'modal-no'(P) { P.modal = null; render(P); },
    'modal-yes'(P) { const run = P.modal.run; P.modal = null; run(); renderAll(); },
    goRun(P) { P.page = 'orders'; P.ordersTab = 'running'; P.chip = 'all'; P.sheet = null; render(P, { enter: true, top: true }); },
    minePosts(P) { P.page = 'orders'; P.ordersTab = 'requested'; P.chip = 'pending'; P.sheet = null; render(P, { enter: true, top: true }); },
    order(P, d) { P.sheet = { type: 'order', id: d.id }; render(P); },
    run(P, d) { P.sheet = { type: 'run', id: d.id }; render(P); },
    reply(P, d) { const o = G.data.orders.find(x => x.id === d.id); o.unread = null; renderAll(); toast(P, L('Reply sent', '回复已发送')); },
    raise(P, d) { P.sheet = { type: 'raise', id: d.id, amt: 0 }; render(P); },
    'raise-amt'(P, d) { P.sheet.amt = Number(d.v); render(P); },
    'raise-ok'(P) { const o = G.data.orders.find(x => x.id === P.sheet.id), amt = P.sheet.amt; o.raised = (o.raised || 0) + amt; o.total += amt; P.sheet = null; renderAll(); toast(P, L('Offer raised by ¥' + money(amt), '已加价 ¥' + money(amt))); },
    cancel(P, d) { P.sheet = { type: 'cancel', id: d.id, reason: '' }; render(P); },
    'cancel-reason'(P, d) { P.sheet.reason = d.v; render(P); },
    'cancel-ok'(P) { const o = G.data.orders.find(x => x.id === P.sheet.id), r = REASONS.find(x => x[0] === P.sheet.reason); o.status = 'cancelled'; o.reason = { en: r[1], zh: r[0] }; o.t.cancelled = now(); o.unread = null; P.sheet = null; renderAll(); toast(P, L('Order cancelled · demo refund ¥' + money(o.total), '订单已取消 · 模拟退款 ¥' + money(o.total))); },
    confirm(P, d) {
      const o = G.data.orders.find(x => x.id === d.id);
      P.modal = { title: L('Confirm receipt?', '确认收货？'), text: L('Confirm only after you have checked your items. ' + o.runner + ' will receive ¥' + money(o.total) + '.', '请在检查物品后确认。' + o.runner + ' 将获得 ¥' + money(o.total) + '。'), no: L('Not yet', '再看看'), yes: L('Confirm', '确认收货'), run: () => { o.status = 'confirmed'; o.t.confirmed = now(); P.sheet = { type: 'thanks', id: o.id }; } };
      render(P);
    },
    advance(P, d) {
      const r = G.data.runs.find(x => x.id === d.run), it = r.items.find(x => x.id === d.item), n = now();
      if (it.status === 'taken' && !it.title) { it.status = 'collected'; it.t.collected = n; }
      else { it.status = 'delivered'; it.t.delivered = n; it.autoAt = n + (it.title ? 24 : r.cat === 'parcel' ? 48 : 1) * 60 * MIN; }
      renderAll(); toast(P, it.status === 'collected' ? L('Picked up · now deliver it', '已取件 · 请尽快送达') : L('Photo sent · waiting for confirmation', '已提交凭证 · 等待确认'));
    },
    again(P) { toast(P, L('Opens the post form, pre-filled from this order.', '打开发布页，并按这笔订单预填。')); },
    post(P) { P.sheet = null; toast(P, L('Opens the existing post form (unchanged).', '打开现有的发布页面（不变）。')); },
    create(P) { P.sheet = { type: 'create' }; render(P); },
    say(P, d) { toast(P, L(d.en, d.zh)); }
  };

  ACT.pastFilter = (P, d) => { if (P.pastFilter !== d.v) { P.pastFilter = d.v; render(P); } };
  Object.assign(ACT, {
    back(P) { P.view = null; P.sheet = null; render(P, { enter: true, top: true }); },
    order(P, d) { const o = G.data.orders.find(x => x.id === d.id); if (!o) return; P.sheet = null; P.view = { type: o.cat === 'task' ? 'task' : 'request', id: o.id }; render(P, { top: true }); },
    run(P, d) { const r = G.data.runs.find(x => x.id === d.id); if (!r) return; P.sheet = null; P.view = r.cat === 'task' ? { type: 'task', id: r.items[0].id, run: r.id } : { type: 'trip', id: r.id }; render(P, { top: true }); },
    confirm(P, d) { const o = G.data.orders.find(x => x.id === d.id); o.status = 'confirmed'; o.t.confirmed = now(); renderAll(); toast(P, L('Confirmed · ¥' + money(o.total) + ' settled to ' + o.runner + ' (demo)', '已确认 · 已向 ' + o.runner + ' 结算 ¥' + money(o.total) + '（演示）')); },
    'raise-now'(P, d) { const o = G.data.orders.find(x => x.id === d.id), amt = Number(d.v); o.raised = (o.raised || 0) + amt; o.total += amt; renderAll(); toast(P, L('Offer raised by ¥' + money(amt), '已加价 ¥' + money(amt))); },
    got(P, d) { const { r, it } = findItem(d); it.parcels[Number(d.i)].done = true; if (it.parcels.every(p => p.done)) { it.status = 'collected'; it.t.collected = now(); } renderAll(); if (phase(r) === 'deliver') toast(P, L('All collected · now deliver', '已全部取件 · 请开始送达')); },
    pickup(P, d) { const { it } = findItem(d); it.status = 'collected'; it.t.collected = now(); renderAll(); },
    tcancel(P, d) { P.sheet = { type: 'rcancel', run: d.run, item: d.item, reason: '' }; render(P); },
    'rc-reason'(P, d) { P.sheet.reason = d.v; render(P); },
    'rc-ok'(P) { giveBack(P, P.sheet.run, P.sheet.item); },
    giveback(P, d) { giveBack(P, d.run, d.item); },
    photo(P, d) { P.sheet = { type: 'proof', run: d.run, item: d.item, photo: false, sent: false }; render(P); },
    'proof-pick'(P) { P.sheet.photo = true; render(P); },
    'proof-send'(P) { const { r, it } = findItem(P.sheet); it.status = 'delivered'; it.t.delivered = now(); it.autoAt = now() + autoHours(r.cat) * 60 * MIN; P.sheet.sent = true; renderAll(); },
    full(P, d) { P.view.full = P.view.full || {}; P.view.full[d.id] = !P.view.full[d.id]; render(P); },
    findJob(P) { P.view = null; P.sheet = null; P.page = 'jobs'; P.jobsTab = 'open'; render(P, { enter: true, top: true }); },
    tphoto(P) { P.view.photo = true; render(P); },
    tdone(P) { const v = P.view; if (String(v.note || '').trim().length < 3) return toast(P, L('Add a short note first (at least 3 characters).', '请先填写说明（至少 3 个字）。')); const r = G.data.runs.find(x => x.id === v.run), it = r.items[0]; it.status = 'delivered'; it.t.delivered = now(); it.autoAt = now() + 24 * 60 * MIN; renderAll(); toast(P, L('Photo and note sent', '已提交照片和说明')); }
  });
  document.addEventListener('input', e => { const t = e.target; if (!t.hasAttribute || !t.hasAttribute('data-note')) return; const P = G.phones.find(p => p.el.contains(t)); if (P && P.view) P.view.note = t.value; });
  function tick() {
    let flip = false;
    document.querySelectorAll('[data-cd]').forEach(el => { const ts = Number(el.dataset.cd); el.textContent = left(ts, el.dataset.f); if (el.hasAttribute('data-flip') && ts <= now()) flip = true; });
    document.querySelectorAll('[data-now]').forEach(el => { el.textContent = clock(now()); });
    if (flip) renderAll();
  }
  function reset() {
    const d = new Date(); d.setHours(19, 40, 0, 0); G.base = d.getTime(); G.t0 = Date.now();
    G.data = build(G.scenario, G.base);
    G.phones.forEach((P, i) => Object.assign(P, { page: i === 0 ? 'jobs' : 'orders', jobsTab: 'open', cat: 'all', sort: 'closing', f: { area: '', building: '', gender: '', time: 'any', limit: false }, picked: new Set(), ordersTab: 'requested', chip: 'all', view: null, sheet: null, modal: null, toast: '', thumb: {}, lastSheet: '', still: false }));
    G.phones.forEach(P => render(P, { enter: true, top: true }));
  }
  function fit() {
    const w = window.innerWidth, h = window.innerHeight, two = w >= 720;
    const k = Math.min(1, two ? (w - 56) / 798 : (w - 24) / 399, Math.max((h - 150) / 836, 0.8));
    document.documentElement.style.setProperty('--k', Math.max(0.5, k));
  }
  function seg(id, key, after) {
    const box = document.getElementById(id);
    box.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; G[key] = b.dataset.v; box.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); after(); });
  }

  [0, 1].forEach(i => {
    const el = document.getElementById('phone-' + i), P = { el };
    G.phones.push(P);
    el.addEventListener('click', e => { const t = e.target.closest('[data-a]'); if (!t || !el.contains(t) || t.disabled) return; const fn = ACT[t.dataset.a]; if (fn) fn(P, t.dataset); });
  });
  seg('scenario', 'scenario', reset);
  seg('lang', 'lang', () => { document.documentElement.lang = G.lang === 'en' ? 'en' : 'zh-CN'; renderAll(); });
  document.querySelector('.which').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; document.querySelectorAll('.which button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); document.querySelectorAll('.device-wrap').forEach((wr, i) => wr.classList.toggle('on', String(i) === b.dataset.i)); });
  window.addEventListener('resize', fit);
  fit(); reset(); setInterval(tick, 1000);
})();
