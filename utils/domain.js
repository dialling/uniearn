const catalog=require('./catalog');
const campus=require('./campus');
const demo = [
  {id:'r1',owner:'Nicha',station:'Station A',dorm:'Dorm 7',room:'412',small:2,big:0,codes:['88-2-4417','88-2-4418'],phone:'138 0102 6092',note:'Leave it at the front desk, thanks!',deadline:'12:30',reward:10,status:'waiting',runnerId:null,collected:[],photo:''},
  {id:'r2',owner:'Minjun',station:'Station A',dorm:'Dorm 7',room:'208',small:1,big:0,codes:['31-5-0926'],phone:'138 0102 3381',note:'Call me when you are downstairs',deadline:'12:45',reward:4,status:'waiting',runnerId:null,collected:[],photo:''},
  {id:'r3',owner:'Fah',station:'Station A',dorm:'Dorm 7',room:'115',small:0,big:1,codes:['12-1-7730'],phone:'138 0102 5510',note:'Heavy one, ground floor is fine',deadline:'13:00',reward:8,status:'waiting',runnerId:null,collected:[],photo:''},
  {id:'r4',owner:'Lina',station:'Station C',dorm:'Building C',room:'107',small:1,big:0,codes:['73-1-2321'],phone:'138 0102 1872',note:'Please call on arrival',deadline:'14:00',reward:5,status:'waiting',runnerId:null,collected:[],photo:''}
];
function boxes(r) { return Number(r.small || 0) + Number(r.big || 0); }
function limit(jobs) { return require('./runner-level').level(typeof jobs==='object'?jobs:{jobsDone:jobs,onTime:jobs}).limit; }
function serviceFee() { return 0; }
// Prices are typed as decimals, so 4.35*100 is 434.99999999999994. Compare against the rounded cent value.
function wholeCents(value) { const n=Number(value); return Number.isFinite(n) && Math.abs(n*100-Math.round(n*100)) < 1e-6; }
const MAX_PRICE_PER_BOX = 50;
function createRequest(s, data) {
  data={...data,category:catalog.category(data),parcelSize:catalog.category(data)==='parcel'?catalog.sizeId(data):null};
  if(!['parcel','takeout'].includes(data.category))throw Error('Choose a pickup category');
  const place=data.category==='takeout'&&data.destinationType==='place';
  if (!data.station || !data.dorm || (place?!String(data.deliveryAddress||'').trim():!data.room) || !/^1\d{10}$/.test((data.phone||'').replace(/\s/g,''))) throw Error(place?'Add the pickup point, exact delivery address and a valid phone number':'Complete station, dorm, room and a valid phone number');
  if(data.category==='takeout'&&data.night){if(!String(data.shop||'').trim())throw Error('Add the shop or stall name');if(!wholeCents(data.pricePerBox)||Number(data.pricePerBox)<4||Number(data.pricePerBox)>MAX_PRICE_PER_BOX)throw Error('Choose a night market offer between ¥4 and ¥'+MAX_PRICE_PER_BOX);data.small=1;data.big=0;}
  if(data.floor&&campus.isBuilding(data.dorm)&&(Number(data.floor)<1||Number(data.floor)>campus.maxFloorOf(data.dorm)))throw Error('That floor does not exist in this building');
  let reward;
  if(data.category==='parcel' && Array.isArray(data.parcelItems)) {
    if(!data.parcelItems.length||data.parcelItems.length>12)throw Error('Choose between 1 and 12 parcels');
    data.parcelItems=data.parcelItems.map(item=>{const size=catalog.sizes.find(x=>x.id===item.size);if(!size||!String(item.code||'').trim())throw Error('Add one pickup code per parcel');return {size:size.id,code:String(item.code).trim(),price:size.price};});
    const sizeCounts={};data.parcelItems.forEach(x=>{sizeCounts[x.size]=(sizeCounts[x.size]||0)+1;if(sizeCounts[x.size]>9)throw Error('Up to 9 items of one size');});data.codes=data.parcelItems.map(x=>x.code);data.big=data.parcelItems.filter(x=>['large','oversized'].includes(x.size)).length;data.small=data.parcelItems.length-data.big;
    if(![0,188,266,555,666,888].includes(Math.round(Number(data.tip||0)*100)))throw Error('Choose a valid tip');
    reward=data.parcelItems.reduce((sum,x)=>sum+x.price,0)+Number(data.tip||0);
  } else {
    if(data.category==='parcel'&&!catalog.sizes.some(x=>x.id===data.parcelSize))throw Error('Choose a parcel size');
    if(data.category==='parcel'){const large=['large','oversized'].includes(data.parcelSize);if(Boolean(data.big)!==large)throw Error('Parcel quantity does not match its size');}
    if(boxes(data)<1||boxes(data)>(data.category==='takeout'?5:3)||(data.big&&boxes(data)>1))throw Error('Choose a valid quantity');
    if(data.category==='takeout')data.codes=Array(boxes(data)).fill('').map((_,i)=>(data.codes||[])[i]||'');
    if(!data.codes||data.codes.length!==boxes(data)||(data.category==='parcel'&&data.codes.some(x=>!String(x).trim())))throw Error('Add one pickup code per parcel');
    if(!wholeCents(data.pricePerBox)||Number(data.pricePerBox)<3||Number(data.pricePerBox)>MAX_PRICE_PER_BOX)throw Error('Choose an offer between the minimum and ¥'+MAX_PRICE_PER_BOX+' per item');
    reward=Math.round(boxes(data)*Number(data.pricePerBox)*100)/100;
  }
  const areaId=data.area||(campus.areaOfBuilding(data.dorm)||{}).id||'';
  const floor=Number(data.floor)||campus.floorOfRoom(data.room);
  const floorSurcharge=campus.highFloor(areaId,floor,data.dorm)?1:0;
  reward=Math.round((Number(reward)+floorSurcharge)*100)/100;
  const r={...data,area:areaId,floor,floorSurcharge,id:'r'+s.nextId++,status:'waiting',runnerId:null,collected:[],photo:'',reward,createdAt:Date.now(),isMine:true,ownerId:s.profile.accountId||'local',serviceFee:serviceFee()};
  s.requests.unshift(r); return r;
}
function eligible(s, trip) { return s.requests.filter(r=>r.status==='waiting' && r.station===trip.station && r.dorm===trip.dorm && catalog.category(r)===catalog.category(trip) && boxes(r)<=trip.capacity); }
function assign(s, trip, ids) {
  if(new Set(ids).size!==ids.length||ids.some(id=>trip.requestIds.includes(id)))throw Error('Duplicate order');
  const selection=ids.map(id=>s.requests.find(r=>r.id===id));
  if (selection.some(r=>!r || r.status!=='waiting' || r.station!==trip.station || r.dorm!==trip.dorm || (trip.destinationKey&&r.destinationKey!==trip.destinationKey) || catalog.category(r)!==catalog.category(trip)||r.campusId!==trip.campusId)) throw Error('Some requests are unavailable for this route');
  const existing=trip.requestIds.map(id=>s.requests.find(r=>r.id===id));
  const totalBoxes=selection.concat(existing).reduce((n,r)=>n+boxes(r),0), reward=selection.concat(existing).reduce((n,r)=>n+r.reward,0);
  if(catalog.category(trip)==='takeout'){if(totalBoxes>5)throw Error('Up to 5 bags per trip');const ats=selection.concat(existing).map(r=>r.arrivalAt||r.createdAt);if(Math.max(...ats)-Math.min(...ats)>15*60000)throw Error('Food arrival times must be within 15 minutes');}
  if (totalBoxes>trip.capacity) throw Error('Too many boxes for this trip');
  if (reward>limit(s.profile)) throw Error('This trip exceeds your runner limit');
  if(!trip.destinationKey&&selection[0]&&selection[0].destinationKey){trip.destinationKey=selection[0].destinationKey;trip.destinationType=selection[0].destinationType;}
  selection.forEach(r=>{r.status='taken';r.runnerId=trip.id;r.takenAt=Date.now();});
  trip.requestIds.push(...ids); return trip;
}
function startTrip(s, cfg) {
  const trip={id:'t'+s.nextId++,campusId:cfg.campusId,universityId:cfg.universityId,category:catalog.category(cfg),station:cfg.station,dorm:cfg.dorm,capacity:Number(cfg.capacity),depart:cfg.depart||'Now',phase:'collect',requestIds:[],cancelled:false};
  s.trips.unshift(trip);
  const waiting=(cfg.requestIds ? cfg.requestIds.map(id=>s.requests.find(r=>r.id===id)) : eligible(s,trip).sort((a,b)=>a.deadline.localeCompare(b.deadline)));
  for (const r of waiting) { try {assign(s,trip,[r.id]);} catch(e) { /* Remaining requests stay in queue. */ } }
  return trip;
}
function acceptJob(s,ids) {
  if (!ids.length || new Set(ids).size!==ids.length) throw Error('Select at least one available request');
  const selected=ids.map(id=>s.requests.find(r=>r.id===id));
  if(selected.some(r=>!r||r.status!=='waiting'))throw Error('A selected request is no longer available');
  const station=selected[0].station,dorm=selected[0].dorm;
  if(selected.some(r=>r.station!==station||r.dorm!==dorm||(r.destinationKey||'')!==(selected[0].destinationKey||'')||catalog.category(r)!==catalog.category(selected[0])))throw Error('Choose requests on the same route');
  if(selected.reduce((n,r)=>n+r.reward,0)>limit(s.profile))throw Error('This trip exceeds your runner limit');
  const t={id:'t'+s.nextId++,campusId:selected[0].campusId,universityId:selected[0].universityId,category:catalog.category(selected[0]),station,dorm,capacity:selected.reduce((n,r)=>n+boxes(r),0),depart:'Now',phase:'collect',requestIds:[],cancelled:false};
  assign(s,t,ids);s.trips.unshift(t);return t;
}
function acceptBoxes(s,refs) {
  if(!refs.length)throw Error('Select at least one parcel');
  const seen=new Set(),groups={};
  refs.forEach(({requestId,index})=>{
    const key=requestId+':'+index;if(seen.has(key))throw Error('Duplicate parcel');seen.add(key);
    const r=s.requests.find(x=>x.id===requestId);
    if(!r||r.status!=='waiting'||catalog.category(r)!=='parcel'||(r.closesAt&&r.closesAt<=Date.now())||!Number.isInteger(index)||index<0||index>=boxes(r))throw Error('Parcel is no longer available');
    (groups[requestId]||(groups[requestId]=[])).push(index);
  });
  const originals=Object.keys(groups).map(id=>s.requests.find(r=>r.id===id));
  const station=originals[0].station,dorm=originals[0].dorm;
  if(originals.some(r=>r.station!==station||r.dorm!==dorm||(r.destinationKey||'')!==(originals[0].destinationKey||'')||r.campusId!==originals[0].campusId||catalog.category(r)!==catalog.category(originals[0])))throw Error('Choose parcels on the same route');
  const rewards=originals.map(r=>{const idxs=groups[r.id];if(!r.parcelItems)return Math.round(r.reward*idxs.length/boxes(r)*100)/100;const prices=idxs.reduce((n,i)=>n+r.parcelItems[i].price,0);return prices+(idxs.length===boxes(r)?Number(r.tip||0):0);});
  if(rewards.reduce((n,v)=>n+v,0)>limit(s.profile))throw Error('This trip exceeds your runner limit');
  const t={id:'t'+s.nextId++,campusId:originals[0].campusId,universityId:originals[0].universityId,category:catalog.category(originals[0]),station,dorm,capacity:refs.length,depart:'Now',phase:'collect',requestIds:[],cancelled:false};
  originals.forEach((r,i)=>{
    const indices=groups[r.id].sort((a,b)=>a-b),remaining=r.codes.filter((_,idx)=>!indices.includes(idx)),originalTip=Number(r.tip||0);
    if(remaining.length){
      const extra={...r,id:'r'+s.nextId++,codes:remaining,small:r.big?0:remaining.length,big:r.big?1:0,reward:Math.round((r.reward-rewards[i])*100)/100,collected:[],status:'waiting',runnerId:null,photo:'',splitParentId:r.id};
      r.splitOriginal={codes:r.codes.slice(),small:r.small,big:r.big,reward:r.reward,tip:r.tip,discount:r.discount,extraId:extra.id,serviceFee:r.serviceFee,parcelItems:r.parcelItems&&r.parcelItems.slice()};
      if(r.parcelItems){extra.parcelItems=r.parcelItems.filter((_,idx)=>!indices.includes(idx));extra.tip=originalTip;extra.big=extra.parcelItems.filter(x=>['large','oversized'].includes(x.size)).length;extra.small=extra.parcelItems.length-extra.big;}
      if(r.serviceFee!==undefined){extra.serviceFee=serviceFee(remaining.length);r.serviceFee=serviceFee(indices.length);}
      // Split the coupon by parcel count, but never let either part's discount exceed what that part costs.
      const originalDiscount=Number(r.discount||0),round=x=>Math.round(x*100)/100,mineCap=round(rewards[i]+serviceFee(indices.length)),restCap=round(extra.reward+serviceFee(remaining.length));let mine=Math.min(mineCap,round(originalDiscount*indices.length/boxes(r))),rest=Math.min(restCap,round(originalDiscount-mine));mine=Math.min(mineCap,round(originalDiscount-rest));r.discount=Math.max(0,mine);extra.discount=Math.max(0,rest);
      s.requests.push(extra);
    }
    r.codes=indices.map(idx=>r.codes[idx]);r.small=r.big?0:indices.length;r.reward=rewards[i];
    if(r.parcelItems){r.tip=remaining.length?0:originalTip;r.parcelItems=indices.map(idx=>r.parcelItems[idx]);r.big=r.parcelItems.filter(x=>['large','oversized'].includes(x.size)).length;r.small=r.parcelItems.length-r.big;}
    r.status='taken';r.runnerId=t.id;r.takenAt=Date.now();t.requestIds.push(r.id);
  });
  s.trips.unshift(t);return t;
}
function abandonUncollectedTrip(s,id) {
  const t=s.trips.find(x=>x.id===id);
  if(!t||t.cancelled||t.phase!=='collect'||t.requestIds.some(rid=>s.requests.find(r=>r.id===rid).collected.length))return false;
  t.cancelled=true;t.requestIds.forEach(rid=>{const r=s.requests.find(x=>x.id===rid);r.status='waiting';r.runnerId=null;r.collected=[];
    if(r.splitOriginal){const extra=s.requests.find(x=>x.id===r.splitOriginal.extraId);if(extra&&extra.status==='waiting'){
      r.serviceFee=r.splitOriginal.serviceFee;r.parcelItems=r.splitOriginal.parcelItems;r.codes=r.splitOriginal.codes;r.small=r.splitOriginal.small;r.big=r.splitOriginal.big;r.reward=r.splitOriginal.reward;r.tip=r.splitOriginal.tip;if(r.splitOriginal.discount!==undefined)r.discount=r.splitOriginal.discount;
      s.requests=s.requests.filter(x=>x.id!==extra.id);delete r.splitOriginal;
    }}
  });return true;
}
function collect(s,id) {
  const r=s.requests.find(x=>x.id===id); if (!r || r.status!=='taken') throw Error('Request is not being collected');
  r.collected.push(r.codes[r.collected.length]);
  if (r.collected.length===boxes(r)) {r.status='collected';r.collectedAt=Date.now();}
  const trip=s.trips.find(t=>t.id===r.runnerId);
  if (trip.requestIds.every(x=>s.requests.find(r=>r.id===x).status==='collected')) trip.phase='deliver';
}
function deliver(s,id,photo) {
  const r=s.requests.find(x=>x.id===id); if (!r || r.status!=='collected' || !photo) throw Error('Take a delivery photo first');
  r.status='delivered';r.photo=photo;r.deliveredAt=Date.now();
  const trip=s.trips.find(t=>t.id===r.runnerId);
  if(trip.requestIds.every(x=>['delivered','confirmed'].includes(s.requests.find(r=>r.id===x).status))) trip.phase='done';
}
function confirm(s,id) {
  const r=s.requests.find(x=>x.id===id);if(!r||r.status!=='delivered')throw Error('Request is not ready for confirmation');
  r.status='confirmed';r.confirmedAt=Date.now();s.profile.jobsDone++;s.profile.paid=Math.round((s.profile.paid+r.reward)*100)/100;
}
function cancelTrip(s,id) {
  const t=s.trips.find(x=>x.id===id);if(!t||t.cancelled||t.phase!=='collect')throw Error('This trip cannot be cancelled now');
  t.cancelled=true;
  t.requestIds.forEach(x=>{const r=s.requests.find(v=>v.id===x);if(r.status==='taken'){r.status='waiting';r.runnerId=null;r.collected=[];}});
}
function cancelRequest(s,id) {
  const r=s.requests.find(x=>x.id===id);if(!r||r.status!=='waiting')throw Error('Only an unclaimed request can be cancelled here');r.status='cancelled';r.refundAmount=Math.max(0,Math.round((r.reward+(r.serviceFee===undefined?serviceFee(boxes(r)):r.serviceFee)-Number(r.discount||0))*100)/100);r.cancelledAt=Date.now();
}
const EXPIRE_MS=3600000;
function sweepExpired(s,now=Date.now()) {
  let n=0;
  for(const r of s.requests){
    if(r.status!=='waiting'||r.runnerId)continue;
    if(r.category!=='takeout')continue;
    const t0=r.createdAt||0;
    if(!t0||now-t0<EXPIRE_MS)continue;
    r.status='cancelled';r.cancelledAt=now;r.cancelReason='expired';
    r.refundAmount=Math.max(0,Math.round((r.reward+(r.serviceFee===undefined?serviceFee(boxes(r)):r.serviceFee)-Number(r.discount||0))*100)/100);
    n++;
  }
  return n;
}
function initial() { const now=Date.now(),food=[{id:'food1',owner:'Ming Li',station:'North gate',dorm:'Dorm 7',room:'412',small:2,big:0,codes:['',''],phone:'13801026092',note:'Leave at the desk',category:'takeout',reward:8,serviceFee:0,status:'waiting',runnerId:null,collected:[],photo:'',arrivalAt:now+20*60000,closesAt:now+50*60000,deadline:'',soup:true,price:4,createdAt:now},{id:'food2',owner:'Minjun',station:'North gate',dorm:'Dorm 7',room:'208',small:1,big:0,codes:[''],phone:'13801023381',note:'',category:'takeout',reward:4,serviceFee:0,status:'waiting',runnerId:null,collected:[],photo:'',arrivalAt:now,closesAt:now+30*60000,deadline:'',arrived:true,price:4,createdAt:now}];return {nextId:10,requests:JSON.parse(JSON.stringify(demo)).concat(food),trips:[],profile:{name:'',phone:'',dorm:'',room:'',onboarded:false,studentVerified:false,verification:{status:'unverified'},jobsDone:0,paid:0}}; }
module.exports={sweepExpired,initial,boxes,limit,serviceFee,wholeCents,MAX_PRICE_PER_BOX,createRequest,eligible,assign,startTrip,acceptJob,acceptBoxes,abandonUncollectedTrip,collect,deliver,confirm,cancelTrip,cancelRequest};
