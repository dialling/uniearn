'use strict';
// 2026-11-16: the Yuni guide on the Me page. Same spotlight as the Jobs page app guide.
// target: an element to highlight; "component >>> element" looks inside that component.
const STEPS = [
  { pose: 'wave', target: '', zh: ['认识 Yuni', '我是你在 Uniearn 的企鹅船长。来看看我们可以一起做什么吧！'], en: ['Meet Yuni', 'Iʼm your penguin captain on Uniearn. Let me show you what we can do together.'] },
  { pose: 'happy', target: '#yuni-stage >>> #ysYuni', zh: ['和 Yuni 互动', '点击 Yuni，和它打个招呼吧。'], en: ['Interact with Yuni', 'Tap Yuni to say hello.'] },
  { pose: 'happy', target: '#yuni-stage >>> #ysFeed', zh: ['喂食与签到', '每天点击「喂食」，用小鱼干完成签到，获得 2 积分。钓到鱼后，也可以通过「喂食」换取积分。'], en: ['Feed and check in', 'Tap Feed each day to check in with a dried fish and earn 2 points. You can also feed Yuni the fish you catch to earn points.'] },
  { pose: 'look', target: '#yuni-stage >>> #ysFish', zh: ['怎么钓鱼？', '先到商店购买鱼竿。浮标下沉后，等指针进入绿色区域时点击停住，再快速连点 3 次，就能钓起鱼。每天有 1 次免费机会，随时可用；午餐 11:00–14:00、晚餐 17:00–20:00 各增加 1 次机会。'], en: ['Go fishing', 'Buy a rod from the shop first. When the bobber dips, tap to stop the pointer in the green area, then tap quickly 3 times to land your fish. You get 1 free try each day to use anytime, plus 1 extra try at lunch (11:00–14:00) and 1 at dinner (17:00–20:00).'] },
  { pose: 'party', target: '#yuni-stage >>> #ysPlay', zh: ['一起玩', '击掌、跳舞、转圈。快速连点能打出连击。'], en: ['Play together', 'High five, dance and spin. Tap again fast for combos.'] },
  { pose: 'go', target: '#yuni-stage >>> #ysShopBtn', zh: ['商店和伙伴', '用积分买帽子、场景，还有会帮你钓鱼的海鹰伙伴。'], en: ['Shop and friends', 'Spend points on outfits, scenes and an eagle friend that helps you fish.'] },
  { pose: 'think', target: '.me-level', zh: ['升级', '完成订单和陪 Yuni 都能赚积分，升级还会解锁新装备。'], en: ['Level up', 'Orders and time with Yuni earn points. New levels unlock new gear for me.'] }
];
function steps(language) { const zh = language !== 'en'; return STEPS.map(s => ({ pose: s.pose, target: s.target, title: (zh ? s.zh : s.en)[0], text: (zh ? s.zh : s.en)[1] })); }
module.exports = { steps, count: STEPS.length };
