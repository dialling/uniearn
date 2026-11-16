// 2026-11-16: the fishing timing bar. Only a stop in the green zone (perfect) catches a fish; a miss lands nothing.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{harness}=require('./helpers/order-cloud');
const play=require('../cloudfunctions/orderService/yuni-play');
(async()=>{
 const h=harness(),me=h.engine.idFor('customer');await h.call('customer','sync');
 h.edit(s=>{const m=s.members[me];m.loyalty=m.loyalty||{points:0,level:1,notices:[]};m.loyalty.points=400;m.loyalty.level=3;});
 await h.call('customer','sync');assert.equal((await h.call('customer','yuniBuy',{item:'rod'})).ok,true);
 const lunch=Date.parse('2026-11-16T04:00:00Z'),day=86400000;let t=lunch;
 const fishAt=(ev,rand)=>{t+=day;return play.fish(h.state,me,ev,t,()=>rand);};
 assert.equal(fishAt({landed:true,perfect:true},0.999).rarity,'super','green zone keeps the odds');
 const bucket=()=>h.state.members[me].yuni.bucket.length,n0=bucket();
 assert.deepEqual(fishAt({landed:true,perfect:false},0.999),{missed:true},'missed the green: no fish');
 assert.deepEqual(fishAt({landed:true},0.999),{missed:true},'no timing result counts as a miss');
 assert.deepEqual(fishAt({landed:true,perfect:'yes'},0.999),{missed:true},'only a real true counts');
 assert.equal(bucket(),n0,'nothing went into the bucket');
 assert.equal(h.state.members[me].yuni.fishing.used.lunch,true,'a miss still uses the try');
 const js=fs.readFileSync(path.join(__dirname,'../components/yuni-stage/index.js'),'utf8'),xml=fs.readFileSync(path.join(__dirname,'../components/yuni-stage/index.wxml'),'utf8');
 assert.match(js,/F\.leg \* 4/,'the marker runs there and back twice');assert.match(js,/phase === 'timing'\) this\.stopTiming\(false\)/,'tapping during the bar stops it');
 assert.match(xml,/class="ys-meter ys-meter-\{\{meter\.state\}\}"/);
 assert.match(js,/if \(F\.round < 2\)[^\n]*this\.runTiming\(F, 2\)/,'the first miss gets one more run of the bar');
 console.log('Fishing timing bar: only a stop in the green catches a fish');
})().catch(e=>{console.error(e);process.exit(1);});
