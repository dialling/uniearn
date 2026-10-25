// Internal team-test service. All authorization and transitions run on the server.
const crypto = require('crypto');
const d = require('./domain');
const f = require('./workflow');
const rewards=require('./rewards');
const wallet=require('./wallet');
const clone = x => JSON.parse(JSON.stringify(x));
const idFor = openid => crypto.createHash('sha256').update(openid).digest('hex');
function check(ok, message) { if (!ok) throw Error(message); }
// One shared document holds every order, so each student gets a fair share of it.
const OPEN_STATUSES = ['waiting','taken','collected','delivered','disputed'], MAX_OPEN_PER_USER = 10, MAX_CREATES_PER_DAY = 30, MAX_TASK_PRICE = 500;
function initial() { return { nextId: 1, requests: [], trips: [], members: {}, receipts: {}, revision: 0, loyaltyStartedAt:Date.now() }; }
const onTime = r => r.category==='task'?r.deliveredAt<=r.dueAt:r.deliveredAt-r.collectedAt<=15*60000;
function stats(s, id) {
  const ownTrips = new Set(s.trips.filter(t => t.runnerAccountId === id).map(t => t.id));
  const paid = s.requests.filter(r => r.status === 'confirmed' && ownTrips.has(r.runnerId));
  const done=s.requests.filter(r=>ownTrips.has(r.runnerId)&&['delivered','confirmed'].includes(r.status));
  const old = (s.members[id] || {}).archived || {};
  return { jobsDone: done.length+(old.jobsDone||0), onTime:done.filter(onTime).length+(old.onTime||0), paid: Math.round((paid.reduce((n, r) => n + r.reward+Number(r.runnerBonus||0), 0)+(old.paid||0)) * 100) / 100,
    marks: (s.members[id] || {}).marks || [] };
}
// Finished orders leave the shared document after ARCHIVE_AFTER. That window is longer than a
// week so weekly bonuses and the 7-day earnings chart still see them. Runner totals and the
// facts that rewards depend on are kept on the member record.
const FINISHED = ['confirmed','cancelled','refunded'], ARCHIVE_AFTER = 8 * 86400000;
const finishedAt = r => r.confirmedAt || r.refundedAt || r.cancelledAt || r.createdAt || 0;
function archive(s, now = Date.now()) {
  wallet.settle(s, now);
  const old = s.requests.filter(r => FINISHED.includes(r.status) && now - finishedAt(r) >= ARCHIVE_AFTER).slice(0,20);
  if (!old.length) return [];
  const ids = new Set(old.map(r => r.id)), member = id => s.members[id] || (s.members[id] = { marks: [] });
  for (const r of old) {
    if (r.ownerId) {
      const m = member(r.ownerId); m.archivedOrders = (m.archivedOrders || 0) + 1;
      if (r.status === 'confirmed') { const month = new Date(r.createdAt + 28800000).toISOString().slice(0, 7); m.confirmedMonths = [...new Set([...(m.confirmedMonths || []), month])].sort().slice(-3); }
    }
    const t = r.status === 'confirmed' && s.trips.find(x => x.id === r.runnerId);
    if (t && t.runnerAccountId) {
      const runner = member(t.runnerAccountId), a = runner.archived || (runner.archived = { jobsDone: 0, onTime: 0, paid: 0 });
      a.jobsDone++; if (onTime(r)) a.onTime++; a.paid = Math.round((a.paid + r.reward + Number(r.runnerBonus || 0)) * 100) / 100;
    }
  }
  s.requests = s.requests.filter(r => !ids.has(r.id));
  const used = new Set(s.requests.map(r => r.runnerId).filter(Boolean));
  s.trips = s.trips.filter(t => used.has(t.id) || now - (t.createdAt || now) < ARCHIVE_AFTER);
  if (s.threads) for (const key of Object.keys(s.threads)) if (ids.has(key.split(':')[0])) delete s.threads[key];
  return old;
}
function profile(s, id, account) { return { ...(account.profile || {}), ...stats(s, id), accountId: id }; }
function ownRequest(s, id, actor) {
  const r = s.requests.find(x => x.id === id);
  check(r && r.ownerId === actor, 'Only the customer who posted this order can do that.');
  return r;
}
function ownTrip(s, id, actor) {
  const t = s.trips.find(x => x.id === id);
  check(t && t.runnerAccountId === actor && !t.cancelled, 'This is not your active trip.');
  return t;
}
function runnerRequest(s, id, actor) {
  const r = s.requests.find(x => x.id === id);
  check(r, 'Order not found.'); ownTrip(s, r.runnerId, actor); return r;
}
function photo(value, actor, required = false) {
  if (!value && !required) return '';
  check(typeof value === 'string' && value.length < 600 &&
    new RegExp('^cloud://[^/]+/order-photos/' + actor + '/[a-f0-9]{32}\\.(jpg|png)$').test(value),
    'Upload this photo again before submitting.');
  return value;
}
function input(data, actor) {
  data = data || {}; const out = {};
  for (const key of ['destinationType','deliveryAddress','dormGender','recipientGender','owner','station','dorm','room','phone','note','description','pickupPoint','pickupAddress','pickupNote','dropNote','deadline','deliveryDate','arrivalTime','pickupCode','deliverBy','shop']) {
    check(data[key] === undefined || typeof data[key] === 'string', 'Invalid ' + key);
    out[key] = (data[key] || '').trim(); check(out[key].length <= 500, key + ' is too long.');
  }
  check(['','male','female'].includes(out.dormGender),'Choose a valid dorm gender.');
  if(out.destinationType==='place'||data.category==='task')out.dormGender='';
  check(['','male','female'].includes(out.recipientGender),'Choose a valid recipient gender.');
  if(out.destinationType!=='place'||data.category==='task')out.recipientGender='';
  check(out.pickupCode.length <= 20, 'Keep the pickup code under 20 characters.');
  check(out.shop.length <= 60, 'Keep the shop name under 60 characters.');
  check(['parcel','takeout','task'].includes(data.category), 'Choose takeaway or parcel.');
  out.category = data.category;
  if(out.category!=='task'){
    check(!out.destinationType||['dorm','place'].includes(out.destinationType),'Choose a valid destination type.');
    if(out.destinationType==='place'){check(!!out.deliveryAddress,'Describe exactly where to deliver.');out.dorm=/library|图书馆/i.test(out.deliveryAddress)?'Library':/classroom|教室/i.test(out.deliveryAddress)?'Classroom':/sports|体育/i.test(out.deliveryAddress)?'Sports centre':'Campus meeting point';out.destinationKey=crypto.createHash('sha256').update(out.deliveryAddress.toLowerCase().replace(/\s+/g,' ').trim()).digest('hex');out.room='';out.dropNote='Meet at the stated location';}
  }
  if(data.deliverAt!==undefined){check(Number.isSafeInteger(data.deliverAt),'Invalid delivery time');out.deliverAt=data.deliverAt;}
  out.arrived = data.arrived === true; out.soup = data.soup === true; out.fragile = data.category === 'parcel' && data.fragile === true; out.night = data.category === 'takeout' && data.night === true;
  for (const key of ['bags','price','tip']) out[key] = Number(data[key] || 0);
  if (out.category === 'takeout') {
    check(data.purchaseStatus===undefined||['ordered','needs_purchase'].includes(data.purchaseStatus),'Choose a valid food order status.');
    out.purchaseStatus=data.purchaseStatus===undefined?'ordered':data.purchaseStatus;
    check(Number.isInteger(out.bags) && out.bags >= 1 && out.bags <= 5, 'Choose 1–5 bags.');
    check(Number.isInteger(out.price) && out.price >= 3 && out.price <= d.MAX_PRICE_PER_BOX, 'Choose ¥3–'+d.MAX_PRICE_PER_BOX+' per bag.');
  } else if(out.category==='task'){
    out.title=String(data.title||'').trim();check(out.title.length>=5&&out.title.length<=4000,'Describe your task (5–4000 characters).');check(d.wholeCents(out.price)&&out.price>=3&&out.price<=MAX_TASK_PRICE,'Set a price from ¥3 to ¥'+MAX_TASK_PRICE+'.');out.price=Math.round(out.price*100)/100;out.dueAt=Number(data.dueAt);check(Number.isFinite(out.dueAt)&&out.dueAt>Date.now(),'Choose a future deadline.');
  } else {
    check(Array.isArray(data.parcelItems) && data.parcelItems.length >= 1 && data.parcelItems.length <= 12, 'Choose 1–12 parcels.');
    out.parcelItems = data.parcelItems.map(p => {
      check(p && typeof p.size === 'string' && typeof p.code === 'string' && p.code.length <= 100, 'Invalid parcel code.');
      check(p.pickupPoint === undefined || typeof p.pickupPoint === 'string' && p.pickupPoint.trim().length > 0 && p.pickupPoint.length <= 100, 'Choose a valid station per parcel.');
      return { size: p.size, code: p.code, pickupPoint: p.pickupPoint && p.pickupPoint.trim() };
    });
  }
  out.riderPhoto = photo(data.riderPhoto, actor);
  out.noticePhoto = photo(data.noticePhoto, actor);
  check(!data.orderPictures || Array.isArray(data.orderPictures) && data.orderPictures.length <= 3, 'Up to three photos.');
  out.orderPictures = (data.orderPictures || []).map(p => photo(p, actor, true));
  return out;
}
function rejectOwn(s, ids, actor) {
  check(Array.isArray(ids) && ids.length > 0 && ids.length <= 12, 'Select 1–12 orders.');
  for (const id of ids) { const r = s.requests.find(x => x.id === id); check(r && r.ownerId !== actor, 'You cannot accept your own order.'); }
}
function expire(s, now) {
  for (const r of s.requests) {
    if (r.status === 'waiting' && r.closesAt && now >= r.closesAt) {
      r.status = 'refunded'; r.refundAmount = f.total(r); r.refundedAt = now; f.event(r, 'Closed · no runner · demo refund', now);
    }
    if (r.status === 'delivered' && now >= r.deliveredAt + f.hours(r) * 3600000) {
      r.status = 'confirmed'; r.confirmedAt = now; r.autoConfirmed = true; f.event(r, 'Automatically confirmed', now);
    }
  }
}
function restoreDormGenders(s,actor,campusId,repairs,now){
  check(Array.isArray(repairs)&&repairs.length>0&&repairs.length<=25,'Invalid dorm gender repair.');
  const rows=repairs.map(p=>{
    check(p&&typeof p.id==='string'&&p.id.length<=100&&['male','female'].includes(p.gender)&&typeof p.dorm==='string'&&p.dorm.length<=100&&typeof p.room==='string'&&p.room.length<=100,'Invalid dorm gender repair.');
    const r=ownRequest(s,p.id,actor);
    check(r.campusId===campusId&&r.category!=='task'&&r.destinationType!=='place'&&OPEN_STATUSES.includes(r.status),'This order cannot restore a dorm gender.');
    check(r.dorm===p.dorm&&r.room===p.room,'The order address has changed.');
    return {r,gender:p.gender};
  });
  let updated=0;
  for(const {r,gender} of rows)if(!r.dormGender){r.dormGender=gender;r.dormGenderRestoredAt=now;updated++;}
  return {updated};
}
const runnerActions = new Set(['accept','acceptBoxes','startTrip','pickup','deliver','runnerCancel','leave','endEmpty','taskDone','sealBroken']);
function execute(s, actor, account, event, now = Date.now()) {
  check(account && account.profile && !account.loggedOut, 'Save your profile / log in in Me first.');
  const action = event.action;
  const campusId=account.profile.campusId,contact=require('./runner-contact')(account);
  if(['create','accept','acceptBoxes','startTrip'].includes(action))check(account.profile.universityId==='xjtlu'&&campusId==='sip','Choose XJTLU SIP campus before posting or taking jobs.');
  if (['accept','acceptBoxes','startTrip'].includes(action))check(!require('./runner-level').level(stats(s,actor),now).paused,'Taking jobs is paused for seven days. Contact the team before returning.');
  if (runnerActions.has(action)) check(account.verification && account.verification.status === 'verified', 'Complete your student check before accepting jobs.');
  if(runnerActions.has(action))check(!!account.runnerRulesAcceptedAt,'Read and accept the runner rules first.');
  s.profile = profile(s, actor, account);
  s.members[actor] = s.members[actor] || { marks: [] };
  rewards.init(s,actor,now);
  let value = {};
  if(action==='restoreDormGenders'){value=restoreDormGenders(s,actor,campusId,event.repairs,now);} else if(action==='profileComplete'){
    const p=account.profile||{};check(String(p.name||'').trim().length>=2&&/^1\d{10}$/.test(String(p.phone||'').replace(/\s/g,'')),'Complete your name and phone number first.');
    value={awarded:rewards.profileCompleted(s,actor,now)};
  } else if(action==='ackLoyaltyNotice') {
    const noticeId=String(event.noticeId||'');check(noticeId.length<=100,'Invalid reward notice.');rewards.acknowledge(s,actor,noticeId);value={acknowledged:true};
  } else if (action === 'walletWithdraw') {
    wallet.settle(s, now);
    value = wallet.withdraw(s, actor, event.amount_cents, event.operationId, now, process.env.WALLET_TEST_WITHDRAW_FAIL === '1');
  } else if (action === 'supportRequest') {
    check(['order','payment','other','deletion'].includes(event.topic),'Choose a support topic.');
    const m=s.members[actor];m.supportTickets=m.supportTickets||[];
    check(m.supportTickets.filter(t=>now-t.createdAt<86400000).length<10,'You can send up to 10 support requests a day.');
    const ticket={id:'support-'+s.nextId++,topic:event.topic,createdAt:now,status:'open'};
    m.supportTickets.push(ticket);m.supportTickets=m.supportTickets.slice(-50);value={ticket};
  } else if (action === 'supportMessage') {
    const m=s.members[actor];m.supportTickets=m.supportTickets||[];
    const text=String(event.text||'').trim().slice(0,500);
    check(text.length>0,'Enter a message.');
    let t=m.supportTickets.filter(x=>x.status==='open').at(-1);
    if(!t){check(m.supportTickets.filter(x=>now-x.createdAt<86400000).length<10,'You can send up to 10 support requests a day.');t={id:'support-'+s.nextId++,topic:['order','payment','other','deletion'].includes(event.topic)?event.topic:'other',createdAt:now,status:'open'};m.supportTickets.push(t);m.supportTickets=m.supportTickets.slice(-50);}
    check((t.messages||[]).filter(msg=>now-msg.at<86400000).length<50,'Too many messages today. Please wait for the team to reply.');
    t.messages=t.messages||[];t.messages.push({text,at:now,mine:true});value={ticket:t};
  } else if (action === 'supportReply') {
    check(account._admin===true||account._reviewer===true,'Admin access required.');
    const accountId=String(event.accountId||''),member=s.members[accountId];
    check(/^[a-f0-9]{64}$/.test(accountId)&&member,'Support conversation not found.');
    const t=(member.supportTickets||[]).find(x=>x.id===event.ticketId&&x.status==='open');
    check(t,'Support conversation is closed or unavailable.');
    const text=String(event.text||'').trim();check(text&&text.length<=500,'Enter a reply up to 500 characters.');
    t.messages=t.messages||[];check(t.messages.filter(msg=>!msg.mine&&now-msg.at<86400000).length<100,'Too many team replies today.');
    t.messages.push({text,at:now,mine:false});value={ticketId:t.id};
  } else if (action === 'create') {
    check(s.requests.filter(r => r.ownerId === actor && OPEN_STATUSES.includes(r.status)).length < MAX_OPEN_PER_USER, 'You have '+MAX_OPEN_PER_USER+' open orders. Wait for some to finish before posting more.');
    check(s.requests.filter(r => r.ownerId === actor && r.createdAt > now - 86400000).length < MAX_CREATES_PER_DAY, 'You can post up to '+MAX_CREATES_PER_DAY+' orders a day.');
    check(s.requests.length < 200, 'The order board is full right now. Please try again later.');
    const data = input(event.data, actor);
    let r;if(data.category==='task'){data.dorm='';data.room='';r={...data,id:'r'+s.nextId++,small:1,big:0,codes:[''],reward:Math.round(data.price*100)/100,serviceFee:0,status:'waiting',runnerId:null,collected:[],photo:'',closesAt:data.dueAt,deadline:f.clock(data.dueAt),station:'Task',createdAt:now};s.requests.unshift(r);f.event(r,'Posted',now);}else r=data.category==='takeout'?f.createTakeaway(s,data,now):d.createRequest(s,data);
    r.createdAt = now; r.campusId=campusId;r.universityId='xjtlu';r.ownerId = actor; r.isMine = true;
    rewards.apply(s,actor,r,event.couponId,now);
    if (data.category === 'parcel') {const date=data.deliveryDate||new Date(now+28800000).toISOString().slice(0,10);if(data.deadline){const close=Date.parse(date+'T'+data.deadline+':00+08:00');check(Number.isFinite(close)&&close>now,'Choose a future delivery deadline.');r.closesAt=close;}f.event(r, 'Posted', now);}
    if (event.tripId) {
      const t = s.trips.find(x => x.id === event.tripId);
      check(t && !t.cancelled && t.phase === 'collect' && t.joinUntil > now, 'This trip is closed.');
      check(t.runnerAccountId !== actor, 'You cannot join your own trip.');check(t.campusId===campusId,'This trip belongs to a different campus.');
      check(!r.arrivalAt || r.arrivalAt <= t.departAt, 'Your food arrives after this runner leaves.');
      // Joining consumes the RUNNER limit, not the customer's limit.
      const previous = s.profile; s.profile = { ...stats(s, t.runnerAccountId) };
      d.assign(s, t, [r.id]); s.profile = previous; f.event(r, 'Runner accepted', now);
    }
    value = { id: r.id };
  } else if (action === 'accept' || action === 'acceptBoxes') {
    const ids = action === 'accept' ? event.ids : (Array.isArray(event.refs) ? event.refs.map(x => x && x.requestId) : []);
    rejectOwn(s, ids, actor);check(ids.every(id=>s.requests.find(r=>r.id===id).campusId===campusId),'Choose orders from your selected campus.');
    const selected=ids.map(id=>s.requests.find(r=>r.id===id));let t;if(selected[0].category==='task'){check(action==='accept'&&ids.length===1,'Take one task at a time.');const r=selected[0];check(r.status==='waiting'&&r.reward<=d.limit(s.profile),'This task exceeds your runner limit.');t={id:'t'+s.nextId++,category:'task',station:'Task',dorm:r.dorm,capacity:1,phase:'deliver',requestIds:[r.id]};r.status='taken';r.runnerId=t.id;r.takenAt=now;s.trips.unshift(t);}else t=action==='accept'?d.acceptJob(s,event.ids):d.acceptBoxes(s,event.refs);
    t.campusId=campusId;t.universityId='xjtlu';t.runnerAccountId = actor; t.runnerName = contact.name; t.runnerPhone=contact.phone; t.createdAt = now;
    t.requestIds.forEach(id => f.event(s.requests.find(r => r.id === id), 'Runner accepted', now)); value = { id: t.id };
  } else if (action === 'startTrip') {
    const cfg = event.data || {};
    if(cfg.selfRequestId){const own=ownRequest(s,cfg.selfRequestId,actor);check(own.status==='waiting'&&own.campusId===campusId&&own.category==='parcel'&&own.station===cfg.station&&own.dorm===cfg.dorm,'Your parcel request changed. Refresh before starting.');d.cancelRequest(s,own.id);own.refundAmount=f.total(own);f.event(own,'Collecting it myself',now);}
    check(['takeout','parcel'].includes(cfg.category) && ['now','later'].includes(cfg.when), 'Invalid trip.');
    check(typeof cfg.station === 'string' && cfg.station.length <= (cfg.category === 'takeout' ? 200 : 100) && typeof cfg.dorm === 'string' && cfg.dorm.length <= 100, 'Invalid route.');
    if(Object.prototype.hasOwnProperty.call(cfg,'requestIds')){
      check(Array.isArray(cfg.requestIds)&&cfg.requestIds.length<=12,'Select up to 12 orders.');
      if(cfg.requestIds.length)rejectOwn(s,cfg.requestIds,actor);
    }
    const tripState={...s,requests:s.requests.filter(r=>r.campusId===campusId)};
    const t = f.startTrip(tripState, { category: cfg.category, when: cfg.when, time: cfg.time, duration: cfg.duration, station: cfg.station, dorm: cfg.dorm, capacity: cfg.capacity, ...(Object.prototype.hasOwnProperty.call(cfg,'requestIds')?{requestIds:cfg.requestIds}:{}) }, now);s.nextId=tripState.nextId;
    t.campusId=campusId;t.universityId='xjtlu';t.runnerAccountId = actor; t.runnerName=contact.name; t.runnerPhone=contact.phone; t.createdAt = now;
    t.requestIds.forEach(id => f.event(s.requests.find(r => r.id === id), 'Runner accepted', now)); value = { id: t.id };
  } else if (['raise','cancel','confirm','report','riderPhoto','foodArrived'].includes(action)) {
    const r = ownRequest(s, event.id, actor);
    if (action === 'raise') { check((r.raised || 0) + Number(event.amount || 0) <= 100, 'Offer increase limit reached.'); f.raise(s, r.id, event.amount); }
    if (action === 'cancel') { d.cancelRequest(s, r.id); f.event(r, 'Cancelled · demo refund', now); }
    if (action === 'confirm') { d.confirm(s, r.id); f.event(r, 'Confirmed', now); }
    if (action === 'report') { check(r.category!=='takeout'||now<=r.deliveredAt+30*60000,'Report takeaway problems within 30 minutes of delivery.'); check(typeof event.note === 'string' && event.note.length <= 500, 'Keep the note under 500 characters.'); f.report(s, r.id, event.reason, photo(event.photo, actor), event.note); }
    if (action === 'foodArrived') { check(r.category==='takeout'&&['waiting','taken'].includes(r.status)&&!r.arrived, 'Only food awaiting pickup can be marked as arrived.'); r.arrived=true; r.arrivalAt=now; f.event(r,'Food is there now',now); }
    if (action === 'riderPhoto') { check(['waiting','taken'].includes(r.status), 'Pickup has already started.'); r.riderPhoto = photo(event.photo, actor, true); r.arrived = true; }
  } else if (['pickup','deliver','runnerCancel','taskDone','sealBroken'].includes(action)) {
    const r = runnerRequest(s, event.id, actor);
    if(action==='taskDone'){check(r.category==='task'&&r.status==='taken','This task cannot be completed now.');const note=String(event.note||'').trim();check(note.length>=3&&note.length<=500,'Add a short completion note.');r.status='delivered';r.photo=photo(event.photo,actor,true);r.completionNote=note;r.deliveredAt=now;ownTrip(s,r.runnerId,actor).phase='done';f.event(r,'Photo and note sent',now);rewards.recordBonus(s,actor,r,now);}
    if(action==='sealBroken'){check(r.category==='takeout'&&r.status==='taken','Report a seal before pickup.');r.sealReportedAt=now;f.event(r,'Seal already broken at pickup',now);}
    if (action === 'pickup') {
      check(r.category!=='task','Use the task completion photo and note.');
      if(r.category==='parcel'&&event.index!==undefined){const i=Number(event.index);check(r.status==='taken'&&Number.isInteger(i)&&i>=0&&i<d.boxes(r),'Invalid parcel.');r.collectedIndices=r.collectedIndices||r.collected.map((_,j)=>j);if(!r.collectedIndices.includes(i)){r.collectedIndices.push(i);r.collected=r.collectedIndices.map(j=>r.codes[j]);}if(r.collected.length===d.boxes(r)){r.status='collected';r.collectedAt=now;f.event(r,'Picked up',now);}}
      else f.pickup(s,r.id);
      const trip=s.trips.find(t=>t.id===r.runnerId);if(trip.requestIds.every(id=>s.requests.find(x=>x.id===id).status==='collected')){trip.phase='deliver';trip.joinUntil=now;}
    }
    if (action === 'deliver') { check(r.category!=='task','Use the task completion photo and note.'); check(ownTrip(s,r.runnerId,actor).phase==='deliver', 'Close joining and go deliver first.'); if(event.location)check((r.destinationType==='place'?['At the stated location']:['At your door','At the front desk','Downstairs']).includes(event.location), 'Choose a delivery location.'); f.deliver(s, r.id, photo(event.photo, actor, true), event.location||'');rewards.recordBonus(s,actor,r,now); }
    if (action === 'runnerCancel') { f.runnerCancel(s, r.id, event.reason, now);s.members[actor].marks=s.profile.marks; }
  } else if (action === 'leave' || action === 'endEmpty') {
    const t = ownTrip(s, event.id, actor);
    if (action === 'leave') { check(t.requestIds.length && t.requestIds.every(id => s.requests.find(r => r.id === id).status === 'collected'), 'Pick up or cancel the remaining orders first.'); t.phase = 'deliver'; }
    else { check(!t.requestIds.length, 'This trip still has orders.'); t.cancelled = true; }
    t.joinUntil = now;
  } else if(action==='resolveDispute'){
    check(account._reviewer===true,'Reviewer access required.');const r=s.requests.find(x=>x.id===event.id);check(r&&r.status==='disputed','Order is not under review.');check(['release','refund'].includes(event.decision),'Choose release or refund.');
    if(event.decision==='release'){r.status='confirmed';r.confirmedAt=now;f.event(r,'Review resolved · confirmed',now);}else{const amount=Number(event.deduction||0);check(Number.isFinite(amount)&&amount>=0&&amount<=1000,'Invalid reviewed deduction.');const note=String(event.note||'').trim();check(note.length>=10&&note.length<=500,'Explain the reviewed deduction.');r.status='refunded';r.refundAmount=f.total(r);r.refundedAt=now;r.refundReason=note;const t=s.trips.find(x=>x.id===r.runnerId);if(amount&&t)(s.adjustments||(s.adjustments=[])).push({id:'a'+s.nextId++,runnerAccountId:t.runnerAccountId,requestId:r.id,amount:Math.round(amount*100)/100,reason:r.dispute.reason,note,at:now});f.event(r,'Review resolved · simulated refund',now);}
  } else if(action==='foodLate'){
    const r=ownRequest(s,event.id,actor);check(['waiting','taken'].includes(r.status)&&r.category==='takeout'&&!r.etaMoved&&now<=(r.arrivalAt+600000),'Move arrival once, before the original ETA + 10 minutes.');const at=f.todayAt(event.time,now);check(at>r.arrivalAt&&at<=r.arrivalAt+1800000,'Move arrival later by at most 30 minutes.');r.originalArrivalAt=r.arrivalAt;r.arrivalAt=at;r.closesAt=at+1800000;r.etaMoved=true;r.etaChangedAfterAccept=r.status==='taken';f.event(r,'Arrival moved to '+f.clock(at),now);
  } else if(action==='collectCoupon'){rewards.collect(s,actor,event.campaignId,now);
  } else if(action==='rewardsInit'){
  } else if(action==='invite'){rewards.invite(s,actor,String(event.code||''),now);
  } else if(action==='preferences'){const m=s.members[actor];m.preferences=m.preferences||{};for(const k of ['newJobs','orderUpdates','nearbyTrip','deliveredUpdates','skillsInterested'])if(typeof event.values?.[k]==='boolean')m.preferences[k]=event.values[k];
  } else if(action==='message'||action==='readMessages'){
    const r=s.requests.find(x=>x.id===event.id),t=r&&s.trips.find(x=>x.id===r.runnerId);check(r&&t&&(r.ownerId===actor||t.runnerAccountId===actor),'Only the current order participants can open this chat.');
    const key=r.id+':'+t.id;const threads=s.threads||(s.threads={});const thread=threads[key]||(threads[key]={messages:[],read:{}});
    if(action==='message'){check(!r.deliveredAt||now<r.deliveredAt+86400000,'This chat closed 24 hours after delivery.');const body=String(event.text||'').trim();check(body&&body.length<=500,'Enter a message up to 500 characters.');check(thread.messages.length<100,'This test chat reached 100 messages.');thread.messages.push({id:'m'+s.nextId++,sender:actor,text:body,at:now});}thread.read[actor]=now;
  } else throw Error('Unknown action.');
  rewards.settle(s,now);
  wallet.settle(s,now);
  check(s.requests.length <= 200 && s.trips.length <= 200, 'Team test storage limit reached. Export test data before starting a new round.');
  delete s.profile; delete s.installationId; delete s.routes; delete s.agreements;
  return value;
}
function snapshot(s, actor, account, now = Date.now()) {
  const loggedIn = !!(account && account.profile && !account.loggedOut);
  const campusId=loggedIn&&account.profile.campusId;
  const inCampus=r=>!!campusId&&r.campusId===campusId;
  const myTrips = new Set(loggedIn ? s.trips.filter(t => t.runnerAccountId === actor).map(t => t.id) : []);
  const requests = s.requests.filter(r => r.status === 'waiting' && inCampus(r) || loggedIn && (r.ownerId === actor || myTrips.has(r.runnerId))).map(r => {
    const isMine = loggedIn && r.ownerId === actor, isRunner = myTrips.has(r.runnerId);
    if (isMine || isRunner) {
      const out = clone(r); delete out.splitOriginal; delete out.ownerId;delete out.analytics;delete out.analyticsEvents;delete out.analyticsRunnerId;delete out.analyticsHistoryCapped;
      const rt=s.trips.find(t=>t.id===r.runnerId),thread=rt&&(s.threads||{})[r.id+':'+rt.id];
      out.runnerPhone=rt&&rt.runnerPhone||'';out.runnerStats=rt?(()=>{const st=stats(s,rt.runnerAccountId);return{jobsDone:st.jobsDone,onTime:st.onTime};})():{};out.unread=thread?thread.messages.filter(m=>m.sender!==actor&&m.at>(thread.read[actor]||0)).length:0;
      out.messages=thread?thread.messages.map(m=>({id:m.id,text:m.text,at:m.at,mine:m.sender===actor})):[];
      return { ...out, runnerName:(s.trips.find(t=>t.id===r.runnerId)||{}).runnerName||'', ownerId: isMine ? actor : '', isMine, isRunner };
    }
    // Allowlist hall fields, including requested dorm room details. Contacts, codes and photo IDs stay private.
    const out = {};
    for (const k of ['destinationKey','destinationType','dormGender','id','campusId','universityId','category','station','dorm','room','small','big','reward','serviceFee','status','deadline','deliveryDate','createdAt','arrivalAt','closesAt','arrived','deliverBy','soup','fragile','night','purchaseStatus','shop','raised','tip','parcelSize']) if (r[k] !== undefined) out[k] = r[k];
    if (r.category === 'takeout' && r.note) out.note = r.note;
    if (r.category === 'takeout' && !r.night && r.pickupPoint) out.pickupPoint = r.pickupPoint;
    return { ...out, owner:'Request', phone:'', room:r.category!=='task'&&r.destinationType!=='place'?r.room||'':'', codes:Array(d.boxes(r)).fill(''), collected:[], photo:'',
      parcelItems:r.parcelItems && r.parcelItems.map(p => ({size:p.size, price:p.price, code:''})), isMine:false, isRunner:false };
  });
  const trips = s.trips.filter(t => myTrips.has(t.id)).map(t => ({...clone(t), isRunner:true}));
  const publicTrips = s.trips.filter(t => inCampus(t) && t.joinUntil && !t.cancelled && t.phase === 'collect' && t.joinUntil > now).map(t => ({
    id:t.id,campusId:t.campusId,universityId:t.universityId,category:t.category,destinationKey:t.destinationKey||'',destinationType:t.destinationType||'dorm', station:t.station, dorm:t.dorm, capacity:t.capacity, runnerName:t.runnerName,
    runnerJobs:stats(s,t.runnerAccountId).jobsDone, departAt:t.departAt, joinUntil:t.joinUntil, phase:t.phase,
    cancelled:false, remaining:t.capacity-t.requestIds.reduce((n,id)=>n+d.boxes(s.requests.find(r=>r.id===id)),0)
  }));
  const publicJobs=s.requests.filter(r=>inCampus(r)&&!['cancelled','refunded','disputed'].includes(r.status)).map(r=>{const o={};for(const k of ['destinationKey','destinationType','dormGender','id','campusId','universityId','category','station','dorm','room','small','big','reward','status','arrivalAt','closesAt','deadline','createdAt','takenAt','collectedAt','deliveredAt','confirmedAt','arrived','deliverBy','soup','fragile','night','purchaseStatus','shop','raised','title','dueAt'])if(r[k]!==undefined)o[k]=r[k];if(r.category==='takeout'&&!r.night&&r.pickupPoint)o.pickupPoint=r.pickupPoint;if(r.category==='task'||r.destinationType==='place')delete o.room;return o;});
  const supportInbox=(account&&account._admin||account&&account._reviewer)?Object.entries(s.members).flatMap(([accountId,member])=>(member.supportTickets||[]).filter(t=>t.status==='open').map(t=>({...clone(t),accountId}))).sort((a,b)=>((b.messages||[]).at(-1)?.at||b.createdAt)-((a.messages||[]).at(-1)?.at||a.createdAt)).slice(0,50):[];
  return {walletSummary:loggedIn?wallet.summary(s,actor):null,progression:loggedIn?rewards.loyaltyView(s.members[actor]||{}):null,revision:s.revision,serverTime:now,capabilities:{restoreDormGenders:loggedIn},publicJobs,deliveredThisWeek:s.requests.filter(r=>inCampus(r)&&r.deliveredAt>now-7*86400000).length,requests,trips,publicTrips,accountId:actor,supportInbox,
    adjustments:loggedIn?(s.adjustments||[]).filter(a=>a.runnerAccountId===actor).map(({runnerAccountId,...a})=>a):[],rewards:loggedIn?rewards.view(s,actor,now):null,preferences:loggedIn?(s.members[actor]||{}).preferences||{}:{},
    supportTickets:loggedIn?((s.members[actor]||{}).supportTickets||[]):[],stats:loggedIn ? stats(s,actor) : {jobsDone:0,paid:0,marks:[]} };
}
module.exports = { initial, idFor, execute, expire, snapshot, photo, archive, ARCHIVE_AFTER };
