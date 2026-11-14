const assert=require('node:assert/strict'),{harness}=require('./helpers/order-cloud'),notice=require('../utils/report-notice');
// 2026-11-14: the whole report process, end to end, including real team replies from a reviewer account.
const data={category:'takeout',destinationType:'dorm',station:'North gate',dorm:'Dorm 7',room:'412',owner:'Ming Li',phone:'13801026092',bags:1,price:4,arrived:true};
async function setup(){const h=harness();const team=h.accounts[h.engine.idFor('other')];team.admin={until:Date.now()+3600000,revision:team.authRevision||0};
 const made=await h.call('customer','create',{data});assert.equal(made.ok,true,made.error);const id=h.state.requests[0].id;
 const t=await h.call('runner','accept',{ids:[id]});assert.equal(t.ok,true,t.error);return {h,id};}
const row=async(h,who,id)=>(await h.call(who,'sync')).snapshot.requests.find(r=>r.id===id);
const ticketOf=(h,who,id)=>(h.state.members[h.engine.idFor(who)].supportTickets||[]).find(t=>t.orderId===id&&t.status==='open');
async function teamReply(h,who,id,text){const t=ticketOf(h,who,id);const res=await h.call('other','supportReply',{accountId:h.engine.idFor(who),ticketId:t.id,text});assert.equal(res.ok,true,res.error);}
(async()=>{
 // 1. Runner after pickup: pick a problem first, then chat; the team replies; the runner reads and closes it.
 let {h,id}=await setup();
 assert.equal((await h.call('runner','pickup',{id})).ok,true);
 const noReason=await h.call('runner','orderFeedbackSubmit',{id,note:'Hello?',photo:''});
 assert.equal(noReason.ok,false,'the first message needs a problem');assert.match(noReason.error,/what the problem is first/);
 assert.equal((await h.call('runner','orderFeedbackSubmit',{id,reason:'Cannot find address',note:'Building 7 has two doors',photo:''})).ok,true);
 assert.equal(h.state.requests.find(r=>r.id===id).status,'collected','a runner report never changes the order');
 let c=await row(h,'customer',id);assert.equal(c.reportNotice,'Cannot find address');assert.equal(c.feedbackOpen,true,'the customer sees the order issue too');assert.equal(c.canResolveFeedback,false,'but only the reporter can close it');
 assert.equal(notice.text(c.reportNotice,true,false),'Runner reported: Can’t find the address');
 let r=await row(h,'runner',id);assert.equal(r.feedbackOpen,true);assert.equal(r.canResolveFeedback,true);assert.equal(r.supportUnread,0);
 await teamReply(h,'runner',id,'We asked the customer to come to the north door.');
 r=await row(h,'runner',id);assert.equal(r.supportUnread,1,'the team reply shows as unread');assert.equal(r.supportPreview,'We asked the customer to come to the north door.');
 assert.equal((await h.call('runner','orderFeedbackRead',{id})).ok,true);r=await row(h,'runner',id);assert.equal(r.supportUnread,0,'opening the chat clears it');
 assert.equal((await h.call('runner','orderFeedbackSubmit',{id,note:'Thanks, found them',photo:''})).ok,true,'later messages need no problem');
 const closed=await h.call('runner','orderFeedbackResolve',{id});assert.equal(closed.ok,true,closed.error);assert.equal(closed.value.completed,false);
 c=await row(h,'customer',id);assert.equal(c.reportNotice,'','the note disappears once the runner closes the report');assert.equal(c.feedbackOpen,false,'and so does the order issue');
 assert.equal(h.state.requests.find(r=>r.id===id).status,'collected');

 // 2. Customer before delivery: nothing freezes; the runner gets a nudge.
 ({h,id}=await setup());
 assert.equal((await h.call('customer','orderFeedbackSubmit',{id,reason:'Runner very late',note:'It has been 40 minutes',photo:''})).ok,true);
 assert.equal(h.state.requests.find(r=>r.id===id).status,'taken','an early report does not freeze anything');
 r=await row(h,'runner',id);assert.equal(r.reportNotice,'Runner very late');assert.equal(r.feedbackOpen,true,'the runner sees the order issue too');assert.equal(r.canResolveFeedback,false);
 assert.equal(notice.text(r.reportNotice,false,false),'Customer reported: Runner very late');

 // 3. Customer after delivery: photo rule, payout frozen until resolved, runner sees the reason only.
 ({h,id}=await setup());
 h.edit(s=>{const o=s.requests.find(x=>x.id===id);o.status='delivered';o.deliveredAt=Date.now();});
 const noPhoto=await h.call('customer','orderFeedbackSubmit',{id,reason:'Spilled or damaged',note:'Soup everywhere',photo:''});
 assert.equal(noPhoto.ok,false,'damage needs a photo');assert.match(noPhoto.error,/photo/i);
 assert.equal((await h.call('customer','orderFeedbackSubmit',{id,reason:'Not received',note:'Nothing at my door',photo:''})).ok,true);
 const frozen=h.state.requests.find(x=>x.id===id);assert.equal(frozen.status,'disputed','the payout is frozen');
 h.edit(s=>h.engine.expire(s,frozen.settle_hold_until+7*86400000));assert.equal(h.state.requests.find(x=>x.id===id).status,'disputed','still frozen a week later');
 r=await row(h,'runner',id);assert.equal(r.reportNotice,'Not received');assert.equal(r.dispute.note,undefined,'the runner never sees the customer’s words');
 assert.equal(r.feedbackOpen,true,'the runner knows the payout is on hold');
 await teamReply(h,'customer',id,'The runner left it at the lobby desk. Can you check?');
 c=await row(h,'customer',id);assert.equal(c.supportUnread,1);
 const done=await h.call('customer','orderFeedbackResolve',{id});assert.equal(done.ok,true,done.error);assert.equal(done.value.completed,true);
 assert.equal(h.state.requests.find(x=>x.id===id).status,'confirmed','resolving completes the order');
 require('../cloudfunctions/orderService/wallet').settle(h.state,Date.now());assert.ok(h.state.wallets[h.engine.idFor('runner')].balance_cents>0,'the runner is paid after the customer resolves');
 console.log('Report e2e: problem-first chat, neutral notes, early reports, frozen disputes, team replies with unread and read, and resolution with payout passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
