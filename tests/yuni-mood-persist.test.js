// 2026-11-21: Yuni's mood hearts stay filled for the day after leaving the Me page.
const assert=require('node:assert/strict');
const storage={};
global.wx={getStorageSync:k=>storage[k],setStorageSync:(k,v)=>{storage[k]=v;},getWindowInfo:()=>({windowWidth:375,windowHeight:667}),createInnerAudioContext:()=>({play(){},stop(){},destroy(){},onError(){}})};
let def;global.Component=d=>{def=d;};
require('../components/yuni-stage/index.js');
const store=require('../utils/store');
const {dayKey}=require('../utils/china-time');
function mount(){const c={data:JSON.parse(JSON.stringify(def.data)),setData(p){Object.assign(this.data,p);},act(){},confetti(){},say(){},t:(zh)=>zh};for(const [k,f] of Object.entries(def.methods))if(!c[k])c[k]=f;return c;}
const first=mount();
for(let i=0;i<7;i++)first.cheer();
assert.equal(first.data.mood,5,'five cheers fill all hearts');
const second=mount();
assert.equal(second.moodToday(),5,'a new Me page sees the full hearts');
store.update(x=>{x.yuniMood={day:dayKey(Date.now()-86400000),value:5};});
assert.equal(mount().moodToday(),0,'a new day starts with empty hearts');
console.log('Yuni: mood hearts persist for the day');
process.exit(0);
