// 2026-11-16 team test: "+ Test tries" gives fresh fishing tries for today; refused once TEST_ROUNDS_FOR_TESTING is off.
const assert=require('node:assert/strict'),fs=require('node:fs'),{harness}=require('./helpers/order-cloud');
const play=require('../cloudfunctions/orderService/yuni-play'),catalog=require('../cloudfunctions/orderService/yuni-catalog');
(async()=>{
 const h=harness(),me=h.engine.idFor('customer');
 await h.call('customer','sync');
 h.edit(s=>{const m=s.members[me];m.loyalty=m.loyalty||{points:0,level:1,notices:[]};m.loyalty.points=300;m.loyalty.level=3;});
 await h.call('customer','sync');
 {const b=await h.call('customer','yuniBuy',{item:'rod'});assert.equal(b.ok,true,b.error);}
 const fishOnce=()=>h.call('customer','yuniFish',{landed:false});
 for(let i=0;i<catalog.WINDOWS.length;i++){const r=await fishOnce();assert.equal(r.ok,true,r.error);}
 assert.equal((await fishOnce()).ok,false,'no tries left today');
 const t=await h.call('customer','yuniTestRound',{});assert.equal(t.ok,true,t.error);
 assert.equal(t.snapshot.yuni.testRounds,true);assert.equal(t.snapshot.yuni.fishing.left,catalog.WINDOWS.length,'tries are back');
 assert.equal((await fishOnce()).ok,true,'can fish again');
 play.setTestRounds(false);
 assert.equal((await h.call('customer','yuniTestRound',{})).ok,false,'switched off before launch');
 assert.equal((await h.call('customer','sync')).snapshot.yuni.testRounds,false,'the button hides');
 play.setTestRounds(true);
 const xml=fs.readFileSync(require('node:path').join(__dirname,'../components/yuni-stage/index.wxml'),'utf8');
 assert.match(xml,/wx:if="\{\{testRounds\}\}"[^>]*catchtap="addTestRound"/,'the button only shows while testing');
 console.log('Yuni test tries: fresh fishing tries while testing, off before launch');
})().catch(e=>{console.error(e);process.exit(1);});
