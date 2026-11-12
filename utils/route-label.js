// Display-ready route labels.
// Takeaway orders have no real station: the pickup place is the locker the customer chose
// (night-market orders use the shop name). Parcel orders use the translated station name.
// Destinations show the campus area plus the building, e.g. "文缘 D01".
const post = require('./post-copy');
const lockers = require('./takeaway-lockers');

function pickup(order = {}, language = 'zh') {
  const zh = language !== 'en';
  const category = order.category;
  if (category === 'task') return '';
  if (category === 'takeout') {
    if (order.night) return order.shop || (zh ? '夜市摊位' : 'Night market stall');
    return lockers.label(order.pickupPoint, language) || (zh ? '外卖取餐点' : 'Takeaway pickup point');
  }
  return post.label(order.station, language) || order.station || (zh ? '取件点' : 'Pickup point');
}

// A station field that may hold either a real station name or the takeaway placeholder.
function place(station, language = 'zh') {
  const zh = language !== 'en';
  if (!station || station === 'Takeaway pickup') return zh ? '外卖取餐点' : 'Takeaway pickup point';
  return post.label(station, language) || station;
}

function destination(order = {}, language = 'zh') {
  const zh = language !== 'en';
  if (order.destinationType === 'place') {
    return order.deliveryAddress || order.deliveryLocation || order.dorm || '';
  }
  try {
    const loc = require('./hall-location').detail(order, language);
    const label = [loc.area, loc.building].filter(Boolean).join(' ');
    if (label) return label;
  } catch (_) { /* fall back to the stored dorm code */ }
  return order.dorm || '';
}

module.exports = { pickup, place, destination };
