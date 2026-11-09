// Account and personal-data deletion.
// Orders stay in the shared test ledger for the other participant (amounts, status, timestamps),
// but every personal field the deleted account contributed is wiped and the rows are marked
// `anonymized`. Everything that only belongs to the account is removed outright.
const ACTIVE = ['taken', 'collected', 'delivered', 'disputed'];

const cloudIds = value => (Array.isArray(value) ? value : [value])
  .filter(p => typeof p === 'string' && p.startsWith('cloud://'));

function runnerTripIds(state, actor) {
  return new Set(state.trips.filter(t => t.runnerAccountId === actor).map(t => t.id));
}

// Orders and trips that still need this account before it can walk away.
function openWork(state, actor) {
  const trips = runnerTripIds(state, actor);
  const mine = r => r.ownerId === actor || trips.has(r.runnerId);
  return {
    requests: state.requests.filter(r => mine(r) && ACTIVE.includes(r.status)).map(r => r.id),
    trips: state.trips.filter(t => trips.has(t.id) && !t.cancelled && t.phase !== 'done').map(t => t.id)
  };
}

function purge(state, actor, now = Date.now()) {
  const photos = new Set();
  const counts = { requests: 0, trips: 0, threads: 0, tickets: 0, receipts: 0, events: 0, wallets: 0, adjustments: 0, routes: 0 };
  const trips = runnerTripIds(state, actor);
  const collect = list => list.forEach(v => cloudIds(v).forEach(p => photos.add(p)));

  for (const r of state.requests) {
    const owner = r.ownerId === actor, runner = trips.has(r.runnerId);
    if (!owner && !runner) continue;
    if (owner) {
      collect([...(r.completionPhotos || []), r.photo, r.noticePhoto, ...(r.orderPictures || []), r.dispute && r.dispute.photo]);
      Object.assign(r, {
        owner: '', phone: '', room: '', codes: (r.codes || []).map(() => ''),
        note: '', orderPictures: [], completionPhotos: [], photo: '', noticePhoto: '', dropNote: '', completionNote: '',
        anonymized: true, anonymizedAt: now
      });
      delete r.ownerId;
      delete r.dispute;
      counts.requests++;
    }
    if (runner) {
      collect([...(r.completionPhotos || []), r.photo, r.riderPhoto, ...(r.riderPhotos || [])]);
      Object.assign(r, { completionPhotos: [], riderPhoto: '', riderPhotos: [], runnerPhone: '', runnerName: '', photo: owner ? '' : (r.photo || '') });
    }
    if (Array.isArray(r.analyticsEvents)) {
      const before = r.analyticsEvents.length;
      r.analyticsEvents = r.analyticsEvents.filter(e => e.actor !== actor);
      counts.events += before - r.analyticsEvents.length;
    }
    if (r.analyticsRunnerId === actor) delete r.analyticsRunnerId;
  }

  for (const t of state.trips) {
    if (t.runnerAccountId !== actor) continue;
    t.runnerName = '';
    t.runnerAvatar = '';
    t.runnerPhone = '';
    t.runnerAccountId = '';
    t.anonymized = true;
    counts.trips++;
  }

  if (state.members && state.members[actor]) {
    counts.tickets = (state.members[actor].supportTickets || []).length;
    delete state.members[actor];
  }

  if (state.threads) {
    for (const key of Object.keys(state.threads)) {
      const [requestId] = key.split(':');
      const r = state.requests.find(x => x.id === requestId);
      if (!r || r.ownerId === actor || trips.has(r.runnerId) || r.anonymized) {
        delete state.threads[key];
        counts.threads++;
      }
    }
  }

  if (state.wallets && state.wallets[actor]) { delete state.wallets[actor]; counts.wallets++; }

  if (Array.isArray(state.adjustments)) {
    const before = state.adjustments.length;
    state.adjustments = state.adjustments.filter(a => a && a.actor !== actor && a.accountId !== actor);
    counts.adjustments = before - state.adjustments.length;
  } else if (state.adjustments && state.adjustments[actor]) {
    delete state.adjustments[actor];
    counts.adjustments++;
  }

  if (state.routes && Array.isArray(state.routes)) {
    const before = state.routes.length;
    state.routes = state.routes.filter(r => r && r.accountId !== actor && r.accountId !== undefined);
    counts.routes = before - state.routes.length;
  }

  for (const key of Object.keys(state.receipts || {})) {
    if (key.startsWith(actor + '_')) { delete state.receipts[key]; counts.receipts++; }
  }

  // Legacy single-profile fields (older schema kept the profile on the state document).
  if (state.profile && state.profile.accountId === actor) {
    state.profile = { ...state.profile, name: '', phone: '', dorm: '', room: '', accountId: '', onboarded: false, loggedOut: true };
    state.agreements = {};
  }

  return { counts, photos: [...photos] };
}

