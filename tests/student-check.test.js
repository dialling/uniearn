const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {createHandler,idFor,validateApplication}=require('../cloudfunctions/studentAccount/handler');
assert.equal(validateApplication({realName:'张三',gender:'male',phone:'13800000000',studentId:'2512345'}).value.studentId,'2512345');
assert.equal(validateApplication({realName:'张',gender:'female',phone:'13800000000',studentId:'2512345'}).code,'INVALID_NAME');
assert.equal(validateApplication({realName:'张三',gender:'male',phone:'1380000',studentId:'2512345'}).code,'INVALID_PHONE');
assert.equal(validateApplication({realName:'张三',gender:'female',phone:'13800000000',studentId:'25A'}).code,'INVALID_STUDENT_ID');
(async()=>{
 const records={};let clock=1000000;
 const orders=[{id:'1',status:'waiting',reward:4,createdAt:1},{id:'2',status:'delivered',reward:5,createdAt:2,phone:'13800000009',codes:['1-2-3']},{id:'3',status:'confirmed',reward:6,createdAt:3},{id:'4',status:'confirmed',reward:7,createdAt:4},{id:'5',status:'cancelled',reward:8,createdAt:5}];
 const repo={
  get:async id=>records[id]?structuredClone(records[id]):null,
  patch:async(id,v)=>{records[id]={...records[id],...structuredClone(v)};},
  submitApplication:async(id,expected,verification,updatedAt)=>{records[id]={...records[id],verification:structuredClone(verification),updatedAt};return '';},
  logout:async id=>{records[id].loggedOut=true;records[id].authRevision=(records[id].authRevision||0)+1;},
  findPhone:async ph=>Object.entries(records).filter(([,a])=>a.verification&&a.verification.phone===ph&&['pending','verified'].includes(a.verification.status)).map(([id])=>id),
  findStudent:async sid=>Object.entries(records).filter(([,a])=>a.verification&&a.verification.studentId===sid&&['pending','verified'].includes(a.verification.status)).map(([id])=>id),
  applications:async()=>Object.entries(records).filter(([,a])=>a.verification&&a.verification.status==='pending').map(([_id,a])=>({_id,...a})),
  accountCounts:async()=>{const all=Object.values(records);return {users:all.filter(a=>a.profile).length,runners:all.filter(a=>a.verification&&a.verification.status==='verified').length,pending:all.filter(a=>a.verification&&a.verification.status==='pending').length};},
  orderRequests:async()=>orders,
  review:async(id,expected,verification)=>{const v=records[id].verification;if(v.status!=='pending'||v.submittedAt!==expected.submittedAt)return false;records[id].verification=verification;return true;}
 };
 let caller='student';
 const handle=createHandler({getOpenId:()=>caller,repo,env:{ADMIN_USERNAME:'boss',ADMIN_PASSWORD:'correct-horse',ADMIN_ACCOUNTS:'ops:second-pass-1;short:1234567'},now:()=>clock});
 const app={realName:'张三',gender:'male',phone:'13800000000',studentId:'2512345'};
 assert.equal((await handle({action:'apply',application:app})).code,'LOGIN_REQUIRED');
 await handle({action:'saveProfile',profile:{name:'张三',phone:'13800000000'}});
 assert.equal((await handle({action:'apply',application:{...app,studentId:'x'}})).code,'INVALID_STUDENT_ID');
 let r=await handle({action:'apply',application:app});
 assert.equal(r.account.verification.status,'pending');assert.equal(r.account.verification.studentLast4,'2345');
 assert.ok(!JSON.stringify(r.account).includes('2512345'),'full student ID is not echoed to the client');
 assert.equal((await handle({action:'agreeRules',accepted:true})).code,'NOT_VERIFIED');
 caller='other';await handle({action:'saveProfile',profile:{name:'李四',phone:'13900000000'}});
 assert.equal((await handle({action:'apply',application:{...app,realName:'李四'}})).code,'STUDENT_ID_USED');
 r=await handle({action:'apply',application:{realName:'李四',gender:'female',phone:'13900000000',studentId:'2512346'}});assert.equal(r.account.verification.status,'pending');

 caller='student';
 assert.equal((await handle({action:'adminDashboard'})).code,'FORBIDDEN');
 assert.equal((await handle({action:'review',accountId:idFor('other'),decision:'approve'})).code,'FORBIDDEN');
 caller='admin';
 assert.equal((await handle({action:'adminStatus'})).admin,false);
 for(let i=0;i<4;i++)assert.equal((await handle({action:'adminLogin',username:'boss',password:'wrong'})).code,'ADMIN_INVALID');
 assert.equal((await handle({action:'adminLogin',username:'boss',password:'wrong'})).code,'ADMIN_INVALID');
 assert.equal((await handle({action:'adminLogin',username:'boss',password:'correct-horse'})).code,'ADMIN_LOCKED','five failures lock login');
 clock+=15*60000+1;
 assert.equal((await handle({action:'adminLogin',username:'boss',password:'correct-horse'})).admin,true);
 assert.equal((await handle({action:'adminStatus'})).admin,true);
 r=await handle({action:'adminDashboard'});
 assert.deepEqual(r.stats,{total:5,waiting:1,unpaid:1,completed:2,users:2,runners:0,pending:2});
 assert.equal(r.applications.length,2);assert.equal(r.applications.find(a=>a.accountId===idFor('student')).studentId,'2512345');
 const unpaid=await handle({action:'adminOrders',bucket:'unpaid'});assert.deepEqual(unpaid.orders.map(o=>o.id),['2']);
 assert.ok(!JSON.stringify(unpaid).includes('13800000009')&&!JSON.stringify(unpaid).includes('1-2-3'),'order list hides phone numbers and pickup codes');
 assert.deepEqual((await handle({action:'adminOrders',bucket:'all'})).orders.map(o=>o.id),['5','4','3','2','1']);
 assert.equal((await handle({action:'adminOrders',bucket:'nope'})).code,'INVALID_BUCKET');
 assert.equal((await handle({action:'review',accountId:idFor('student'),decision:'approve'})).ok,true);
 assert.equal((await handle({action:'review',accountId:idFor('other'),decision:'reject',note:'学号与姓名不符'})).ok,true);
 assert.equal((await handle({action:'review',accountId:idFor('other'),decision:'approve'})).code,'NOT_PENDING');
 assert.equal((await handle({action:'adminDashboard'})).stats.runners,1);
 caller='student';
 r=await handle({action:'status'});assert.equal(r.account.verification.status,'verified');
 assert.equal((await handle({action:'agreeRules',accepted:true})).account.runnerRulesAccepted,true);
 caller='other';r=await handle({action:'status'});assert.equal(r.account.verification.status,'rejected');assert.equal(r.account.verification.reason,'学号与姓名不符');
 assert.equal((await handle({action:'apply',application:{realName:'李四',gender:'male',phone:'13900000000',studentId:'2512347'}})).account.verification.status,'pending','rejected applicants can apply again');
 caller='admin';await handle({action:'adminLogout'});assert.equal((await handle({action:'adminDashboard'})).code,'FORBIDDEN');
 await handle({action:'adminLogin',username:'boss',password:'correct-horse'});await repo.patch(idFor('admin'),{authRevision:1});
 assert.equal((await handle({action:'adminStatus'})).admin,false,'signing in again ends the admin session');
 clock+=1;assert.equal((await handle({action:'adminLogin',username:'boss',password:'correct-horse'})).admin,true);clock+=12*3600000+1;
 assert.equal((await handle({action:'adminStatus'})).admin,false,'admin session expires');
 {const multi=createHandler({getOpenId:()=>'multi-admin',repo,env:{ADMIN_ACCOUNTS:'ops:second-pass-1;short:1234567'},now:()=>clock});assert.equal((await multi({action:'adminLogin',username:'ops',password:'second-pass-1'})).admin,true,'extra admin accounts can log in');assert.equal((await multi({action:'adminLogin',username:'short',password:'1234567'})).code,'ADMIN_INVALID','passwords under 8 characters are ignored');assert.equal((await multi({action:'adminLogin',username:'ops',password:'correct-horse'})).code,'ADMIN_INVALID','passwords do not cross accounts');}
 const noSetup=createHandler({getOpenId:()=>'admin',repo,env:{},now:()=>clock});
 assert.equal((await noSetup({action:'adminLogin',username:'',password:''})).code,'ADMIN_SETUP');
 assert.equal((await noSetup({action:'scan'})).code,'INVALID_ACTION','student-card scanning is removed');
 caller='third';await handle({action:'saveProfile',profile:{name:'王五',phone:'13700000000'}});
 assert.equal((await handle({action:'apply',application:{realName:'王五',gender:'male',phone:'13800000000',studentId:'2512399'}})).code,'PHONE_USED','a runner phone cannot be reused by another account');
 await handle({action:'apply',application:{realName:'王五',gender:'male',phone:'13700000000',studentId:'2512399'}});assert.equal(records[idFor('third')].verification.phoneVerified,false);assert.equal(records[idFor('third')].verification.phoneSource,'manual');
 await repo.patch(idFor('third'),{wechatPhone:'13700000000'});r=await handle({action:'apply',application:{realName:'王五',gender:'male',phone:'13700000000',studentId:'2512399'}});assert.equal(records[idFor('third')].verification.phoneVerified,true);assert.equal(r.account.verification.phoneVerified,true);assert.equal(r.account.wechatPhone,'13700000000');
 caller='';assert.equal((await handle()).code,'AUTH_REQUIRED');
 console.log('Runner application: validation, unique student ID, admin login lockout and session, dashboard counts, private order list, approve/reject and re-apply passed.');

 let def,calls=[];
 const state={language:'zh',requests:[],profile:{name:'张三',phone:'13800000000',onboarded:true,jobsDone:0}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../pages/student-check/index.js'),'utf8'),{
  Page:v=>def=v,wx:{},
  require:n=>n.includes('china-time')?require('../utils/china-time'):n.includes('store')?{get:()=>state,update:fn=>fn(state)}:n.includes('domain')?{limit:()=>10,boxes:()=>1}:n.includes('runner-level')?require('../utils/runner-level'):{call:async(action,args)=>{calls.push({action,...args});return {account:{id:'x',profile:state.profile,verification:action==='apply'?{status:'pending',studentName:'张三',studentLast4:'2345',submittedAt:1}:{status:'unverified'}}};}}
 });
 const page={...def,data:structuredClone(def.data),setData(v){for(const [k,val] of Object.entries(v)){const parts=k.split('.');let t=this.data;parts.slice(0,-1).forEach(p=>t=t[p]);t[parts.at(-1)]=val;}}};
 await page.onShow();assert.equal(page.data.stage,'apply');assert.equal(page.data.form.realName,'张三');assert.equal(page.data.form.phone,'13800000000');
 await page.submit();assert.match(page.data.error,/性别/);assert.equal(calls.filter(c=>c.action==='apply').length,0);page.chooseGender({currentTarget:{dataset:{gender:'female'}}});await page.submit();assert.match(page.data.error,/学号/);assert.equal(calls.filter(c=>c.action==='apply').length,0);
 page.field({currentTarget:{dataset:{field:'studentId'}},detail:{value:'2512345'}});await page.submit();
 assert.deepEqual(JSON.parse(JSON.stringify(calls.at(-1))),{action:'apply',application:{realName:'张三',gender:'female',phone:'13800000000',studentId:'2512345'}});assert.equal(page.data.stage,'pending');assert.equal(page.data.busy,false);
 page.reapply();assert.equal(page.data.stage,'apply');
 console.log('Student check page: prefilled form, client validation, submit to pending and edit again passed.');
})().catch(e=>{console.error(e);process.exitCode=1});
