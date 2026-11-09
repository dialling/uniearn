const assert = require('node:assert/strict');
const fs = require('node:fs');
const reasons = require('../utils/customer-cancel-reasons');
const cloudReasons = require('../cloudfunctions/orderService/customer-cancel-reasons');
const domain = require('../utils/domain');
const cloudDomain = require('../cloudfunctions/orderService/domain');
const engine = require('../cloudfunctions/orderService/engine');
const workflow = require('../utils/workflow');

assert.equal(
  fs.readFileSync(require.resolve('../utils/customer-cancel-reasons.js'), 'utf8'),
  fs.readFileSync(require.resolve('../cloudfunctions/orderService/customer-cancel-reasons.js'), 'utf8'),
  'client and orderService share one reason catalog'
);
assert.deepEqual(reasons.POSTED.map(row => row.key), cloudReasons.POSTED.map(row => row.key));
assert.deepEqual(reasons.TAKEN.map(row => row.key), [
  'Collected it myself',
  'Runner too slow to pick up',
  'Other'
]);
assert.deepEqual(reasons.POSTED.map(row => row.key), [
  'No one took the order',
  'Collected it myself',
  'Changed my mind',
  'Wrong details in the order',
  'Other'
]);
for (const row of reasons.POSTED.concat(reasons.TAKEN)) {
  assert.doesNotMatch(row.key, /[\u4e00-\u9fff]/, row.key);
  assert.match(row.zh, /[\u4e00-\u9fff]/);
}
assert.equal(reasons.POSTED.find(row => row.note).key, 'Other');
assert.equal(reasons.TAKEN.filter(row => row.note).length, 1);

const waiting = {status: 'waiting', runnerId: null};
const taken = {status: 'taken', runnerId: 't', takenAt: 1};
assert.deepEqual(reasons.options(waiting, false).map(row => row.label), reasons.POSTED.map(row => row.key));
assert.deepEqual(reasons.options(waiting, true).map(row => row.label), reasons.POSTED.map(row => row.zh));
assert.equal(reasons.options(taken, false).some(row => row.value === 'No one took the order'), false);
assert.equal(reasons.options(waiting, false).some(row => row.value === 'Runner too slow to pick up'), false);
assert.equal(reasons.label('expired', false), '');
assert.equal(reasons.label('Collected it myself', true), '我自己取了');

function fresh(status, extra) {
  return {requests: [{id: '1', status, runnerId: status === 'waiting' ? null : 't', takenAt: 10, reward: 4, serviceFee: 0, discount: 0, collected: [], ...extra}], trips: status === 'waiting' ? [] : [{id: 't', requestIds: ['1'], joinUntil: 0}]};
}
for (const api of [domain, cloudDomain]) {
  assert.throws(() => api.customerCancel(fresh('waiting'), '1', 20), /Choose a cancel reason/);
  assert.throws(() => api.customerCancel(fresh('waiting'), '1', 20, 'Runner too slow to pick up'), /Choose a cancel reason/);
  assert.throws(() => api.customerCancel(fresh('taken'), '1', 20, 'Changed my mind'), /Choose a cancel reason/);
  assert.throws(() => api.customerCancel(fresh('waiting'), '1', 20, 'Other', '   '), /short note/);
  assert.throws(() => api.customerCancel(fresh('waiting'), '1', 20, 'Other', 'x'.repeat(201)), /200/);
  const noted = fresh('waiting');
  api.customerCancel(noted, '1', 20, 'Other', '  Posted twice  ');
  assert.equal(noted.requests[0].cancelReason, 'Other');
  assert.equal(noted.requests[0].cancelNote, 'Posted twice');
  assert.equal(noted.requests[0].cancelledBy, 'student');
  const plain = fresh('taken');
  api.customerCancel(plain, '1', 20, 'Runner too slow to pick up', 'ignored');
  assert.equal(plain.requests[0].status, 'cancelled');
  assert.equal(plain.requests[0].cancelReason, 'Runner too slow to pick up');
  assert.equal(plain.requests[0].cancelNote, undefined);
  assert.equal(plain.trips[0].requestIds.includes('1'), false);
  const late = fresh('taken');
  assert.throws(() => api.customerCancel(late, '1', 20 + 180000, 'Runner too slow to pick up'), /Cancel window ended/);
}

