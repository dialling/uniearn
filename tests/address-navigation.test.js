const assert=require('node:assert/strict'),fs=require('node:fs');
let definition,navigation,back;
global.Page=value=>definition=value;
global.wx={getStorageSync:()=>null,setStorageSync(){},showToast(){},showModal:options=>options.success({confirm:true}),navigateTo:options=>navigation=options,navigateBack:options=>back=options};
const store=require('../utils/store'),routes=require('../utils/saved-routes').forService('parcel');
function page(name,options={},events={}){
 delete require.cache[require.resolve('../pages/'+name+'/index')];require('../pages/'+name+'/index');
 const p={...definition,data:structuredClone(definition.data),getOpenerEventChannel:()=>({emit:(name,value)=>events[name]&&events[name](value)}),setData(patch){for(const [key,value] of Object.entries(patch)){const parts=key.split('.');let target=this.data;for(const part of parts.slice(0,-1))target=target[part];target[parts.at(-1)]=value;}}};
 if(p.onLoad)p.onLoad(options);if(p.onReady)p.onReady();return p;
}
(async()=>{
 store.reset();store.update(s=>{s.language='zh';s.profile={...s.profile,accountId:'student',onboarded:true,name:'同学',phone:'13800138000'};});
 const first=page('address-add');first.onShow();assert.equal(first.data.form.destinationType,'dorm','the first address starts in Dorms');
 const saved=routes.save({owner:'同学',phone:'13800138000',dorm:'D02',room:'1111',dormGender:'male'});
 const food=page('takeaway');food.manage();assert.match(navigation.url,/^\/pages\/address\/index\?pick=1/);
 const list=page('address',{pick:'1',selected:saved.id},navigation.events);list.onShow();
 assert.equal(list.data.list.length,1);assert.equal(list.data.selectedId,saved.id);assert.equal(list.data.form,undefined,'management has no address form');
 list.edit({currentTarget:{dataset:{id:saved.id}}});assert.match(navigation.url,/^\/pages\/address-edit\/index\?id=/);
 const editor=page('address-edit',{id:saved.id},navigation.events);editor.onShow();
 assert.equal(editor.data.editing,true);assert.equal(editor.data.form.destinationType,'dorm','editing keeps the saved address type');assert.equal(editor.data.form.room,'1111');assert.equal(editor.data.list,undefined);
 editor.setData({'form.room':'2222'});await editor.save();assert.equal(back.delta,1);assert.equal(routes.list().length,1);assert.equal(routes.list()[0].room,'2222');assert.equal(list.data.list[0].room,'2222');assert.equal(food.data.room,'2222','editing the selected address updates the order draft');
 food.edit();assert.equal(navigation.url,'/pages/address-add/index?mode=order','per-order edits reuse the built-in address form');
 const orderEdit=page('address-add',{mode:'order'},navigation.events);orderEdit.loadDraft({...food.draft(),name:food.data.routeName});orderEdit.onShow();assert.equal(orderEdit.data.orderMode,true);assert.equal(orderEdit.data.form.room,'2222');orderEdit.setData({'form.room':'3333'});await orderEdit.save();assert.equal(food.data.room,'3333','the edited address is applied to this order');assert.equal(routes.list()[0].room,'2222','per-order editing does not change the saved address');
 const cancel=page('address-edit',{id:saved.id});cancel.setData({'form.room':'not saved'});assert.equal(routes.list()[0].room,'2222','typing in edit does not change saved data');
 food.addAddress();assert.equal(navigation.url,'/pages/address-add/index');food.addOtherAddress();assert.equal(navigation.url,'/pages/address-add/index?type=place');
 const add=page('address-add',{},navigation.events);add.onShow();assert.equal(add.data.editing,false);assert.equal(add.data.form.destinationType,'place','additional addresses start in Other');add.chooseType({currentTarget:{dataset:{value:'dorm'}}});add.onShow();assert.equal(add.data.form.destinationType,'dorm','returning to the form keeps a manual tab selection');assert.equal(add.data.form.id,'');assert.equal(add.data.list,undefined);
 add.chooseType({currentTarget:{dataset:{value:'place'}}});add.setData({'form.name':'图书馆一楼前台','form.deliveryAddress':'图书馆前台'});await add.save();
 assert.equal(routes.list().length,2);assert.equal(food.data.deliveryAddress,'图书馆前台');assert.equal(food.data.routeId,routes.list()[1].id,'new address is selected after saving');assert.equal(back.delta,1);
 const parcel=page('create');parcel.manageAddresses();assert.match(navigation.url,/^\/pages\/address\/index\?pick=1/);parcel.addAddress();assert.equal(navigation.url,'/pages/address-add/index');parcel.addOtherAddress();assert.equal(navigation.url,'/pages/address-add/index?type=place');
 const parcelAdd=page('address-add',{},navigation.events);assert.equal(parcelAdd.data.form.destinationType,'place');
 list.add();assert.equal(navigation.url,'/pages/address-add/index');assert.equal(page('address-add').data.form.destinationType,'place');
 const listXml=fs.readFileSync(require.resolve('../pages/address/index.wxml'),'utf8');assert.doesNotMatch(listXml,/<input|<textarea|addr-form/);
 const formXml=fs.readFileSync(require.resolve('../utils/address-form.wxml'),'utf8');assert.doesNotMatch(formXml,/addr-list-head|我的常用地址/);
 for(const name of ['address-add','address-edit'])assert.match(fs.readFileSync(require.resolve('../pages/'+name+'/index.wxml'),'utf8'),/include src="\.\.\/\.\.\/utils\/address-form.wxml"/);
 for(const binding of formXml.matchAll(/(?:bind(?:tap|input|change)|catchtap)="(\w+)"/g))assert.equal(typeof add[binding[1]],'function',binding[1]);
 console.log('Address navigation: list/add/edit separation, selected-address updates, cancel isolation, direct add selection and both posting entrances passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
