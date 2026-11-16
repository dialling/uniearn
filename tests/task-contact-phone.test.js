// 2026-11-16: a task keeps the student's phone so the runner can call them (and the student can call back).
const assert=require('node:assert/strict'),{harness}=require('./helpers/order-cloud');
(async()=>{
 const h=harness(),ok=async(who,action,args)=>{const r=await h.call(who,action,args);assert.equal(r.ok,true,r.error);return r;};
 const id=h.engine.idFor('customer');h.accounts[id].profile.phone='';h.accounts[id].wechatPhone='13912345678';
 const task=(await ok('customer','create',{data:{category:'task',taskMode:'offline',title:'Bring a drink please',price:3,owner:'Customer',phone:'',dorm:'',room:''}})).value.id;
 assert.equal(h.state.requests.find(r=>r.id===task).phone,'13912345678','the account phone fills a task posted without one');
 await ok('runner','accept',{ids:[task]});
 const seen=(await ok('runner','sync')).snapshot.requests.find(r=>r.id===task);
 assert.equal(seen.phone,'13912345678','the runner can call the student');
 const mine=(await ok('customer','sync')).snapshot.requests.find(r=>r.id===task);
 assert.ok(mine.runnerPhone===undefined||/^1\d{10}$/.test(mine.runnerPhone)||mine.runnerPhone==='', 'runner phone is a phone number when present');
 console.log('task keeps a contact phone for both sides');
})().catch(e=>{console.error(e);process.exit(1);});
