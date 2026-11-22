'use strict';
// 2026-11-16: the Yuni guide on the Me page. Same spotlight as the Jobs page app guide.
// target: an element to highlight; "component >>> element" looks inside that component.
const { WINDOWS } = require('./yuni-catalog');
const fishSpan = id => { const w = WINDOWS.find(x => x.id === id); return w.from + ':00–' + w.to + ':00'; };
const STEPS = [
  { pose: 'wave', target: '', zh: ['认识 Yuni', '我是你在 Uniearn 的企鹅船长。来看看我们可以一起做什么吧！'], en: ['Meet Yuni', 'Iʼm your penguin captain on Uniearn. Let me show you what we can do together.'] },
  { pose: 'happy', target: '#yuni-stage >>> #ysYuni', zh: ['摸摸和点点', '摸摸我的头，我会害羞又开心。点一下跟我打招呼。'], en: ['Pet and tap', 'Stroke my head for hearts and happy sounds. Tap me to say hi.'] },
  { pose: 'happy', target: '#yuni-stage >>> #ysFeed', zh: ['喂 Yuni', '每天一条小鱼干，完成签到 +2 积分。钓到的鱼也在这里喂我。'], en: ['Feed Yuni', 'One dried fish a day checks you in for +2 points. The fish you catch are fed here too.'] },
  { pose: 'look', target: '#yuni-stage >>> #ysFish', zh: ['去钓鱼', '先买鱼竿。浮标沉下去时停在绿色区，再连点 3 次。每天免费钓一次，随时都行；午餐 ' + fishSpan('lunch') + '、晚餐 ' + fishSpan('dinner') + ' 各多一次。'], en: ['Go fishing', 'Buy a rod first. When the bobber dips, stop in the green, then tap 3 times. One free try a day at any time, plus a bonus try at lunch (' + fishSpan('lunch') + ') and dinner (' + fishSpan('dinner') + ').'] },
  { pose: 'party', target: '#yuni-stage >>> #ysPlay', zh: ['一起玩', '击掌、跳舞、转圈。快速连点能打出连击。'], en: ['Play together', 'High five, dance and spin. Tap again fast for combos.'] },
  { pose: 'go', target: '#yuni-stage >>> #ysShopBtn', zh: ['商店和伙伴', '用积分买帽子、场景，还有会帮你钓鱼的海鹰伙伴。'], en: ['Shop and friends', 'Spend points on outfits, scenes and an eagle friend that helps you fish.'] },
  { pose: 'think', target: '.me-level', zh: ['升级', '完成订单和陪 Yuni 都能赚积分，升级还会解锁新装备。'], en: ['Level up', 'Orders and time with Yuni earn points. New levels unlock new gear for me.'] }
];
function steps(language) { const zh = language !== 'en'; return STEPS.map(s => ({ pose: s.pose, target: s.target, title: (zh ? s.zh : s.en)[0], text: (zh ? s.zh : s.en)[1] })); }
module.exports = { steps, count: STEPS.length };
