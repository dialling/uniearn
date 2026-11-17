'use strict';
// 2026-11-17: each finished order (as the poster or as the runner) leaves a fish for Yuni on the Me page.
// The server already added the points when the order was confirmed; feeding the fish only shows them, like the daily dried fish.
const store = require('./store');
const KEEP_DAYS = 14, fed = new Set();
const key = (account, id) => 'uniearn:yuni-orderfish:' + account + ':' + id;
function account(state) { const p = state.profile || {}; return p.accountId && !p.loggedOut && state.progressionAccountId === p.accountId ? p.accountId : ''; }
function wasFed(acc, id) { const k = key(acc, id); if (fed.has(k)) return true; try { return !!wx.getStorageSync(k); } catch (_) { return false; } }
// Fish still waiting for Yuni, oldest first.
function waiting(state = store.get()) {
  const acc = account(state); if (!acc) return [];
  const since = (Number(state.serverTime) || Date.now()) - KEEP_DAYS * 86400000;
  return ((state.progression && state.progression.orderFish) || []).filter(f => f && f.id && f.points > 0 && f.at >= since && !wasFed(acc, f.id));
}
function markFed(id, state = store.get()) { const acc = account(state); if (!acc) return; const k = key(acc, id); fed.add(k); try { wx.setStorageSync(k, true); } catch (_) {} }
// Points still inside a fish (order fish not fed yet, and today's dried fish if Yuni has not eaten it).
// The server has added them already; Me shows them only once the fish is fed, so the points count up as Yuni eats.
function pendingPoints(state = store.get()) {
  let n = waiting(state).reduce((sum, f) => sum + (Number(f.points) || 0), 0);
  try { if (require('./checkin').dailyFishWaiting()) { const c = (state.progression && state.progression.checkin) || {}; n += (Number(c.dailyPoints) || 0) + (Number(c.rewardPoints) || 0); } } catch (_) {}
  return n;
}
function shownProgression(state = store.get()) { const p = state.progression || {}; return { ...p, points: Math.max(0, (Number(p.points) || 0) - pendingPoints(state)) }; }
module.exports = { waiting, markFed, pendingPoints, shownProgression, KEEP_DAYS };
