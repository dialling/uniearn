const assert=require('node:assert/strict');
const calls=[];
global.wx={getStorageSync:()=>null,setStorageSync(){},showToast(){},
  setNavigationBarColor(o){calls.push(['nav',o.frontColor,o.backgroundColor]);},
  setBackgroundColor(o){calls.push(['bg',o.backgroundColorTop,o.backgroundColorBottom]);}};
const store=require('../utils/store');
store.reset();
const appearance=require('../utils/appearance');
assert.equal(appearance.isDark(),false);
appearance.apply();
assert.deepEqual(calls.at(-2),['nav','#000000','#ffffff'],'light nav bar is white with black text');
assert.deepEqual(calls.at(-1),['bg','#f7f7f4','#f7f7f4'],'light window background');
store.update(s=>{s.meAppearance='dark';});
assert.equal(appearance.isDark(),true);
appearance.apply();
assert.deepEqual(calls.at(-2),['nav','#ffffff','#202522'],'dark nav bar is dark with white text');
assert.deepEqual(calls.at(-1),['bg','#202522','#202522'],'dark window background');
let def;global.Component=d=>{def=d;};
require('../components/nav/index.js');
const inst={data:{...def.data},setData(v){Object.assign(this.data,v);},...def.methods};
inst.localize();
assert.equal(inst.data.dark,true,'bottom nav follows dark appearance');
assert.equal(inst.data.zh,true);
store.update(s=>{s.meAppearance='light';});
inst.localize();
assert.equal(inst.data.dark,false,'bottom nav returns to light');
console.log('Appearance: navigation bar, window background and bottom nav follow light/dark passed.');
