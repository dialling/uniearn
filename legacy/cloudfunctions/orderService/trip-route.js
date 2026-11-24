// Exact endpoint matching; this is not map-based detour matching.
function normalize(value){return String(value||'').toLowerCase().replace(/\s+/g,' ').trim();}
function placeDorm(address){return /library|图书馆/i.test(address)?'Library':/classroom|教室/i.test(address)?'Classroom':/sports|体育/i.test(address)?'Sports centre':'Campus meeting point';}
// 2026-11-21: a trip can deliver to several dorm buildings (trip.dorms, same area, up to 10); older trips only have trip.dorm.
function tripDorms(t){const list=Array.isArray(t&&t.dorms)?t.dorms.filter(x=>typeof x==='string'&&x):[];return list.length?list:(t&&t.dorm?[t.dorm]:[]);}
function destinationMatches(r,t){if(t.destinationType==='place')return r.destinationType==='place'&&!!normalize(t.deliveryAddress)&&normalize(r.deliveryAddress)===normalize(t.deliveryAddress);if(t.destinationType==='dorm'&&r.destinationType==='place')return false;return tripDorms(t).includes(r.dorm);}
function categoryMatches(r,t){return t.category==='other'?['takeout','parcel','task'].includes(r.category||'parcel'):(r.category||'parcel')===(t.category||'parcel');}
module.exports={normalize,placeDorm,destinationMatches,categoryMatches,tripDorms};
