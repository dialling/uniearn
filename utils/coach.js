'use strict';
// 2026-11-16: first-time tips. One short spotlight (2–3 steps) the first time someone uses a screen, then never again.
// Same look as the Jobs page app guide. "Replay the app guide" (Me › Yuni) resets them.
// target: an element in the screen that holds the tip; "component >>> element" looks inside a component.
const store = require('./store');
const TIPS = {
  post: [
    { target: '#csPickup', pose: 'go', fixed: true, zh: ['发布代取', '门口的外卖、驿站的快递，跑手帮你送到宿舍。'], en: ['Post a pick-up', 'Food at the gate or a parcel at the station. A runner brings it to your door.'] },
    { target: '#csTask', pose: 'think', fixed: true, zh: ['发布任何任务', '其他校园小事也可以，时间和价格你来定。'], en: ['Post any task', 'Anything else on campus. You set the time and the price.'] },
    { target: '#csTrip', pose: 'party', fixed: true, zh: ['发起顺路行程', '本来就要去？分享路线，顺路帮同学带东西赚零花钱。'], en: ['Start a trip', 'Going anyway? Share your route and earn by bringing classmates’ orders.'] }
  ],
  trip: [
    { target: '.ts-route', pose: 'look', zh: ['你的路线', '在哪里取，送到哪里。'], en: ['Your route', 'Where you pick up and where you’re heading.'] },
    { target: '.ts-card', pose: 'think', zh: ['时间和数量', '选好出发时间、开放加入多久，以及最多能带几件。'], en: ['When and how much', 'Pick when you leave, how long others can join, and how much you can carry.'] },
    { target: '.ts-go', pose: 'party', fixed: true, zh: ['分享行程', '发到宿舍群。同学加入后，由你决定接哪一单。'], en: ['Share your trip', 'Send it to your dorm group. Classmates add orders and you choose which to take.'] }
  ],
  takeaway: [
    { target: '.flow-card', pose: 'look', zh: ['外卖在哪里', '选外卖柜和送达时间，宿舍和房间会自动填好。'], en: ['Where your food is', 'Pick the locker and arrival time. Your dorm and room fill in for you.'] },
    { target: '.post-submit', pose: 'go', fixed: true, zh: ['发布', '跑手会在接单大厅看到。进度在「我的订单」里查看。'], en: ['Post it', 'Runners see it in the job hall. Follow it in My orders.'] }
  ],
  parcel: [
    { target: '#parcelSizes', pose: 'look', zh: ['你的快递', '选包裹大小和数量，或者识别驿站短信自动填写取件码。'], en: ['Your parcels', 'Pick sizes and how many, or scan the station SMS to fill in the codes.'] },
    { target: '.post-submit', pose: 'go', fixed: true, zh: ['发布', '跑手会在接单大厅看到。进度在「我的订单」里查看。'], en: ['Post it', 'Runners see it in the job hall. Follow it in My orders.'] }
  ],
  task: [
    { target: '.tp-card', pose: 'think', zh: ['说清楚需要什么', '写上地点和时间，跑手更容易接。'], en: ['Say what you need', 'Include where and when, so a runner can say yes fast.'] },
    { target: '.tp-go', pose: 'go', fixed: true, zh: ['设好报酬再发布', '任何跑手都能接，完成后你来确认。'], en: ['Set a reward and post', 'Any runner can take it. You confirm when it’s done.'] }
  ]
};
const who = () => { const p = store.get().profile || {}; return p.accountId || 'local'; };
function seen(name) { return ((store.get().coachSeen || {})[who()] || []).includes(name); }
function mark(name) { store.update(s => { const id = who(), all = { ...(s.coachSeen || {}) }; all[id] = (all[id] || []).filter(n => n !== name).concat(name); s.coachSeen = all; }); }
function reset() { store.update(s => { const all = { ...(s.coachSeen || {}) }; delete all[who()]; s.coachSeen = all; }); }
function steps(name, language) { const zh = language !== 'en'; return (TIPS[name] || []).map(t => ({ target: t.target, pose: t.pose, fixed: !!t.fixed, title: (zh ? t.zh : t.en)[0], text: (zh ? t.zh : t.en)[1] })); }
module.exports = { steps, seen, mark, reset, names: Object.keys(TIPS) };
