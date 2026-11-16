'use strict';
// 2026-11-16: first-time tips. One short spotlight (1–3 steps) the first time someone uses a screen, then never again.
// Same look as the Jobs page app guide. "Replay the app guide" (Me › Yuni) resets them.
// target: an element in the screen that holds the tip; "component >>> element" looks inside a component.
const store = require('./store');
const TIPS = {
  post: [
    { target: '#csPickup', pose: 'go', fixed: true, zh: ['发布代取', '门口的外卖、驿站的快递，跑手帮你送到宿舍。'], en: ['Post a pick-up', 'Food at the gate or a parcel at the station. A runner brings it to your door.'] },
    { target: '#csTask', pose: 'think', fixed: true, zh: ['发布任何任务', '其他校园小事也可以，时间和价格你来定。'], en: ['Post any task', 'Anything else on campus. You set the time and the price.'] },
    { target: '#csTrip', pose: 'party', fixed: true, zh: ['发起顺路行程', '本来就要去？分享路线，顺路帮同学带东西赚零花钱。'], en: ['Start a trip', 'Going anyway? Share your route and earn by bringing classmates’ orders.'] }
  ],
  // 2026-11-17: only the parts people get wrong. Posting is obvious, so no step points at the post button.
  trip: [
    { target: '#tsOther', pose: 'look', zh: ['去其他地方？', '选「其他」，自己填路线：从哪里出发、途经哪里、最后去哪里。'], en: ['Going somewhere else?', 'Pick Other and type your own route: where you start, a stop on the way, and where you’re heading.'] },
    { target: '.ts-go', pose: 'party', fixed: true, zh: ['分享行程', '发到宿舍群。顺路的同学把订单加进来，由你决定接哪一单。'], en: ['Share your trip', 'Send it to your dorm group. Classmates on your route add their orders, and you choose which to take.'] }
  ],
  takeaway: [
    { target: '.arrival-card', pose: 'think', zh: ['外卖还没到？', '选「未送达」，填外卖平台显示的最晚送达时间。外卖到了跑手再去取；如果提前送到，可以在订单里改时间。'], en: ['Food not here yet?', 'Pick Not yet and enter the latest time your delivery app shows. The runner collects it after it arrives. If it comes early, change the time in your order.'] }
  ],
  parcel: [
    { target: '.notice-upload', pose: 'look', zh: ['上传截图就行', '上传驿站短信或取件 App 的截图，Yuni 会帮你识别驿站和取件码。只有接单的跑手能看到。'], en: ['Just upload a screenshot', 'Add a screenshot of the station SMS or app. Yuni reads the station and pickup codes for you. Only the runner who takes your order sees them.'] }
  ],
  task: [
    { target: '.deadline-card', pose: 'think', zh: ['这是接单截止时间', '指跑手可以接单的时间，不是任务要完成的时间。什么时候做，请写在任务描述里。到时没人接单，任务会自动关闭并全额退款。'], en: ['A deadline to take your order', 'It’s how long runners can take your post, not when the task must be done. Put that time in your description. If nobody takes it in time, it closes with a full refund.'] }
  ]
};
const who = () => { const p = store.get().profile || {}; return p.accountId || 'local'; };
// Bump a version when a tip set changes so everyone sees the new one once.
const VERSION = { trip: 2, takeaway: 2, parcel: 2, task: 2 }, key = n => VERSION[n] ? n + '@' + VERSION[n] : n;
function seen(name) { return ((store.get().coachSeen || {})[who()] || []).includes(key(name)); }
function mark(name) { const k = key(name); store.update(s => { const id = who(), all = { ...(s.coachSeen || {}) }; all[id] = (all[id] || []).filter(n => n !== k).concat(k); s.coachSeen = all; }); }
function reset() { store.update(s => { const all = { ...(s.coachSeen || {}) }; delete all[who()]; s.coachSeen = all; }); }
function steps(name, language) { const zh = language !== 'en'; return (TIPS[name] || []).map(t => ({ target: t.target, pose: t.pose, fixed: !!t.fixed, title: (zh ? t.zh : t.en)[0], text: (zh ? t.zh : t.en)[1] })); }
module.exports = { steps, seen, mark, reset, names: Object.keys(TIPS) };
