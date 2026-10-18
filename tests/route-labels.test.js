const assert=require('node:assert/strict');
let definition;
global.Page=x=>definition=x;
global.wx={getStorageSync:()=>null,setStorageSync(){},showToast(){},navigateBack(){},navigateTo(){},showModal(o){o.success&&o.success({confirm:false});},setNavigationBarTitle(){}};
const store=require('../utils/store');
function page(name,args){delete require.cache[require.resolve('../pages/'+name+'/index')];require('../pages/'+name+'/index');const p={...definition,data:structuredClone(definition.data)};p.setData=function(v){for(const k of Object.keys(v))this.data[k]=v[k];};if(p.onLoad)p.onLoad(args||{});return p;}
store.reset();store.update(s=>{s.language='zh';s.profile={...s.profile,name:'Ming Li',accountId:'a',onboarded:true};});
const editor=page('route-edit',{service:'takeaway',type:'dorm'});
assert.equal(editor.data.dormLabels.length,31,'the building picker lists all 31 real buildings');
assert.equal(editor.data.dormLabels[0],'文缘 D01');
assert.equal(editor.data.stationLabels[0],'北门');
assert.ok(editor.data.stationLabels.includes('文缘菜鸟驿站'),'real pickup points are listed in Chinese');
assert.equal(editor.data.form.dorm,'D01','a dorm route defaults to the first real building');
store.update(s=>{s.language='en';});
editor.localize();
assert.equal(editor.data.dormLabels[0],'Wenyuan D01');
assert.equal(editor.data.stationLabels[0],'North gate');
console.log('Route editor: real building and pickup labels follow the language passed.');
