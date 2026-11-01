const assert=require('node:assert/strict');
for(const base of ['../utils/','../cloudfunctions/orderService/']){
 const f=require(base+'workflow'),d=require(base+'domain'),now=Date.now();
 for(const offset of [-3600000,0,599999]){
  const s=d.initial();s.requests=[];s.trips=[];s.profile.marks=[];
  const r={id:'missing',category:'takeout',campusId:'sip',station:'Gate',dorm:'D01',room:'101',small:1,big:0,codes:[''],reward:3,status:'waiting',collected:[],arrivalAt:now+3600000,createdAt:now,closesAt:now+7200000};s.requests.push(r);d.acceptJob(s,[r.id]);
  assert.equal(f.runnerCancel(s,r.id,'missing',now+offset),false);assert.equal(r.status,'waiting');assert.equal(r.runnerId,null);assert.equal(s.profile.marks.length,0);assert.equal(r.cancellation.reason,'missing');
 }
}
const fs=require('fs'),xml=fs.readFileSync(require.resolve('../pages/trip/index.wxml'),'utf8');assert(!xml.includes('missingAllowed'));assert(!xml.includes('arrival + 10 min'));assert(xml.includes('disabled="{{!cancelReason}}"'));
console.log('Missing food: immediately selectable and cancellable without marks, with no frontend or server ETA wait.');
