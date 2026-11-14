const assert=require('node:assert/strict'),{harness}=require('./helpers/order-cloud'),reasons=require('../utils/report-reasons');
// 2026-11-14: the Uniearn team resolves reports without asking either side; safety reports stay hidden from the
// customer; the other side can answer a report without freezing anything.
const data={category:'takeout',destinationType:'dorm',station:'North gate',dorm:'Dorm 7',room:'412',owner:'Ming Li',phone:'13801026092',bags:1,price:4,arrived:true};
async function setup(){process.env.REVIEWER_OPENIDS='other';const h=harness();const team=h.accounts[h.engine.idFor('other')];team.admin={until:Date.now()+3600000,revision:team.authRevision||0};
 const made=await h.call('customer','create',{data});assert.equal(made.ok,true,made.error);const id=h.state.requests[0].id;
 assert.equal((await h.call('runner','accept',{ids:[id]})).ok,true);return {h,id};}
const row=async(h,who,id)=>(await h.call(who,'sync')).snapshot.requests.find(r=>r.id===id);
const open=(h,id)=>Object.values(h.state.members).flatMap(m=>m.supportTickets||[]).filter(t=>t.orderId===id&&t.status==='open');
(async()=>{
 // 1. Team resolves for both sides, no permission from either.
 let {h,id}=await setup();
 assert.equal((await h.call('runner','orderFeedbackSubmit',{id,reason:'Customer not responding',note:'Called twice',photo:''})).ok,true);
 let c=await row(h,'customer',id);assert.equal(c.feedbackOpen,true);
 assert.deepEqual(reasons.ids(c,false)[0],'Report response','the customer can answer the report first');
 assert.equal((await h.call('customer','orderFeedbackSubmit',{id,reason:'Report response',note:'I was in class, calling back now',photo:''})).ok,true);
 assert.equal(open(h,id).length,2,'both sides have an open conversation');
 assert.equal((await h.call('runner','teamResolveReport',{id})).ok,false,'only the team can do this');
 const done=await h.call('other','teamResolveReport',{id});assert.equal(done.ok,true,done.error);assert.equal(done.value.closed,2);
 assert.equal(open(h,id).length,0,'every report on the order is closed');
 let r=await row(h,'runner',id);assert.equal(r.feedbackOpen,false);assert.equal(r.supportUnread,1,'the runner gets the team’s closing message');
 c=await row(h,'customer',id);assert.equal(c.feedbackOpen,false);assert.equal(c.supportUnread,1,'so does the customer');assert.equal(c.reportNotice,'');
 assert.equal(h.state.requests.find(x=>x.id===id).status,'taken','resolving a report never changes the order itself');

 // 2. Frozen orders need release or refund, which also closes the reports.
 ({h,id}=await setup());
 h.edit(s=>{const o=s.requests.find(x=>x.id===id);o.status='delivered';o.deliveredAt=Date.now();});
 assert.equal((await h.call('customer','orderFeedbackSubmit',{id,reason:'Not received',note:'Nothing at my door',photo:''})).ok,true);
 assert.equal(h.state.requests.find(x=>x.id===id).status,'disputed');
 assert.equal((await h.call('runner','orderFeedbackSubmit',{id,reason:'Report response',note:'I left it at the lobby desk',photo:''})).ok,true);
 assert.equal(h.state.requests.find(x=>x.id===id).status,'disputed');
 const refused=await h.call('other','teamResolveReport',{id});assert.equal(refused.ok,false);assert.match(refused.error,/release or refund/);
 const released=await h.call('other','resolveDispute',{id,decision:'release'});assert.equal(released.ok,true,released.error);
 assert.equal(h.state.requests.find(x=>x.id===id).status,'confirmed');assert.equal(open(h,id).length,0,'release closes both sides’ reports');
 c=await row(h,'customer',id);assert.equal(c.feedbackOpen,false);assert.equal(c.supportUnread,1);

 // 3. "Customer rude or unsafe" is no longer a topic; an older report with that reason stays between the runner and the team.
 ({h,id}=await setup());
 assert.equal((await h.call('runner','orderFeedbackSubmit',{id,reason:'Customer unsafe or rude',note:'Shouted at me',photo:''})).ok,false,'the topic is gone');
 h.edit(s=>{const m=s.members[h.engine.idFor('runner')];(m.supportTickets||(m.supportTickets=[])).push({id:'legacy-rude',topic:'order',orderId:id,status:'open',createdAt:Date.now(),messages:[{text:'[Customer unsafe or rude] Shouted at me',note:'Shouted at me',reason:'Customer unsafe or rude',at:Date.now(),mine:true}]});});
 c=await row(h,'customer',id);assert.equal(c.feedbackOpen,false,'the customer sees no order issue');assert.equal(c.reportNotice,'','and no reason');
 r=await row(h,'runner',id);assert.equal(r.feedbackOpen,true,'the runner still sees their own report');
 assert.equal(open(h,id).length,1,'the team still has it');

 // 4. Answering a report after delivery does not freeze the runner's payout.
 ({h,id}=await setup());
 h.edit(s=>{const o=s.requests.find(x=>x.id===id);o.status='delivered';o.deliveredAt=Date.now();});
 assert.equal((await h.call('runner','orderFeedbackSubmit',{id,reason:'Customer not responding',note:'Left at the door',photo:''})).ok,true);
 assert.equal((await h.call('customer','orderFeedbackSubmit',{id,reason:'Report response',note:'Got it, thanks',photo:''})).ok,true);
 assert.equal(h.state.requests.find(x=>x.id===id).status,'delivered','a reply to a report is not a complaint');
 console.log('Report team: team resolves for both sides, release closes reports, safety reports hidden, replies never freeze.');
})().catch(e=>{console.error(e);process.exitCode=1;});
