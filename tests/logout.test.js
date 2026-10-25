const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {createHandler}=require('../cloudfunctions/studentAccount/handler');
(async()=>{
 let record={profile:{name:'李明',phone:'13800000000'},verification:{status:'verified'},authRevision:0},repo;
 const cloud={init(){},database:()=>({command:{set:value=>({__replace:value})},runTransaction:async fn=>fn({collection:()=>({doc:()=>({get:async()=>({data:record}),update:async({data})=>{for(const [key,value] of Object.entries(data)){if(value&&Object.prototype.hasOwnProperty.call(value,'__replace'))record[key]=value.__replace;else if(value&&typeof value==='object'&&record[key]===null)throw Object.assign(Error('Cannot create child field under null'),{errCode:-502001});else record[key]=value;}}})})})})};
 vm.runInNewContext(fs.readFileSync(require.resolve('../cloudfunctions/studentAccount/index'),'utf8'),{require:n=>n==='wx-server-sdk'?cloud:n==='./handler'?{createHandler:opts=>{repo=opts.repo;return()=>{};}}:require(n),exports:{},process:{env:{}}});
 repo.get=async()=>structuredClone(record);
 const handle=createHandler({repo,getOpenId:()=> 'student',env:{}});
 const r=await handle({action:'logout'});assert.equal(r.account.loggedOut,true);assert.equal(r.account.profile,null);assert.equal(r.account.verification.status,'unverified');
 assert.equal(record.profile.name,'李明');assert.equal(record.verification.status,'verified');
 assert.equal((await handle({action:'status'})).account.loggedOut,true);
 assert.equal((await handle({action:'saveProfile',profile:{}})).code,'LOGIN_REQUIRED');
 assert.equal((await handle({action:'apply',application:{realName:'李明',phone:'13800000000',studentId:'2512345'}})).code,'LOGIN_REQUIRED');
 assert.equal(record.authRevision,1);
 let def,confirm=false,logoutCalls=0,modal;
 const state={requests:[],profile:{name:'李明',onboarded:true,studentVerified:true,jobsDone:0}};
 // Only the store and the cloud call are faked; everything else loads for real,
 // so a new util inside refresh() cannot quietly break this test.
 const pageRequire=n=>{
  if(n.includes('package.json'))return require('../package.json');
  if(n==='../../utils/store')return {get:()=>state};
  if(n==='../../utils/account')return {call:async action=>{assert.equal(action,'logout');logoutCalls++;state.profile={loggedOut:true,onboarded:false};}};
  return require(require('path').resolve(__dirname,'../pages/profile',n));
 };
 // The page runs in a vm, but the utils it pulls in load for real, so they need
 // the same wx stub on the global object.
 const wxStub={getStorageSync:()=>null,setStorageSync(){},showModal:o=>{modal=o;o.success({confirm});}};
 global.wx=wxStub;
 vm.runInNewContext(fs.readFileSync(require.resolve('../pages/profile/index.js'),'utf8'),{
 Page:v=>def=v,require:pageRequire,
 wx:wxStub
 });
 const page={...def,data:{...def.data},setData(v){Object.assign(this.data,v);}};
 await page.logout();assert.equal(logoutCalls,0);assert.equal(state.profile.studentVerified,true);assert.equal(page.data.loggingOut,false);
 confirm=true;await page.logout();assert.equal(logoutCalls,1);assert.equal(page.data.profile.loggedOut,true);assert.equal(page.data.editing,false);assert.equal(modal.cancelText,'Cancel');
 console.log('Logout cancel/confirm, persistent logged-out status, retained records and logged-out application guard passed.');
})().catch(e=>{console.error(e);process.exitCode=1});
