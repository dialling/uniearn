const assert=require('node:assert/strict'),ta=require('../utils/trip-address');
const trip={dorm:'D01',destinationType:'dorm'},place={destinationType:'place',deliveryAddress:'BS Building'};
assert.equal(ta.fits({dorm:'D01',destinationType:'dorm'},trip),true);
assert.equal(ta.fits({dorm:'D03',destinationType:'dorm'},trip),false,'another building cannot join this trip');
assert.equal(ta.fits({destinationType:'place',deliveryAddress:'BS Building'},place),true);
assert.equal(ta.fits({dorm:'D01'},place),false);
assert.equal(ta.pick([{id:'a',dorm:'D03'},{id:'b',dorm:'D01'},{id:'c',dorm:'D01',default:true}],trip).id,'c','the default address wins when it fits');
assert.equal(ta.pick([{id:'a',dorm:'D03',default:true}],trip),null);
assert.match(ta.mismatch(trip,false),/only delivers to D01/);
// sign in first, then come straight back to the shared trip
global.wx={getStorageSync:()=>null,setStorageSync(){}};
const store=require('../utils/store'),onboarding=require('../utils/onboarding');store.reset();
store.update(s=>{s.profile={...s.profile,campusId:'sip',universityId:'xjtlu',onboarded:true};s.afterSignIn='/pages/join/index?id=t42';});
if(onboarding.selected(store.get().profile)){assert.equal(onboarding.nextPage(),'/pages/join/index?id=t42');assert.equal(store.get().afterSignIn,undefined,'the return trip is used once');assert.equal(onboarding.nextPage(),'/pages/jobs/index');}
store.update(s=>{s.afterSignIn='https://evil.example';});if(onboarding.selected(store.get().profile))assert.notEqual(onboarding.nextPage(),'https://evil.example','only a join page can be the return target');
console.log('trip join address + sign-in return ok');
