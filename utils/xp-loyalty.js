// XP servers deployed before account points can still show their existing local check-in data.
const china = require('./china-time');
const KEY = 'xp_loyalty_v1';
const DAILY_POINTS = 2;
const WEEKLY_POINTS = 10;
const CHECKIN_CYCLE = 7;
const LEVELS = [
  {level: 1, zh: 'Yuni 新星', en: 'Yuni Star', points: 0},
  {level: 2, zh: 'Yuni 帮手', en: 'Yuni Helper', points: 20},
  {level: 3, zh: 'Yuni 达人', en: 'Yuni Pro', points: 150},
  {level: 4, zh: 'Yuni 王牌', en: 'Yuni Ace', points: 500},
  {level: 5, zh: 'Yuni 船长', en: 'Yuni Captain', points: 1000}
];

function readAll() { try { return wx.getStorageSync(KEY) || {}; } catch (_) { return {}; } }
function writeAll(all) { try { wx.setStorageSync(KEY, all); } catch (_) {} }
function blank() { return {points: 0, level: 1, profileAwarded: false, anyCompleted: false, notices: [], orderFish: []}; }
function data(accountId) {
  if (!accountId) return blank();
  const saved = readAll()[accountId];
  return saved ? {...blank(), ...saved} : blank();
}
function save(accountId, record) { if (!accountId) return; const all = readAll(); all[accountId] = record; writeAll(all); }

function view(record) {
  const l = record || blank(), points = Number(l.points) || 0, level = LEVELS[Math.min(4, Math.max(0, (l.level || 1) - 1))], next = LEVELS[level.level] || null;
  const start = level.points, to = next ? next.points : start, segment = Math.max(0, points - start);
  return {
    points, level: level.level, nameZh: level.zh, nameEn: level.en,
    next: next ? {level: next.level, nameZh: next.zh, nameEn: next.en, points: next.points, remaining: Math.max(0, next.points - points)} : null,
    remaining: next ? Math.max(0, next.points - points) : 0,
    progress: next ? Math.min(100, Math.max(0, (segment / (to - start)) * 100)) : 100,
    anyCompleted: !!l.anyCompleted, loginStreak: l.loginStreak || 0,
    checkin: l.checkin || null, notices: (l.notices || []).slice(), orderFish: (l.orderFish || []).slice(),
    profileAwarded: !!l.profileAwarded
  };
}

function dailyCheckin(accountId, now) {
  if (!accountId) return;
  const record = data(accountId), previous = record.checkin || {}, day = china.dayKey(now);
  if (previous.day >= day) return;
  const streak = previous.day === china.dayKey(now - china.DAY) ? (Number(previous.streak) || 0) + 1 : 1;
  const cycleDay = (streak - 1) % CHECKIN_CYCLE + 1;
  const rewardPoints = cycleDay === CHECKIN_CYCLE ? WEEKLY_POINTS : 0;
  const checkin = {day, at: now, streak, cycleDay, totalDays: (Number(previous.totalDays) || 0) + 1,
    dailyPoints: DAILY_POINTS, rewardPoints};
  const points = DAILY_POINTS + rewardPoints;
  record.checkin = checkin;
  record.loginStreak = streak;
  record.points = (Number(record.points) || 0) + points;
  record.notices = (record.notices || []).filter(n => n.type !== 'checkin').concat({
    id: 'checkin-' + day, type: 'checkin', ...checkin, weeklyPoints: rewardPoints, points,
  });
  save(accountId, record);
}

function progression(accountId) { return accountId ? view(data(accountId)) : null; }

