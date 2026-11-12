const d=require('./domain'),c=require('./catalog'),route=require('./trip-route');
const HOUR=3600000,MIN=60000;
function clock(ts){if(!ts)return '—';const t=new Date(ts+8*3600000);return String(t.getUTCHours()).padStart(2,'0')+':'+String(t.getUTCMinutes()).padStart(2,'0');}
function todayAt(value,now=Date.now()){const parts=String(value).split(':').map(Number);if(parts.length!==2||parts[0]<0||parts[0]>23||parts[1]<0||parts[1]>59||parts.some(x=>!Number.isInteger(x)))throw Error('Choose a valid time');const t=new Date(now+8*3600000);return Date.UTC(t.getUTCFullYear(),t.getUTCMonth(),t.getUTCDate(),parts[0]-8,parts[1],0,0);}
function fee(r){return Number(r.serviceFee===undefined?d.serviceFee(d.boxes(r)):r.serviceFee);}
function total(r){return Math.max(0,Math.round((r.reward+fee(r)-Number(r.discount||0))*100)/100);}
function hours(){return 2;}
function event(r,label,at=Date.now()){(r.history||(r.history=[])).push({label,at});}
function migrate(s){s.installationId=s.installationId||('local-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2));s.routes=s.routes||[];s.profile.marks=s.profile.marks||[];s.agreements=s.agreements||{};return s;}
function expire(s,now=Date.now()){
 let changed=false;
 for(const r of s.requests){
  if(r.status==='waiting'&&r.closesAt&&now>=r.closesAt){r.status='refunded';r.refundAmount=total(r);r.refundedAt=now;event(r,'Closed · no runner · demo refund',now);changed=true;}
  if(r.status==='delivered'&&r.deliveredAt&&now>=r.deliveredAt+hours(r)*HOUR){d.confirm(s,r.id);r.confirmedAt=now;r.autoConfirmed=true;event(r,'Automatically confirmed',now);changed=true;}
 }
 return changed;
}
function createTakeaway(s,data,now=Date.now()){
 const arrivalAt=data.arrived?now:todayAt(data.arrivalTime,now);
 if(!data.arrived&&arrivalAt<now)throw Error('Choose an arrival time later today');
 if(!String(data.owner||'').trim())throw Error('Add the name on your order');
 const closeAt=arrivalAt+30*MIN;let deliverBy='';if(data.arrived&&data.deliverBy){let at=data.deliverAt===undefined?todayAt(data.deliverBy,now):Number(data.deliverAt);if(data.deliverAt===undefined&&at<now-60000)at+=24*3600000;if(!Number.isSafeInteger(at)||at<=now||at>now+65*60000)throw Error('Choose a future delivery time within 1 hour');deliverBy=clock(at);}
 const r=d.createRequest(s,{...data,deliverBy,category:'takeout',small:Number(data.bags),big:0,codes:[],pricePerBox:Number(data.price),deadline:clock(closeAt),arrivalAt,arrived:!!data.arrived,closesAt:closeAt,soup:!!data.soup,lobbyPickupAllowed:!!data.lobbyPickupAllowed,riderPhoto:data.riderPhoto||''});
 r.createdAt=now;r.baseReward=r.reward;event(r,'Posted',now);return r;
}
function raise(s,id,amount){const r=s.requests.find(x=>x.id===id);if(!r||r.status!=='waiting')throw Error('This offer can no longer be increased');if(typeof amount!=='number'||!Number.isFinite(amount)||amount<0.01||amount>100.88||Math.abs(Math.round(amount*100)-amount*100)>1e-6)throw Error('Enter ¥0.01–100, up to 2 decimal places');if(Math.round((r.raised||0)*100)+Math.round(amount*100)>10088)throw Error('Offer increase limit reached.');r.reward=Math.round((r.reward+amount)*100)/100;r.raised=(r.raised||0)+amount;event(r,'Offer raised by ¥'+amount);return r;}
function cancelReason(r,reason,now=Date.now()){
 if(r.status!=='taken'||r.collected.length)throw Error('Only an uncollected order can be cancelled');
 if(!['missing','quantity','personal','mismatch'].includes(reason))throw Error('Choose a reason');
 if(c.category(r)==='task')return reason!=='mismatch';
 if(r.etaChangedAfterAccept&&reason==='personal')return false;
 return reason==='personal'&&(c.category(r)!=='takeout'||!r.arrivalAt||now>r.arrivalAt-15*MIN);
}
function runnerCancel(s,id,reason,now=Date.now()){
 migrate(s);const r=s.requests.find(x=>x.id===id);if(!r)throw Error('Order not found');const mark=cancelReason(r,reason,now),t=s.trips.find(x=>x.id===r.runnerId);
 if(!t)throw Error('Trip not found');
 const previousRunner=t.runnerName||s.profile.name||'Runner';
 if(mark)s.profile.marks.push({at:now,requestId:id,reason:'Late cancellation'});
 require('./task-tip').returnTaskTip(r,now);
 event(r,'Returned to the board: '+reason,now);r.cancellation={reason,at:now,runner:previousRunner,mark};r.status='waiting';r.runnerId=null;r.collected=[];delete r.takenAt;delete r.etaChangedAfterAccept;if(r.closesAt&&r.closesAt<=now)r.closesAt=now+30*MIN;
 t.requestIds=t.requestIds.filter(x=>x!==id);(t.cancelledRequests||(t.cancelledRequests=[])).push(id);
 if(!t.requestIds.length&&!t.joinUntil)t.cancelled=true;
 else if(t.requestIds.length&&t.requestIds.every(rid=>s.requests.find(x=>x.id===rid).status==='collected'))t.phase='deliver';
 expire(s,now);return mark;
}
function pickup(s,id){const r=s.requests.find(x=>x.id===id);if(!r||r.status!=='taken')throw Error('This order cannot be picked up');if(c.category(r)==='takeout')while(r.status==='taken')d.collect(s,id);else d.collect(s,id);if(r.status==='collected')event(r,'Picked up');const t=s.trips.find(x=>x.id===r.runnerId);if(t&&t.joinUntil>Date.now())t.phase='collect';}
function deliver(s,id,photo,location){d.deliver(s,id,photo);const r=s.requests.find(x=>x.id===id);r.deliveryLocation=location||'';event(r,'Delivered · photo');}
function report(s,id,reason,photo,note){const r=s.requests.find(x=>x.id===id);if(!r||r.status!=='delivered')throw Error('Only a delivered order can be reported');if(!['Not received','Wrong bag','Spilled or damaged','Something else'].includes(reason))throw Error('Choose a reason');if(reason==='Spilled or damaged'&&!photo)throw Error('Add a photo of the damage');if(reason==='Something else'&&!String(note||'').trim())throw Error('Describe the issue');r.status='disputed';r.dispute={reason,photo:photo||'',note:note||'',at:Date.now()};event(r,'Issue reported · settlement paused');}
function candidates(s,t,now=Date.now()){
 return s.requests.filter(r=>{const pickup=c.category(r)==='takeout'?(r.pickupPoint||r.station):r.station;return r.status==='waiting'&&r.ownerId!==s.profile.accountId&&pickup===t.station&&route.destinationMatches(r,t)&&route.categoryMatches(r,t)&&(!r.closesAt||r.closesAt>now)&&(!r.closesAt||r.closesAt>t.departAt)&&(!r.arrivalAt||r.arrivalAt<=t.departAt);});
}
function plan(s,cfg,now=Date.now()){
 if(!['takeout','parcel','other'].includes(cfg.category||'takeout'))throw Error('Choose a pickup category');
 const station=String(cfg.station||'').trim(),destinationType=cfg.destinationType==='place'?'place':cfg.destinationType==='dorm'?'dorm':undefined,deliveryAddress=String(cfg.deliveryAddress||'').trim(),pickupAddress=String(cfg.pickupAddress||'').trim(),waypoint=String(cfg.waypoint||'').trim();
 if(!station||station.length>200||pickupAddress.length>200||waypoint.length>200)throw Error('Add a pickup location under 200 characters');
 if(destinationType==='place'&&(!deliveryAddress||deliveryAddress.length>500))throw Error('Add a delivery address under 500 characters');
 const dorm=destinationType==='place'?route.placeDorm(deliveryAddress):String(cfg.dorm||'').trim();
 const capacity=Number(cfg.capacity);if(!Number.isInteger(capacity)||capacity<1||capacity>(cfg.category==='takeout'?5:12))throw Error('Choose a capacity between 1 and 12');
 if(!station||!dorm||dorm.length>100)throw Error('Choose a pickup point and destination');
 const later=cfg.when==='later',duration=cfg.duration===undefined||cfg.duration===null||cfg.duration===''?10:Number(cfg.duration);if(!later&&(!Number.isInteger(duration)||duration<1||duration>30))throw Error('Choose a duration between 1 and 30 minutes');
 const departAt=later?todayAt(cfg.time,now):now+duration*MIN;
 if(later&&departAt<=now+10*MIN)throw Error('Choose a departure more than 10 minutes from now');
 return {campusId:s.profile.campusId,universityId:s.profile.universityId,category:cfg.category||'takeout',station,pickupAddress,waypoint,dorm,destinationType,deliveryAddress:destinationType==='place'?deliveryAddress:'',capacity,departAt,depart:clock(departAt),joinUntil:later?departAt-10*MIN:departAt,remindAt:later?departAt-15*MIN:0,phase:'collect',requestIds:[],cancelled:false,runnerName:s.profile.name||'You',runnerJobs:s.profile.jobsDone||0};
}
function matchingTripOrders(s,cfg,now=Date.now()){
 const t=plan(s,cfg,now);
 return candidates(s,t,now).sort((a,b)=>(a.arrivalAt||0)-(b.arrivalAt||0));
}
function previewTrip(s,cfg,now=Date.now()){
 const t=plan(s,cfg,now),ids=[];let boxes=0,reward=0;
 if(Object.prototype.hasOwnProperty.call(cfg,'requestIds')){
  if(!Array.isArray(cfg.requestIds)||cfg.requestIds.length>12||cfg.requestIds.some(id=>typeof id!=='string')||new Set(cfg.requestIds).size!==cfg.requestIds.length)throw Error('Choose up to 12 different orders');
  const available=new Map(candidates(s,t,now).map(r=>[r.id,r]));
  const selected=cfg.requestIds.map(id=>available.get(id));
  if(selected.some(r=>!r))throw Error('A selected order changed. Refresh and choose again.');
  // Validate on copies: preview must never accept or change the real orders.
  d.assign({...s,requests:selected.map(r=>({...r}))},{...t,requestIds:[]},cfg.requestIds);
  return {trip:t,ids:cfg.requestIds.slice(),boxes:selected.reduce((n,r)=>n+d.boxes(r),0),reward:selected.reduce((n,r)=>n+r.reward,0)};
 }
 for(const r of candidates(s,t,now).sort((a,b)=>(a.arrivalAt||0)-(b.arrivalAt||0))){if(boxes+d.boxes(r)<=t.capacity&&(c.category(r)!=='takeout'||boxes+d.boxes(r)<=5)){const first=ids.length&&s.requests.find(x=>x.id===ids[0]);if(first&&(r.destinationKey||'')!==(first.destinationKey||''))continue;if(t.category==='other'&&first&&c.category(r)!==c.category(first))continue;if((t.category==='takeout'||first&&c.category(first)==='takeout')&&first&&Math.abs(r.arrivalAt-first.arrivalAt)>15*MIN)continue;ids.push(r.id);boxes+=d.boxes(r);reward+=r.reward;}}
 return {trip:t,ids,boxes,reward};
}
function startTrip(s,cfg,now=Date.now()){const p=previewTrip(s,cfg,now),t={...p.trip,id:'t'+s.nextId++};d.assign(s,t,p.ids);s.trips.unshift(t);return t;}
function join(s,tripId,make,now=Date.now()){
 const copy=JSON.parse(JSON.stringify(s)),t=copy.trips.find(x=>x.id===tripId);
 if(!t||t.cancelled||t.phase!=='collect'||!t.joinUntil||now>=t.joinUntil)throw Error('This trip is closed to new orders');
 const r=make(copy);if(r.arrivalAt&&r.arrivalAt>t.departAt)throw Error('Your food arrives after this runner leaves');
 d.assign(copy,t,[r.id]);Object.assign(s,copy);return r;
}
function owned(s,r){return r.isMine===true&&(r.ownerId?r.ownerId===(s.profile.accountId||'local'):true)||r.owner==='You'||!!s.profile.name&&r.owner===s.profile.name;}
function status(r){return {waiting:r.cancellation?'Finding another runner':'Waiting for a runner',taken:'Runner accepted',collected:'On the way',delivered:'Delivered · please check',confirmed:'Confirmed',cancelled:'Cancelled · demo refund',refunded:'No runner · demo refund',disputed:'Issue reported · under review'}[r.status]||r.status;}
function view(r){return {...r,category:c.category(r),unit:c.category(r)==='task'?'task':c.category(r)==='takeout'?'bags':'boxes',boxes:d.boxes(r),fee:fee(r).toFixed(2),total:total(r).toFixed(2),taskTipText:Number(r.taskTip||0).toFixed(2),taskBaseText:((Math.round(r.reward*100)-Math.round(Number(r.taskTip||0)*100))/100).toFixed(2),rewardText:r.reward.toFixed(2),earnedText:(r.reward+Number(r.runnerBonus||0)).toFixed(2),statusLabel:status(r),arrivalLabel:r.arrived?'Food is there now':'Arrives '+clock(r.arrivalAt),closeTime:clock(r.closesAt),phoneLast4:(r.phone||'').replace(/\s/g,'').slice(-4),autoHours:hours(r),autoTime:r.deliveredAt?clock(r.deliveredAt+hours(r)*HOUR):'',sizeLabel:c.category(r)==='task'?'Task':c.label(r),deliveredTime:clock(r.deliveredAt),history:(r.history||[]).map(e=>({...e,time:clock(e.at)}))};}
module.exports={clock,todayAt,fee,total,hours,event,migrate,expire,createTakeaway,raise,cancelReason,runnerCancel,pickup,deliver,report,matchingTripOrders,previewTrip,startTrip,join,owned,status,view};
