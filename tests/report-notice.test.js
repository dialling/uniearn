const assert=require('node:assert/strict'),{harness}=require('./helpers/order-cloud'),notice=require('../utils/report-notice');
// 2026-11-14 (user decision): the other person sees the reason the reporter picked, never the reporter's words or photos.
const data={category:'takeout',destinationType:'dorm',station:'North gate',dorm:'Dorm 7',room:'412',owner:'Ming Li',phone:'13801026092',bags:1,price:4,arrived:true};
async function taken(){const h=harness();const made=await h.call('customer','create',{data});assert.equal(made.ok,true,made.error);const id=h.state.requests[0].id;const t=await h.call('runner','accept',{ids:[id]});assert.equal(t.ok,true,t.error);return {h,id};}
const seen=async(h,who,id)=>(await h.call(who,'sync')).snapshot.requests.find(r=>r.id===id);
(async()=>{
 let {h,id}=await taken();
 assert.equal((await seen(h,'customer',id)).reportNotice,'','no report, no note');
 await h.call('runner','orderFeedbackSubmit',{id,reason:'Customer not responding',note:'Called twice',photo:''});
 const c=await seen(h,'customer',id);assert.equal(c.reportNotice,'Customer not responding');assert.equal(c.feedbackOpen,true);
 assert.equal(notice.text(c.reportNotice,true,false),'Runner reported: Customer not responding');
 assert.equal(notice.text(c.reportNotice,true,true),'跑手反馈：顾客联系不上');
 assert.ok(!JSON.stringify(c).includes('Called twice'),'the runner’s words never reach the customer');
 await h.call('runner','orderFeedbackSubmit',{id,note:'Still no answer',photo:''});
 assert.equal((await seen(h,'customer',id)).reportNotice,'Customer not responding','follow-up chat keeps the picked reason');
 assert.equal((await h.call('runner','orderFeedbackResolve',{id})).ok,true);
 assert.equal((await seen(h,'customer',id)).reportNotice,'','the reason disappears once the report is closed');

 ({h,id}=await taken());
 h.edit(s=>{const r=s.requests.find(x=>x.id===id);r.status='delivered';r.deliveredAt=Date.now();});
 const sent=await h.call('customer','orderFeedbackSubmit',{id,reason:'Not received',note:'Nothing at my door, checked twice',photo:''});assert.equal(sent.ok,true,sent.error);
 const r=await seen(h,'runner',id);assert.equal(r.reportNotice,'Not received');assert.equal(notice.text(r.reportNotice,false,false),'Customer reported: Not received');
 assert.equal(r.dispute.reason,'Not received');assert.equal(r.dispute.note,undefined,'the runner sees the reason only');assert.ok(!JSON.stringify(r).includes('checked twice'));
 assert.equal((await seen(h,'customer',id)).dispute.note,'Nothing at my door, checked twice','the customer still sees their own report');
 assert.equal(notice.text('',true,false),'','no reason, no note');
 console.log('Report notice: the picked reason shows to the other side, words and photos stay private, and it clears when closed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
