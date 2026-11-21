// 2026-11-21: a runner can start a trip to several dorm buildings (trip.dorms). Orders to any of those buildings fit the
// trip; other buildings do not. Old one-building trips keep working (trip.dorm only).
const assert = require('node:assert/strict'), engine = require('../cloudfunctions/orderService/engine');
const route = require('../cloudfunctions/orderService/trip-route'), clientRoute = require('../utils/trip-route');
const now = Date.now(), base = { universityId: 'xjtlu', campusId: 'sip' };
const accounts = {
  a: { profile: { ...base, name: 'Ann', phone: '13800000001' }, verification: { status: 'verified' }, runnerRulesAcceptedAt: 1 },
  b: { profile: { ...base, name: 'Ben', phone: '13800000002' }, verification: { status: 'verified' }, runnerRulesAcceptedAt: 1 },
  c: { profile: { ...base, name: 'Cat', phone: '13800000003' }, verification: { status: 'verified' }, runnerRulesAcceptedAt: 1 },
  r: { profile: { ...base, name: 'Runner', phone: '13800000009' }, verification: { status: 'verified' }, runnerRulesAcceptedAt: 1 }
};
let s = engine.initial();
const ids = Object.fromEntries(Object.keys(accounts).map(k => [k, engine.idFor(k)]));
let op = 0;
function act(who, action, p = {}) { const copy = structuredClone(s); const v = engine.execute(copy, ids[who], accounts[who], { action, operationId: 'op_test_' + (++op) + '_xxxxxxxx', ...p }, now); s = copy; return v; }
const order = dorm => ({ category: 'takeout', owner: 'X', phone: '13800000001', station: 'Test gate', dorm, room: '101', bags: 1, price: 4, arrived: true });

// the shared matching rule, same in the cloud and the app
assert.equal(route.tripDorms({ dorm: 'D01' }).join(), 'D01', 'old trips: just trip.dorm');
assert.equal(route.tripDorms({ dorm: 'D01', dorms: ['D01', 'D03'] }).join(), 'D01,D03');
assert.equal(route.destinationMatches({ dorm: 'D03' }, { destinationType: 'dorm', dorm: 'D01', dorms: ['D01', 'D03'] }), true);
assert.equal(route.destinationMatches({ dorm: 'D02' }, { destinationType: 'dorm', dorm: 'D01', dorms: ['D01', 'D03'] }), false);
assert.equal(clientRoute.tripDorms({ dorm: 'D01', dorms: ['D01', 'D03'] }).join(), 'D01,D03', 'the app uses the same rule');

const inD01 = act('a', 'create', { data: order('D01') }).id, inD03 = act('b', 'create', { data: order('D03') }).id, inD02 = act('c', 'create', { data: order('D02') }).id;
// a trip to D01 + D03 picks up the D01 and D03 orders, not the D02 one
const trip = act('r', 'startTrip', { data: { category: 'takeout', when: 'now', duration: 10, station: 'Test gate', destinationType: 'dorm', dorm: 'D01', dorms: ['D01', 'D03'], capacity: 5 } });
const t = s.trips.find(x => x.id === trip.id);
assert.deepEqual(t.dorms, ['D01', 'D03'], 'the trip keeps every building');
assert.equal(t.dorm, 'D01', 'the first building stays in trip.dorm for older app versions');
assert.deepEqual(t.requestIds.slice().sort(), [inD01, inD03].sort(), 'orders in either building are taken');
assert.equal(s.requests.find(r => r.id === inD02).status, 'waiting', 'an order to another building is left in the hall');
// the public trip card carries the buildings so classmates can see them
const pub = engine.snapshot(s, ids.c, accounts.c, now).publicTrips.find(x => x.id === trip.id);
assert.ok(pub, 'the open trip is listed for classmates');
assert.deepEqual(pub.dorms, ['D01', 'D03'], 'the public trip card lists both buildings');
// a classmate joining the trip can pick either building on the add-order page; the cloud accepts the second one too
const joined = act('c', 'create', { data: order('D03'), tripId: trip.id });
assert.equal(s.requests.find(r => r.id === joined.id).dorm, 'D03', 'joined with the second building');
assert.equal(s.requests.find(r => r.id === joined.id).offeredTripId, trip.id, 'the order is sent to the runner of this trip (the runner then accepts it)');
assert.throws(() => act('c', 'create', { data: order('D02'), tripId: trip.id }), undefined, 'a building the trip does not go to is refused');
// the add-order page shows building buttons only when the trip has two or more buildings
const tripDorms = require('../utils/trip-dorms');
assert.deepEqual(tripDorms.chips(t, 'zh').map(c => c.code), ['D01', 'D03']);
assert.deepEqual(tripDorms.chips({ destinationType: 'dorm', dorm: 'D01' }, 'zh'), [], 'one building: stays locked');
// bad lists are refused
assert.throws(() => act('r', 'startTrip', { data: { category: 'takeout', when: 'now', duration: 10, station: 'Test gate', destinationType: 'dorm', dorm: 'D01', dorms: [], capacity: 5 } }));
assert.throws(() => act('r', 'startTrip', { data: { category: 'takeout', when: 'now', duration: 10, station: 'Test gate', destinationType: 'dorm', dorm: 'D01', dorms: Array.from({ length: 11 }, (_, i) => 'C' + i), capacity: 5 } }));
console.log('Multi-building trips: D01 + D03 trip takes both orders, leaves D02, keeps trip.dorm for older clients');
