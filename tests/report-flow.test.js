const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{harness}=require('./helpers/order-cloud'),reasons=require('../utils/report-reasons');
// 2026-11-14: customers can report before delivery, runners can report too, and each side has its own reasons.
const h=harness();const data={category:'takeout',destinationType:'dorm',station:'North gate',dorm:'Dorm 7',room:'412',owner:'Ming Li',phone:'13801026092',bags:1,price:4,arrived:true};
const order=id=>h.state.requests.find(r=>r.id===id);
(async()=>{
 const made=await h.call('customer','create',{data});assert.equal(made.ok,true,made.error);const id=h.state.requests[0].id;
 const taken=await h.call('runner','accept',{ids:[id]});assert.equal(taken.ok,true,taken.error);

 const early=await h.call('customer','orderFeedbackSubmit',{id,reason:'Runner not responding',note:'No reply for 20 minutes',photo:''});
 assert.equal(early.ok,true,early.error);assert.equal(order(id).status,'taken','a report before delivery does not freeze or change the order');
 assert.equal((await h.call('customer','orderFeedbackSubmit',{id,reason:'Food not ready',note:'not mine to pick',photo:''})).ok,false,'customers cannot use runner reasons');

 const runner=await h.call('runner','orderFeedbackSubmit',{id,reason:'Customer not responding',note:'Called twice, no answer',photo:''});
 assert.equal(runner.ok,true,runner.error);assert.equal(order(id).status,'taken','a runner report never freezes the order');
 assert.equal((await h.call('runner','orderFeedbackSubmit',{id,reason:'Not received',note:'wrong side',photo:''})).ok,false,'runners cannot use customer reasons');
 const seal=await h.call('runner','orderFeedbackSubmit',{id,reason:'Seal broken',note:'Seal torn already',photo:''});
 assert.equal(seal.ok,false,'a broken seal needs a photo');assert.match(seal.error,/photo/i);

 assert.deepEqual(reasons.ids({status:'taken',category:'takeout'},true),['Food not ready','Seal broken','Customer not responding','Something else']);
 assert.deepEqual(reasons.ids({status:'collected',category:'takeout'},true),['Cannot find address','Customer not responding','Something else']);
 assert.deepEqual(reasons.ids({status:'taken',category:'takeout'},false),['Runner not responding','Runner very late','Something else']);
 assert.deepEqual(reasons.ids({status:'delivered',category:'takeout'},false),['Not received','Wrong bag','Spilled or damaged','Something else']);
 assert.equal(reasons.list({status:'taken',category:'takeout'},true,false).find(r=>r.id==='Seal broken').photo,true);

 // Team replies count as unread for that participant until they open the chat.
 const feedback=require('../cloudfunctions/orderService/order-feedback'),customer=h.engine.idFor('customer');
 const ticket=h.state.members[customer].supportTickets.find(t=>t.orderId===id);ticket.messages.push({text:'We are calling the runner now.',at:Date.now()+1000,mine:false});
 assert.deepEqual(feedback.unread(h.state,customer,id),{supportUnread:1,supportPreview:'We are calling the runner now.',supportPreviewZh:'We are calling the runner now.'});
 feedback.read(h.state,customer,{id},Date.now()+2000);assert.equal(feedback.unread(h.state,customer,id).supportUnread,0,'opening the chat clears the reply');
 const synced=await h.call('customer','sync');assert.equal(synced.snapshot.requests.find(r=>r.id===id).supportUnread,0);
 const root=path.join(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
 assert.match(read('pages/request/index.wxml'),/class="report-link[^"]*"[^>]*bindtap="issue"/,'customer has a Report a problem link before delivery');
 assert.match(read('pages/trip/index.wxml'),/class="report-link[^"]*"[^>]*bindtap="report"/,'runner has a Report a problem link on each order');
 console.log('Report flow: early customer reports, runner reports, role-specific reasons, photo rule and both entry links and unread team replies passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
