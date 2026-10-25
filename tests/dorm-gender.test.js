const assert=require('node:assert/strict'),fs=require('node:fs');
const now=Date.parse('2030-01-02T10:00:00+08:00');Date.now=()=>now;
let definition;
global.Page=value=>definition=value;
global.wx={getStorageSync:()=>null,setStorageSync(){},showToast(){},redirectTo(){},navigateBack(){}};
const store=require('../utils/store'),routes=require('../utils/saved-routes'),orders=require('../utils/orders');
const {harness}=require('./helpers/order-cloud'),h=harness();
function page(name){delete require.cache[require.resolve('../pages/'+name+'/index')];require('../pages/'+name+'/index');return {...definition,data:structuredClone(definition.data),setData(patch){for(const [key,value] of Object.entries(patch)){const keys=key.split('.');let target=this.data;for(const part of keys.slice(0,-1))target=target[part];target[keys.at(-1)]=value;}}};}
(async()=>{
 store.reset();store.update(s=>{s.language='zh';s.profile={...s.profile,...h.accounts[h.engine.idFor('customer')].profile,accountId:h.engine.idFor('customer'),onboarded:true};});
 let manager=page('address-add');manager.onLoad();manager.onShow();
 manager.setData({'form.owner':'同学','form.phone':'13800138000','form.area':0,'form.room':'101'});manager.syncBuildings();manager.setData({'form.building':0});
 manager.chooseGender({currentTarget:{dataset:{value:'female'}}});await manager.save();
 const saved=routes.list()[0];assert.equal(saved.dormGender,'female');
 manager=page('address-edit');manager.onLoad({id:saved.id});manager.onShow();assert.equal(manager.data.form.dormGender,'female');
 manager.chooseGender({currentTarget:{dataset:{value:'male'}}});await manager.save();
 const updated=routes.list()[0];assert.equal(updated.dormGender,'male');assert.equal(updated.id,saved.id);
 const parcel=page('create');parcel.onLoad();assert.equal(parcel.data.dormGender,'male');assert.equal(parcel.addressDraft().dormGender,'male');
 const food=page('takeaway');food.onLoad();assert.equal(food.data.dormGender,'male');assert.equal(food.draft().dormGender,'male');
 assert.equal(routes.normalize({dorm:'D01'}).dormGender,'','old addresses do not gain a guessed gender');
 assert.equal(routes.normalize({...updated,destinationType:'place'}).dormGender,'');
 const originalAct=orders.act,originalUpload=orders.upload;
 orders.upload=async()=>'';
 orders.act=async(action,args)=>{const result=await h.call('customer',action,args);assert.equal(result.ok,true,result.error);return result.value;};
 parcel.setData({pickupPoint:'Parcel station',codes:['1-2-3456'],sizeOptions:parcel.data.sizeOptions.map((size,index)=>({...size,count:index===0?1:0}))});await parcel.post();
 food.pickLocker({detail:{value:0}});await food.post();
 orders.act=originalAct;orders.upload=originalUpload;
 assert.equal(h.state.requests.length,2,'both posting forms complete');
 for(const request of h.state.requests)assert.equal(request.dormGender,'male','posting preserves the selected address dorm gender');
 const view=await h.call('other','sync');
 assert.equal(view.snapshot.publicJobs.length,2);
 for(const request of view.snapshot.publicJobs)assert.equal(request.dormGender,'male','hall can filter before acceptance');
 for(const request of view.snapshot.requests){assert.equal(request.phone,'');assert.equal(request.room,'101');assert.equal(request.dormGender,'male');}
 const base={category:'takeout',owner:'同学',phone:'13800138000',station:'取餐点',dorm:'D01',room:'101',bags:1,price:3,arrived:true};
 const invalid=await h.call('customer','create',{data:{...base,dormGender:'unknown'}});assert.equal(invalid.ok,false);
 const xml=fs.readFileSync(require.resolve('../utils/address-form.wxml'),'utf8');assert.ok(xml.indexOf("zh?'姓名'")<xml.indexOf("zh?'性别'"));assert.ok(xml.indexOf("zh?'性别'")<xml.indexOf("zh?'电话'"));
 console.log('Dorm gender: address save/edit, shared parcel/takeaway posting, public filtering field, input validation and private contact redaction passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
