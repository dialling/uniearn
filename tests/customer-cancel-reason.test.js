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
assert.deepEqual(reasons.REASONS.map(row => row.key), cloudReasons.REASONS.map(row => row.key));
assert.deepEqual(reasons.REASONS.map(row => row.key), ['信息填错', '不需要了', '我自己取了', '跑手太慢', '没人接单', '测试', '其他']);
assert.deepEqual(reasons.options({status: 'waiting'}, false).map(row => row.label), ['Wrong details in the order', 'Changed my mind', 'Collected it myself', 'Runner too slow to pick up', 'No one took the order', 'Test order', 'Other']);
assert.deepEqual(reasons.options({status: 'taken'}, true).map(row => row.label), ['信息填错', '不需要了', '我自己取了', '跑手太慢', '没人接单', '测试', '其他']);
assert.deepEqual(reasons.options({status: 'waiting'}, false).map(row => row.value), reasons.options({status: 'collected'}, false).map(row => row.value));
for (const label of reasons.options({}, false).map(row => row.label)) assert.doesNotMatch(label, /[\u4e00-\u9fff]/);
assert.equal(reasons.label('expired', false), '');
assert.equal(reasons.label('测试', false), 'Test order');
assert.equal(reasons.label('其他：late class', false), 'Other: late class');
assert.equal(reasons.label('其他：晚了', true), '其他：晚了');

