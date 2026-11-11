const assert=require('assert'),fs=require('fs');
const f=require('../utils/workflow');

const wxml=fs.readFileSync('pages/request/index.wxml','utf8');
const js=fs.readFileSync('pages/request/index.js','utf8');
assert.ok(wxml.includes('journey-ticket')&&wxml.includes('journey-progress')&&wxml.includes('journey-mascot'),'Yuni and five-step progress are combined into one journey ticket');assert.ok(!wxml.includes('class="flow-card status-card"'),'no duplicate status banner');
assert.equal(wxml.includes('class="timeline"'),false,'the old bottom vertical progress block is removed');
assert.ok(!js.includes('offerAmounts:')&&!js.includes('customRaise()'),'Parcel/takeaway offer handlers removed');
assert.match(wxml,/offer-cancel[^>]*bindtap="cancel"/,'free cancellation remains a real bordered button wired to the existing action');

const request={id:'offer',category:'task',status:'waiting',reward:5,history:[]},state={requests:[request]};
for(const amount of [1.88,3.88,5.88,8.88]){
 request.reward=5;request.raised=0;request.history=[];
 assert.equal(f.raise(state,'offer',amount).reward,Math.round((5+amount)*100)/100,'waiting task orders accept the displayed raise '+amount);
}
request.raised=0;assert.doesNotThrow(()=>f.raise(state,'offer',2.66));
for(const invalid of [0,-1,1.001,Infinity,101])assert.throws(()=>f.raise(state,'offer',invalid));
request.raised=99;assert.throws(()=>f.raise(state,'offer',2),/limit/);
console.log('Shared order flow and offer card: top five-step progress, old block removal, no parcel/takeaway raise buttons, cancellation wiring and backend amount parity passed.');
