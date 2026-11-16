// Parcel delivery time in plain words, from the slot the customer picked (2026-11-15):
// noon → "Deliver by noon", afternoon → "Deliver this afternoon", night → "Deliver tonight",
// tomorrow → "Deliver tomorrow". Any other time falls back to "Deliver by HH:MM".
const time = require('./china-time');

module.exports = function deliverLabel(order, now, zh) {
  const r = order || {}, today = time.dayKey(now), tomorrow = time.dayKey(now + time.DAY);
  const day = r.deliveryDate || today, at = String(r.deadline || '').trim();
  if (day === tomorrow) return zh ? '明天送达' : 'Deliver tomorrow';
  if (day > tomorrow) { const [, m, d] = day.split('-'); return zh ? Number(m) + '月' + Number(d) + '日送达' : 'Deliver by ' + Number(d) + '/' + Number(m); }
  if (at === '13:00') return zh ? '中午前送达' : 'Deliver by noon';
  if (at === '18:00') return zh ? '今天下午送达' : 'Deliver this afternoon';
  if (!at || at === '23:59') return zh ? '今晚送达' : 'Deliver tonight';
  return zh ? at + ' 前送达' : 'Deliver by ' + at;
};
