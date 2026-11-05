// Exact endpoint matching; this is not map-based detour matching.
function normalize(value){return String(value||'').toLowerCase().replace(/\s+/g,' ').trim();}
function placeDorm(address){return /library|图书馆/i.test(address)?'Library':/classroom|教室/i.test(address)?'Classroom':/sports|体育/i.test(address)?'Sports centre':'Campus meeting point';}
function destinationMatches(r,t){if(t.destinationType==='place')return r.destinationType==='place'&&!!normalize(t.deliveryAddress)&&normalize(r.deliveryAddress)===normalize(t.deliveryAddress);if(t.destinationType==='dorm'&&r.destinationType==='place')return false;return r.dorm===t.dorm;}
function categoryMatches(r,t){return t.category==='other'?['takeout','parcel','task'].includes(r.category||'parcel'):(r.category||'parcel')===(t.category||'parcel');}
module.exports={normalize,placeDorm,destinationMatches,categoryMatches};
