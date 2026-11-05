'use strict';
const crypto = require('crypto');
const TTL = 12 * 3600000;
const hash = value => crypto.createHash('sha256').update(String(value)).digest('hex');
const equal = (a, b) => crypto.timingSafeEqual(Buffer.from(hash(a)), Buffer.from(hash(b)));
const clone = value => JSON.parse(JSON.stringify(value));
const permissions = {
  review: ['admin', 'ops'], supportReply: ['admin', 'ops', 'support'],
  supportStatus: ['admin', 'ops', 'support'], resolveDispute: ['admin', 'ops'],
  note: ['admin', 'ops', 'support'], tag: ['admin', 'ops'], markTest: ['admin'],
  addMark: ['admin', 'ops'], removeMark: ['admin', 'ops'], export: ['admin']
};
function problem(code, message, status = 400) {
  const error = new Error(message); error.code = code; error.status = status; return error;
}
function admins(env) {
  let roles = {};
  try { roles = JSON.parse(env.ADMIN_ROLES || '{}'); } catch (_) { throw problem('ADMIN_SETUP', 'ADMIN_ROLES must be a JSON object.', 503); }
  const entries = String(env.ADMIN_ACCOUNTS || '').split(/[;\n]/).map(line => {
    const at = line.indexOf(':'); return at > 0 ? {username: line.slice(0, at).trim(), password: line.slice(at + 1).trim()} : null;
  }).filter(Boolean);
  if (env.ADMIN_USERNAME) entries.push({username: String(env.ADMIN_USERNAME), password: String(env.ADMIN_PASSWORD || '')});
  return entries.filter(a => a.username && a.password.length >= 8).map(a => ({...a,
    role: ['admin', 'ops', 'support'].includes(roles[a.username]) ? roles[a.username] : 'admin'}));
}
function text(value, max, required = true) {
  const result = String(value || '').trim();
  if ((required && !result) || result.length > max) throw problem('INVALID_INPUT', 'Please enter valid text (maximum ' + max + ' characters).');
  return result;
}
function createService({repo, env, now = Date.now, random = () => crypto.randomBytes(32).toString('base64url')}) {
  async function authenticate(token) {
    if (!/^[A-Za-z0-9_-]{40,100}$/.test(token || '')) throw problem('AUTH_REQUIRED', 'Please sign in to the admin console.', 401);
    const session = await repo.session(hash(token));
    const entry = session && admins(env).find(a => equal(a.username, session.username));
    if (!session || session.until <= now() || !entry || !equal(session.credential, hash(entry.username + ':' + entry.password))) {
      throw problem('AUTH_REQUIRED', 'Your admin session expired. Please sign in again.', 401);
    }
    return {username: entry.username, role: entry.role};
  }
  async function run(input = {}, token = '', client = '') {
    const action = String(input.action || 'snapshot');
    if (action === 'login') {
      const list = admins(env);
      if (!list.length) throw problem('ADMIN_SETUP', 'Configure ADMIN_ACCOUNTS in the adminService cloud function.', 503);
      const username = text(input.username, 80), password = text(input.password, 300);
      const key = hash(username.toLowerCase());
      // The repository records failures transactionally, so limits survive cold starts.
      const entry = list.find(a => equal(username, a.username) & equal(password, a.password));
      await repo.loginAttempt(key, !!entry, now(), hash(client));
      if (!entry) throw problem('ADMIN_INVALID', 'Incorrect username or password.', 401);
      const token = random();
      await repo.putSession(hash(token), {username: entry.username, until: now() + TTL,
        credential: hash(entry.username + ':' + entry.password)});
      return {ok: true, token, user: {username: entry.username, role: entry.role}, expiresAt: now() + TTL};
    }
    const user = await authenticate(token);
    if (action === 'logout') { await repo.deleteSession(hash(token)); return {ok: true}; }
    if (action === 'snapshot') {
      const data = await repo.snapshot();
      // Passwords, mini-program admin sessions and login lockouts never leave the server.
      const accounts = data.accounts.filter(a => a.profile).map(a => ({
        id: a._id, profile: {name: a.profile.name || '', dorm: a.profile.dorm || '', room: a.profile.room || '',
          pickup: a.profile.pickup || '', phone: user.role === 'support' ? '' : a.profile.phone || ''},
        verification: a.verification ? {status: a.verification.status, gender: user.role === 'support' ? '' : ['male','female'].includes(a.verification.gender) ? a.verification.gender : '', realName: a.verification.realName || a.verification.studentName || '',
          studentId: user.role === 'support' ? '' : a.verification.studentId || '',
          phone: user.role === 'support' ? '' : a.verification.phone || '', phoneVerified: !!a.verification.phoneVerified,
          submittedAt: a.verification.submittedAt || null, checkedAt: a.verification.checkedAt || null,
          reason: a.verification.reason || '', reviewerId: a.verification.reviewerId || ''} : null,
        updatedAt: a.updatedAt || null, createdAt: a.createdAt || a.updatedAt || null
      }));
      const state = data.state || {requests: [], trips: [], members: {}};
      const requests = [...(state.requests || []), ...(data.archived || [])].map(r => {
        const out = {};
        for (const k of ['id','category','title','station','dorm','reward','serviceFee','discount','couponId','status',
          'ownerId','runnerId','createdAt','takenAt','collectedAt','deliveredAt','confirmedAt','cancelledAt',
          'autoConfirmed','cancelReason','refundedAt','refundAmount','refundReason','isTest','rating','arrivalAt',
          'dueAt','small','big','night','runnerBonus','cancelledBy','dispute']) if (r[k] !== undefined) out[k] = clone(r[k]);
        return out;
      });
      const tickets = Object.entries(state.members || {}).flatMap(([accountId, member]) =>
        (member.supportTickets || []).map(t => ({...t, accountId})));
      const marks = Object.entries(state.members || {}).flatMap(([accountId, member]) =>
        (member.marks || []).map((m, i) => ({...m, accountId, index: i})));
      return {ok: true, user, serverTime: now(), data: {accounts, requests, tickets, marks,
        trips: (state.trips || []).map(t => ({id: t.id, runnerAccountId: t.runnerAccountId, requestIds: t.requestIds || []})),
        meta: data.meta || {}, audit: data.audit || [], truncated: data.truncated || false,
        revision: state.revision || 0, testLedger: true}};
    }
    if (!permissions[action] || !permissions[action].includes(user.role)) throw problem('FORBIDDEN', 'Your role cannot perform this action.', 403);
    if (!/^[A-Za-z0-9_-]{12,100}$/.test(input.operationId || '')) throw problem('INVALID_OPERATION', 'A unique operation ID is required.');
    const payload = {...input}; delete payload.operationId;
    if (JSON.stringify(payload).length > 10000) throw problem('INVALID_INPUT', 'The operation is too large.');
    return repo.mutate({action, payload, user, now: now(),
      id: hash(user.username + ':' + input.operationId), signature: hash(JSON.stringify(payload))});
  }
  return {run, authenticate};
}
module.exports = {createService, admins, equal, hash, problem, text, permissions};
