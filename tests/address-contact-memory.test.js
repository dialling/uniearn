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
 store.reset();store.update(s=>{s.language='zh';s.profile={...s.profile,accountId:'student',name:'个人资料姓名',phone:'13800138000'};});
 const firstForm=form();assert.equal(prompts.length,0);assert.equal(firstForm.data.form.destinationType,'dorm');
 const first=routes.save({owner:'首个地址姓名',phone:'13900139000',dormGender:'female',dorm:'D01',room:'101'});
 const second=routes.save({owner:'另一位收件人',phone:'13700137000',dormGender:'male',dorm:'D02',room:'202'});routes.setDefault(second.id);
 const add=form();assert.equal(prompts.length,1);assert.match(prompts[0].content,/首个地址姓名/);assert.equal(add.data.form.owner,'');assert.equal(add.data.form.phone,'');
 prompts[0].success({confirm:true});assert.equal(add.data.form.owner,first.owner);assert.equal(add.data.form.phone,first.phone);assert.equal(add.data.form.recipientGender,'female');assert.equal(add.data.form.destinationType,'place');assert.equal(add.data.form.deliveryAddress,'');assert.equal(add.data.form.room,'');
 add.chooseType({currentTarget:{dataset:{value:'dorm'}}});assert.equal(add.data.form.dormGender,'female');add.onShow();add.onReady();assert.equal(prompts.length,1,'the dialog appears once per new-address page');
 add.chooseType({currentTarget:{dataset:{value:'place'}}});add.setData({'form.owner':'自定义姓名','form.phone':'13600136000','form.deliveryAddress':'图书馆前台'});await add.save();assert.equal(routes.list().at(-1).owner,'自定义姓名');assert.equal(routes.list()[0].owner,first.owner,'reusing contacts never changes the original address');
 const manual=form();prompts.at(-1).success({cancel:true,confirm:false});assert.equal(manual.data.form.owner,'');assert.equal(manual.data.form.phone,'');assert.equal(manual.data.form.recipientGender,'');
 const count=prompts.length,edit=form(true,{id:first.id});assert.equal(prompts.length,count);assert.equal(edit.data.form.owner,first.owner);
 const stale=form(),oldPrompt=prompts.at(-1);store.update(s=>s.profile.accountId='different-user');oldPrompt.success({confirm:true});assert.equal(stale.data.form.owner,'');const separate=form();assert.equal(separate.data.form.destinationType,'dorm');assert.equal(prompts.at(-1),oldPrompt,'another account cannot reuse these saved addresses');
 store.update(s=>{s.profile.accountId='student';s.language='en';});routes.remove(first.id);routes.remove(second.id);const only=routes.list()[0];assert.equal(only.destinationType,'place');const english=form();assert.match(prompts.at(-1).title,/previous contact/);prompts.at(-1).success({confirm:true});assert.equal(english.data.form.dormGender,'female','Other gender maps correctly when later choosing Dorms');
 const closed=form(),closedPrompt=prompts.at(-1);closed.onUnload();closedPrompt.success({confirm:true});assert.equal(closed.data.form.owner,'');
 console.log('Address contact memory: first-address source, consent/manual entry, both gender types, editable copies, one prompt, edit exclusion, account isolation, closed-page guard and bilingual dialog passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
