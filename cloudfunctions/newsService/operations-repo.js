const safeError=message=>Object.assign(new Error(message),{safe:true});
const crypto=require('crypto'),auth=require('./auth'),defaults=require('./promotions-default');
const missing=e=>/not exist|not found|does not exist/i.test(e.message||'')||e.errCode===-502005||e.code===-502005;
const clean=x=>{const v=JSON.parse(JSON.stringify(x));delete v._id;return v;};
module.exports=function operationsRepo(db){
 const col='uniearn_news',accounts='uniearn_accounts',stateCol='uniearn_order_state',analytics=require('./analytics-repo')(db);
 async function read(tx,c,id){try{return (await tx.collection(c).doc(id).get()).data||null;}catch(e){if(missing(e))return null;throw e;}}
 const log=async(tx,actor,action,target,detail,at)=>tx.collection(col).doc('audit-'+at+'-'+crypto.randomBytes(8).toString('hex')).set({data:{kind:'audit',actor,action,target,detail,at}});
 const guardState=s=>{if(!s||!Array.isArray(s.requests)||!s.members)throw safeError('订单数据尚未初始化。');};
 return {
  account:id=>read(db,accounts,id),getStaff:id=>read(db,col,id),
  async logoutSession(actor,expectedKey,at){return db.runTransaction(async tx=>{const a=await read(tx,col,actor);if(!a||a.tokenKey!==expectedKey)throw safeError('登录状态已更新。');await tx.collection(col).doc(actor).update({data:{tokenKey:crypto.randomBytes(32).toString('hex')}});await log(tx,actor,'sessionLogout',actor,{},at);});},
  async changePassword(actor,expected,record,at){return db.runTransaction(async tx=>{const a=await read(tx,col,actor);if(!a||a.disabled||a.passwordHash!==expected||a.lockedUntil>at)throw safeError('账号状态已变化，请重新登录后重试。');await tx.collection(col).doc(actor).update({data:{salt:record.salt,passwordHash:record.passwordHash,tokenKey:record.tokenKey,fails:0,lockedUntil:0,passwordChangedAt:at}});await log(tx,actor,'passwordChanged',actor,{},at);});},
  async findStaff(username){const rows=(await db.collection(col).where({kind:'member',username}).limit(1).get()).data;return rows[0]||null;},
  async staffLogin(id,accepted,at){return db.runTransaction(async tx=>{const a=await read(tx,col,id);if(!a||a.disabled||a.lockedUntil>at)return {ok:false,error:'账号已停用或暂时锁定。'};const fails=accepted?0:(a.fails||0)+1;await tx.collection(col).doc(id).update({data:{fails:fails>=5?0:fails,lockedUntil:fails>=5?at+900000:0}});return {ok:true};});},
  async counts(){const count=async q=>(await db.collection(accounts).where(q).count()).total;const [users,runners,pending]=await Promise.all([count({profile:db.command.exists(true)}),count({'verification.status':'verified'}),count({'verification.status':'pending'})]);return {users,runners,pending};},
  orderState:()=>read(db,stateCol,'team-test'),
  async users(page,pending){const q=pending?{'verification.status':'pending'}:{profile:db.command.exists(true)};const c=db.collection(accounts).where(q);const [r,n]=await Promise.all([c.skip(page*50).limit(50).get(),db.collection(accounts).where(q).count()]);return {items:r.data,total:n.total,hasMore:(page+1)*50<n.total};},
  async archiveCounts(){const fresh=await analytics.newArchiveCounts();try{const c=db.collection('uniearn_order_archive');const [n,d]=await Promise.all([c.count(),c.where({status:'confirmed'}).count()]);return {available:true,total:n.total+fresh.total,completed:d.total+fresh.completed};}catch(e){if(missing(e))return {available:true,...fresh};throw e;}},
  async archiveRows(page){let total=0,items=[];try{total=(await db.collection('uniearn_order_archive').count()).total;if(page*50<total)items=(await db.collection('uniearn_order_archive').orderBy('_id','asc').skip(page*50).limit(51).get()).data;}catch(e){if(!missing(e))throw e;}if(items.length<51)items.push(...await analytics.newArchiveRows(Math.max(0,page*50-total),51-items.length));return {items:items.slice(0,50),hasMore:items.length>50};},
  audit:(actor,action,target,detail,at)=>log(db,actor,action,target,detail,at),
  async changeState(actor,action,target,change,at){return db.runTransaction(async tx=>{const s=await read(tx,stateCol,'team-test');guardState(s);change(s);s.revision=(s.revision||0)+1;const data=clean(s);if(Buffer.byteLength(JSON.stringify(data))>850000)throw safeError('订单存储空间不足，请先归档。');await tx.collection(stateCol).doc('team-test').set({data});await log(tx,actor,action,target,{},at);});},
  async review(actor,input,at){
   if(input.decision==='approve'){
    const current=await read(db,accounts,String(input.id||''));
    if(current?.verification?.studentId){const duplicates=(await db.collection(accounts).where({'verification.studentId':current.verification.studentId,'verification.status':db.command.in(['pending','verified'])}).limit(20).get()).data;if(duplicates.some(a=>a._id!==input.id))throw safeError('该学号存在其他申请或认证，请先核实重复记录。');}
   }
   return db.runTransaction(async tx=>{
   const id=String(input.id||'');if(!/^[a-f0-9]{64}$/.test(id))throw safeError('用户标识无效。');
   const a=await read(tx,accounts,id),v=a?.verification;if(!v||v.status!=='pending'||v.submittedAt!==input.submittedAt)throw safeError('申请已变化，请刷新后重新审核。');
   if(input.decision==='approve'){
    const lockId='student-'+auth.hash(v.studentId),lock=await read(tx,accounts,lockId);
    if(lock&&lock.ownerId!==id){const other=await read(tx,accounts,lock.ownerId);if(other?.verification?.studentId===v.studentId&&['pending','verified'].includes(other.verification.status))throw safeError('该学号已被其他申请占用。');}
    await tx.collection(accounts).doc(lockId).set({data:{ownerId:id}});
   }
   const note=String(input.note||'').trim().slice(0,500);const next={...v,status:input.decision==='approve'?'verified':'rejected',checkedAt:at,reviewerId:actor,reviewNote:note,reason:input.decision==='reject'?note:''};
   await tx.collection(accounts).doc(id).update({data:{verification:db.command.set(next)}});await log(tx,actor,'opsReview',id,{decision:input.decision,note},at);
  });},
  async promotions(){const d=await read(db,col,'promotion-config');return {revision:d?.revision||0,value:d?.value||defaults};},
  async savePromotions(actor,revision,value,at){return db.runTransaction(async tx=>{const d=await read(tx,col,'promotion-config');if(revision!==(d?.revision||0))throw safeError('活动配置已被其他成员修改，请刷新。');await tx.collection(col).doc('promotion-config').set({data:{revision:revision+1,value,updatedAt:at}});await log(tx,actor,'opsSavePromotions','promotion-config',{},at);});},
  async audits(page){const c=db.collection(col).where({kind:'audit'});const r=await c.orderBy('at','desc').skip(page*50).limit(51).get();return {items:r.data.slice(0,50),hasMore:r.data.length>50};},
  async members(){const [owner,rows]=await Promise.all([read(db,col,'admin'),db.collection(col).where({kind:'member'}).limit(100).get()]);return [...(owner?[{...owner,_id:'admin'}]:[]),...rows.data];},
  async createInvite(actor,token,at){await db.runTransaction(async tx=>{await tx.collection(col).doc('invite-'+auth.hash(token)).set({data:{kind:'invite',expiresAt:at+86400000,createdBy:actor,createdAt:at}});await log(tx,actor,'opsInvite','member-invite',{},at);});},
  async claimInvite(token,record,at){return db.runTransaction(async tx=>{
   const ref=tx.collection(col).doc('invite-'+auth.hash(token)),invite=await read(tx,col,'invite-'+auth.hash(token));if(!invite||invite.usedAt||invite.expiresAt<=at)throw safeError('邀请已失效或已使用。');
   const id='member-'+auth.hash(record.username);const existing=await read(tx,col,id),owner=await read(tx,col,'admin');if(existing||owner?.username===record.username)throw safeError('该账号已存在。');
   await tx.collection(col).doc(id).set({data:{...record,kind:'member'}});await ref.update({data:{usedAt:at}});await log(tx,id,'memberJoined',id,{},at);return id;
  });},
  async disableMember(actor,id,disabled,at){if(id==='admin')throw safeError('首次设置账号需保留，以便恢复后台。');if(!id.startsWith('member-'))throw safeError('成员不存在。');await db.runTransaction(async tx=>{const a=await read(tx,col,id);if(!a||a.kind!=='member')throw safeError('成员不存在。');await tx.collection(col).doc(id).update({data:{disabled,tokenKey:crypto.randomBytes(32).toString('hex')}});await log(tx,actor,'opsDisableMember',id,{disabled},at);});}
 };
};
