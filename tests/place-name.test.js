const assert=require('node:assert/strict'),{harness}=require('./helpers/order-cloud'),routeLabel=require('../utils/route-label');
// A saved "other address" name (e.g. "Library") travels with the order for display only:
// the server still derives dorm from the address text. Like a dorm building, the name is public so
// runners know where it goes; the exact detail (like a room number) stays private until acceptance.
const h=harness();const data={category:'takeout',destinationType:'place',deliveryAddress:'Level2',placeName:'Library',station:'North gate',dorm:'D02',room:'',owner:'Guitar',phone:'17743452354',bags:1,price:4,arrived:true};
(async()=>{
 const a=await h.call('customer','create',{data});assert.equal(a.ok,true);const r=h.state.requests[0];
 assert.equal(r.placeName,'Library','the saved place name is stored on the order');
 assert.equal(r.dorm,'Campus meeting point','dorm stays server-derived, never the client value');
 const pub=await h.call('other','sync');const published=pub.snapshot.requests.find(x=>x.id===r.id);
 assert.equal(published.placeName,'Library','runners see the place name before taking the job');
 assert.equal(published.deliveryAddress,undefined,'the exact address detail stays private until a runner accepts');
 assert.ok(!JSON.stringify(pub.snapshot).includes('Level2'),'the exact detail is not in any public list');
 assert.equal(pub.snapshot.publicJobs.find(x=>x.id===r.id).placeName,'Library','the public jobs list carries the place name too');
 const taken=await h.call('runner','accept',{ids:[r.id]});assert.equal(taken.ok,true);
 const row=taken.snapshot.requests.find(x=>x.id===r.id);assert.equal(row.placeName,'Library','the runner sees the place name after accepting');
 assert.equal(routeLabel.destination(row,'en'),'Library · Level2','My orders shows the name with the exact address');
 await h.call('customer','create',{data:{...data,placeName:'Other'}});assert.equal(h.state.requests[0].placeName,'','the generic default name is not shown');
 await h.call('customer','create',{data:{...data,destinationType:'dorm',dorm:'D02',room:'101'}});assert.equal(h.state.requests[0].placeName,'','dorm orders never carry a place name');
 console.log('Place name: shown to runners, exact detail private before acceptance, dorm stays server-derived');
})().catch(e=>{console.error(e);process.exitCode=1;});
