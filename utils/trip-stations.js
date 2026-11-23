// Pickup labels for a trip. A trip may store one station or a JSON list of stations.
const lockers = require('./takeaway-lockers');
const rc = require('./runner-copy');

function list(raw) {
  const text = String(raw || '').trim();
  if (text.startsWith('[')) {
    try { const a = JSON.parse(text); if (Array.isArray(a)) return a.map(x => String(x || '').trim()).filter(Boolean); } catch (_) { /* plain text */ }
  }
  return text ? [text] : [];
}
function names(trip = {}, language = 'zh') {
  const lang = language === 'en' ? 'en' : 'zh';
  return list(trip.station).map(x => (trip.category === 'takeout' ? lockers.label(x, lang) : rc.name(x, lang)) || x);
}
// Every station, for places where the student needs the full list.
function full(trip, language) { return names(trip, language).join(language === 'en' ? ', ' : '、'); }
// First station plus a count, for one-line titles.
function short(trip, language) {
  const all = names(trip, language);
  if (all.length <= 1) return all[0] || '';
  return language === 'en' ? all[0] + ' + ' + (all.length - 1) + ' more' : all[0] + ' 等 ' + all.length + ' 处';
}
module.exports = { list, names, full, short };
