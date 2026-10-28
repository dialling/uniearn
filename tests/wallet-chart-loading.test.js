const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../pages/wallet/index'),'utf8');
function setup(){
 let definition,strokes=0;const calls=[],queries=[],state={language:'zh',profile:{accountId:'runner'}};
 const ctx=new Proxy({createLinearGradient:()=>({addColorStop(){}}),stroke(){strokes++;}},{get:(o,k)=>k in o?o[k]:()=>{}});
 const hit={node:{getContext:()=>ctx},width:320,height:150};
 vm.runInNewContext(source,{Page:p=>definition=p,require:name=>name.includes('wallet-copy')?require('../utils/wallet-copy'):name.includes('store')?{get:()=>state}:{overview:()=>new Promise((resolve,reject)=>calls.push({resolve,reject}))},wx:{getStorageSync:()=>false,setStorageSync(){},getWindowInfo:()=>({pixelRatio:2}),createSelectorQuery:()=>({select(){return this;},fields(){return this;},exec(fn){queries.push(()=>fn([hit]));}})}});
 const page={...definition,data:structuredClone(definition.data),setData(patch,fn){Object.assign(this.data,patch);fn&&fn();}};
 page.onLoad();return {page,calls,queries,get strokes(){return strokes;}};
}
const response={balance_cents:500,balance_yuan:'5.00',today_income_cents:500,total_income_cents:500,pending_cents:0,pending_yuan:'0.00',debt_cents:0,rules:{},series:[{date:'2026-10-27',cents:0},{date:'2026-10-28',cents:500}],transactions:[],withdrawals:[],pending:[]};
(async()=>{
 const h=setup(),p=h.page;
 const loading=p.load();p.onReady();
 assert.equal(h.queries.length,0,'ready before wallet data must not draw a default zero-balance line');
 assert.equal(p.data.chartReady,false);
 h.calls.shift().resolve(response);await loading;
 assert.equal(h.queries.length,1);assert.equal(p.data.chartReady,false,'canvas stays invisible until drawing finishes');
 h.queries.shift()();assert.ok(h.strokes>0);assert.equal(p.data.chartReady,true);
 p.toggleHide();const stale=h.queries.shift(),before=h.strokes,refresh=p.load();
 assert.equal(p.data.chartReady,false,'refresh hides the previous canvas while data is pending');
 stale();assert.equal(h.strokes,before,'an old canvas callback cannot repaint during a newer load');
 h.calls.shift().resolve(response);await refresh;p.onHide();h.queries.shift()();
 assert.equal(h.strokes,before,'a hidden wallet must not paint a late chart');
 const early=setup(),loadEarly=early.page.load();early.calls.shift().resolve(response);await loadEarly;
 assert.equal(early.queries.length,0);early.page.onReady();early.queries.shift()();assert.equal(early.page.data.chartReady,true,'data before ready also draws once the page is ready');
 const failure=early.page.load();early.calls.shift().reject(Error('offline'));await failure;
 early.page.drawChart();assert.equal(early.page.data.chartReady,false);assert.equal(early.queries.length,0,'a failed load does not show a fabricated green line');
 const xml=fs.readFileSync(require.resolve('../pages/wallet/index.wxml'),'utf8');assert.ok(xml.includes("chartReady?'':'chart-hidden'"));assert.ok(xml.includes('class="chart-loading"'));
 console.log('Wallet chart loading: slow data, data before ready, hidden canvas until paint, stale refresh/navigation callbacks and failed loads passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
