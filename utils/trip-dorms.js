'use strict';
// 2026-11-21: a runner's trip can deliver to several dorm buildings (trip.dorms); older trips only have trip.dorm.
// label() gives the destination as people read it: "D01、D03" in Chinese, "D01, D03" in English.
const { tripDorms } = require('./trip-route');
function label(trip, language) {
  if (!trip) return '';
  const en = language === 'en', campus = require('./campus');
  return tripDorms(trip).map(code => campus.buildingLabel(code, en ? 'en' : 'zh')).join(en ? ', ' : '、');
}
// Buttons for the add-order page when a dorm trip goes to two or more buildings (one building: none, the route stays locked).
function chips(trip, language) {
  if (!trip || trip.destinationType === 'place') return [];
  const list = tripDorms(trip), campus = require('./campus');
  return list.length > 1 ? list.map(code => ({ code, label: campus.buildingLabel(code, language === 'en' ? 'en' : 'zh') })) : [];
}
module.exports = { list: tripDorms, label, chips };
