'use strict';
const {hash, problem, text} = require('./core');
const missing = e => /not exist|not found|does not exist/i.test(e.message || '') || e.errCode === -502005;
const json = value => JSON.parse(JSON.stringify(value));
async function read(db, collection, id, fallback = null) {
  try { return (await db.collection(collection).doc(id).get()).data || fallback; }
  catch (e) { if (missing(e)) return fallback; throw e; }
}
async function rows(db, collection, max = 5000) {
  const all = [];
  try {
    while (all.length <= max) {
      const data = (await db.collection(collection).orderBy('_id', 'asc').skip(all.length).limit(Math.min(100, max + 1 - all.length)).get()).data;
      all.push(...data); if (data.length < 100 || all.length > max) break;
    }
  } catch (e) { if (!missing(e)) throw e; }
  return {data: all.slice(0, max), truncated: all.length > max};
}
function createRepository(db, engine) {
  engine = engine || require('./order-engine/engine');
  return {
    session: id => read(db, 'uniearn_admin_sessions', id),
    putSession: (id, data) => db.collection('uniearn_admin_sessions').doc(id).set({data}),
    deleteSession: id => db.collection('uniearn_admin_sessions').doc(id).remove(),
    async loginAttempt(key, success, now, client) {
      const result = await db.runTransaction(async tx => {
        const refs = [tx.collection('uniearn_admin_sessions').doc('login-' + key),
          tx.collection('uniearn_admin_sessions').doc('client-' + client)];
        const locks = await Promise.all(refs.map(ref => ref.get().then(r => r.data).catch(e => {if (missing(e)) return {}; throw e;})));
        if (locks.some(v => v.lockedUntil > now)) return {locked: true};
        for (let i = 0; i < refs.length; i++) {
          const lock = locks[i], fails = success ? 0 : (now - (lock.lastAt || 0) < 15 * 60000 ? lock.fails || 0 : 0) + 1;
          await refs[i].set({data: {fails, lastAt: now, lockedUntil: fails >= (i ? 20 : 5) ? now + 15 * 60000 : 0}});
        }
        return {locked: false};
      });
      if ((result.result || result).locked) throw problem('ADMIN_LOCKED', 'Too many attempts. Try again in 15 minutes.', 429);
    },
    async snapshot() {
      const [accounts, archived, state, meta, audit] = await Promise.all([
        rows(db, 'uniearn_accounts'), rows(db, 'uniearn_order_archive'),
        read(db, 'uniearn_order_state', 'team-test'), read(db, 'uniearn_admin_meta', 'dashboard', {}),
        db.collection('uniearn_admin_audit').orderBy('at', 'desc').limit(100).get().then(r => r.data).catch(e => {if (missing(e)) return []; throw e;})
      ]);
      if (!state || !Array.isArray(state.requests)) throw problem('STATE_MISSING', 'The existing uniearn_order_state/team-test document is missing.', 503);
      return {accounts: accounts.data, archived: archived.data, state, meta, audit,
        truncated: accounts.truncated || archived.truncated};
    },
    async mutate(operation) {
      const {id, signature, action, payload: p, user, now} = operation;
      const result = await db.runTransaction(async tx => {
        const receipt = await read(tx, 'uniearn_admin_audit', id);
        if (receipt) {
          if (receipt.signature !== signature) throw problem('OPERATION_REUSED', 'This operation ID was used for a different action.', 409);
          return {ok: true, replayed: true};
        }
        const state = await read(tx, 'uniearn_order_state', 'team-test');
        if (!state) throw problem('STATE_MISSING', 'The order state is missing.', 503);
        const meta = await read(tx, 'uniearn_admin_meta', 'dashboard', {});
        delete state._id; delete meta._id;
        const actor = hash('admin-web:' + user.username);
        let stateChanged = false, metaChanged = false;
        if (action === 'review') {
          if (!/^[a-f0-9]{64}$/.test(p.accountId || '') || !['approve','reject'].includes(p.decision)) throw problem('INVALID_REVIEW', 'Invalid application review.');
          const account = await read(tx, 'uniearn_accounts', p.accountId), v = account?.verification;
          if (!v || v.status !== 'pending' || !p.submittedAt || v.submittedAt !== p.submittedAt) throw problem('REVIEW_CHANGED', 'The application changed. Reload before reviewing.', 409);
          const note = text(p.note, 300, p.decision === 'reject');
          if (p.decision === 'approve') {
            if (!/^\d{6,12}$/.test(v.studentId || '')) throw problem('INVALID_STUDENT_ID', 'The student ID needs manual correction before approval.');
            const lockId = 'student-' + hash(v.studentId), lock = await read(tx, 'uniearn_accounts', lockId);
            if (lock && lock.ownerId !== p.accountId) {
              const other = await read(tx, 'uniearn_accounts', lock.ownerId);
              if (other?.verification?.studentId === v.studentId && ['pending','verified'].includes(other.verification.status)) throw problem('STUDENT_ID_USED', 'Another active application uses this student ID.', 409);
            }
            await tx.collection('uniearn_accounts').doc(lockId).set({data: {ownerId: p.accountId}});
          }
          const verification = {...v, status: p.decision === 'approve' ? 'verified' : 'rejected',
            checkedAt: now, reviewerId: actor, reviewNote: note, reason: p.decision === 'reject' ? note : ''};
          await tx.collection('uniearn_accounts').doc(p.accountId).update({data: {verification: db.command.set(verification), updatedAt: now}});
        } else if (action === 'supportReply' || action === 'resolveDispute') {
          if (action === 'supportReply') text(p.text, 500);
          if (action === 'resolveDispute' && !['release','refund'].includes(p.decision)) throw problem('INVALID_DECISION', 'Choose release or refund.');
          engine.execute(state, actor, {profile: {name: user.username}, _admin: true, _reviewer: true}, {...p, action}, now);
          if (action === 'resolveDispute') {
            const order = state.requests.find(r => r.id === p.id);
            order.dispute.reviewNote = text(p.note, 500);
            order.dispute.reviewedBy = user.username;
            order.dispute.reviewedAt = now;
          }
          stateChanged = true;
        } else if (action === 'supportStatus') {
          if (!['open','resolved'].includes(p.status)) throw problem('INVALID_STATUS', 'Invalid ticket status.');
          const ticket = (state.members[p.accountId]?.supportTickets || []).find(t => t.id === p.ticketId);
          if (!ticket) throw problem('NOT_FOUND', 'Support ticket not found.', 404);
          ticket.status = p.status; ticket.updatedAt = now; stateChanged = true;
        } else if (action === 'addMark' || action === 'removeMark') {
          const account = await read(tx, 'uniearn_accounts', p.accountId);
          if (account?.verification?.status !== 'verified') throw problem('NOT_RUNNER', 'This member is not a verified runner.');
          const member = state.members[p.accountId] || (state.members[p.accountId] = {marks: []});
          member.marks = member.marks || [];
          if (action === 'addMark') member.marks.push({id, at: now, reason: text(p.reason, 300), by: user.username});
          else {
            const i = member.marks.findIndex((m, index) => (m.id || String(index)) === p.markId);
            if (i < 0) throw problem('MARK_CHANGED', 'This mark changed. Reload first.', 409);
            member.marks.splice(i, 1);
          }
          stateChanged = true;
        } else if (action === 'note' || action === 'tag' || action === 'markTest') {
          if (!['order','member'].includes(p.kind)) throw problem('INVALID_INPUT', 'Choose an order or member.');
          if (p.kind === 'order' && !state.requests.some(r => r.id === p.id)) throw problem('NOT_FOUND', 'Only active orders can be annotated.', 404);
          if (p.kind === 'member' && !await read(tx, 'uniearn_accounts', p.id)) throw problem('NOT_FOUND', 'Member not found.', 404);
          const key = p.kind + ':' + text(p.id, 100);
          meta.annotations = meta.annotations || {};
          const item = meta.annotations[key] || (meta.annotations[key] = {notes: [], tags: []});
          if (action === 'note') item.notes = [...item.notes, {text: text(p.text, 500), by: user.username, at: now}].slice(-50);
          else if (action === 'markTest') item.isTest = !!p.value;
          else {const tag = text(p.tag, 50), tags = new Set(item.tags); if (tags.has(tag)) tags.delete(tag); else tags.add(tag); item.tags = [...tags].slice(-20);}
          metaChanged = true;
        } else if (action !== 'export') throw problem('UNSUPPORTED', 'This action is not connected to the mini program.', 400);
        if (stateChanged) {
          state.revision = (state.revision || 0) + 1;
          if (Buffer.byteLength(JSON.stringify(state)) > 850000) throw problem('STORAGE_FULL', 'Archive old orders before adding more data.', 409);
          await tx.collection('uniearn_order_state').doc('team-test').set({data: json(state)});
        }
        if (metaChanged) {
          if (Buffer.byteLength(JSON.stringify(meta)) > 600000) throw problem('STORAGE_FULL', 'Archive old admin notes first.', 409);
          await tx.collection('uniearn_admin_meta').doc('dashboard').set({data: json(meta)});
        }
        // Audit and mutation commit together; failed operations leave neither behind.
        await tx.collection('uniearn_admin_audit').doc(id).set({data: {signature, action, username: user.username,
          role: user.role, target: String(p.id || p.accountId || p.kind || '').slice(0,100), at: now}});
        return {ok: true};
      });
      return result.result || result;
    }
  };
}
module.exports = {createRepository, rows, read};
