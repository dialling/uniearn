const assert=require('node:assert/strict'),fs=require('node:fs');
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
assert.deepEqual(calls.at(-1),['bg','#eeede8','#eeede8'],'light window background');
store.update(s=>{s.meAppearance='dark';});
assert.equal(appearance.isDark(),true);
appearance.apply();
assert.deepEqual(calls.at(-2),['nav','#ffffff','#1b1c1a'],'dark nav bar is dark with white text');
assert.deepEqual(calls.at(-1),['bg','#1b1c1a','#1b1c1a'],'dark window background');
let def;global.Component=d=>{def=d;};
require('../components/nav/index.js');
const inst={data:{...def.data},setData(v){Object.assign(this.data,v);},...def.methods};
inst.localize();
assert.equal(inst.data.dark,true,'bottom nav follows dark appearance');
assert.equal(inst.data.zh,true);
store.update(s=>{s.meAppearance='light';});
inst.localize();
assert.equal(inst.data.dark,false,'bottom nav returns to light');
// every page root carries the dark class binding (profile keeps its own me-dark)
for(const dir of fs.readdirSync("pages")){
  const xml=fs.readFileSync("pages/"+dir+"/index.wxml","utf8");
  if(dir==="profile"||dir==="invite")continue; // invite is always dark, so it skips the theme class
  assert.ok(xml.includes("{{darkClass}}"),"page root missing dark class: "+dir);
}
// apply(page) toggles the root class together with the nav colours
const page={value:null,setData(v){this.value=v.darkClass;}};
store.update(s=>{s.meAppearance="dark";});
appearance.apply(page);
assert.equal(page.value,"page-dark");
store.update(s=>{s.meAppearance="light";});
appearance.apply(page);
assert.equal(page.value,"");
console.log('Appearance: navigation bar, window background, bottom nav and page dark class follow light/dark passed.');
