'use strict';
// Sample data for the Jobs / My orders design preview.
// Every field mirrors something the real app already has (see utils/workflow.js, utils/public-order.js,
// utils/runner-trip-card.js): statuses, pickup points, dorm areas, prices, tips and time limits are the real ones.
(function () {
  const MIN = 60000, DAY = 86400000;
  const AREAS = {
    wenyuan: { en: 'Wenyuan', zh: '文缘', buildings: ['D01', 'D02', 'D03', 'D04', 'D05', 'D06'] },
    wenxing: { en: 'Wenxing', zh: '文星', buildings: ['A01', 'A02', 'A03', 'A04', 'A05'] },
    wencui: { en: 'Wencui', zh: '文萃', buildings: ['C01', 'C02', 'C03', 'C04', 'C05', 'C06', 'C07', 'C08', 'C09', 'C10'] },
    wenhui: { en: 'Wenhui', zh: '文荟', buildings: ['B01', 'B02', 'B03', 'B04', 'B05', 'B06', 'B07', 'B08', 'B09', 'B10'] }
  };
  const PLACE = {
    kfc: { en: 'Fengshihui KFC takeaway locker', zh: '丰食汇KFC外卖柜' },
    nightLocker: { en: 'Wenyuan night market locker', zh: '文缘夜市门口外卖柜' },
    wencuiNorth: { en: 'Wencui north gate locker', zh: '文萃北门外卖柜' },
    fruit: { en: 'Wenxing fruit shop pickup point', zh: '文星水果店门口外卖点' },
    cainiaoWY: { en: 'Wenyuan Cainiao station', zh: '文缘菜鸟驿站' },
    cainiaoN: { en: 'North gate Cainiao station', zh: '北门菜鸟驿站' },
    hanlin: { en: 'Hanlin Mama station', zh: '翰林妈妈驿站' },
    jd: { en: 'East gate JD point', zh: '东门京东快递点' },
    night: { en: 'Night market', zh: '夜市代买' }
  };
  const dest = (area, building, room) => ({
    en: AREAS[area].en + ' ' + building + (room ? ' · Room ' + room : ''),
    zh: AREAS[area].zh + ' ' + building + (room ? ' ' + room + '室' : '')
  });

  function build(scenario, base) {
    const T = m => base + m * MIN;
    // A clock time on an earlier day, e.g. at(1,'18:22') = yesterday 18:22.
    const at = (daysAgo, hhmm) => { const d = new Date(base - daysAgo * DAY), p = hhmm.split(':'); d.setHours(+p[0], +p[1], 0, 0); return d.getTime(); };
    const runner = scenario !== 'new';
    const me = { name: 'Alex', runner, level: { en: 'Trusted', zh: '可信跑手' }, limit: Infinity, weekDone: 3, weekGoal: 5, weekBonus: 5, todayEarned: 18, home: dest('wenyuan', 'D03', '1203') };

    const jobs = [
      { id: 'j1', cat: 'takeout', from: PLACE.kfc, area: 'wenyuan', building: 'D03', gender: 'male', qty: 2, reward: 9.88, raised: 1.88, soup: true, arrived: true, deliverBy: T(25), closesAt: T(12), postedAt: T(-48),
        note: { en: 'Leave it at the door, no need to knock.', zh: '放门口就行，不用敲门。' }, priv: { room: '0915', code: { en: 'Locker code 73 4018', zh: '取餐码 73 4018' } } },
      { id: 'j2', cat: 'takeout', group: 'g1', from: PLACE.nightLocker, area: 'wenyuan', building: 'D05', gender: 'female', qty: 1, reward: 4, arrivalAt: T(4), closesAt: T(40), postedAt: T(-20), priv: { room: '0807' } },
      { id: 'j3', cat: 'takeout', group: 'g1', from: PLACE.nightLocker, area: 'wenyuan', building: 'D05', gender: 'female', qty: 2, reward: 8, soup: true, arrivalAt: T(8), closesAt: T(44), postedAt: T(-16),
        note: { en: 'Soup inside, please keep it upright.', zh: '里面有汤，请拿稳别倒。' }, priv: { room: '1502' } },
      { id: 'j4', cat: 'takeout', group: 'g1', from: PLACE.nightLocker, area: 'wenyuan', building: 'D05', gender: 'female', qty: 1, reward: 4, arrivalAt: T(11), closesAt: T(47), postedAt: T(-13), priv: { room: '0311' } },
      { id: 'j5', cat: 'parcel', from: PLACE.cainiaoWY, area: 'wenxing', building: 'A05', gender: 'female', qty: 3, sizes: { en: '2 small · 1 medium', zh: '2 小件 · 1 中件' }, reward: 10, lobby: true, deadline: { en: 'today 21:30', zh: '今天 21:30' }, postedAt: T(-19),
        priv: { room: '1201', code: { en: 'Codes 6-2-4018 · 6-3-1177 · 12-1-0933', zh: '取件码 6-2-4018 · 6-3-1177 · 12-1-0933' } } },
      { id: 'j6', cat: 'parcel', from: PLACE.cainiaoN, area: 'wencui', building: 'C07', gender: 'male', qty: 1, sizes: { en: '1 large', zh: '1 大件' }, reward: 5, fragile: true, deadline: { en: 'today 22:00', zh: '今天 22:00' }, postedAt: T(-31),
        priv: { room: '0604', code: { en: 'Code 3-5-2290', zh: '取件码 3-5-2290' } } },
      { id: 'j7', cat: 'night', shop: { en: 'Wang’s grilled cold noodles · stall 12', zh: '王姐烤冷面 · 12号摊' }, area: 'wencui', building: 'C02', gender: 'female', qty: 1, reward: 4, purchase: 'needs', deliverBy: T(50), closesAt: T(45), postedAt: T(-15),
        note: { en: 'One cold noodle, extra egg, mild spicy. About ¥12.', zh: '一份烤冷面，加蛋，微辣。大约 ¥12。' }, priv: { room: '1108' } },
      { id: 'j8', cat: 'night', shop: { en: 'Chen’s fried rice · stall 5', zh: '陈记炒饭 · 5号摊' }, area: 'wenhui', building: 'B06', gender: 'male', qty: 1, reward: 4, purchase: 'ordered', deliverBy: T(55), closesAt: T(51), postedAt: T(-9), priv: { room: '0420' } },
      { id: 'j9', cat: 'task', kind: 'print', mode: 'offline', title: { en: 'Print 24 pages (double-sided) and bring them to CB G13', zh: '打印 24 页（双面）并送到中心楼 G13' }, reward: 6, dueAt: T(80), postedAt: T(-11),
        note: { en: 'File sent in chat after you accept. Staple top-left please.', zh: '接单后在聊天里发文件，左上角装订。' } },
      { id: 'j10', cat: 'task', kind: 'shop', mode: 'offline', title: { en: 'Buy tissues and 2 bottles of water at FamilyMart, bring to Wenyuan', zh: '全家代买纸巾和两瓶水，送到文缘' }, reward: 5, dueAt: T(60), postedAt: T(-6),
        note: { en: 'About ¥15 of items. Keep the receipt.', zh: '商品约 ¥15，请保留小票。' } },
      { id: 'j11', cat: 'task', kind: 'book', mode: 'offline', title: { en: 'Return 2 library books before closing', zh: '闭馆前帮忙还两本书' }, reward: 4.5, dueAt: T(110), postedAt: T(-26) },
      { id: 'j12', cat: 'task', kind: 'online', mode: 'online', title: { en: 'Proofread a 300-word English email', zh: '帮忙润色一封 300 词的英文邮件' }, reward: 8, postedAt: T(-3) },
      { id: 'j13', cat: 'task', kind: 'move', mode: 'offline', title: { en: 'Help move 4 boxes from Wenxing A02 to Wencui C04', zh: '帮忙把 4 个箱子从文星 A02 搬到文萃 C04' }, reward: 30, dueAt: T(125), postedAt: T(-38) },
      { id: 'j14', cat: 'takeout', from: PLACE.wencuiNorth, area: 'wencui', building: 'C09', gender: 'female', qty: 1, reward: 4, arrivalAt: T(18), closesAt: T(48), postedAt: T(-12), priv: { room: '0706' } },
      { id: 'j15', cat: 'parcel', from: PLACE.jd, area: 'wenhui', building: 'B03', gender: 'male', qty: 1, sizes: { en: '1 extra large (10–20 kg)', zh: '1 超大件（10–20 kg）' }, reward: 12.66, raised: 2.66, deadline: { en: 'today 22:00', zh: '今天 22:00' }, postedAt: T(-44),
        priv: { room: '1402', code: { en: 'Code JD-88213', zh: '取件码 JD-88213' } } }
    ].map(j => ({ status: 'waiting', ...j }));

    // Jobs other students already finished (the hall's Done tab).
    const done = [
      { id: 'd1', cat: 'takeout', from: PLACE.kfc, to: dest('wenyuan', 'D02'), reward: 8, at: T(-22) },
      { id: 'd2', cat: 'parcel', from: PLACE.hanlin, to: dest('wenxing', 'A03'), reward: 7, at: T(-51) },
      { id: 'd3', cat: 'task', title: { en: 'Pick up a lab coat from SC building', zh: '去理科楼取实验服' }, kind: 'move', reward: 5, at: T(-95) },
      { id: 'd4', cat: 'night', from: PLACE.night, to: dest('wencui', 'C05'), reward: 4, at: at(0, '12:48') },
      { id: 'd5', cat: 'takeout', from: PLACE.wencuiNorth, to: dest('wencui', 'C01'), reward: 4, at: at(0, '12:31') },
      { id: 'd6', cat: 'parcel', from: PLACE.cainiaoWY, to: dest('wenyuan', 'D06'), reward: 10, at: at(1, '20:12') },
      { id: 'd7', cat: 'task', title: { en: 'Print lecture slides, 40 pages', zh: '打印课件 40 页' }, kind: 'print', reward: 6, at: at(1, '17:40') },
      { id: 'd8', cat: 'takeout', from: PLACE.fruit, to: dest('wenxing', 'A01'), reward: 4, at: at(1, '12:22') }
    ];

    const home = me.home;
    const orders = scenario === 'new' ? [] : [
      { id: 'o1', cat: 'takeout', from: PLACE.kfc, to: home, qty: 2, total: 8, status: 'delivered', runner: 'Leo', t: { created: T(-52), taken: T(-40), collected: T(-17), delivered: T(-9) }, autoAt: T(51), drop: { en: 'At your door', zh: '放在门口' } },
      { id: 'o2', cat: 'takeout', from: PLACE.nightLocker, to: home, qty: 1, total: 4, status: 'collected', runner: 'Kai', t: { created: T(-33), taken: T(-21), collected: T(-4) }, doorBy: T(11), soup: true,
        unread: { en: 'I’m on my way', zh: '我在路上了' } },
      { id: 'o3', cat: 'night', shop: { en: 'Auntie Li’s jianbing · stall 3', zh: '李阿姨煎饼 · 3号摊' }, to: home, qty: 1, total: 4, status: 'taken', runner: 'Yuki', purchase: 'needs', t: { created: T(-14), taken: T(-0.7) }, doorBy: T(45) },
      { id: 'o4', cat: 'takeout', from: PLACE.kfc, to: home, qty: 1, total: 4, raised: 0, status: 'waiting', arrived: true, t: { created: T(-35) }, closesAt: T(25) },
      { id: 'o5', cat: 'parcel', from: PLACE.cainiaoWY, to: home, qty: 2, sizes: { en: '1 small · 1 medium', zh: '1 小件 · 1 中件' }, total: 7, raised: 0, status: 'waiting', t: { created: T(-28) }, deadline: { en: 'today 22:00', zh: '今天 22:00' } },
      { id: 'o6', cat: 'parcel', from: PLACE.jd, to: home, qty: 1, sizes: { en: '1 large', zh: '1 大件' }, total: 5, raised: 0, status: 'waiting', returnedBy: 'Sam', t: { created: T(-95) }, deadline: { en: 'today 22:00', zh: '今天 22:00' } },
      { id: 'o7', cat: 'task', kind: 'book', title: { en: 'Pick up my student card from the library front desk', zh: '去图书馆前台取我的学生卡' }, total: 5, status: 'taken', runner: 'Lin', t: { created: T(-30), taken: T(-12) }, dueAt: T(50) },
      { id: 'o8', cat: 'takeout', from: PLACE.kfc, to: home, qty: 1, total: 4, status: 'disputed', runner: 'Noah', issue: { en: 'Spilled or damaged', zh: '洒漏或损坏' }, t: { created: T(-200), taken: T(-185), collected: T(-165), delivered: T(-150), reported: T(-141) }, holdUntil: T(-141 + 1440) },

      { id: 'p1', cat: 'takeout', from: PLACE.kfc, to: home, qty: 2, total: 8, status: 'confirmed', runner: 'Leo', t: { created: at(0, '11:52'), taken: at(0, '11:58'), collected: at(0, '12:19'), delivered: at(0, '12:27'), confirmed: at(0, '12:31') } },
      { id: 'p2', cat: 'parcel', from: PLACE.hanlin, to: home, qty: 1, sizes: { en: '1 small', zh: '1 小件' }, total: 3, status: 'cancelled', reason: { en: 'Collected it myself', zh: '我自己取了' }, t: { created: at(0, '09:40'), cancelled: at(0, '10:05') } },
      { id: 'p3', cat: 'night', shop: { en: 'Chen’s fried rice · stall 5', zh: '陈记炒饭 · 5号摊' }, to: home, qty: 1, total: 4, status: 'confirmed', runner: 'Yuki', t: { created: at(1, '20:58'), taken: at(1, '21:04'), collected: at(1, '21:22'), delivered: at(1, '21:36'), confirmed: at(1, '21:40') } },
      { id: 'p4', cat: 'parcel', from: PLACE.cainiaoWY, to: home, qty: 3, sizes: { en: '2 small · 1 medium', zh: '2 小件 · 1 中件' }, total: 10, status: 'confirmed', auto: true, runner: 'Kai', t: { created: at(3, '15:10'), taken: at(3, '15:32'), collected: at(3, '17:50'), delivered: at(3, '18:22'), confirmed: at(1, '18:22') } },
      { id: 'p5', cat: 'takeout', from: PLACE.nightLocker, to: home, qty: 1, total: 4, status: 'refunded', why: 'norunner', t: { created: at(1, '12:10'), refunded: at(1, '13:10') } },
      { id: 'p6', cat: 'task', kind: 'shop', title: { en: 'Buy hangers at FamilyMart', zh: '全家代买衣架' }, total: 6, status: 'confirmed', runner: 'Lin', t: { created: at(1, '10:20'), taken: at(1, '10:31'), delivered: at(1, '10:58'), confirmed: at(1, '11:02') } },
      { id: 'p7', cat: 'task', kind: 'print', title: { en: 'Print lab report, 12 pages', zh: '打印实验报告 12 页' }, total: 4, status: 'confirmed', runner: 'Noah', t: { created: at(2, '08:05'), taken: at(2, '08:12'), delivered: at(2, '08:40'), confirmed: at(2, '08:44') } },
      { id: 'p8', cat: 'takeout', from: PLACE.kfc, to: home, qty: 1, total: 4, status: 'cancelled', reason: { en: 'Wrong details in the order', zh: '信息填错' }, t: { created: at(2, '18:01'), cancelled: at(2, '18:03') } },
      { id: 'p9', cat: 'parcel', from: PLACE.cainiaoN, to: home, qty: 1, sizes: { en: '1 large', zh: '1 大件' }, total: 5, status: 'confirmed', runner: 'Sam', t: { created: at(2, '14:10'), taken: at(2, '14:40'), collected: at(2, '16:05'), delivered: at(2, '16:30'), confirmed: at(2, '16:52') } },
      { id: 'p10', cat: 'takeout', from: PLACE.kfc, to: home, qty: 1, total: 4, status: 'refunded', why: 'review', t: { created: at(4, '12:02'), delivered: at(4, '12:40'), refunded: at(4, '19:15') } },
      { id: 'p11', cat: 'parcel', from: PLACE.jd, to: home, qty: 1, sizes: { en: '1 extra large', zh: '1 超大件' }, total: 12.66, raised: 2.66, status: 'confirmed', runner: 'Leo', t: { created: at(4, '09:30'), taken: at(4, '10:12'), collected: at(4, '10:50'), delivered: at(4, '11:15'), confirmed: at(4, '11:20') } },
      { id: 'p12', cat: 'takeout', from: PLACE.wencuiNorth, to: home, qty: 1, total: 4, status: 'confirmed', runner: 'Kai', t: { created: at(5, '18:20'), taken: at(5, '18:24'), collected: at(5, '18:41'), delivered: at(5, '18:52'), confirmed: at(5, '19:00') } }
    ];
    if (scenario === 'empty') for (let i = orders.length - 1; i >= 0; i--) if (!['confirmed', 'cancelled', 'refunded'].includes(orders[i].status)) orders.splice(i, 1);

    // Jobs the user took as a runner. A run with more than one item is a group trip.
    const runs = !runner ? [] : [
      ...(scenario === 'empty' ? [] : [
        { id: 'r1', cat: 'takeout', items: [
          { id: 'r1a', from: PLACE.nightLocker, to: dest('wenyuan', 'D05', '0807'), gender: 'female', qty: 1, reward: 4, status: 'taken', arrived: true, t: { taken: T(-6) }, code: { en: 'Locker code 21 5530', zh: '取餐码 21 5530' }, note: { en: 'Call me when you’re downstairs.', zh: '到楼下给我打电话。' } },
          { id: 'r1b', from: PLACE.nightLocker, to: dest('wenyuan', 'D05', '1502'), gender: 'female', qty: 1, reward: 4, status: 'taken', arrivalAt: T(9), t: { taken: T(-6) }, code: { en: 'Locker code 21 5544', zh: '取餐码 21 5544' } }
        ] },
        { id: 'r2', cat: 'parcel', items: [
          { id: 'r2a', from: PLACE.hanlin, to: dest('wenxing', 'A03', '402'), gender: 'male', qty: 2, reward: 7, status: 'collected', fragile: true, deadline: { en: 'today 21:00', zh: '今天 21:00' }, t: { taken: T(-34), collected: T(-6) }, code: { en: 'Codes 8-1-2204 · 8-4-0517', zh: '取件码 8-1-2204 · 8-4-0517' } }
        ] },
        { id: 'r3', cat: 'task', items: [
          { id: 'r3a', kind: 'book', title: { en: 'Return 2 library books before closing', zh: '闭馆前帮忙还两本书' }, reward: 4.5, status: 'delivered', t: { taken: T(-70), delivered: T(-20) }, autoAt: T(-20 + 1440) }
        ] }
      ]),
      { id: 'c1', cat: 'takeout', done: true, at: at(0, '18:10'), items: [{ id: 'c1a', from: PLACE.kfc, to: dest('wenyuan', 'D01', '0612'), qty: 2, reward: 8, status: 'confirmed' }] },
      { id: 'c2', cat: 'parcel', done: true, at: at(0, '13:02'), items: [{ id: 'c2a', from: PLACE.cainiaoWY, to: dest('wenxing', 'A05', '1201'), qty: 3, reward: 10, status: 'confirmed' }] },
      { id: 'c3', cat: 'night', done: true, at: at(1, '20:45'), items: [{ id: 'c3a', from: PLACE.night, to: dest('wencui', 'C02', '1108'), qty: 1, reward: 4, status: 'confirmed' }] },
      { id: 'c4', cat: 'takeout', done: true, at: at(1, '12:20'), items: [{ id: 'c4a', from: PLACE.wencuiNorth, to: dest('wencui', 'C09', '0706'), qty: 1, reward: 4, status: 'confirmed' }, { id: 'c4b', from: PLACE.wencuiNorth, to: dest('wencui', 'C09', '0911'), qty: 1, reward: 4, status: 'confirmed' }] },
      { id: 'c5', cat: 'task', done: true, at: at(2, '16:05'), items: [{ id: 'c5a', kind: 'print', title: { en: 'Print 30 flyers for a club fair', zh: '打印 30 张社团招新传单' }, reward: 6, status: 'confirmed' }] }
    ];

    return { me, jobs: scenario === 'empty' ? [] : jobs, done: scenario === 'empty' ? done.slice(3) : done, orders, runs };
  }

  window.UE_DATA = { AREAS, PLACE, dest, build, MIN, DAY };
})();
