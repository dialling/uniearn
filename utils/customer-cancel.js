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

module.exports = {WINDOW_MS, clock, runnerLabel, view, arm, stop, sync};
