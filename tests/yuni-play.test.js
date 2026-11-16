const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{harness}=require('./helpers/order-cloud');
// 2026-11-15: Yuni shop, wardrobe and fishing. Levels count lifetime points; the shop spends a separate balance.
const root=path.join(__dirname,'..'),strip=f=>fs.readFileSync(path.join(root,f),'utf8').split('\n').filter(l=>!l.startsWith('//')).join('\n');
assert.equal(strip('utils/yuni-catalog.js'),strip('cloudfunctions/orderService/yuni-catalog.js'),'the app and server share one catalogue');
const play=require('../cloudfunctions/orderService/yuni-play'),catalog=require('../cloudfunctions/orderService/yuni-catalog');
(async()=>{
 const h=harness(),me=h.engine.idFor('customer');
 let snap=(await h.call('customer','sync')).snapshot;assert.ok(snap.yuni,'the snapshot carries Yuni play state');
 assert.deepEqual(snap.yuni.worn,{hat:'captain',scarf:'green',scene:'morning',ride:'floe'});
 const poor=await h.call('customer','yuniBuy',{item:'rod'});assert.equal(poor.ok,false);assert.match(poor.error,/more points/);
 h.edit(s=>{const m=s.members[me];m.loyalty=m.loyalty||{points:0,level:1,notices:[]};m.loyalty.points=300;m.loyalty.level=3;});
 snap=(await h.call('customer','sync')).snapshot;
 assert.equal(snap.yuni.balance,300);assert.equal(snap.yuni.worn.bag,'satchel','level 2 reward is worn');assert.equal(snap.yuni.worn.badge,'epaulettes','level 3 reward is worn');
 assert.equal((await h.call('customer','yuniBuy',{item:'cape'})).ok,false,'level rewards cannot be bought');
 assert.equal((await h.call('customer','yuniFish',{landed:true})).ok,false,'fishing needs a rod');
 const bought=await h.call('customer','yuniBuy',{item:'rod'});assert.equal(bought.ok,true,bought.error);
 snap=bought.snapshot;assert.equal(snap.yuni.balance,180);assert.equal(snap.yuni.worn.hand,'rod');
 assert.equal(snap.progression.points,300,'buying never lowers level points');assert.equal(snap.progression.level,3);
 assert.equal((await h.call('customer','yuniBuy',{item:'rod'})).ok,false,'no double purchase');
 assert.equal((await h.call('customer','yuniWear',{slot:'scarf',item:''})).ok,false,'the scarf cannot be taken off');
 assert.equal((await h.call('customer','yuniWear',{slot:'hat',item:'crown'})).ok,false,'cannot wear what you do not own');
 assert.equal((await h.call('customer','yuniWear',{slot:'hat',item:''})).ok,true);
 // Fishing: one try per window, a miss uses it, and points arrive only when the fish is fed.
 play.setAnyTime(false); // check the real lunch and dinner windows
 assert.throws(()=>play.fish(h.state,me,{landed:true},Date.parse('2026-11-16T07:00:00Z'),()=>0.1),/lunch and dinner/,'15:00 is outside both windows');
 const m=h.state.members[me],lunch=Date.parse('2026-11-16T04:30:00Z'),dinner=Date.parse('2026-11-16T10:30:00Z'); // 12:30 and 18:30 China time
 const first=play.fish(h.state,me,{landed:true,perfect:true},lunch,()=>0.1);assert.equal(first.rarity,'common');assert.equal(m.yuni.bucket.length,1);
 assert.throws(()=>play.fish(h.state,me,{landed:true},lunch+60000,()=>0.1),/One try per meal/);
 const miss=play.fish(h.state,me,{landed:false},dinner,()=>0.1);assert.equal(miss.missed,true);assert.equal(m.yuni.bucket.length,1,'a miss lands nothing');
 assert.throws(()=>play.fish(h.state,me,{landed:true},dinner+60000,()=>0.1),/One try per meal/,'a miss uses the try');
 assert.equal(play.view(m,dinner+60000).fishing.left,0);
 assert.equal(play.fish(h.state,me,{landed:true,perfect:true},lunch+86400000,()=>0.999).rarity,'super','a new day gives new tries');
 const before=m.loyalty.points,fed=play.feed(h.state,me,{index:0},lunch);assert.equal(fed.points,2);assert.equal(m.loyalty.points,before+2,'feeding earns the points');
 assert.equal(play.feed(h.state,me,{index:0},lunch).points,10);assert.throws(()=>play.feed(h.state,me,{index:0},lunch),/not in the bucket/);
 // While the team tests, any hour counts as the next unused window, still two tries a day.
 play.setAnyTime(true);const night=Date.parse('2026-11-18T19:00:00Z');
 assert.equal(play.view(m,night).fishing.open,true);play.fish(h.state,me,{landed:false},night,()=>0.1);assert.equal(play.view(m,night).fishing.open,true,'the second try opens straight away');
 play.fish(h.state,me,{landed:false},night,()=>0.1);assert.equal(play.view(m,night).fishing.open,false);assert.equal(play.view(m,night).fishing.left,0);
 // Better tools find rarer fish.
 for(const it of catalog.ITEMS.filter(i=>i.odds))assert.equal(it.odds.reduce((a,b)=>a+b,0),100,it.id+' odds add up');
 const odds=['rod','rod2','rod3','trident'].map(id=>catalog.item(id).odds[2]);assert.deepEqual(odds.slice().sort((a,b)=>a-b),odds,'super rare chance rises with the tool');
 // Reaching Captain grants the trident once; the player may switch back to a rod.
 h.edit(s=>{s.members[me].loyalty.level=5;});
 assert.equal(play.view(h.state.members[me],lunch).worn.hand,'trident');
 assert.equal((await h.call('customer','yuniWear',{slot:'hand',item:'rod'})).ok,true);
 assert.equal(play.view(h.state.members[me],lunch).worn.hand,'rod','the reward is not forced back on');
 // Team test: +200 points that count toward levels; refused once the flag is off.
 const tp0=h.state.members[me].loyalty.points,tp=await h.call('customer','yuniTestPoints',{});assert.equal(tp.ok,true,tp.error);assert.equal(h.state.members[me].loyalty.points,tp0+200);assert.equal(tp.snapshot.yuni.testPoints,true);
 play.setTestPoints(false);assert.equal((await h.call('customer','yuniTestPoints',{})).ok,false);assert.equal(play.view(h.state.members[me],lunch).testPoints,false);play.setTestPoints(true);
 console.log('Yuni play: shared catalogue, shop balance apart from level points, wardrobe rules, fishing tries, feeding for points and level rewards passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
