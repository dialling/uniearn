// 2026-11-18: on the waiting ticket the task text sits in a clear box, and the customer can edit it until a runner accepts.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), engine = require('../cloudfunctions/orderService/engine');
const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const now = Date.now(), owner = engine.idFor('edit-owner'), other = engine.idFor('edit-other'), account = { profile: { name: 'Student', campusId: 'sip', universityId: 'xjtlu' } };
let state = engine.initial();
const run = (who, event) => { const w = structuredClone(state); const v = engine.execute(w, who, account, event, now); state = w; return v; };
const { id } = run(owner, { action: 'create', data: { category: 'task', title: 'Please proofread one page', price: 5 } });
run(owner, { action: 'editTask', id, title: '  Please proofread two pages  ' });
assert.equal(state.requests.find(r => r.id === id).title, 'Please proofread two pages', 'owner edits while waiting');
assert.throws(() => run(owner, { action: 'editTask', id, title: 'hey' }), /5–4000/, 'too short');
assert.throws(() => run(other, { action: 'editTask', id, title: 'Someone else edits' }), /Task not found/, 'only the owner');
state.requests.find(r => r.id === id).status = 'taken';
assert.throws(() => run(owner, { action: 'editTask', id, title: 'Change after acceptance' }), /can no longer be edited/, 'locked after a runner accepts');

const xml = read('pages/task/index.wxml'), js = read('pages/task/index.js');
assert.match(xml, /<view class="tk-brief"><view class="tk-brief-head">.*?<view wx:if="\{\{request\.isMine && request\.status==='waiting'\}\}" class="tk-brief-edit"[^>]*bindtap="openEditTask">/, 'Edit only for the owner while waiting');
assert.match(xml, /<text class="tk-brief-text" user-select="\{\{true\}\}">\{\{request\.title\}\}<\/text>/);
assert.match(xml, /wx:if="\{\{editTaskOpen && request\.isMine && request\.status==='waiting'\}\}"/, 'the sheet closes if a runner accepts');
assert.ok(js.includes("await orders.act('editTask',{id:this.id,title})"));
assert.ok(fs.existsSync(path.join(__dirname, '..', 'assets/icons/edit.svg')));
console.log('Task text: boxed on the ticket, editable by the owner until a runner accepts');
