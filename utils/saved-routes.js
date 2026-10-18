const store=require('./store');
const phoneHint='Enter an 11-digit mobile number that starts with 1.';
function validPhone(value){return /^1\d{10}$/.test(String(value||'').replace(/\s/g,''));}
const campus=require('./campus');
const stations=campus.stationValues();
const dorms=campus.buildings();
const names=['Study spot','Classroom','Roommate','Other'];
const suggestions=['In front of the main entrance','Outside the library','Classroom 302','Meet me at the building entrance'];
function normalize(a={}){
 const place=a.destinationType==='place';const out={accountId:a.accountId||'',default:!!a.default};
 for(const k of ['id','name','station','dorm','room','owner','phone','pickupNote','dropNote','deliveryAddress','deliveryNote'])out[k]=String(a[k]||'').trim();
 out.phone=out.phone.replace(/\s/g,'');out.destinationType=place?'place':'dorm';
 out.name=out.name||(place?'Other':'My dorm');out.dropMode=place?'meet':(a.dropMode?a.dropMode==="lobby"?'lobby':'door':/lobby/i.test(out.dropNote)?'lobby':'door');
 if(place){out.room='';out.dorm=/library|图书馆/i.test(out.deliveryAddress)?'Library':/classroom|教室/i.test(out.deliveryAddress)?'Classroom':/sports|体育/i.test(out.deliveryAddress)?'Sports centre':'Campus meeting point';out.dropNote='Meet at the stated location';}
 else out.dropNote=out.dropMode==='lobby'?'Lobby · I’ll come down':'At my door';
 return out;
}
function validate(a){const x=normalize(a);if(!x.station)throw Error('Choose where to collect.');if(x.destinationType==='place'){if(!x.deliveryAddress)throw Error('Describe exactly where to deliver.');if(x.deliveryAddress.length>500)throw Error('Keep the delivery address under 500 characters.');}else if(!x.dorm||x.dorm==='Choose building'||!x.room)throw Error('Choose your building and add a room.');if(!x.owner)throw Error('Add the name on the order.');if(!validPhone(x.phone))throw Error(phoneHint);return x;}
function scoped(service){
 const parcel=service==='parcel',key=parcel?'parcelRoutes':'routes';
 function scopedValidate(a){return validate(parcel?{...a,station:a.station||'Parcel delivery'}:a);}
 function list(){const s=store.get(),owner=s.profile.accountId||'local';return (s[key]||[]).filter(x=>!x.accountId||x.accountId===owner).map(normalize);}
 function save(a){const x=scopedValidate(a);store.update(s=>{const owner=s.profile.accountId||'local';s[key]=(s[key]||[]).map(v=>v.accountId?v:{...v,accountId:owner});const own=s[key].filter(v=>v.accountId===owner),old=own.find(v=>v.id===x.id);if(x.id&&!old)throw Error('This saved route is unavailable.');x.id=x.id||(parcel?'parcelRoute':'route')+s.nextId++;x.accountId=owner;x.default=old?!!old.default:!own.length;const i=s[key].findIndex(v=>v.id===x.id);if(i>=0)s[key][i]={...x};else s[key].push({...x});if(!parcel&&x.destinationType==='dorm'&&x.name==='My dorm'){s.profile.dorm=x.dorm;s.profile.room=x.room;s.profile.pickup=x.station;}});return {...x};}
 function setDefault(id){store.update(s=>{const owner=s.profile.accountId||'local';(s[key]||[]).forEach(v=>{if(!v.accountId||v.accountId===owner)v.default=v.id===id;});});}
 function remove(id){store.update(s=>{const owner=s.profile.accountId||'local';s[key]=(s[key]||[]).filter(v=>!(v.id===id&&(!v.accountId||v.accountId===owner)));const own=s[key].filter(v=>!v.accountId||v.accountId===owner);if(own.length&&!own.some(v=>v.default))own[0].default=true;});}
 return {phoneHint,validPhone,stations,dorms,names,suggestions,normalize,validate:scopedValidate,list,save,setDefault,remove,display,phoneMask,formatPhone,campus,buildingLabel:lang=>campus.buildingLabel,dormLabel:(code,lang)=>campus.buildingLabel(code,lang),stationLabel:(v,lang)=>campus.stationLabel(v,lang),areas:campus.areas,buildingsOf:area=>campus.areaOfBuilding(area)};
}
function display(a){return a.destinationType==='place'?a.deliveryAddress:(a.dorm||'Choose building')+' · Room '+(a.room||'—');}
function formatPhone(value){const phone=String(value||'').replace(/\s/g,'');return validPhone(phone)?phone.slice(0,3)+' '+phone.slice(3,7)+' '+phone.slice(7):phone;}
function phoneMask(p){return /^1\d{10}$/.test(p||'')?p.slice(0,3)+'****'+p.slice(-4):'';}
module.exports={...scoped('takeaway'),forService:scoped};
