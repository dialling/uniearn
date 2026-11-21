// Joining a runner's trip: the order must go where the trip goes (2026-11-15).
// A saved address fits when it is in the trip's dorm building, or is the same "other place".
function fits(route, trip) {
  if (!route || !trip) return false;
  const tripPlace = trip.destinationType === 'place', routePlace = route.destinationType === 'place';
  if (tripPlace !== routePlace) return false;
  if (tripPlace) return String(route.deliveryAddress || '').trim() === String(trip.deliveryAddress || '').trim();
  return !!route.dorm && route.dorm === trip.dorm;
}
// The saved address to use when the form opens: the default one if it fits, otherwise the first that fits.
function pick(routes, trip) {
  const ok = (routes || []).filter(r => fits(r, trip));
  return ok.find(r => r.default) || ok[0] || null;
}
function mismatch(trip, zh) {
  const where = trip && (trip.destinationType === 'place' ? trip.deliveryAddress : require('./campus').buildingLabel(trip.dorm, zh ? 'zh' : 'en')) || '';
  return zh ? '这趟行程只送到 ' + where + '，请选择或添加该地址' : 'This trip only delivers to ' + where + '. Choose or add an address there.';
}
module.exports = {fits, pick, mismatch};