const owner = engine.idFor('cancel-reason-owner');
const runner = engine.idFor('cancel-reason-runner');
const person = {profile: {name: 'Student', phone: '13800000000', campusId: 'sip', universityId: 'xjtlu'}, verification: {status: 'verified'}, runnerRulesAcceptedAt: 1};
function act(state, who, action, payload) {
  return engine.execute(state, who === 'runner' ? runner : owner, person, {action, ...payload}, Date.now());
}
const state = engine.initial();
const posted = act(state, 'owner', 'create', {data: {category: 'parcel', owner: 'Student', phone: '13800000000', station: 'North gate', dorm: 'D01', room: '101', parcelItems: [{size: 'small', code: 'A1'}]}}).id;
assert.throws(() => act(state, 'owner', 'cancel', {id: posted}), /Choose a cancel reason/);
assert.throws(() => act(state, 'owner', 'cancel', {id: posted, reason: 'Other'}), /short note/);
assert.throws(() => act(state, 'owner', 'cancel', {id: posted, reason: 'Other', note: 12}), /Invalid cancel note/);
act(state, 'owner', 'cancel', {id: posted, reason: 'Wrong details in the order'});
const saved = state.requests.find(row => row.id === posted);
assert.equal(saved.status, 'cancelled');
assert.equal(saved.cancelReason, 'Wrong details in the order');
assert.equal(saved.cancelledBy, 'student');
assert.equal(workflow.view(saved, 'zh').cancelReasonLabel, '信息填错了');
assert.equal(workflow.view(saved, 'en').cancelReasonLabel, 'Wrong details in the order');
const snap = engine.snapshot(state, owner, person, Date.now());
assert.equal(snap.requests.find(row => row.id === posted).cancelReason, 'Wrong details in the order');

const accepted = act(state, 'owner', 'create', {data: {category: 'takeout', owner: 'Student', phone: '13800000000', station: 'North gate', dorm: 'D01', room: '101', bags: 1, price: 4, arrived: true}}).id;
act(state, 'runner', 'accept', {ids: [accepted]});
assert.throws(() => act(state, 'owner', 'cancel', {id: accepted, reason: 'No one took the order'}), /Choose a cancel reason/);
act(state, 'owner', 'cancel', {id: accepted, reason: 'Other', note: 'Runner has not moved'});
const after = state.requests.find(row => row.id === accepted);
assert.equal(after.cancelReason, 'Other');
assert.equal(after.cancelNote, 'Runner has not moved');
assert.equal(engine.snapshot(state, owner, person, Date.now()).requests.find(row => row.id === accepted).cancelNote, 'Runner has not moved');

const admin = fs.readFileSync(require.resolve('../cloudfunctions/adminService/core.js'), 'utf8');
assert.match(admin, /'cancelReason','cancelNote'/);
const connection = fs.readFileSync(require.resolve('../admin-web/dist/connection.js'), 'utf8');
assert.match(connection, /cancelNote:r\.cancelNote/);

