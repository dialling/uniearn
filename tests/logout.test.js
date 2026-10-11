const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {createHandler}=require('../cloudfunctions/studentAccount/handler');
(async()=>{
 let record={profile:{name:'李明',phone:'13800000000'},verification:{status:'verified'},authRevision:0},repo,ocrCalls=0;
 const cloud={init(){},database:()=>({command:{set:value=>({__replace:value})},runTransaction:async fn=>fn({collection:()=>({doc:()=>({get:async()=>({data:record}),update:async({data})=>{for(const [key,value] of Object.entries(data)){if(value&&Object.prototype.hasOwnProperty.call(value,'__replace'))record[key]=value.__replace;else if(value&&typeof value==='object'&&record[key]===null)throw Object.assign(Error('Cannot create child field under null'),{errCode:-502001});else record[key]=value;}}})})})})};
 vm.runInNewContext(fs.readFileSync(require.resolve('../cloudfunctions/studentAccount/index'),'utf8'),{require:n=>n==='wx-server-sdk'?cloud:n==='./handler'?{createHandler:opts=>{repo=opts.repo;return()=>{};}}:require(n),exports:{},process:{env:{}}});
 repo.get=async()=>structuredClone(record);
 const card=['XJTLU','Ming Li','李明','2512345','STUDENT ID'].map(DetectedText=>({DetectedText,Confidence:99}));
 let block=false,ready,finish;
 const handle=createHandler({repo,getOpenId:()=> 'student',env:{STUDENT_HASH_SECRET:'a'.repeat(32)},loadImage:async()=> 'A'.repeat(32),deleteImage:async()=>{},ocr:async()=>{ocrCalls++;if(block)return new Promise(resolve=>{finish=resolve;ready();});return card;}});
 const r=await handle({action:'logout'});assert.equal(r.account.loggedOut,true);assert.equal(r.account.profile,null);assert.equal(r.account.verification.status,'unverified');
 assert.equal(record.profile.name,'李明');assert.equal(record.verification.status,'verified');
 assert.equal((await handle({action:'status'})).account.loggedOut,true);
 assert.equal((await handle({action:'saveProfile',profile:{}})).code,'LOGIN_REQUIRED');
 let prep=await handle({action:'prepareUpload'}),req={action:'scan',fileID:'cloud://env/'+prep.cloudPath,consent:true};
 assert.equal((await handle(req)).account.verification.status,'verified');assert.equal(ocrCalls,1);assert.equal(record.loggedOut,false);
 await handle({action:'logout'});block=true;
 const started=new Promise(resolve=>ready=resolve),scan=handle(req);await started;await handle({action:'logout'});finish(card);
 assert.equal((await scan).code,'SESSION_CHANGED');assert.equal(record.loggedOut,true);
 let def,confirm=false,logoutCalls=0,modal;
 const state={requests:[],profile:{name:'李明',onboarded:true,studentVerified:true,jobsDone:0}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../pages/profile/index.js'),'utf8'),{
 Page:v=>def=v,require:n=>n.includes('me-copy')?require('../utils/me-copy'):n.includes('package.json')?require('../package.json'):n.includes('store')?{get:()=>state}:n.includes('earnings')?{summary:()=>({})}:n.includes('domain')?{limit:()=>10}:n.includes('runner-level')?require('../utils/runner-level'):n.includes('yuni')?{stickers:()=>[]}:{call:async action=>{assert.equal(action,'logout');logoutCalls++;state.profile={loggedOut:true,onboarded:false};}},
 wx:{showModal:o=>{modal=o;o.success({confirm});}}
 });
 const page={...def,data:{...def.data},setData(v){Object.assign(this.data,v);}};
 await page.logout();assert.equal(logoutCalls,0);assert.equal(state.profile.studentVerified,true);assert.equal(page.data.loggingOut,false);
 confirm=true;await page.logout();assert.equal(logoutCalls,1);assert.equal(page.data.profile.loggedOut,true);assert.equal(page.data.editing,false);assert.equal(modal.cancelText,'Cancel');
 console.log('Logout cancel/confirm, persistent logged-out status, retained records, card re-login and stale scan guard passed.');
})().catch(e=>{console.error(e);process.exitCode=1});
