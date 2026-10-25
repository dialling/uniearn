'use strict';
const assert=require('node:assert/strict');
const {createService,hash}=require('../cloudfunctions/adminService/core');
const {createRepository}=require('../cloudfunctions/adminService/repository');
const engine=require('../cloudfunctions/orderService/engine');
const clone=value=>JSON.parse(JSON.stringify(value));
function database(seed){
 let data=clone(seed);
 const api={command:{set:value=>value},collection(name){
  const query={sort:null,offset:0,count:100,orderBy(field,direction){this.sort=[field,direction];return this;},skip(value){this.offset=value;return this;},limit(value){this.count=value;return this;},async get(){let rows=Object.entries(data[name]||{}).map(([id,value])=>({_id:id,...clone(value)}));if(this.sort){const [key,dir]=this.sort;rows.sort((a,b)=>(a[key]>b[key]?1:a[key]<b[key]?-1:0)*(dir==='desc'?-1:1));}return{data:rows.slice(this.offset,this.offset+this.count)};},doc(id){return{
   async get(){if(!data[name]||!Object.hasOwn(data[name],id))throw Error('document not found');return{data:{...clone(data[name][id]),_id:id}};},
   async set({data:value}){data[name]||={};data[name][id]=clone(value);},
   async update({data:value}){if(!data[name]?.[id])throw Error('document not found');Object.assign(data[name][id],clone(value));},
   async remove(){if(data[name])delete data[name][id];}
  };}};return query;},async runTransaction(fn){const old=clone(data);try{return await fn(api);}catch(e){data=old;throw e;}},get data(){return data;}};
 return api;
}
async function main(){
 let clock=1800000000000;const student=hash('student'),runner=hash('runner'),other=hash('other');
 const state=engine.initial();
 state.members[student]={marks:[],supportTickets:[{id:'support-1',topic:'order',status:'open',createdAt:clock-1000,messages:[{text:'Where is my order?',mine:true,at:clock-1000}]}]};
 state.members[runner]={marks:[]};
 state.requests=[{id:'r1',ownerId:student,runnerId:'t1',status:'disputed',category:'takeout',reward:4,serviceFee:0,createdAt:clock-10000,deliveredAt:clock-2000,dispute:{reason:'Not received',at:clock-1000}}];
 state.trips=[{id:'t1',runnerAccountId:runner,requestIds:['r1']}];
 const db=database({uniearn_accounts:{[student]:{profile:{name:'Student',phone:'13800000000',dorm:'Wen Yuan D01'},verification:{status:'pending',studentId:'2512345',realName:'张三',gender:'male',phone:'13800000000',submittedAt:clock-1000},admin:{secret:'never-export'},adminLogin:{password:'never-export'}},[runner]:{profile:{name:'Runner'},verification:{status:'verified',studentId:'2512346'}},['student-'+hash('2512345')]:{ownerId:student}},uniearn_order_state:{'team-test':state},uniearn_admin_sessions:{},uniearn_admin_audit:{},uniearn_admin_meta:{}});
 const repo=createRepository(db,engine),env={ADMIN_ACCOUNTS:'boss:correct-password;helper:helper-password',ADMIN_ROLES:'{"helper":"support"}'};
 const service=createService({repo,env,now:()=>clock});
 const rejects=async(promise,code)=>assert.rejects(promise,e=>e.code===code);
 await rejects(service.run({action:'snapshot'}),'AUTH_REQUIRED');
 for(let i=0;i<5;i++)await rejects(service.run({action:'login',username:'boss',password:'incorrect'}),'ADMIN_INVALID');
 await rejects(service.run({action:'login',username:'boss',password:'correct-password'}),'ADMIN_LOCKED');
 clock+=15*60000+1;
 const admin=await service.run({action:'login',username:'boss',password:'correct-password'}),token=admin.token;
 assert.equal(admin.user.role,'admin');
 const snapshot=await service.run({action:'snapshot'},token);
 assert.equal(snapshot.data.accounts.length,2);assert.equal(snapshot.data.accounts.find(a=>a.id===student).verification.gender,'male');assert.equal(snapshot.data.requests[0].id,'r1');
 assert(!JSON.stringify(snapshot).includes('never-export'));assert(!JSON.stringify(snapshot).includes('correct-password'));
 const helper=await service.run({action:'login',username:'helper',password:'helper-password'});
 await rejects(service.run({action:'review',accountId:student,decision:'approve',submittedAt:clock,operationId:'helper_review_0001'},helper.token),'FORBIDDEN');
 await rejects(service.run({action:'export',operationId:'helper_export_0001'},helper.token),'FORBIDDEN');
 assert.equal((await service.run({action:'snapshot'},helper.token)).data.accounts[0].profile.phone,'');
 assert.equal((await service.run({action:'snapshot'},helper.token)).data.accounts.find(a=>a.id===student).verification.gender,'');
 const reply={action:'supportReply',accountId:student,ticketId:'support-1',text:'We are checking it.',operationId:'reply_operation_0001'};
 await service.run(reply,helper.token);await service.run(reply,helper.token);
 assert.equal(db.data.uniearn_order_state['team-test'].members[student].supportTickets[0].messages.length,2,'repeated operation does not duplicate the reply');
 await rejects(service.run({...reply,text:'Different text'},helper.token),'OPERATION_REUSED');
 assert.equal(db.data.uniearn_order_state['team-test'].revision,1);
 const submitted=db.data.uniearn_accounts[student].verification.submittedAt;
 await rejects(service.run({action:'review',accountId:student,decision:'approve',submittedAt:submitted+1,operationId:'review_changed_0001'},token),'REVIEW_CHANGED');
 assert.equal(db.data.uniearn_accounts[student].verification.status,'pending');
 await service.run({action:'review',accountId:student,decision:'approve',submittedAt:submitted,operationId:'review_current_0001'},token);
 assert.equal(db.data.uniearn_accounts[student].verification.status,'verified');
 await rejects(service.run({action:'review',accountId:student,decision:'reject',submittedAt:submitted,note:'Changed',operationId:'review_again_0001'},token),'REVIEW_CHANGED');
 db.data.uniearn_accounts[other]={profile:{name:'Other'},verification:{status:'pending',studentId:'2512345',submittedAt:submitted}};
 await rejects(service.run({action:'review',accountId:other,decision:'approve',submittedAt:submitted,operationId:'review_duplicate_0001'},token),'STUDENT_ID_USED');
 assert.equal(db.data.uniearn_accounts[other].verification.status,'pending');
 await service.run({action:'resolveDispute',id:'r1',decision:'refund',deduction:0,note:'The delivery could not be located after checking.',operationId:'dispute_refund_0001'},token);
 assert.equal(db.data.uniearn_order_state['team-test'].requests[0].status,'refunded');
 assert.equal(db.data.uniearn_order_state['team-test'].requests[0].refundAmount,4);
 await service.run({action:'addMark',accountId:runner,reason:'Late delivery',operationId:'runner_mark_0001'},token);
 const mark=db.data.uniearn_order_state['team-test'].members[runner].marks[0];assert.equal(mark.reason,'Late delivery');
 await service.run({action:'removeMark',accountId:runner,markId:mark.id,operationId:'runner_unmark_0001'},token);
 assert.equal(db.data.uniearn_order_state['team-test'].members[runner].marks.length,0);
 await service.run({action:'tag',kind:'member',id:student,tag:'Needs help',operationId:'member_tag_0001'},token);
 assert.deepEqual(db.data.uniearn_admin_meta.dashboard.annotations['member:'+student].tags,['Needs help']);
 await rejects(service.run({action:'wpay',operationId:'withdraw_0001'},token),'FORBIDDEN');
 assert(Object.values(db.data.uniearn_admin_audit).some(a=>a.action==='review'));
 // A manual mini-program application reaches the independent web backend's review queue.
 const {createHandler,idFor}=require('../cloudfunctions/studentAccount/handler');
 const applicant=idFor('manual-runner');db.data.uniearn_accounts[applicant]={profile:{name:'申请人',phone:'13700137000',universityId:'xjtlu',campusId:'sip'}};
 const applicantRepo={get:async id=>clone(db.data.uniearn_accounts[id]),patch:async(id,patch)=>Object.assign(db.data.uniearn_accounts[id],clone(patch)),findStudent:async sid=>Object.entries(db.data.uniearn_accounts).filter(([,a])=>a.verification?.studentId===sid&&['pending','verified'].includes(a.verification.status)).map(([id])=>id),findPhone:async phone=>Object.entries(db.data.uniearn_accounts).filter(([,a])=>a.verification?.phone===phone&&['pending','verified'].includes(a.verification.status)).map(([id])=>id),submitApplication:async(id,expected,verification,at)=>{Object.assign(db.data.uniearn_accounts[id],{verification:clone(verification),updatedAt:at});return '';}};
 const account=createHandler({getOpenId:()=>'manual-runner',repo:applicantRepo,env:{},now:()=>clock});
 const application={realName:'申请人',gender:'female',phone:'13700137000',studentId:'2512398'};
 const applied=await account({action:'apply',application});assert.equal(applied.ok,true,applied.error);assert.equal(applied.account.verification.status,'pending');assert.equal(db.data.uniearn_accounts[applicant].wechatPhone,undefined);assert.equal(db.data.uniearn_accounts[applicant].verification.phoneVerified,false);
 const queued=(await service.run({action:'snapshot'},token)).data.accounts.find(a=>a.id===applicant).verification;
 assert.deepEqual([queued.realName,queued.gender,queued.phone,queued.studentId],[application.realName,application.gender,application.phone,application.studentId]);
 assert.equal((await account({action:'agreeRules',accepted:true})).code,'NOT_VERIFIED','submitting the form never bypasses admin review');
 await service.run({action:'review',accountId:applicant,decision:'approve',submittedAt:queued.submittedAt,operationId:'manual_runner_review_0001'},token);
 assert.equal((await account({action:'status'})).account.verification.status,'verified');assert.equal((await account({action:'agreeRules',accepted:true})).account.runnerRulesAccepted,true);
 await service.run({action:'logout'},helper.token);await rejects(service.run({action:'snapshot'},helper.token),'AUTH_REQUIRED');
 env.ADMIN_ACCOUNTS='boss:changed-password';await rejects(service.run({action:'snapshot'},token),'AUTH_REQUIRED');
 const expired=await service.run({action:'login',username:'boss',password:'changed-password'});clock+=12*3600000+1;await rejects(service.run({action:'snapshot'},expired.token),'AUTH_REQUIRED');
 console.log('Independent admin: authentication, persistent lockout, server roles, secret redaction, idempotent replies, application conflicts, duplicate student IDs, test-ledger dispute, runner marks, audit and session revocation passed.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