const missing = e => /not exist|not found|does not exist|-502005/i.test(String(e && (e.message || e.errCode || e.code) || ''));

// Removes the account record and its auxiliary documents, plus the uploaded photos.
async function eraseDocuments({ cloud, db, actor, account = {}, photos = [] }) {
  const refs = [
    db.collection('uniearn_accounts').doc(actor),
    db.collection('uniearn_ocr_limits').doc(actor)
  ];
  const email = (account.emailChallenge && account.emailChallenge.emailHash) ||
    (account.verification && account.verification.emailHash) || '';
  if (email) {
    refs.push(db.collection('uniearn_accounts').doc('email-owner-' + email));
    refs.push(db.collection('uniearn_accounts').doc('email-rate-' + email));
  }
  for (const ref of refs) {
    try { await ref.remove(); } catch (e) { if (!missing(e)) throw e; }
  }

  // Archived orders keep a copy of the row; drop the copies that belong to this account.
  try {
    const archived = await db.collection('uniearn_news').where({ kind: 'orderArchive', 'order.ownerId': actor }).limit(100).get();
    for (const doc of archived.data || []) await db.collection('uniearn_news').doc(doc._id).remove();
  } catch (e) { if (!missing(e)) console.error('orderService archived deletion', e.message); }

  for (let i = 0; i < photos.length; i += 50) {
    try { await cloud.deleteFile({ fileList: photos.slice(i, i + 50) }); }
    catch (e) { console.error('orderService deleteFile', e.message); }
  }
  return { documents: refs.length, photos: photos.length };
}

// Closes every order the account still owns, including ones a runner already took.
// Used before deleting an account, or when the owner wants a clean slate.
function closeOwn(state, actor, now = Date.now()) {
  const domain = require('./domain');
  const counts = { orders: 0, trips: 0 };
  const trips = new Set();
  const closed = r => ['cancelled', 'refunded', 'confirmed'].includes(r.status);
  for (const r of state.requests) {
    if (r.ownerId !== actor || closed(r)) continue;
    if (r.runnerId) trips.add(r.runnerId);
    const fee = r.serviceFee === undefined ? domain.serviceFee(domain.boxes(r)) : r.serviceFee;
    r.status = 'cancelled';
    r.cancelledAt = now;
    r.cancelReason = 'customer-closed';
    r.refundAmount = Math.max(0, Math.round((r.reward + fee - Number(r.discount || 0)) * 100) / 100);
    counts.orders++;
  }
  for (const t of state.trips) {
    if (!trips.has(t.id) || t.cancelled) continue;
    const alive = (t.requestIds || []).filter(id => {
      const r = state.requests.find(x => x.id === id);
      return r && !closed(r);
    });
    if (!alive.length) { t.cancelled = true; t.cancelReason = 'customer-closed'; }
    else t.requestIds = alive;
    counts.trips++;
  }
  return counts;
}

module.exports = { openWork, purge, eraseDocuments, closeOwn, ACTIVE };
