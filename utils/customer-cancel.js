// Customer cancel window shared by the order pages. The server enforces the same
// 3 minutes in cloudfunctions/orderService/domain.js (CUSTOMER_CANCEL_MS).
const WINDOW_MS = 3 * 60 * 1000;

function clock(ms) {
  const total = Math.max(0, Math.ceil(Number(ms) / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return minutes + ':' + String(seconds).padStart(2, '0');
}

function runnerLabel(order, zh) {
  const name = String(order && order.runnerName || '').trim();
  return name || (zh ? '跑手' : 'Runner');
}

function view(order, zh, now = Date.now()) {
  const button = zh ? '取消订单' : 'Cancel order';
  const hidden = {phase: 'hidden', canCancel: false, button: '', tip: '', clock: '', remainingMs: 0};
  if (!order || order.isMine === false) return hidden;
  if (order.status === 'waiting') {
    return {
      phase: 'open', canCancel: true, button, clock: '', remainingMs: 0,
      tip: zh ? '接单前可随时取消；跑手接单后 3 分钟内仍可取消，满 3 分钟后不可取消。' : 'Cancel anytime before acceptance, or within 3 minutes after a runner accepts. After 3 minutes, cancellation is unavailable.'
    };
  }
  if (['taken', 'collected'].includes(order.status)) {
    const takenAt = Number(order.takenAt);
    const left = Number.isFinite(takenAt) && takenAt > 0 ? takenAt + WINDOW_MS - now : 0;
    if (left > 0 && now >= takenAt) {
      const time = clock(left);
      return {
        phase: 'grace', canCancel: true, button, clock: time, remainingMs: left,
        tip: zh ? '接单后仅限 3 分钟内取消，剩余 ' + time + '；倒计时结束后不可取消。' : 'Cancellation is available only within 3 minutes of acceptance. Time left: ' + time + '.'
      };
    }
    return {
      phase: 'ended', canCancel: false, button, clock: '0:00', remainingMs: 0,
      tip: zh ? '跑手接单已满 3 分钟，无法取消订单。' : 'It has been 3 minutes since acceptance. This order can no longer be cancelled.'
    };
  }
  return hidden;
}

function arm(page) {
  stop(page);
  const timer = setInterval(() => {
    const order = page.data && page.data.request;
    if (!order) return stop(page);
    const next = view(order, page.data.zh);
    const prev = page.data.cancelWindow || {};
    if (next.phase !== prev.phase || next.clock !== prev.clock || next.tip !== prev.tip) page.setData({cancelWindow: next});
    if (next.phase !== 'grace') stop(page);
  }, 1000);
  if (timer && typeof timer.unref === 'function') timer.unref();
  page._cancelTimer = timer;
}

function stop(page) {
  if (page && page._cancelTimer) clearInterval(page._cancelTimer);
  if (page) page._cancelTimer = null;
}

function sync(page, order, zh) {
  const cancel = view(order, zh);
  if (cancel.phase === 'grace') arm(page);
  else stop(page);
  return cancel;
}

const reasons = require('./customer-cancel-reasons');

function openSheet(page) {
  const order = page.data && page.data.request;
  const window = page.data && page.data.cancelWindow;
  if (!order || !window || !window.canCancel || page.data.cancelling) return;
  page.setData({
    cancelOpen: true,
    cancelReason: '',
    cancelNote: '',
    cancelReady: false,
    cancelOptions: reasons.options(order, !!page.data.zh)
  });
}

function choose(page, event) {
  const cancelReason = event.currentTarget.dataset.value;
  page.setData({
    cancelReason,
    cancelReady: reasons.ready(page.data.request, cancelReason, page.data.cancelNote)
  });
}

function note(page, event) {
  const cancelNote = event.detail.value;
  page.setData({
    cancelNote,
    cancelReady: reasons.ready(page.data.request, page.data.cancelReason, cancelNote)
  });
}

function close(page, force) {
  if (!force && page.data && page.data.cancelling) return;
  page.setData({cancelOpen: false, cancelReason: '', cancelNote: '', cancelReady: false, cancelOptions: []});
}

function payload(page) {
  const picked = reasons.check(page.data.request, page.data.cancelReason, page.data.cancelNote);
  return {reason: picked.reason, ...(picked.note ? {note: picked.note} : {})};
}

function syncOpen(page) {
  if (!page.data || !page.data.cancelOpen) return;
  const order = page.data.request;
  const window = page.data.cancelWindow || {};
  if (!order || !window.canCancel) { close(page, true); return; }
  page.setData({
    cancelOptions: reasons.options(order, !!page.data.zh),
    cancelReady: reasons.ready(order, page.data.cancelReason, page.data.cancelNote)
  });
}

module.exports = {WINDOW_MS, clock, runnerLabel, view, arm, stop, sync, openSheet, choose, note, close, payload, syncOpen};
