'use strict';
// 2026-11-21: Post sheet tip titles use the cards' own names (我需要！发布代取 / 其他需求 / 我顺路！发起行程).
// 2026-11-16: first-time tips. One short spotlight (1–3 steps) the first time someone uses a screen, then never again.
// Same look as the Jobs page app guide. "Replay the app guide" (Me › Yuni) resets them.
// target: an element in the screen that holds the tip; "component >>> element" looks inside a component.
const store = require('./store');
const TIPS = {
  post: [
    { target: '#csPickup', pose: 'go', fixed: true, zh: ['我需要！发布代取', '门口的外卖、驿站的快递，跑手帮你送到宿舍。'], en: ['Post a pick-up', 'Food at the gate or a parcel at the station. A runner brings it to your door.'] },
    { target: '#csTask', pose: 'think', fixed: true, zh: ['其他需求', '其他校园小事也可以，时间和价格你来定。'], en: ['Post any task', 'Anything else on campus. You set the time and the price.'] },
    { target: '#csTrip', pose: 'party', fixed: true, zh: ['我顺路！发起行程', '本来就要去？分享路线，顺路帮同学带东西赚零花钱。'], en: ['Start a trip!', 'Going anyway? Share your route and earn by bringing classmatesʼ orders.'] }
  ],
  // 2026-11-17: only the parts people get wrong. Posting is obvious, so no step points at the post button.
  trip: [
    { target: '#tsOther', pose: 'look', zh: ['还想去哪里？', '去超市、便利店或其他商店？选择「其他」，填写出发地、途经地点和目的地，让同路的同学把订单加入你的行程。'], en: ['Where else are you heading?', 'Heading to a supermarket, convenience store or another shop? Choose Other and enter your starting point, stops and destination so classmates along your route can add their orders.'] },
    { target: '.ts-go', pose: 'party', fixed: true, zh: ['分享行程', '发到宿舍群。顺路的同学把订单加进来，由你决定接哪一单。'], en: ['Share your trip', 'Send it to your dorm group. Classmates on your route add their orders, and you choose which to take.'] }
  ],
  takeaway: [
    { target: '.arrival-card', pose: 'think', zh: ['外卖还没到？', '选「未送达」，填外卖平台显示的最晚送达时间。外卖到了跑手再去取；如果提前送到，可以在订单里改时间。'], en: ['Food not here yet?', 'Pick Not yet and enter the latest time your delivery app shows. The runner collects it after it arrives. If it comes early, change the time in your order.'] }
  ],
  // 2026-11-17: Night market: what "Already ordered" and "Not ordered" mean
  night: [
    { target: '.purchase-status-card', pose: 'think', zh: ['已经下单了吗？', '已下单：你已在店里或 App 付好钱，跑手只需帮你取。未下单：跑手帮你买并先垫付，请在备注写清要买什么，接单后和跑手确认垫付金额。'], en: ['Already ordered or not?', 'Already ordered: youʼve paid at the stall or in the app, so the runner just collects it. Not ordered: the runner buys it and pays first. Write what to buy in your note, then agree the amount with your runner once they accept.'] }
  ],
  parcel: [
    { target: '.notice-upload', pose: 'look', zh: ['上传截图就行', '上传驿站短信或取件 App 的截图，Yuni 会帮你识别驿站和取件码。只有接单的跑手能看到。'], en: ['Just upload a screenshot', 'Add a screenshot of the station SMS or app. Yuni reads the station and pickup codes for you. Only the runner who takes your order sees them.'] }
  ],
  task: [
    { target: '.deadline-card', pose: 'think', zh: ['订单会展示到什么时候？', '到截止时间仍无人接单，订单会从接单大厅移除，并自动关闭、全额退款。如果你要求跑手在指定时间前完成任务，请在任务描述中写明。'], en: ['How long will your order stay listed?', 'If no runner accepts by the deadline, your order will be removed from the order hall and closed automatically with a full refund. If the task needs to be completed by a specific time, please include that time in the task description.'] }
  ]
};
const who = () => { const p = store.get().profile || {}; return p.accountId || 'local'; };
// Bump a version when a tip set changes so everyone sees the new one once.
const VERSION = { night: 1, trip: 2, takeaway: 2, parcel: 2, task: 2 }, key = n => VERSION[n] ? n + '@' + VERSION[n] : n;
function seen(name) { return ((store.get().coachSeen || {})[who()] || []).includes(key(name)); }
function mark(name) { const k = key(name); store.update(s => { const id = who(), all = { ...(s.coachSeen || {}) }; all[id] = (all[id] || []).filter(n => n !== k).concat(k); s.coachSeen = all; }); }
function reset() { store.update(s => { const all = { ...(s.coachSeen || {}) }; delete all[who()]; s.coachSeen = all; }); }
function steps(name, language) { const zh = language !== 'en'; return (TIPS[name] || []).map(t => ({ target: t.target, pose: t.pose, fixed: !!t.fixed, title: (zh ? t.zh : t.en)[0], text: (zh ? t.zh : t.en)[1] })); }
module.exports = { steps, seen, mark, reset, names: Object.keys(TIPS) };