const sheet = fs.readFileSync('utils/customer-cancel-sheet.wxml', 'utf8');
assert.match(sheet, /disabled="\{\{!cancelReady \|\| cancelling\}\}"/);
assert.match(sheet, /bindtap="submitCancel"/);
assert.doesNotMatch(sheet.replace(/\{\{zh\?'[^']*':'([^']*)'\}\}/g, '$1'), /[\u4e00-\u9fff]/);
for (const page of ['request', 'task']) {
  const xml = fs.readFileSync('pages/' + page + '/index.wxml', 'utf8');
  const js = fs.readFileSync('pages/' + page + '/index.js', 'utf8');
  assert.match(xml, /customer-cancel-sheet/);
  assert.match(xml, /is="customerCancelSheet"/);
  assert.match(xml, /request\.status!=='waiting' && cancelWindow\.phase!=='hidden'/);
  assert.match(js, /openSheet\(this\)/);
  assert.match(js, /orders\.act\('cancel'/);
  assert.doesNotMatch(js, /ui\.confirm\([^)]*取消这笔订单/);
}
const history = fs.readFileSync('pages/requests/index.wxml', 'utf8');
assert.match(history, /cancelReasonLabel/);
const jobs = fs.readFileSync('pages/jobs/index.wxml', 'utf8');
assert.doesNotMatch(jobs, /bindtap="cancel"/);

global.wx = {getStorageSync: () => null, setStorageSync() {}, showToast() {}, showModal() {}, setNavigationBarTitle() {}, previewImage() {}};
const store = require('../utils/store');
const orders = require('../utils/orders');
store.reset();
store.update(s => {
  s.language = 'en';
  s.profile = {...s.profile, accountId: 'me', name: 'Ada'};
  s.requests = [{id: 'o1', isMine: true, ownerId: 'me', status: 'waiting', category: 'parcel', reward: 4, serviceFee: 0, discount: 0, collected: [], history: [], orderPictures: [], runnerId: null, dorm: 'D01', room: '101', station: 'North gate', codes: ['A']}];
});
let def;
global.Page = spec => { def = spec; };
delete require.cache[require.resolve('../pages/request/index')];
require('../pages/request/index');
const calls = [];
orders.act = async (action, payload) => { calls.push({action, payload}); };
const page = {...def, data: structuredClone(def.data), setData(patch) { Object.assign(this.data, patch); }};
page.onLoad({id: 'o1'});
page.refresh();
page.cancel();
assert.equal(page.data.cancelOpen, true);
assert.equal(page.data.cancelReady, false);
assert.equal(calls.length, 0, 'opening the sheet does not cancel');
assert.deepEqual(page.data.cancelOptions.map(row => row.label), reasons.POSTED.map(row => row.key));
page.submitCancel();
assert.equal(calls.length, 0, 'confirm stays blocked until a reason is chosen');
page.chooseCancelReason({currentTarget: {dataset: {value: 'Other'}}});
assert.equal(page.data.cancelReady, false);
page.cancelNoteInput({detail: {value: '   '}});
assert.equal(page.data.cancelReady, false);
page.cancelNoteInput({detail: {value: 'Wrong room'}});
assert.equal(page.data.cancelReady, true);
(async () => {
  await page.submitCancel();
  assert.equal(calls[0].action, 'cancel');
  assert.deepEqual(calls[0].payload, {id: 'o1', reason: 'Other', note: 'Wrong room'});
  assert.equal(page.data.cancelOpen, false);

  store.update(s => {
    s.language = 'zh';
    const row = s.requests[0];
    row.status = 'taken';
    row.runnerId = 'trip';
    row.takenAt = Date.now();
  });
  page.refresh();
  assert.equal(page.data.cancelWindow.phase, 'grace');
  assert.equal(page.data.zh, true);
  page.cancel();
  assert.deepEqual(page.data.cancelOptions.map(row => row.value), reasons.TAKEN.map(row => row.key));
  assert.deepEqual(page.data.cancelOptions.map(row => row.label), reasons.TAKEN.map(row => row.zh));
  page.chooseCancelReason({currentTarget: {dataset: {value: 'No one took the order'}}});
  assert.equal(page.data.cancelReady, false, 'a posted-only reason cannot confirm after acceptance');
  require('../utils/customer-cancel').stop(page);
  console.log('Customer cancel requires an XP reason, blocks an empty choice, and keeps the note only for Other.');
})().catch(error => { console.error(error); process.exitCode = 1; });
