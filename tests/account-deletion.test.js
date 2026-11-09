const assert = require('node:assert/strict');
const { harness } = require('./helpers/order-cloud');
const h = harness();
const id = h.engine.idFor;
const ok = async (who, action, extra = {}) => { const r = await h.call(who, action, extra); assert.equal(r.ok, true, r.error); return r; };
const fail = async (who, action, extra = {}) => { const r = await h.call(who, action, extra); assert.equal(r.ok, false, 'expected failure for ' + action); return r; };
const photo = (who, name) => 'cloud://test/order-photos/' + id(who) + '/' + String(name).repeat(32).slice(0, 32) + '.jpg';
const base = { category: 'takeout', owner: 'Customer', phone: '13801026092', station: 'North gate', dorm: 'Dorm 7', room: '412', bags: 1, price: 4, arrived: true };

(async () => {
  /* ---------- 1. deletion is refused while the account still has active work ---------- */
  const active = (await ok('customer', 'create', { data: base })).value.id;
  await ok('runner', 'accept', { ids: [active] });
  const blocked = await fail('customer', 'deleteAccount', { confirm: 'DELETE' });
  assert.match(blocked.error, /完成|取消|Finish|cancel/i);
  assert.equal(h.accounts[id('customer')].profile.name, 'customer', 'account survives a refused deletion');

  await ok('runner', 'pickup', { id: active });
  await ok('runner', 'deliver', { id: active, photo: photo('runner', 'a'), location: 'Downstairs' });
  await ok('customer', 'confirm', { id: active });

  /* ---------- 2. closed order, ticket and photos are wiped ---------- */
  const second = (await ok('customer', 'create', {
    data: { ...base, orderPictures: [photo('customer', 'b'), photo('customer', 'c')], note: 'Door 412, call me' }
  })).value.id;
  await ok('customer', 'supportRequest', { topic: 'deletion' });
  assert.equal(h.state.members[id('customer')].supportTickets.length, 1);
  const receiptsBefore = Object.keys(h.state.receipts).filter(k => k.startsWith(id('customer') + '_')).length;
  assert.ok(receiptsBefore > 0);

  const deleted = (await ok('customer', 'deleteAccount', { confirm: 'DELETE' })).value;
  assert.equal(deleted.counts.requests, 2, 'both own orders were anonymised');
  assert.ok(deleted.photos.length >= 2, 'photos are queued for storage deletion');

  const wiped = h.state.requests.find(r => r.id === second);
  assert.equal(wiped.owner, '', 'owner name is gone');
  assert.equal(wiped.phone, '', 'phone is gone');
  assert.equal(wiped.room, '', 'room is gone');
  assert.equal(wiped.note, '', 'free-text note is gone');
  assert.deepEqual(wiped.orderPictures, [], 'order photos are gone');
  assert.equal(wiped.ownerId, undefined, 'owner id is gone');
  assert.equal(wiped.anonymized, true);
  assert.equal(wiped.status, 'waiting', 'status is preserved for the other side');
  assert.equal(wiped.reward, 4, 'amount is preserved for the other side');

  const closed = h.state.requests.find(r => r.id === active);
  assert.equal(closed.owner, '', 'confirmed order is anonymised too');
  assert.equal(closed.confirmedAt > 0, true, 'timestamps survive');

  assert.equal(h.state.members[id('customer')], undefined, 'member record (points, warnings, tickets) is deleted');
  assert.equal(Object.keys(h.state.receipts).filter(k => k.startsWith(id('customer') + '_')).length, 0, 'retry receipts are deleted');
  assert.equal(h.accounts[id('customer')], undefined, 'account document is deleted');
  assert.ok(h.deletedFiles.includes(photo('customer', 'b')), 'stored photos are deleted from cloud storage');
  assert.ok(h.deletedFiles.includes(photo('runner', 'a')), 'runner proof uploaded for this customer is deleted as well');

  /* ---------- 3. the deleted account cannot sync its old data back ---------- */
  const after = await h.call('customer', 'sync');
  assert.equal(after.ok, true);
  assert.equal(after.snapshot.requests.filter(r => r.isMine || r.isRunner).length, 0, 'no personal order view after deletion');
  assert.equal(after.snapshot.accountId, id('customer'));
  const account = h.accounts[id('customer')];
  assert.equal(account, undefined, 'account document stays deleted');

  /* ---------- 4. an explicit confirmation string is required ---------- */
  const third = (await ok('runner', 'create', { data: { ...base, owner: 'Runner', phone: '13801023381' } })).value.id;
  const noConfirm = await fail('runner', 'deleteAccount', {});
  assert.match(noConfirm.error, /Confirm|确认/i);

  /* ---------- 6. closing every open order (even accepted ones) before deleting ---------- */
  const c1 = (await ok('stranger', 'create', { data: { ...base, owner: 'Stranger', phone: '13801023382' } })).value.id;
  await ok('runner', 'accept', { ids: [c1] });
  const closedResult = (await ok('stranger', 'closeMyOrders')).value;
  assert.equal(closedResult.counts.orders, 1, 'the accepted order was closed');
  assert.equal(h.state.requests.find(r => r.id === c1).status, 'cancelled');
  assert.ok(h.state.trips.find(t => t.requestIds.includes(c1)).cancelled, 'its trip is closed as well');
  const nothingLeft = await fail('stranger', 'closeMyOrders');
  assert.match(nothingLeft.error, /没有|no open/i);

  const c2 = (await ok('stranger', 'create', { data: { ...base, owner: 'Stranger', phone: '13801023382' } })).value.id;
  await ok('runner', 'accept', { ids: [c2] });
  const closedAndDeleted = (await ok('stranger', 'deleteAccount', { confirm: 'DELETE', closeOrders: true })).value;
  assert.equal(h.state.requests.find(r => r.id === c2).status, 'cancelled', 'deleteAccount can close the open order first');
  assert.equal(closedAndDeleted.counts.requests >= 1, true);
  assert.equal(h.accounts[id('stranger')], undefined, 'account deleted after closing the orders');

  /* ---------- 5. runner deletion blanks the runner identity but keeps the customer's order ---------- */
  await ok('runner', 'cancel', { id: third, reason: 'Changed my mind' });
  await h.call('other', 'sync');
  const runnerDeleted = (await ok('runner', 'deleteAccount', { confirm: 'DELETE' })).value;
  assert.ok(runnerDeleted.counts.trips >= 1, 'trips run by the account are anonymised');
  const anonymisedTrip = h.state.trips.find(t => t.anonymized);
  assert.ok(anonymisedTrip, 'a trip was anonymised');
  assert.equal(anonymisedTrip.runnerAccountId, '', 'runner account id removed from the trip');
  assert.equal(anonymisedTrip.runnerPhone, '', 'runner phone removed');
  const customerOrder = h.state.requests.find(r => r.id === active);
  assert.equal(customerOrder.owner, '', 'previously anonymised customer stays anonymised');
  assert.equal(h.accounts[id('runner')], undefined, 'runner account document deleted');

  console.log('Account deletion: active-work guard, order anonymisation, member/receipt/ticket removal, photo deletion, account document removal, sync after deletion, runner-side anonymisation and close-all-orders passed');
})().catch(e => { console.error(e); process.exitCode = 1; });