function inviteRewards(rewards) {
  if (!rewards || !rewards.inviteCode) return null;
  const titles = {title:'Invite reward · 50% delivery coupon',titleZh:'邀请奖励 · 5折配送券',short:'Invite 50% off'};
  const claimed = (rewards.inviteCoupons || []).map(coupon => ({
    ...titles, id: 'xpCoupon' + coupon.id, kind: 'deliveryPercent', xp: true,
    percent: (10000 - coupon.pay_rate_bps) / 100, max: coupon.max_discount_cents / 100,
    status: coupon.status, usable: coupon.eligible && coupon.status === 'available',
    orderTypes: coupon.allowed_types || [], issuedAt: Date.parse(coupon.starts_at), expiresAt: Date.parse(coupon.expires_at),
    descriptionZh:'配送费打五折，最高抵 ¥3.9', description:'50% off the delivery fee, up to ¥3.90',
  }));
  const inviteIds = new Set(claimed.map(coupon => coupon.id));
  for (const coupon of rewards.accountCoupons || []) {
    const id = 'xpCoupon' + coupon.id;
    if (inviteIds.has(id)) continue;
    const percent = coupon.discount_type === 'percentage' ? (10000 - coupon.pay_rate_bps) / 100 : 0;
    claimed.push({
      id, xp:true, title:coupon.name, titleZh:coupon.name, short:coupon.name,
      kind:percent ? 'deliveryPercent' : 'delivery', percent,
      max:(percent ? coupon.max_discount_cents : coupon.discount_cents) / 100,
      usable:coupon.eligible && coupon.status === 'available', status:coupon.status,
      orderTypes:coupon.allowed_types || [], issuedAt:Date.parse(coupon.starts_at), expiresAt:Date.parse(coupon.expires_at),
    });
  }
  const campaigns = (rewards.campaigns || []).map(c => {
    const percent = c.discount_type === 'percentage' ? (10000 - c.pay_rate_bps) / 100 : 0;
    return {
      id:'xpCampaign' + c.id, title:c.name, titleZh:c.name, enabled:true, start:c.starts_at, end:c.expires_at,
      face:percent ? (10 - percent / 10) + '折' : '¥' + c.discount_cents / 100, collected:!!c.claimed, eligible:!c.claimed,
    };
  });
  const pending = (rewards.pendingInviteCoupons || []).map(coupon => ({
    ...titles, id:coupon.id, kind:'deliveryPercent', percent:50, max:3.9, status:'pending', pending:true, usable:false,
  }));
  return {
    inviteCode: rewards.inviteCode, hasInvitedBy: rewards.hasInvitedBy,
    campaigns, coupons: claimed.filter(coupon => coupon.usable),
    couponHistory: [...pending, ...claimed],
  };
}

async function sync(accountId, now) {
  if (!accountId) return {progression: null, awarded: false};
  const state = require('./store').get();
  const last = state.progressionAccountId === accountId && state.progression && state.progression.source === 'xp-server'
    ? state.progression
    : null;
  const addressSaved = state.profile.accountId === accountId && (!last || !last.profileAwarded)
    && require('./saved-routes').list().length > 0;
  try {
    const data = await require('./api').post('/api/loyalty/sync', addressSaved ? {addressSaved} : {}, {timeout: 4500});
    if ('xp' + data.accountId !== accountId || !data.progression) return {progression: last, awarded: false, syncError: true};
    const rewards = inviteRewards(data.rewards);
    return {progression: {...data.progression, source: 'xp-server'}, yuni: data.yuni || null, rewards, inviteAvailable: !!rewards, awarded: !!data.profileAwardedNow};
  } catch (error) {
    if (last) return {progression: last, yuni: state.yuniPlay, rewards: state.rewards, inviteAvailable: (state.orderCapabilities || {}).inviteRewards, awarded: false, syncError: true};
    if (error.status === 404) {
      // Keep the previous check-in for users whose XP server has yet to be upgraded.
      // The legacy total is confined to this phone and is never uploaded as account credit.
      if (state.profile.campusId) dailyCheckin(accountId, now);
      return {progression: progression(accountId), inviteAvailable: false, awarded: false, syncError: true};
    }
    return {progression: null, awarded: false, syncError: true};
  }
}

async function activityConfig() {
  const response = await require('./api').requestWithToken('GET', '/api/loyalty/rules', undefined, undefined, {timeout: 4500});
  const rules = response.rules;
  const fallback = require('../pages/levels/news-activity');
  return {
    ...fallback, revision: 'xp-account-points',
    tasks: fallback.tasks.map(task => {
      if (task.kind === 'referral') return {...task, enabled: rules.referral, points: rules.referralPoints || task.points};
      if (task.kind === 'profile') return {...task, points: rules.profile};
      if (task.kind === 'weekly_login') return {...task, points: rules.checkin.weekly, daysRequired: rules.checkin.days};
      const rule = task.kind === 'customer_order' ? rules.customer : rules.runner;
      return {...task, points: rule.regular, firstCompletion: {...task.firstCompletion, points: rule.first}};
    }),
  };
}

module.exports = {sync, activityConfig};
