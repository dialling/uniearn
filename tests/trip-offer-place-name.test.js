// 2026-11-16: a join request to a typed place shows that place's name (e.g. "library"), not "Other address".
const assert=require('node:assert/strict');
let definition;
global.Page=value=>definition=value;global.wx={getStorageSync:()=>null,setStorageSync(){},showToast(){}};
require('../pages/trip/index');
const page={...definition,data:{}};
const trip={id:'t1',category:'other',destinationType:'place',deliveryAddress:'library',dorm:'',station:'Restaurant'};
const now=Date.now();
const task={id:'r1',category:'task',title:'tea shop',destinationType:'place',placeName:'',offeredTripId:'t1',offeredAt:now,status:'waiting',reward:4};
const [en]=page.offerViews({requests:[task]},trip,'en',now);
assert.equal(en.to,'library');
const [zh]=page.offerViews({requests:[task]},trip,'zh',now);
assert.equal(zh.to,'library');
const [dorm]=page.offerViews({requests:[{...task,destinationType:'dorm',dorm:'D01'}]},{...trip,destinationType:'dorm',dorm:'D01'},'en',now);
assert.equal(dorm.to,'D01');
assert.equal(en.task,true);assert.equal(en.detail,'tea shop','a task request shows the task itself');assert.equal(dorm.detail,'tea shop');
const [parcel]=page.offerViews({requests:[{...task,category:'parcel',parcelItems:[{size:'small'}],station:'North gate'}]},trip,'en',now);assert.equal(parcel.task,false);assert.equal(parcel.detail,'');
console.log('join request card: typed place name, task detail only');