function fresh(status, extra) {
  return {requests: [{id: '1', status, runnerId: status === 'waiting' ? null : 't', takenAt: 10, reward: 4, serviceFee: 0, discount: 0, collected: [], ...extra}], trips: status === 'waiting' ? [] : [{id: 't', requestIds: ['1'], joinUntil: 0}]};
}
for (const api of [domain, cloudDomain]) {
  assert.throws(() => api.customerCancel(fresh('waiting'), '1', 20), /Choose a cancel reason/);
  assert.throws(() => api.customerCancel(fresh('waiting'), '1', 20, 'Changed my mind'), /Choose a cancel reason/);
  assert.throws(() => api.customerCancel(fresh('waiting'), '1', 20, '其他', 'x'.repeat(201)), /200/);
  const optional = fresh('waiting');
  api.customerCancel(optional, '1', 20, '其他', '   ');
  assert.equal(optional.requests[0].cancel_reason, '其他');
  assert.equal(optional.requests[0].cancelNote, undefined);
  const noted = fresh('taken');
  api.customerCancel(noted, '1', 20, '其他', '  Posted twice  ');
  assert.equal(noted.requests[0].cancel_reason, '其他：Posted twice');
  assert.equal(noted.requests[0].cancelReason, '其他：Posted twice');
  assert.equal(noted.requests[0].cancelledBy, 'student');
  assert.equal(noted.trips[0].requestIds.includes('1'), false);
  const plain = fresh('taken');
  api.customerCancel(plain, '1', 20, '没人接单', 'ignored');
  assert.equal(plain.requests[0].status, 'cancelled');
  assert.equal(plain.requests[0].cancel_reason, '没人接单');
  const late = fresh('taken');
  assert.throws(() => api.customerCancel(late, '1', 20 + 180000, '测试'), /Cancel window ended/);
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
assert.throws(() => act(state, 'owner', 'cancel', {id: posted, reason: 'Collected it myself'}), /Choose a cancel reason/);
assert.throws(() => act(state, 'owner', 'cancel', {id: posted, reason: '其他', note: 12}), /Invalid cancel note/);
act(state, 'owner', 'cancel', {id: posted, reason: '信息填错'});
const saved = state.requests.find(row => row.id === posted);
assert.equal(saved.status, 'cancelled');
assert.equal(saved.cancel_reason, '信息填错');
assert.equal(saved.cancelledBy, 'student');
assert.equal(workflow.view(saved, 'zh').cancelReasonLabel, '信息填错');
assert.equal(workflow.view(saved, 'en').cancelReasonLabel, 'Wrong details in the order');
const snap = engine.snapshot(state, owner, person, Date.now());
assert.equal(snap.requests.find(row => row.id === posted).cancel_reason, '信息填错');

const accepted = act(state, 'owner', 'create', {data: {category: 'takeout', owner: 'Student', phone: '13800000000', station: 'North gate', dorm: 'D01', room: '101', bags: 1, price: 4, arrived: true}}).id;
act(state, 'runner', 'accept', {ids: [accepted]});
act(state, 'owner', 'cancel', {id: accepted, reason: '没人接单'});
const takenReason = state.requests.find(row => row.id === accepted);
assert.equal(takenReason.cancel_reason, '没人接单', 'the same seven reasons apply after acceptance');
const acceptedAgain = act(state, 'owner', 'create', {data: {category: 'takeout', owner: 'Student', phone: '13800000000', station: 'North gate', dorm: 'D01', room: '102', bags: 1, price: 4, arrived: true}}).id;
act(state, 'runner', 'accept', {ids: [acceptedAgain]});
act(state, 'owner', 'cancel', {id: acceptedAgain, reason: '其他', note: '  Runner has not moved  '});
const after = state.requests.find(row => row.id === acceptedAgain);
assert.equal(after.cancel_reason, '其他：Runner has not moved');
assert.equal(after.cancelNote, undefined);
assert.equal(workflow.view(after, 'en').cancelReasonLabel, 'Other: Runner has not moved');
assert.equal(engine.snapshot(state, owner, person, Date.now()).requests.find(row => row.id === acceptedAgain).cancel_reason, '其他：Runner has not moved');

const admin = fs.readFileSync(require.resolve('../cloudfunctions/adminService/core.js'), 'utf8');
assert.match(admin, /'cancel_reason','cancelReason'/);
const connection = fs.readFileSync(require.resolve('../admin-web/dist/connection.js'), 'utf8');
assert.match(connection, /cancelNote:r\.cancelNote/);

const sheet = fs.readFileSync('utils/customer-cancel-sheet.wxml', 'utf8');
assert.match(sheet, /cancelNoteOpen/);
assert.match(sheet, /optional/i);
assert.doesNotMatch(sheet, /short note is required/i);
assert.match(sheet, /bindtap="submitCancel"/);
assert.doesNotMatch(sheet.replace(/\{\{zh\?'[^']*':'([^']*)'\}\}/g, '$1'), /[\u4e00-\u9fff]/);
for (const page of ['request', 'task']) {
  const xml = fs.readFileSync('pages/' + page + '/index.wxml', 'utf8');
  const js = fs.readFileSync('pages/' + page + '/index.js', 'utf8');
  assert.match(xml, /customer-cancel-sheet/);
  assert.match(xml, /is="customerCancelSheet"/);
  assert.match(xml, /cancelWindow\.phase!=='hidden'/);
  assert.match(js, /openSheet\(this\)/);
  assert.match(js, /orders\.act\('cancel'/);
  assert.doesNotMatch(js, /ui\.confirm\([^)]*取消这笔订单/);
}
const requestXml=fs.readFileSync('pages/request/index.wxml', 'utf8');
assert.match(requestXml, /cancel-window-card/);
assert.ok(requestXml.indexOf('<order-feedback ') < requestXml.indexOf('cancel-window-card') && requestXml.indexOf('cancel-window-card') < requestXml.indexOf('bindtap="repeat"'), 'cancel sits under order feedback, not stuck to the page bottom');
assert.match(fs.readFileSync('pages/task/index.wxml', 'utf8'), /cancel-tip/, 'task page keeps its cancel window tip');
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
assert.deepEqual(page.data.cancelOptions.map(row => row.label), ['Wrong details in the order', 'Changed my mind', 'Collected it myself', 'Runner too slow to pick up', 'No one took the order', 'Test order', 'Other']);
page.submitCancel();
assert.equal(calls.length, 0, 'confirm stays blocked until a reason is chosen');
const mainRun = (async () => {
  await page.chooseCancelReason({currentTarget: {dataset: {value: '测试'}}});
  assert.equal(calls.length, 0, 'choosing a reason only selects it');
  assert.equal(page.data.cancelReason, '测试');
  assert.equal(page.data.cancelReady, true, 'the Cancel order button is ready once a reason is chosen');
  await page.submitCancel();
  assert.equal(calls.length, 1, 'Cancel order sends the chosen reason');
  assert.deepEqual(calls[0].payload, {id: 'o1', reason: '测试'});
  assert.equal(page.data.cancelOpen, false);

  page.cancel();
  page.chooseCancelReason({currentTarget: {dataset: {value: '其他'}}});
  assert.equal(page.data.cancelNoteOpen, true);
  assert.equal(page.data.cancelReady, true, '其他 can be sent with no note');
  assert.equal(calls.length, 1);
  page.cancelNoteInput({detail: {value: '   '}});
  await page.submitCancel();
  assert.deepEqual(calls[1].payload, {id: 'o1', reason: '其他'});

  page.cancel();
  page.chooseCancelReason({currentTarget: {dataset: {value: '其他'}}});
  page.cancelNoteInput({detail: {value: '  Wrong room  '}});
  await page.submitCancel();
  assert.deepEqual(calls[2].payload, {id: 'o1', reason: '其他', note: 'Wrong room'});

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
  assert.deepEqual(page.data.cancelOptions.map(row => row.value), ['信息填错', '不需要了', '我自己取了', '跑手太慢', '没人接单', '测试', '其他']);
  assert.deepEqual(page.data.cancelOptions.map(row => row.label), ['信息填错', '不需要了', '我自己取了', '跑手太慢', '没人接单', '测试', '其他']);
  require('../utils/customer-cancel').stop(page);
  console.log('Publisher cancel uses XP’s cancel vocabulary, sends the chosen reason from the Cancel order button, and keeps the 其他 note optional.');
})().catch(error => { console.error(error); process.exitCode = 1; });

// Sheet: Back before a reason is chosen, Cancel order after; older servers get 其他 with the reason as the note.
{
  const sheetXml = fs.readFileSync('utils/customer-cancel-sheet.wxml', 'utf8');
  assert.match(sheetXml, /wx:if="\{\{cancelReason\}\}"[^>]*bindtap="submitCancel"[^>]*>\{\{zh\?'取消订单':'Cancel order'\}\}/);
  assert.match(sheetXml, /wx:else class="btn outline" bindtap="backCancel"/);
  const cancelHelper = require('../utils/customer-cancel');
  assert.deepEqual(cancelHelper.legacyBody({reason: '我自己取了'}, Error('Choose a cancel reason')), {reason: '其他', note: '我自己取了'});
  assert.equal(cancelHelper.legacyBody({reason: '我自己取了'}, Error('Network down')), null);
}
mainRun.then(async () => {
  const cancelHelper = require('../utils/customer-cancel');
  // Simulate the deployed old orderService, which only knows four reasons.
  const old = new Set(['信息填错', '不需要了', '我自己取了', '其他']);
  for (const pageName of ['request', 'task']) {
    let spec; global.Page = s => { spec = s; };
    delete require.cache[require.resolve('../pages/' + pageName + '/index')];
    require('../pages/' + pageName + '/index');
    const sent = [];
    orders.act = async (action, body) => { sent.push(body); if (!old.has(body.reason)) throw Error('Choose a cancel reason'); };
    const pg = {...spec, id: 'o1', data: {...structuredClone(spec.data), cancelReason: '测试', cancelNote: '', cancelReady: true, cancelOpen: true}, setData(p) { Object.assign(this.data, p); }, refresh() {}};
    await pg.submitCancel();
    assert.deepEqual(sent.map(b => b.reason), ['测试', '其他'], pageName + ' falls back to 其他 when an old server rejects the reason');
    assert.equal(sent[1].note, '测试');
    assert.equal(pg.data.cancelOpen, false, pageName + ' closes the sheet after the cancel goes through');
  }
  console.log('Cancel sheet: Back becomes Cancel order after a reason is chosen; older servers get 其他 with the reason kept as the note.');
}).catch(e => { console.error(e); process.exitCode = 1; });
