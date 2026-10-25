const assert = require('node:assert/strict');
const {harness} = require('./helpers/order-cloud');
const wallet = require('../cloudfunctions/orderService/wallet');
const now = Date.parse('2030-01-02T18:00:00+08:00'); Date.now = () => now;
const h = harness(), id = h.engine.idFor;
const ok = async (who, action, extra = {}) => {const r = await h.call(who, action, extra); assert.equal(r.ok, true, r.error); return r;};
const data = {category:'takeout',owner:'Customer',phone:'13801026092',station:'North gate',dorm:'Dorm 7',room:'412',bags:1,price:4,arrived:true};
(async () => {
 let ov = (await ok('runner','wallet')).value;
 assert.equal(ov.mode,'test');assert.equal(ov.balance_cents,0);assert.equal(ov.series.length,30);assert.equal(ov.rules.min_cents,1);assert.match(ov.rules.arrive,/模拟/);
 const rid = (await ok('customer','create',{data})).value.id;
 await ok('runner','accept',{ids:[rid]});await ok('runner','pickup',{id:rid});
 await ok('runner','deliver',{id:rid,photo:'cloud://test/order-photos/'+id('runner')+'/'+'a'.repeat(32)+'.jpg',location:'Downstairs'});
 ov = (await ok('runner','wallet')).value;assert.equal(ov.balance_cents,0);assert.equal(ov.pending_cents,400);assert.equal(ov.pending[0].auto_settle_at,now+2*3600000);
 await ok('customer','confirm',{id:rid,operationId:'wallet_confirm_001'});
 await ok('customer','confirm',{id:rid,operationId:'wallet_confirm_001'});
 ov = (await ok('runner','wallet')).value;
 assert.equal(ov.balance_cents,400);assert.equal(ov.transactions.length,1);assert.equal(ov.total_income_cents,400);assert.equal(ov.today_income_cents,400);assert.equal(ov.pending_cents,0);
 assert.equal((await ok('customer','wallet',{accountId:id('runner')})).value.balance_cents,0,'caller cannot choose a different wallet');
 assert.ok(!JSON.stringify((await ok('stranger','sync')).snapshot).includes('wallet_confirm'),'wallet ledger is not in public snapshots');
 assert.equal((await h.call('runner','walletWithdraw',{amount_cents:401})).ok,false);
 for (const bad of [-1,0,0.1,'400',NaN,Number.MAX_SAFE_INTEGER+1]) assert.equal((await h.call('runner','walletWithdraw',{amount_cents:bad})).ok,false);
 assert.equal((await ok('runner','wallet')).value.balance_cents,400,'bad amounts never change balance');
 const concurrent = await Promise.all([1,2].map(n=>h.call('runner','walletWithdraw',{amount_cents:400,operationId:'wallet_concurrent_'+n})));
 assert.equal(concurrent.filter(r=>r.ok).length,1,'two simultaneous withdrawals cannot spend the same balance');
 const wd = concurrent.find(r=>r.ok).value.withdrawal;
 assert.equal(wd.transfer_state,'SIMULATED_SUCCESS');assert.equal(wd.status,'approved');
 const successOp = 'wallet_concurrent_'+(concurrent[0].ok?1:2);
 const retry = await ok('runner','walletWithdraw',{amount_cents:400,operationId:successOp});assert.equal(retry.value.withdrawal.id,wd.id);
 ov = (await ok('runner','wallet')).value;assert.equal(ov.balance_cents,0);assert.equal(ov.withdrawals.length,1);assert.equal(ov.transactions.length,2);
 assert.equal(ov.transactions[0].amount_cents,-400);assert.equal(ov.series.at(-1).cents,0);
 // An archived order was already credited; later archive totals never create another opening credit.
 h.edit(s=>{s.requests[0].confirmedAt=now-9*86400000;s.archiveCheckedAt=0;});await ok('runner','sync');
 ov=(await ok('runner','wallet')).value;assert.equal(ov.balance_cents,0);assert.equal(ov.total_income_cents,400);assert.equal(h.state.requests.length,0);
 h.accounts[id('runner')].loggedOut=true;assert.equal((await h.call('runner','wallet')).ok,false);assert.equal((await h.call('runner','walletWithdraw',{amount_cents:1})).ok,false);assert.equal((await ok('runner','sync')).snapshot.walletSummary,null);

 // Migration of older archived totals, atomic failed-withdrawal return, and deductions.
 const s=h.engine.initial();s.members.a={archived:{paid:12.34}};wallet.settle(s,now);wallet.settle(s,now);
 assert.equal(wallet.overview(s,'a',now).balance_cents,1234);assert.equal(wallet.overview(s,'a',now).today_income_cents,0);
 const fail=wallet.withdraw(s,'a',1234,'failed-operation',now,true);assert.equal(fail.withdrawal.status,'rejected');assert.equal(fail.balance_cents,1234);
 wallet.refundWithdraw(s,'a',fail.withdrawal.id,now);wallet.withdraw(s,'a',1234,'failed-operation',now,true);
 ov=wallet.overview(s,'a',now);assert.equal(ov.transactions.length,3);assert.equal(ov.balance_cents,1234,'refund and replay are idempotent');
 assert.throws(()=>wallet.startWithdraw(s,'a',1233,'failed-operation',now),/reused/);
 s.adjustments=[{id:'a1',runnerAccountId:'a',amount:15,at:now}];wallet.settle(s,now);wallet.settle(s,now);
 ov=wallet.overview(s,'a',now);assert.equal(ov.balance_cents,0);assert.equal(ov.debt_cents,266);assert.throws(()=>wallet.withdraw(s,'a',1,'debt-withdrawal',now),/Insufficient/);
 wallet.credit(s,'a',500,'future-job',now);ov=wallet.overview(s,'a',now);assert.equal(ov.balance_cents,234);assert.equal(ov.debt_cents,0);
 const paid=wallet.withdraw(s,'a',234,'successful-operation',now);assert.throws(()=>wallet.refundWithdraw(s,'a',paid.withdrawal.id,now),/completed/);
 assert.equal(wallet.overview(s,'b',now).transactions.length,0);assert.equal(wallet.overview(s,'a',now,true).rules.channel,'Test ledger only; no real transfer');
 // Beijing midnight boundaries and curve replay include both days correctly.
 const t=h.engine.initial(),midnight=Date.parse('2030-01-03T00:00:00+08:00');
 wallet.credit(t,'a',100,'before',midnight-1);wallet.credit(t,'a',200,'after',midnight);
 ov=wallet.overview(t,'a',midnight);assert.equal(ov.today_income_cents,200);assert.equal(ov.series.at(-2).cents,100);assert.equal(ov.series.at(-1).cents,300);
 const p=h.engine.initial();p.trips=[{id:'t',runnerAccountId:'a'}];p.requests=[{id:'p',runnerId:'t',status:'delivered',category:'parcel',reward:3,deliveredAt:now},{id:'task',runnerId:'t',status:'disputed',category:'task',reward:4,deliveredAt:now}];
 ov=wallet.overview(p,'a',now);assert.equal(ov.pending_cents,700);assert.equal(ov.pending[0].auto_settle_at,now+2*3600000);assert.equal(ov.pending[1].auto_settle_at,0);assert.equal(ov.balance_cents,0);
 // Timer settles every order type at the same exact boundary without a signed-in student.
 const ht=harness();ht.edit(st=>{st.trips=[{id:'timer-trip',runnerAccountId:id('runner')}];st.requests=['takeout','parcel','task'].map((category,n)=>({id:'timer-'+n,category,reward:3,status:'delivered',ownerId:id('customer'),runnerId:'timer-trip',createdAt:now,deliveredAt:now-2*3600000}));st.requests.push({id:'not-due',category:'takeout',reward:3,status:'delivered',ownerId:id('customer'),runnerId:'timer-trip',createdAt:now,deliveredAt:now-2*3600000+1},{id:'review',category:'parcel',reward:3,status:'disputed',ownerId:id('customer'),runnerId:'timer-trip',createdAt:now,deliveredAt:now-3*3600000});});
 assert.equal((await ht.call('','sync')).ok,false,'unsigned clients cannot read orders');
 assert.equal((await ht.call('','sync',{Type:'Timer',TriggerName:'wrong'})).ok,false);
 const timer=await ht.call('','sync',{Type:'Timer',TriggerName:'wallet-auto-settle'});assert.deepEqual(timer,{ok:true,mode:'test'});assert.equal(ht.state.wallets[id('runner')].balance_cents,900);assert.equal(ht.state.requests.find(r=>r.id==='not-due').status,'delivered');assert.equal(ht.state.requests.find(r=>r.id==='review').status,'disputed');
 await ht.call('','sync',{Type:'Timer',TriggerName:'wallet-auto-settle'});assert.equal(ht.state.wallets[id('runner')].transactions.length,3,'timer replay never credits twice');
 // Server-only failure switch exercises the same atomic transaction used by the page.
 const hf=harness();hf.edit(st=>{st.members[id('runner')]={archived:{paid:2}};});process.env.WALLET_TEST_WITHDRAW_FAIL='1';
 try {const r=await hf.call('runner','walletWithdraw',{amount_cents:200});assert.equal(r.ok,true,r.error);assert.equal(r.value.withdrawal.status,'rejected');assert.equal(r.value.balance_cents,200);}finally{delete process.env.WALLET_TEST_WITHDRAW_FAIL;}
 console.log('Wallet: real order confirmation, one-time credits, test-only withdrawals, concurrent spend protection, retries, refund idempotency, migration/archive, deductions, account privacy and Beijing dates passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
