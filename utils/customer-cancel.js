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
      tip: zh ? '还没有跑手接单，你可以随时取消。' : 'No runner has accepted yet — you can cancel anytime.'
    };
  }
  if (order.status === 'taken' && !(order.collected || []).length) {
    const takenAt = Number(order.takenAt);
    const left = Number.isFinite(takenAt) && takenAt > 0 ? takenAt + WINDOW_MS - now : 0;
    if (left > 0) {
      const time = clock(left);
      return {
        phase: 'grace', canCancel: true, button, clock: time, remainingMs: left,
        tip: zh ? '跑手已接单。你还可以取消，剩余 ' + time + '。' : 'A runner has accepted. You can still cancel for ' + time + '.'
      };
    }
    return {
      phase: 'ended', canCancel: false, button, clock: '0:00', remainingMs: 0,
      tip: zh ? '跑手已接单，取消时限已结束。' : 'A runner has accepted — cancel window ended.'
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
    cancelNoteOpen: false,
    cancelReady: false,
    cancelOptions: reasons.options(order, !!page.data.zh)
  });
}

function choose(page, event) {
  const value = event && event.currentTarget && event.currentTarget.dataset.value;
  const item = reasons.REASONS.find(row => row.key === value);
  if (!item || (page.data && page.data.cancelling)) return;
  // Choosing only selects the reason; the sheet's Back button becomes "Cancel order" to send it.
  if (item.note) {
    page.setData({
      cancelReason: value,
      cancelNoteOpen: true,
      cancelReady: reasons.ready(value, page.data.cancelNote)
    });
    return;
  }
  page.setData({cancelReason: value, cancelNote: '', cancelNoteOpen: false, cancelReady: true});
}

function note(page, event) {
  const cancelNote = event.detail.value;
  page.setData({
    cancelNote,
    cancelReady: reasons.ready(page.data.cancelReason, cancelNote)
  });
}

function close(page, force) {
  if (!force && page.data && page.data.cancelling) return;
  page.setData({cancelOpen: false, cancelReason: '', cancelNote: '', cancelNoteOpen: false, cancelReady: false, cancelOptions: []});
}

function payload(page, override) {
  const direct = override && override.submit && override.reason;
  const picked = reasons.check(direct ? override.reason : page.data.cancelReason, direct ? '' : page.data.cancelNote);
  return {reason: picked.key, ...(picked.note ? {note: picked.note} : {})};
}

function syncOpen(page) {
  if (!page.data || !page.data.cancelOpen) return;
  const order = page.data.request;
  const window = page.data.cancelWindow || {};
  if (!order || !window.canCancel) { close(page, true); return; }
  page.setData({
    cancelOptions: reasons.options(order, !!page.data.zh),
    cancelNoteOpen: reasons.isOther(page.data.cancelReason),
    cancelReady: reasons.ready(page.data.cancelReason, page.data.cancelNote)
  });
}

function legacyBody(body, error) {
  const text = String(error && error.message || error || '');
  if (!/Choose a cancel reason|选择取消原因|取消原因/.test(text)) return null;
  const note = String((body && (body.note || body.reason)) || '').slice(0, 200);
  return note ? {reason: '其他', note} : null;
}

module.exports = {WINDOW_MS, clock, runnerLabel, view, arm, stop, sync, openSheet, choose, note, close, payload, syncOpen, legacyBody};
