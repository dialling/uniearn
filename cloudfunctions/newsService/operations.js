const safeError=message=>Object.assign(new Error(message),{safe:true});
const crypto=require('crypto');
const check=(ok,message)=>{if(!ok)throw safeError(message);};
const text=(v,max=500)=>String(v||'').trim().slice(0,max);
const maskName=v=>v?String(v).slice(0,1)+'**':'';
const maskPhone=v=>v?String(v).slice(0,3)+'****'+String(v).slice(-4):'';
const maskStudent=v=>v?'****'+String(v).slice(-4):'';
const accountRow=a=>({id:a._id,name:maskName(a.profile?.name),phone:maskPhone(a.profile?.phone),campus:a.profile?.campusId||'',analyticsClass:require('./analytics').klass(a),verification:a.verification?.status||'unverified',submittedAt:a.verification?.submittedAt||null,updatedAt:a.updatedAt||null});
const orderRow=r=>({id:r.id,category:r.category,status:r.status,title:text(r.title,80),station:r.station||'',reward:Number(r.reward)||0,serviceFee:Number(r.serviceFee)||0,discount:Number(r.discount)||0,createdAt:r.createdAt||null,caseStatus:r.adminCase?.status||'',caseNote:r.adminCase?.note||'',hasDispute:!!r.dispute,ownerId:r.ownerId||''});
function tickets(s){return Object.entries(s?.members||{}).flatMap(([accountId,m])=>(m.supportTickets||[]).map(t=>({...t,accountId}))).sort((a,b)=>b.createdAt-a.createdAt);}
function validatePromotions(value){
 check(value&&Array.isArray(value.campaigns)&&value.campaigns.length<=20,'最多配置 20 个活动。');
 const ids=new Set();const campaigns=value.campaigns.map(c=>{
  check(/^[a-zA-Z0-9_-]{2,40}$/.test(c.id||'')&&!ids.has(c.id),'活动标识重复或无效。');ids.add(c.id);
  check(typeof c.title==='string'&&c.title.trim()&&c.title.length<=100,'请填写活动名称。');
  check(Number.isFinite(c.max)&&c.max>0&&c.max<=100&&['delivery','total'].includes(c.kind),'优惠金额需大于 0 且不超过 100 元。');
  check(Number.isInteger(c.days)&&c.days>=1&&c.days<=365,'有效期需为 1–365 天。');
  for(const k of ['start','end'])if(c[k])check(Number.isFinite(Date.parse(c[k])),'活动时间格式不正确。');
  if(c.start&&c.end)check(Date.parse(c.start)<Date.parse(c.end),'结束时间需晚于开始时间。');
  if(c.hours)check(Array.isArray(c.hours)&&c.hours.length===2&&c.hours[0]>=0&&c.hours[1]<=24&&c.hours[0]<c.hours[1],'时段需在 0–24 点之间。');
  const out={id:c.id,title:text(c.title,100),titleZh:text(c.titleZh||c.title,100),short:text(c.short||c.title,40),face:c.face?text(c.face,20):'¥'+c.max,sub:text(c.sub||'off',30),description:text(c.description,300),descriptionZh:text(c.descriptionZh||c.description,300),max:c.max,kind:c.kind,days:c.days,enabled:c.enabled!==false,automatic:!!c.automatic,returning:!!c.returning,count:Math.min(10,Math.max(1,Number(c.count)||1))};
  for(const k of ['start','end','hours','daily','event','dailyOrderLimit','bannerLabel','headline','blurb'])if(c[k]!==undefined)out[k]=c[k];
  if(out.dailyOrderLimit)check(Number.isInteger(out.dailyOrderLimit)&&out.dailyOrderLimit>0&&out.dailyOrderLimit<=10000,'每日订单上限无效。');
  for(const k of ['bannerLabel','headline','blurb'])if(out[k])out[k]=text(out[k],300);
  return out;
 });
 const w=value.weekly,r=value.rush;
 check(w&&Number.isInteger(w.target)&&w.target>=1&&w.target<=100&&Number.isFinite(w.amount)&&w.amount>=0&&w.amount<=100,'每周奖励配置无效。');
 check(r&&Number.isFinite(r.amount)&&r.amount>=0&&r.amount<=100&&Array.isArray(r.hours)&&r.hours.length===2&&r.hours[0]>=0&&r.hours[1]<=24&&r.hours[0]<r.hours[1],'高峰奖励配置无效。');
 return {campaigns,weekly:{enabled:!!w.enabled,target:w.target,amount:w.amount},rush:{enabled:!!r.enabled,station:text(r.station,80),hours:r.hours,timeLabel:r.hours.join('–'),amount:r.amount}};
}
async function handleOperations({input,repo,actor,now=Date.now}){
 const at=now(),action=input.action,page=Number(input.page)||0;
 check(Number.isInteger(page)&&page>=0&&page<10000,'页码无效。');
 if(action==='opsAnalytics')return repo.analyticsReport(input,at);
 if(action==='opsAnalyticsClass'){await repo.classifyAnalytics(actor,text(input.id,80),input.value,input.reason,at);return {ok:true};}
 if(action==='opsFeedbackTrack'){
  const v=input.value||{};check(['order','payment','account','ocr','bug','suggestion','other','deletion'].includes(v.category),'请选择反馈分类。');
  check(['pending','watching','passed','reopened'].includes(v.verification),'验证状态无效。');
  if(v.verification==='passed')check(text(v.rootCause).length>=2&&text(v.resolution).length>=2,'复查通过前，请填写问题原因和解决方案。');
  await repo.changeState(actor,action,text(input.ticketId,80),s=>{const t=(s.members?.[input.accountId]?.supportTickets||[]).find(x=>x.id===input.ticketId);check(t,'反馈不存在。');t.tracking={category:v.category,owner:text(v.owner,60),orderId:text(v.orderId,60),version:text(v.version,40),rootCause:text(v.rootCause,300),resolution:text(v.resolution,300),verification:v.verification,updatedAt:at,resolvedAt:v.verification==='passed'?(t.tracking?.resolvedAt||at):null};},at);return {ok:true};
 }
 if(action==='opsOverview'){
  const [counts,state,archived]=await Promise.all([repo.counts(),repo.orderState(),repo.archiveCounts()]);
  const rows=state?.requests||[],completed=rows.filter(r=>r.status==='confirmed').length;
  return {ok:true,counts,orders:state?{active:rows.length,completed,waiting:rows.filter(r=>r.status==='waiting').length,exceptions:rows.filter(r=>r.dispute||r.adminCase&&r.adminCase.status!=='resolved').length,orderAmount:Math.round(rows.reduce((s,r)=>s+(Number(r.reward)||0)+(Number(r.serviceFee)||0),0)*100)/100}:null,archived,feedbackOpen:tickets(state).filter(t=>t.status==='open').length,payment:{connected:false,revenue:null},updatedAt:at};
 }
 if(action==='opsUsers'){const result=await repo.users(page,!!input.pending);return {ok:true,...result,items:result.items.map(accountRow),page};}
 if(action==='opsReveal'){
  check(text(input.reason).length>=4,'请填写至少 4 个字的查看原因。');
  const a=await repo.account(text(input.id,80));check(a&&a.profile,'用户不存在。');
  await repo.audit(actor,action,a._id,{reason:text(input.reason)},at);
  return {ok:true,profile:{name:a.profile.name||'',phone:a.profile.phone||''},verification:a.verification?{realName:a.verification.realName||a.verification.studentName||'',phone:a.verification.phone||'',studentId:a.verification.studentId||'',phoneVerified:!!a.verification.phoneVerified,status:a.verification.status,submittedAt:a.verification.submittedAt||null}:null};
 }
 if(action==='opsOrders'){
  if(input.archived){const result=await repo.archiveRows(page);return {ok:true,...result,items:result.items.map(orderRow),page};}
  const s=await repo.orderState();check(s,'订单数据尚未初始化。');return {ok:true,items:s.requests.map(orderRow),hasMore:false,page:0};
 }
 if(action==='opsCase'){
  check(['open','investigating','resolved'].includes(input.status)&&text(input.note).length>=2,'请选择处理状态并填写说明。');
  await repo.changeState(actor,action,text(input.id,80),s=>{const r=s.requests.find(x=>x.id===input.id);check(r,'订单已归档或不存在，请刷新。');r.adminCase={status:input.status,note:text(input.note),updatedAt:at,updatedBy:actor};},at);return {ok:true};
 }
 if(action==='opsFeedback'){const s=await repo.orderState();check(s,'订单数据尚未初始化。');return {ok:true,items:tickets(s)};}
 if(action==='opsReply'){
  check(text(input.text).length>0,'请填写回复内容。');
  await repo.changeState(actor,action,text(input.ticketId,80),s=>{const t=(s.members?.[input.accountId]?.supportTickets||[]).find(x=>x.id===input.ticketId);check(t&&t.status==='open','会话已关闭或不存在。');t.messages=t.messages||[];check(t.messages.length<500,'会话已达到消息上限。');t.messages.push({text:text(input.text),at,mine:false});if(input.close)t.status='closed';},at);return {ok:true};
 }
 if(action==='opsReview'){
  check(['approve','reject'].includes(input.decision),'审核决定无效。');check(input.decision!=='reject'||text(input.note).length>=2,'拒绝时请填写原因。');
  await repo.review(actor,input,at);return {ok:true};
 }
 if(action==='opsActivities')return {ok:true,...await repo.activities()};
 if(action==='opsSaveActivities'){const value=require('./activity-config').validate(input.value);await repo.saveActivities(actor,input.revision,value,at);return {ok:true};}
 if(action==='opsPromotions')return {ok:true,...await repo.promotions()};
 if(action==='opsSavePromotions'){const value=validatePromotions(input.value);await repo.savePromotions(actor,input.revision,value,at);return {ok:true};}
 if(action==='opsAudit'){const [result,members]=await Promise.all([repo.audits(page),repo.members()]);const names=Object.fromEntries(members.map(m=>[m._id,m.username]));return {ok:true,...result,items:result.items.map(a=>({...a,actorName:names[a.actor]||a.actor})),page};}
 if(action==='opsMembers')return {ok:true,items:(await repo.members()).map(a=>({id:a._id,username:a.username,disabled:!!a.disabled,createdAt:a.createdAt})),currentId:actor};
 if(action==='opsInvite'){
  const token=crypto.randomBytes(32).toString('base64url');await repo.createInvite(actor,token,at);return {ok:true,token,expiresAt:at+86400000};
 }
 if(action==='opsDisableMember'){check(input.id!==actor,'不能停用自己的账号。');await repo.disableMember(actor,text(input.id,80),!!input.disabled,at);return {ok:true};}
 throw safeError('Unknown operations action.');
}
module.exports={handleOperations,validatePromotions,accountRow,orderRow,tickets,maskName,maskPhone,maskStudent};
