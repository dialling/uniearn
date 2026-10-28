// Restore only an explicitly saved choice belonging to this account and address.
const restorable=new Set(['waiting','taken','collected','delivered','disputed','confirmed']);
const clean=value=>String(value||'').trim();
const phone=value=>clean(value).replace(/\s/g,'');
function savedGender(state,r){
 const p=state.profile||{};
 if(p.loggedOut||!p.accountId||!r.isMine||r.dormGender||r.campusId!==p.campusId||!restorable.has(r.status)||r.category==='task'||r.destinationType==='place'||!clean(r.dorm)||!clean(r.room)||!clean(r.owner)||!/^1\d{10}$/.test(phone(r.phone)))return '';
 const routes=(state.routes||[]).filter(a=>a.accountId===p.accountId&&a.destinationType!=='place'&&['male','female'].includes(a.dormGender));
 const genders=[...new Set(routes.filter(a=>clean(a.dorm)===clean(r.dorm)&&clean(a.room)===clean(r.room)&&clean(a.owner)===clean(r.owner)&&phone(a.phone)===phone(r.phone)).map(a=>a.dormGender))];
 return genders.length===1?genders[0]:'';
}
function repairs(state){
 if(!state.orderCapabilities?.restoreDormGenders)return [];
 return (state.requests||[]).flatMap(r=>{const gender=savedGender(state,r);return gender?[{id:r.id,dorm:r.dorm,room:r.room,gender}]:[];}).slice(0,25);
}
module.exports={repairs,savedGender};
