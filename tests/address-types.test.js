const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
Date.now=()=>Date.parse('2030-01-02T10:00:00+08:00');
let definition;const notices=[];
global.Page=value=>definition=value;
global.wx={getStorageSync:()=>null,setStorageSync(){},showToast:value=>notices.push(value.title),redirectTo(){},navigateBack(){}};
const store=require('../utils/store'),routes=require('../utils/saved-routes'),orders=require('../utils/orders');
const {harness}=require('./helpers/order-cloud'),h=harness();
function page(name){delete require.cache[require.resolve('../pages/'+name+'/index')];require('../pages/'+name+'/index');return {...definition,data:structuredClone(definition.data),setData(patch){for(const [key,value] of Object.entries(patch)){const keys=key.split('.');let target=this.data;for(const part of keys.slice(0,-1))target=target[part];target[keys.at(-1)]=value;}}};}
const event=value=>({currentTarget:{dataset:{value}}});
(async()=>{
 store.reset();store.update(s=>{s.language='zh';s.profile={...s.profile,...h.accounts[h.engine.idFor('customer')].profile,accountId:h.engine.idFor('customer'),onboarded:true};});
 let manager=page('address-add');manager.onLoad();manager.onShow();
 assert.equal(manager.data.form.destinationType,'dorm');
 manager.setData({'form.owner':'同学','form.phone':'13800138000','form.area':0,'form.room':'101'});manager.syncBuildings();manager.setData({'form.building':0});manager.chooseGender(event('male'));
 manager.chooseType(event('place'));manager.chooseGender(event('female'));manager.setData({'form.deliveryAddress':'图书馆一楼前台'});
 manager.chooseType(event('dorm'));assert.equal(manager.data.form.dormGender,'male');assert.equal(manager.data.form.building,0);assert.equal(manager.data.form.room,'101');
 manager.chooseType(event('place'));assert.equal(manager.data.form.recipientGender,'female');assert.equal(manager.data.form.deliveryAddress,'图书馆一楼前台');
 manager.setData({'form.deliveryAddress':'  '});await manager.save();assert.equal(routes.list().length,0);assert.match(notices.at(-1),/具体地点/);
 manager.setData({'form.deliveryAddress':'  图书馆一楼前台  '});await manager.save();
 const saved=routes.list()[0];assert.equal(saved.destinationType,'place');assert.equal(saved.deliveryAddress,'图书馆一楼前台');assert.equal(saved.recipientGender,'female');assert.equal(saved.dormGender,'');assert.equal(saved.room,'');assert.equal(saved.floor,0);assert.equal(saved.default,true);
 manager=page('address-edit');manager.onLoad({id:saved.id});manager.onShow();assert.equal(manager.data.form.destinationType,'place');assert.equal(manager.data.form.recipientGender,'female');
 manager.setData({'form.deliveryAddress':'图书馆东门'});await manager.save();assert.equal(routes.list().length,1);assert.equal(routes.list()[0].id,saved.id);assert.equal(routes.list()[0].deliveryAddress,'图书馆东门');
 const parcel=page('create');parcel.onLoad();const food=page('takeaway');food.onLoad();
 for(const form of [parcel.addressDraft(),food.draft()]){assert.equal(form.destinationType,'place');assert.equal(form.recipientGender,'female');assert.equal(form.deliveryAddress,'图书馆东门');}
 const originalAct=orders.act,originalUpload=orders.upload;orders.upload=async()=>'';
 orders.act=async(action,args)=>{const result=await h.call('customer',action,args);assert.equal(result.ok,true,result.error);return result.value;};
 parcel.setData({pickupPoint:'Parcel station',codes:['1-2-3456'],sizeOptions:parcel.data.sizeOptions.map((size,index)=>({...size,count:index===0?1:0}))});await parcel.post();
 food.customLocker({detail:{value:'图书馆外卖柜'}});await food.post();orders.act=originalAct;orders.upload=originalUpload;
 assert.equal(h.state.requests.length,2);
 for(const order of h.state.requests){assert.equal(order.recipientGender,'female');assert.equal(order.dormGender,'');assert.equal(order.deliveryAddress,'图书馆东门');assert.equal(order.room,'');}
 const other=await h.call('other','sync');for(const order of other.snapshot.publicJobs)assert.equal(order.recipientGender,undefined,'personal gender is not dorm classification');
 const xml=fs.readFileSync(require.resolve('../utils/address-form.wxml'),'utf8');
 assert.ok(xml.indexOf('addr-type-tabs')<xml.indexOf("zh?'姓名'"));
 for(const zh of [true,false])for(const destinationType of ['dorm','place']){const data={...manager.data,zh,darkClass:'',item:{...saved,phoneText:'138 0013 8000',place:'Library'},index:0,form:{...manager.data.form,destinationType}};for(const match of xml.matchAll(/\{\{(.*?)\}\}/gs))assert.notEqual(vm.runInNewContext(match[1],data),undefined,match[1]);}
 console.log('Address types: sliding selector, independent drafts, inline place save/edit, required location, shared posting, recipient gender and bilingual template expressions passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
