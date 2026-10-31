const assert=require('node:assert/strict');
let definition;const prompts=[];
global.Page=value=>definition=value;
global.wx={getStorageSync:()=>null,setStorageSync(){},showModal:options=>prompts.push(options),showToast(){},navigateBack(){}};
const store=require('../utils/store'),routes=require('../utils/saved-routes').forService('parcel');
function form(editing=false,options={}){
 const name=editing?'address-edit':'address-add';delete require.cache[require.resolve('../pages/'+name+'/index')];require('../pages/'+name+'/index');
 const p={...definition,data:structuredClone(definition.data),setData(patch){for(const [key,value]of Object.entries(patch)){const parts=key.split('.');let target=this.data;for(const part of parts.slice(0,-1))target=target[part];target[parts.at(-1)]=value;}}};
 p.onLoad(options);p.onShow();p.onReady();return p;
}
(async()=>{
 store.reset();store.update(s=>{s.language='zh';s.profile={...s.profile,accountId:'student',name:'个人资料姓名',phone:'13800138000',verification:{gender:'female'}};});
 const firstForm=form();assert.equal(prompts.length,0);assert.equal(firstForm.data.form.destinationType,'dorm');assert.equal(firstForm.data.form.owner,'个人资料姓名');assert.equal(firstForm.data.form.phone,'13800138000');
 const first=routes.save({owner:'首个地址姓名',phone:'13900139000',dormGender:'female',dorm:'D01',room:'101'});
 const second=routes.save({owner:'另一位收件人',phone:'13700137000',dormGender:'male',dorm:'D02',room:'202'});routes.setDefault(second.id);
 const add=form(false,{type:'place'});assert.equal(prompts.length,0);assert.equal(add.data.form.destinationType,'place');assert.equal(add.data.form.owner,'个人资料姓名');assert.equal(add.data.form.phone,'13800138000');assert.equal(add.data.form.recipientGender,'female');assert.equal(add.data.phoneText,'138 0013 8000');assert.equal(add.data.form.deliveryAddress,'');assert.equal(add.data.form.room,'');
 add.setData({'form.name':'图书馆北门1号门','form.deliveryAddress':'图书馆北门前台'});await add.save();const saved=routes.list().at(-1);assert.equal(saved.name,'图书馆北门1号门');assert.equal(saved.owner,'个人资料姓名');assert.equal(saved.phone,'13800138000');assert.equal(routes.list()[0].owner,first.owner,'automatic contacts never change an existing address');
 const count=prompts.length,edit=form(true,{id:first.id});assert.equal(prompts.length,count);assert.equal(edit.data.form.owner,first.owner);
 store.update(s=>{s.profile.accountId='different-user';s.profile.name='另一账户';s.profile.phone='13600136000';});const separate=form(false,{type:'place'});assert.equal(separate.data.form.owner,'另一账户');assert.equal(separate.data.form.phone,'13600136000');assert.equal(separate.data.form.destinationType,'place');
 console.log('Other-address contact autofill: profile name, gender and phone, specific address name, edit preservation and account isolation passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
