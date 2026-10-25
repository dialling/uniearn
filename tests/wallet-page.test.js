const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {harness}=require('./helpers/order-cloud');
const h=harness(),id=h.engine.idFor,now=Date.parse('2030-01-02T18:00:00+08:00');Date.now=()=>now;
h.edit(s=>{s.members[id('runner')]={archived:{paid:5}};});h.user='runner';
let def,notices=[],lost=false,holdModal=false,modal,withdrawCalls=0;
const storage={};
global.Page=x=>def=x;
global.wx={getStorageSync:key=>storage[key],setStorageSync:(key,value)=>storage[key]=value,showToast:options=>notices.push(options.title),showModal(options){if(holdModal)modal=options;else options.success({confirm:true});},cloud:{init(){},async callFunction({name,data}){
 if(name==='studentAccount'){const actor=id(h.user),a=h.accounts[actor];return{result:{ok:true,account:{...a,id:actor,runnerRulesAccepted:true}}};}
 assert.equal(name,'orderService');if(data.action==='walletWithdraw')withdrawCalls++;
 const result=await h.client(data);if(lost&&data.action==='walletWithdraw'){lost=false;throw Error('network response lost after commit');}return{result};
}}};
const store=require('../utils/store');store.update(s=>{s.profile={...h.accounts[id('runner')].profile,accountId:id('runner'),studentVerified:true};s.language='zh';});
require('../pages/wallet/index');const page={...def,data:structuredClone(def.data),setData(patch,fn){Object.assign(this.data,patch);if(fn)fn();}};page.onLoad();
(async()=>{
 await page.load();assert.equal(page.data.balance,'5.00');assert.equal(page.data.totalIncome,'5.00');assert.equal(page.data.transactions.length,1);assert.equal(page.data.ui.withdraw,'模拟提现');
 page.toggleHide();assert.equal(page.data.hideAmount,true);await page.load();assert.equal(page.data.hideAmount,true,'hide preference persists per account');
 holdModal=true;const first=page.withdraw();await page.withdraw();assert.equal(withdrawCalls,0,'second tap cannot create another confirmation or request');assert.equal(page.data.withdrawing,true);
 lost=true;modal.success({confirm:true});await first;holdModal=false;
 assert.equal(withdrawCalls,2,'lost response retries the saved operation');assert.equal(page.data.balanceCents,0);assert.equal(page.data.withdrawals.length,1);assert.equal(page.data.withdrawals[0].statusText,'模拟提现完成');assert.equal(page.data.transactions.length,2);assert.equal(store.get().pendingOrderOperation,undefined);
 assert.equal(h.state.wallets[id('runner')].withdrawals.length,1);assert.ok(!('requestMerchantTransfer' in wx),'simulation never calls a merchant transfer');
 h.user='other';store.update(s=>{s.profile={...h.accounts[id('other')].profile,accountId:id('other')};s.language='en';});await page.load();assert.equal(page.data.balanceCents,0);assert.equal(page.data.transactions.length,0);assert.equal(page.data.hideAmount,false);assert.equal(page.data.ui.withdraw,'Simulate withdrawal');
 page.openRules();assert.equal(page.data.rulesVisible,true);page.closeRules();assert.equal(page.data.rulesVisible,false);
 h.accounts[id('other')].loggedOut=true;store.update(s=>{s.profile.loggedOut=true;});await page.load();assert.equal(page.data.transactions.length,0);assert.ok(page.data.error);
 // The page ignores late responses after it is hidden.
 let resolve;const state={language:'zh',profile:{accountId:'a'}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../pages/wallet/index'),'utf8'),{Page:x=>def=x,require:name=>name.includes('wallet-copy')?require('../utils/wallet-copy'):name.includes('store')?{get:()=>state}:{overview:()=>new Promise(r=>resolve=r)},wx:{getStorageSync:()=>false}});
 const hidden={...def,data:structuredClone(def.data),setData(patch,fn){Object.assign(this.data,patch);fn&&fn();}};hidden.onLoad();const pending=hidden.load();hidden.onHide();resolve({balance_cents:999999});await pending;assert.equal(hidden.data.balanceCents,0);
 const xml=fs.readFileSync(require.resolve('../pages/wallet/index.wxml'),'utf8');assert.ok(xml.includes('hideAmount?\'***\':(item.positive'));assert.ok(xml.includes('ui.testNote'));
 console.log('Wallet page: cloud overview, double-tap guard, lost-response recovery, test labels, isolated hide preferences, account switch/logout and hidden-page response guard passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
