const assert=require('node:assert/strict');let def;global.Page=x=>def=x;global.wx={getStorageSync:()=>null,setStorageSync(){}};
const store=require('../utils/store'),events=require('../utils/yuni-events');require('../pages/jobs/index');
store.reset();store.update(s=>{s.language='en';s.profile={...s.profile,accountId:'owner',onboarded:true,campusId:'sip'};s.publicJobs=[];s.requests=[];});
const now=Date.now(),row={id:'mine',ownerId:'owner',isMine:true,campusId:'sip',category:'takeout',station:'Takeaway pickup',pickupPoint:'Locker A',dorm:'D01',room:'101',reward:3,small:1,big:0,createdAt:now-600000,arrivalAt:now,closesAt:now+3600000,status:'waiting',collected:[],codes:[],history:[]};
const p={...def,data:structuredClone(def.data),setData(v){Object.assign(this.data,v)}};
function state(status){store.update(s=>s.requests=[{...row,status,...(status==='taken'?{takenAt:now,runnerId:'runner-trip'}:{}),...(status==='confirmed'?{confirmedAt:now,deliveredAt:now}:{})}]);p.refresh();}
state('waiting');assert.equal(p.data.cards.length,1);assert.equal(p.data.trackedOrders.length,0);
state('taken');assert.equal(p.data.cards.length,1,'accepted orders stay visible in the hall');assert.equal(p.data.cards[0].running,true);assert.equal(p.data.trackedOrders.length,1,'accepted customer order remains accessible on home');assert.equal(p.data.trackedOrders[0].id,'mine');assert.match(p.data.trackedOrders[0].title,/Locker A/);
state('collected');assert.equal(p.data.trackedOrders.length,1);state('delivered');assert.equal(p.data.trackedOrders.length,1,'awaiting customer confirmation remains active');state('disputed');assert.equal(p.data.trackedOrders.length,1);
state('confirmed');assert.equal(p.data.trackedOrders.length,0);state('cancelled');assert.equal(p.data.trackedOrders.length,0);state('refunded');assert.equal(p.data.trackedOrders.length,0);
state('taken');store.update(s=>s.requests[0].isMine=false);p.refresh();assert.equal(p.data.trackedOrders.length,0,'private tracker only shows own orders');
events.reset();const shown=[],off=events.subscribe(e=>shown.push(e));events.emit({key:'intro',title:'Intro'});events.status({...row,status:'cancelled'},1);
events.reconcile({accountId:'owner',requests:[{...row,status:'taken'}]});events.next();assert.equal(shown.length,1,'queued old cancellation never appears after active status arrives');
events.status({...row,status:'cancelled'},2);assert.equal(shown.at(-1).title,'Order cancelled');events.reconcile({accountId:'owner',requests:[{...row,status:'collected'}]});assert.equal(shown.at(-1),null,'an already visible stale cancellation is dismissed');
events.status({...row,status:'cancelled'},3);const count=shown.length;events.reconcile({accountId:'owner',requests:[{...row,status:'cancelled'}]});assert.equal(shown.length,count,'real cancellation stays visible');events.next();
events.status({...row,status:'waiting',cancellation:{reason:'personal'}},4);assert.equal(shown.at(-1).title,'Order still active','runner giving back an order is not customer cancellation');
events.reconcile({accountId:'another-account',requests:[]});assert.equal(shown.at(-1),null,'old account notifications cannot survive an account switch');off();events.reset();
console.log('Customer order visibility: acceptance/pickup/delivery/review stay on home, terminal/privacy exclusions, stale queued/current cancellation removal and returned-order wording passed.');
