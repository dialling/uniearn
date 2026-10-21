const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const handler=require('../cloudfunctions/studentAccount/handler');
// Optimistic transactions retry when a concurrent commit changes the read snapshot.
// Use the actual production repository methods, not a mocked uniqueness check.
let records={},revision=0,repo,conflicts=0;
const clone=x=>structuredClone(x);
const command={set:value=>({replacement:value}),in:value=>({oneOf:value})};
function matches(row,where){return Object.entries(where).every(([k,v])=>{const actual=k.split('.').reduce((o,p)=>o&&o[p],row);return v&&v.oneOf?v.oneOf.includes(actual):actual===v;});}
const db={
 command,
 collection(){
  return {where(where){
   return {limit(){
    return {async get(){return {data:Object.entries(records).map(([_id,a])=>({_id,...clone(a)})).filter(a=>matches(a,where))};}};
   }};
  }};
 },
 async runTransaction(fn){
  for(let attempt=0;attempt<30;attempt++){
   const version=revision,copy=clone(records);let writes=false;
   const tx={collection:()=>({doc:id=>({
    get:async()=>{if(!copy[id])throw Error('not found');return{data:clone(copy[id])};},
    set:async({data})=>{copy[id]=clone(data);writes=true;},
    update:async({data})=>{if(!copy[id])throw Error('not found');for(const [k,v] of Object.entries(data))copy[id][k]=clone(v&&Object.hasOwn(v,'replacement')?v.replacement:v);writes=true;}
   })})};
   const result=await fn(tx);
   if(version!==revision){conflicts++;continue;}
   if(writes){records=copy;revision++;}
   return result;
  }
  throw Error('Too many test transaction retries');
 }
};
vm.runInNewContext(fs.readFileSync(require.resolve('../cloudfunctions/studentAccount/index.js'),'utf8'),{
 require:n=>n==='wx-server-sdk'?{init(){},database:()=>db}:n==='./handler'?{...handler,createHandler:opts=>{repo=opts.repo;return()=>{};}}:require(n),
 exports:{},process:{env:{}}
});
const profile={name:'Test Student',phone:'13800000000'};
const application={realName:'Test Student',gender:'male',phone:'13800000000',studentId:'2512345'};
const user=n=>handler.createHandler({getOpenId:()=>n,repo,env:{},now:()=>1000});
async function add(n){records[handler.idFor(n)]={profile:clone(profile)};}
(async()=>{
 await add('one');await add('two');
 const result=await Promise.all(['one','two'].map(n=>user(n)({action:'apply',application})));
 assert.equal(result.filter(r=>r.ok).length,1);
 assert.equal(result.find(r=>!r.ok).code,'STUDENT_ID_USED');
 assert.ok(conflicts>0,'the test must exercise concurrent transaction retry');
 const winner=result[0].ok?'one':'two',loser=winner==='one'?'two':'one',winId=handler.idFor(winner);
 assert.equal((await user(winner)({action:'apply',application})).ok,true,'same owner can update an application');
 const pending=clone(records[winId].verification);
 assert.equal(await repo.review(winId,pending,{...pending,status:'rejected'}),true);
 assert.equal((await user(loser)({action:'apply',application})).ok,true,'rejection releases the student ID for another account');
 const loserId=handler.idFor(loser),newPending=clone(records[loserId].verification);
 assert.equal(await repo.review(loserId,newPending,{...newPending,status:'verified'}),true);
 assert.equal((await user(winner)({action:'apply',application})).code,'STUDENT_ID_USED');
 // A logged-out account cannot commit an application prepared before logout.
 await add('logout');
 const logoutId=handler.idFor('logout'),expected=clone(records[logoutId]);
 records[logoutId].loggedOut=true;records[logoutId].authRevision=1;
 assert.equal(await repo.submitApplication(logoutId,expected,{...pending,studentId:'9999999'},1001),'APPLICATION_CHANGED');
 // Legacy duplicate pending rows cannot both be approved.
 const legacy={...pending,studentId:'8888888',status:'pending'};
 for(const n of ['legacy1','legacy2'])records[handler.idFor(n)]={profile:clone(profile),verification:clone(legacy)};
 const approvals=await Promise.all(['legacy1','legacy2'].map(n=>repo.review(handler.idFor(n),legacy,{...legacy,status:'verified'})));
 assert.equal(approvals.filter(Boolean).length,1);
 const admin=handler.createHandler({getOpenId:()=> 'reviewer',repo,env:{REVIEWER_OPENIDS:'reviewer'},now:()=>1000});
 const pendingLegacy=approvals[0]?'legacy2':'legacy1';
 assert.equal((await admin({action:'review',accountId:handler.idFor(pendingLegacy),decision:'approve'})).code,'STUDENT_ID_USED');
 console.log('Student reservation: concurrent applications/approvals, legacy duplicates, reapplication, rejection and logout passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
