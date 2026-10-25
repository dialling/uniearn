const assert=require('node:assert/strict');let definition,navigation;
global.Page=value=>definition=value;
global.wx={getStorageSync:()=>null,setStorageSync(){},showToast(){},reLaunch:o=>navigation=o.url,navigateTo:o=>navigation=o.url,setNavigationBarColor(){},setNavigationBarTitle(){}};
const store=require('../utils/store'),account=require('../utils/account'),orders=require('../utils/orders');
function page(name,options={}){const path=require.resolve('../pages/'+name+'/index');delete require.cache[path];require(path);const p={...definition,data:structuredClone(definition.data),setData(v){Object.assign(this.data,v);}};if(p.onLoad)p.onLoad(options);return p;}
(async()=>{
 store.reset();store.update(s=>{s.profile={...s.profile,accountId:'owner',onboarded:true,dorm:'Old dorm',room:'Old room'};s.routes=[{accountId:'another',default:true,dorm:'Private dorm',room:'123'},{accountId:'owner',destinationType:'place',default:true,deliveryAddress:'Library'},{accountId:'owner',destinationType:'dorm',default:true,dorm:'D01',room:'412'}];});
 const me=page('profile');me.refresh();assert.equal(me.data.deliverySummary,'D01 · 412');assert.equal(me.edit,undefined);assert.equal(me.save,undefined);me.dormDetails();assert.equal(navigation,'/pages/address/index');
 store.update(s=>{s.routes=[];});me.refresh();assert.equal(me.data.deliverySummary,'Old dorm · Old room','legacy dorm details are still visible');
 store.update(s=>{s.profile={...s.profile,onboarded:false,loggedOut:true};});
 const invitation=page('invite',{invite:'INV123'});invitation.register();assert.equal(navigation,'/pages/welcome/index');assert.equal(store.get().pendingInviteCode,'INV123');
 account.call=async(action,args={})=>{if(action==='sessionLogin')store.update(s=>{s.profile={accountId:'new',onboarded:true,loggedOut:false,name:'',phone:''};});if(action==='selectCampus')store.update(s=>Object.assign(s.profile,{universityId:args.universityId,campusId:args.campusId}));return {ok:true};};
 orders.invalidate=()=>{};orders.sync=async()=>{};orders.bind=p=>p.refresh();
 const welcome=page('welcome');welcome.onShow();welcome.agree();await welcome.enter();assert.equal(navigation,'/pages/campus/index');
 const campus=page('campus');await campus.onShow();campus.selectSip();await campus.continueToJobs();assert.equal(navigation,'/pages/invite/index?invite=INV123');
 let redeemed;orders.act=async(action,args)=>{assert.equal(action,'invite');redeemed=args.code;return {bound:true};};
 const resumed=page('invite',{invite:'INV123'});resumed.onShow();await new Promise(resolve=>setImmediate(resolve));assert.equal(redeemed,'INV123');assert.equal(store.get().pendingInviteCode,undefined);
 console.log('Profile: no personal editor, scoped dorm address summary/management and invitation login → campus → binding without personal details passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
