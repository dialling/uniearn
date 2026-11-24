// 2026-11-16: the eagle friend. Bought in the shop (Friends tab); after Yuni lands a fish it has a 30% chance to catch
// one more (its own odds), which goes in the bucket if there is room.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{harness}=require('./helpers/order-cloud');
const play=require('../legacy/cloudfunctions/orderService/yuni-play'),catalog=require('../legacy/cloudfunctions/orderService/yuni-catalog');
(async()=>{
 const eagle=catalog.item('eagle');assert.equal(eagle.slot,'friend');assert.equal(eagle.price,300);assert.equal(eagle.helper.chance,30);
 assert.ok(catalog.TABS.some(t=>t.slots.includes('friend')),'a Friends tab in the shop');
 const h=harness(),me=h.engine.idFor('customer');await h.call('customer','sync');
 h.edit(s=>{const m=s.members[me];m.loyalty=m.loyalty||{points:0,level:1,notices:[]};m.loyalty.points=900;m.loyalty.level=3;});
 await h.call('customer','sync');
 assert.equal((await h.call('customer','yuniBuy',{item:'rod'})).ok,true);
 const m=()=>h.state.members[me],day=86400000;let t=Date.parse('2026-11-16T04:00:00Z');
 const fishAt=seq=>{t+=day;let i=0;return play.fish(h.state,me,{landed:true,perfect:true},t,()=>seq[Math.min(i++,seq.length-1)]);};
 // without the eagle: never a second fish
 const before=m().yuni.bucket.length;const r0=fishAt([0.5,0.1,0.1,0.1,0.1]);assert.ok(r0.fish&&!r0.eagle);assert.equal(m().yuni.bucket.length,before+1);
 // buy it: it is worn straight away and perches beside Yuni
 const bought=await h.call('customer','yuniBuy',{item:'eagle'});assert.equal(bought.ok,true,bought.error);assert.equal(bought.snapshot.yuni.worn.friend,'eagle');
 // lucky helper roll (< 30%): two fish
 const n=m().yuni.bucket.length;const r1=fishAt([0.5,0.5,0.5,0.1,0.1,0.1]);assert.ok(r1.fish&&r1.eagle,'the eagle caught one too');assert.equal(m().yuni.bucket.length,n+2);
 assert.ok(catalog.fish(r1.eagle.fish),'a real fish');
 // unlucky helper roll (>= 30%): one fish
 const r2=fishAt([0.5,0.5,0.5,0.9]);assert.ok(r2.fish&&!r2.eagle);
 // no room for the eagle's fish when Yuni's catch fills the bucket
 m().yuni.bucket=Array(catalog.BUCKET_MAX-1).fill('sardine');const r3=fishAt([0.5,0.5,0.5,0.01]);assert.ok(r3.fish&&!r3.eagle,'a full bucket leaves no room');
 // taking the eagle off stops the help
 assert.equal((await h.call('customer','yuniWear',{slot:'friend',item:''})).ok,true);m().yuni.bucket=[];assert.ok(!fishAt([0.5,0.5,0.5,0.01]).eagle);
 // over many catches it helps about 30% of the time
 assert.equal((await h.call('customer','yuniWear',{slot:'friend',item:'eagle'})).ok,true);
 let extra=0;for(let i=0;i<4000;i++){m().yuni.bucket=[];m().yuni.lastCouponAt=t;t+=day;if(play.fish(h.state,me,{landed:true,perfect:true},t,Math.random).eagle)extra++;}
 assert.ok(extra>1000&&extra<1400,'about 30% of 4000 catches: '+extra);
 const wxml=fs.readFileSync(path.join(__dirname,'../components/yuni-stage/index.wxml'),'utf8');assert.match(wxml,/wx:if="\{\{friend && !friendAway\}\}" class="ys-friend [^"]*" style="\{\{friendStyle\}\}"/,'the eagle flies freely, placed by code');
 const js=fs.readFileSync(path.join(__dirname,'../components/yuni-stage/index.js'),'utf8');assert.match(js,/friendVisit\(b\)/);assert.match(js,/friendCircle\(b\)/);
 console.log('Eagle friend: Friends tab, 30% extra fish, respects bucket space ('+extra+'/4000)');
})().catch(e=>{console.error(e);process.exit(1);});

// 2026-11-16: it hovers over the water while Yuni fishes, and can rest on Yuni's hat.
{const js=fs.readFileSync(path.join(__dirname,'../components/yuni-stage/index.js'),'utf8');
 assert.match(js,/friendPerch\(b\)/,'it lands on Yuni\'s hat');assert.match(js,/hover over the water near the bobber/,'it watches the bobber while Yuni fishes');
 assert.match(js,/if \(this\.fperched && p && p\.body/,'Yuni moving sends it back into the air');}
