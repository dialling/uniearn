// Restore only an explicitly saved choice belonging to this account and address.
const active=new Set(['waiting','taken','collected','delivered','disputed']);
const clean=value=>String(value||'').trim();
const phone=value=>clean(value).replace(/\s/g,'');
function repairs(state){
 const p=state.profile||{};
 if(p.loggedOut||!p.accountId||!state.orderCapabilities?.restoreDormGenders)return [];
 const routes=(state.routes||[]).filter(a=>a.accountId===p.accountId&&a.destinationType!=='place'&&['male','female'].includes(a.dormGender));
 return (state.requests||[]).filter(r=>r.isMine&&!r.dormGender&&r.campusId===p.campusId&&active.has(r.status)&&r.category!=='task'&&r.destinationType!=='place'&&clean(r.dorm)&&clean(r.room)&&clean(r.owner)&&/^1\d{10}$/.test(phone(r.phone))).flatMap(r=>{
  const genders=[...new Set(routes.filter(a=>clean(a.dorm)===clean(r.dorm)&&clean(a.room)===clean(r.room)&&clean(a.owner)===clean(r.owner)&&phone(a.phone)===phone(r.phone)).map(a=>a.dormGender))];
  return genders.length===1?[{id:r.id,dorm:r.dorm,room:r.room,gender:genders[0]}]:[];
 }).slice(0,25);
}
module.exports={repairs};
