'use strict';
const d=require('./domain');
const cents=n=>Math.round(Number(n||0)*100),money=n=>n/100;
function event(r,label,at){(r.history||(r.history=[])).push({label,at});}
function missingParcel(s,id,index,expectedCodes,now=Date.now()){
 const r=s.requests.find(r=>r.id===id),t=r&&s.trips.find(t=>t.id===r.runnerId);
 if(!r||r.category!=='parcel'||r.status!=='taken'||!t||t.cancelled||t.phase!=='collect'||!t.requestIds.includes(id))throw Error('Parcel is no longer available');
 if(!Number.isInteger(index)||index<0||index>=r.codes.length)throw Error('Choose a valid parcel');
 if(!Array.isArray(expectedCodes)||expectedCodes.length!==r.codes.length||expectedCodes.some((v,i)=>v!==r.codes[i]))throw Error('Parcels changed. Refresh and choose again.');
 const collected=(r.collectedIndices||r.collected.map((_,i)=>i)).slice();
 if(collected.includes(index))throw Error('This parcel is already collected');
 const originalStation=r.station,code=r.codes[index],count=r.codes.length,runner=t.runnerName||s.profile.name||'Runner';
 if(count===1){
  r.status='waiting';r.runnerId=null;r.collected=[];r.collectedIndices=[];delete r.takenAt;delete r.splitOriginal;
  r.cancellation={reason:'missing',at:now,runner,mark:false};if(r.closesAt&&r.closesAt<=now)r.closesAt=now+30*60000;
  t.requestIds=t.requestIds.filter(x=>x!==id);(t.cancelledRequests||(t.cancelledRequests=[])).push(id);
  event(r,'Parcel not found · returned to the board',now);
 }else{
  const indices=r.codes.map((_,i)=>i).filter(i=>i!==index),reward=cents(r.reward),items=r.parcelItems;
  const base=items&&items.length===count?items.reduce((n,p)=>n+cents(p.price),0):0;
  const returnedReward=items&&items.length===count?Math.max(0,Math.min(reward,cents(items[index].price)+Math.round((reward-base)/count))):Math.round(reward/count),keptReward=reward-returnedReward;
  const fee=cents(r.serviceFee===undefined?d.serviceFee(count):r.serviceFee),returnedFee=Math.round(fee/count),keptFee=fee-returnedFee;
  const discount=cents(r.discount),returnedCap=returnedReward+returnedFee,keptCap=keptReward+keptFee;
  let returnedDiscount=Math.min(returnedCap,Math.round(discount/count)),keptDiscount=Math.min(keptCap,discount-returnedDiscount);returnedDiscount=Math.min(returnedCap,discount-keptDiscount);
  const extra={...r,id:'r'+s.nextId++,codes:[code],reward:money(returnedReward),serviceFee:money(returnedFee),discount:money(returnedDiscount),tip:money(Math.round(cents(r.tip)/count)),collected:[],collectedIndices:[],status:'waiting',runnerId:null,photo:'',history:(r.history||[]).map(e=>({...e})),splitParentId:r.splitParentId||r.id,cancellation:{reason:'missing',at:now,runner,mark:false}};
  delete extra.splitOriginal;delete extra.takenAt;delete extra.collectedAt;delete extra.etaChangedAfterAccept;
  if(extra.closesAt&&extra.closesAt<=now)extra.closesAt=now+30*60000;
  r.codes=indices.map(i=>r.codes[i]);r.reward=money(keptReward);r.serviceFee=money(keptFee);r.discount=money(keptDiscount);r.tip=money(cents(r.tip)-cents(extra.tip));delete r.splitOriginal;
  if(items){extra.parcelItems=[items[index]];r.parcelItems=indices.map(i=>items[i]);for(const part of [r,extra]){part.big=part.parcelItems.filter(p=>['large','oversized'].includes(p.size)).length;part.small=part.parcelItems.length-part.big;part.station=[...new Set(part.parcelItems.map(p=>p.pickupPoint||originalStation))].join('、');part.pickupPoint=part.station;}}
  else{extra.big=r.big?1:0;extra.small=extra.big?0:1;r.small=r.big?0:indices.length;}
  r.collectedIndices=collected.map(i=>i>index?i-1:i);r.collected=r.collectedIndices.map(i=>r.codes[i]);
  if(r.collected.length===r.codes.length){r.status='collected';r.collectedAt=now;}
  event(r,'Parcel '+code+' not found · other parcels retained',now);event(extra,'Parcel not found · returned to the board',now);s.requests.push(extra);
 }
 if(t.requestIds.length&&t.requestIds.every(id=>s.requests.find(r=>r.id===id).status==='collected')){t.phase='deliver';t.joinUntil=now;}
 else if(!t.requestIds.length&&!t.joinUntil)t.cancelled=true;
 return {requestId:id,remaining:count===1?0:r.codes.length,returnedCode:code};
}
module.exports={missingParcel};
