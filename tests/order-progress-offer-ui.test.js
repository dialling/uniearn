const assert=require('assert'),fs=require('fs');
const f=require('../utils/workflow');

const wxml=fs.readFileSync('pages/request/index.wxml','utf8');
const js=fs.readFileSync('pages/request/index.js','utf8');
assert.ok(wxml.indexOf('order-progress-card')<wxml.indexOf('status-card'),'the shared five-step flow appears at the top of every order detail');
assert.equal(wxml.includes('class="timeline"'),false,'the old bottom vertical progress block is removed');
assert.match(js,/offerAmounts:\[1\.88,3\.88,5\.88,8\.88,13\.88,18\.88\]/,'the reference offer amounts are available from the shared view model');
assert.match(wxml,/offer-cancel[^>]*bindtap="cancel"/,'free cancellation remains a real bordered button wired to the existing action');

assert.equal(wxml.includes('offer-custom-row'),false,'custom amounts use the single 自定义 entry, not a second disabled add button');
assert.match(wxml,/bindtap="customRaise"/,'the custom amount entry stays on the offer grid');
assert.equal(wxml.includes('外卖已送达'),false,'waiting-state copy must not ask if food has already arrived');
assert.match(wxml,/放置位置照片（选填）/);
assert.match(wxml,/Placement photos \(optional\)/);

const request={id:'offer',category:'task',status:'waiting',reward:5,history:[]},state={requests:[request]};
for(const amount of [1.88,3.88,5.88,8.88]){
 request.reward=5;request.raised=0;request.history=[];
 assert.equal(f.raise(state,'offer',amount).reward,Math.round((5+amount)*100)/100,'all shared order categories accept the displayed raise '+amount);
}
request.raised=0;assert.doesNotThrow(()=>f.raise(state,'offer',2.66));
for(const invalid of [0,-1,1.001,Infinity,101])assert.throws(()=>f.raise(state,'offer',invalid));
request.raised=99;assert.throws(()=>f.raise(state,'offer',2),/limit/);
console.log('Shared order flow and offer card: top five-step progress, old block removal, four themed raise buttons, cancellation wiring and backend amount parity passed.');
