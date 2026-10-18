const cloud=require('wx-server-sdk');
cloud.init({env:cloud.DYNAMIC_CURRENT_ENV});
const db=cloud.database(), _=db.command, collection='uniearn_accounts';
const {createHandler}=require('./handler');
const missing=e=>/not exist|not found|does not exist/i.test(e.message||'');
const repo={
  async logout(id){return db.runTransaction(async tx=>{
    const ref=tx.collection(collection).doc(id),a=(await ref.get()).data;
    await ref.update({data:{loggedOut:true,authRevision:(a.authRevision||0)+1}});
  });},
  async review(id,expected,verification){return db.runTransaction(async tx=>{const ref=tx.collection(collection).doc(id),a=(await ref.get()).data,v=a.verification;if(!v||v.status!=='pending'||v.submittedAt!==expected.submittedAt||v.studentId!==expected.studentId)return false;await ref.update({data:{verification:_.set(verification)}});return true;});},
  async get(id){const r=await db.collection(collection).where({_id:id}).limit(1).get();return r.data[0]||null;},
  async patch(id,patch){await db.runTransaction(async tx=>{const ref=tx.collection(collection).doc(id);let old;try{old=(await ref.get()).data;}catch(e){if(!missing(e))throw e;}const data={...(old||{}),...patch};delete data._id;await ref.set({data});});},
  async findStudent(studentId){const r=await db.collection(collection).where({'verification.studentId':studentId,'verification.status':_.in(['pending','verified'])}).limit(20).get();return r.data.map(a=>a._id);},
  async applications(limit){const r=await db.collection(collection).where({'verification.status':'pending'}).orderBy('verification.submittedAt','asc').limit(limit).get();return r.data;},
  async accountCounts(){
    const count=async where=>(await db.collection(collection).where(where).count()).total;
    const [users,runners,pending]=await Promise.all([count({profile:_.exists(true)}),count({'verification.status':'verified'}),count({'verification.status':'pending'})]);
    return {users,runners,pending};
  },
  async archivedCounts(){try{const archive=db.collection('uniearn_order_archive');const [total,completed]=await Promise.all([archive.count(),archive.where({status:'confirmed'}).count()]);return {total:total.total,completed:completed.total};}catch(e){if(/not exist|not found|-502005/i.test(String(e.message||e.errCode||'')))return {total:0,completed:0};throw e;}},
  async orderRequests(){try{const d=(await db.collection('uniearn_order_state').doc('team-test').get()).data;return Array.isArray(d&&d.requests)?d.requests:[];}catch(e){if(missing(e))return [];throw e;}}
};
const accountHandler=createHandler({getOpenId:()=>cloud.getWXContext().OPENID,repo,env:process.env});

exports.main=async event=>{if(event?.action==='wechatLogin'){try{const openid=cloud.getWXContext().OPENID;if(!openid||!event.code)throw Error('Use the phone authorization button in WeChat.');const id=require('./handler').idFor(openid),a=await repo.get(id)||{};const res=await cloud.openapi.phonenumber.getPhoneNumber({code:event.code});const phone=res.phoneInfo?.purePhoneNumber;if(!/^1\d{10}$/.test(phone||''))throw Error('A mainland mobile number is needed for campus deliveries.');const profile={...(a.profile||{}),name:String(a.profile?.name||event.name||'Student').slice(0,60),phone,wechatPhone:phone};await repo.patch(id,{profile,loggedOut:false,authRevision:(a.authRevision||0)+1,updatedAt:Date.now()});return {ok:true,account:require('./handler').publicAccount({...a,profile,loggedOut:false},id)};}catch(e){return {ok:false,error:e.message||'WeChat phone authorization is unavailable. Use manual registration.'};}}return accountHandler(event);};
