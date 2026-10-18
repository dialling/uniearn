const assert=require('node:assert/strict');
global.wx={getStorageSync:()=>null,setStorageSync(){},showToast(){},pageScrollTo(){}};
global.Page=v=>{global.__page=v;};
const {DOC,TABS}=require('../pages/terms/index.js');
const store=require('../utils/store');

assert.equal(TABS.length,4,'four tabs: notice / terms / privacy / disclaimer');
for(const t of TABS){
  for(const lang of ['zh','en']){
    const doc=DOC[t.id][lang];
    assert.ok(doc&&doc.title&&doc.intro,'missing '+t.id+' '+lang);
    assert.ok(doc.sections.length>=5,'thin '+t.id+' '+lang);
    for(const s of doc.sections){
      assert.ok(s.h&&s.ps.length,'empty section in '+t.id+' '+lang);
      for(const p of s.ps)assert.ok(typeof p==='string'&&p.length>8,'short paragraph in '+t.id+' '+lang);
    }
  }
}
// the merged text must describe this app, not the other mini program or real payments
const all=JSON.stringify(DOC);
assert.ok(!all.includes('XP跑了么'),'no leftover brand from the other mini program');
assert.ok(!/提现到微信零钱|微信支付由平台托管/.test(all),'test build must not promise real payments');
assert.ok(all.includes('测试账本')&&all.includes('test ledger'),'test-ledger disclosure present in both languages');

// tab switching keeps the right language
store.reset();store.update(s=>s.language='zh');
const page={data:JSON.parse(JSON.stringify(global.__page.data)),setData(v){Object.assign(this.data,v);}};
global.__page.localize.call(page);
assert.equal(page.data.tabs[0].label,'用户须知');
global.__page.choose.call(page,{currentTarget:{dataset:{i:2}}});
assert.equal(page.data.doc.title,'UniEarn · 隐私政策');
store.update(s=>s.language='en');
global.__page.localize.call(page);
assert.equal(page.data.tabs[2].label,'Privacy policy');
assert.equal(page.data.doc.title,'UniEarn · Privacy policy');
console.log('Terms: 4 bilingual documents, no leftover brand, no real-payment promises, tab switching passed.');
