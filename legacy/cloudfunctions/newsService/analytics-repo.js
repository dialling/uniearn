const crypto=require('crypto'),a=require('./analytics');
const missing=e=>/not exist|not found|does not exist/i.test(e.message||'')||e.errCode===-502005||e.code===-502005;
module.exports=function(db){
 const col='uniearn_news',read=async(tx,c,id)=>{try{return (await tx.collection(c).doc(id).get()).data||null;}catch(e){if(missing(e))return null;throw e;}};
 async function bounded(collection,query,limit=400){
  try{const pages=await Promise.all(Array.from({length:Math.ceil(limit/100)},(_,i)=>db.collection(collection).where(query).skip(i*100).limit(100).get()));const rows=pages.flatMap(p=>p.data);return {rows,partial:rows.length>=limit};}catch(e){if(missing(e))return {rows:[],missing:true,partial:false};throw e;}
 }
 return {
  async ingestAnalytics(openid,input,now){
   if(!Array.isArray(input.events)||input.events.length>12||JSON.stringify(input).length>12000)return {ok:false,error:'Invalid event batch.'};
   const events=input.events.map(e=>a.sanitize(e,now)).filter(Boolean);if(!events.length)return {ok:true,accepted:0};
   const actor=crypto.createHash('sha256').update(openid).digest('hex'),day=Math.floor((now+28800000)/a.DAY)*a.DAY-28800000;
   return db.runTransaction(async tx=>{
    const account=await read(tx,'uniearn_accounts',actor);if(account?.loggedOut)return {ok:true,accepted:0};
    const id='analytics-'+day+'-'+actor,old=await read(tx,col,id)||{kind:'analyticsDay',day,actor,campus:['sip','taicang'].includes(account?.profile?.campusId)?account.profile.campusId:'',events:[]};
    if(!old.campus&&['sip','taicang'].includes(account?.profile?.campusId))old.campus=account.profile.campusId;
    const seen=new Set(old.events.map(e=>e.id)),fresh=events.filter(e=>!seen.has(e.id)&&seen.add(e.id)),room=Math.max(0,500-old.events.length);
    if(fresh.length&&(room||!old.capped)){old.events.push(...fresh.slice(0,room));old.capped=old.capped||fresh.length>room;old.updatedAt=now;const data={...old};delete data._id;await tx.collection(col).doc(id).set({data});}
    return {ok:true,accepted:Math.min(room,fresh.length),capped:!!old.capped};
   });
  },
  async analyticsReport(input,now){
   const p=a.range(input,now),start=p.previousStart-31*a.DAY,end=p.end;
   const [state,accounts,days,archive,legacy]=await Promise.all([read(db,'uniearn_order_state','team-test'),bounded('uniearn_accounts',{profile:db.command.exists(true)},500),bounded(col,{kind:'analyticsDay',day:db.command.gte(start).and(db.command.lt(end))},400),bounded(col,{kind:'orderArchive','order.createdAt':db.command.gte(start).and(db.command.lt(end))},500),bounded('uniearn_order_archive',{createdAt:db.command.gte(start).and(db.command.lt(end))},300)]);
   const trips=new Map((state?.trips||[]).map(t=>[t.id,t.runnerAccountId]));
   const orders=[...(state?.requests||[]),...archive.rows.map(d=>d.order),...legacy.rows].filter(Boolean).map(r=>({...r,analyticsRunnerId:r.analyticsRunnerId||trips.get(r.runnerId)||'',analytics:r.analytics||{}}));
   const result=a.report({orders,accounts:accounts.rows,days:days.rows,state:state||{},input,now,partial:{accounts:accounts.partial,events:days.partial,archive:archive.partial||legacy.partial,legacyMissing:!!legacy.missing}});
   result.options.stationLabels=Object.fromEntries(Object.entries(a.STATIONS).map(([v,label])=>[a.stationCode(v),label]));return result;
  },
  async classifyAnalytics(actor,id,value,reason,now){
   if(!/^[a-f0-9]{64}$/.test(id)||!['live','test','unclassified'].includes(value)||typeof reason!=='string'||reason.trim().length<4)throw Object.assign(Error('请选择数据类别，并填写至少 4 个字的原因。'),{safe:true});
   return db.runTransaction(async tx=>{const old=await read(tx,'uniearn_accounts',id);if(!old?.profile)throw Object.assign(Error('用户不存在。'),{safe:true});await tx.collection('uniearn_accounts').doc(id).update({data:{analyticsClass:value}});await tx.collection(col).doc('audit-'+now+'-'+crypto.randomBytes(8).toString('hex')).set({data:{kind:'audit',actor,action:'opsAnalyticsClass',target:id,detail:{value,reason:reason.trim().slice(0,200)},at:now}});});
  },
  async newArchiveCounts(){const [n,d]=await Promise.all([db.collection(col).where({kind:'orderArchive'}).count(),db.collection(col).where({kind:'orderArchive','order.status':'confirmed'}).count()]);return {total:n.total,completed:d.total};},
  async newArchiveRows(skip,limit){return (await db.collection(col).where({kind:'orderArchive'}).skip(skip).limit(limit).get()).data.map(d=>d.order);}
 };
};
