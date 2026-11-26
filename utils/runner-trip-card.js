const location=require('./hall-location'),post=require('./post-copy'),runner=require('./runner-copy'),routeLabel=require('./route-label');
const clock=require('./workflow').clock,boxes=require('./domain').boxes;
const clean=value=>String(value||'').trim();
const unique=values=>[...new Set(values.filter(Boolean))];

// Accepted trips use the runner's request snapshot, including the full destination.
function card(trip,requests,language='zh',now=Date.now()){
 const zh=language!=='en',name=value=>runner.name(post.label(value,language),language);
 const items=requests.map(r=>{r=require('./order-feedback-state').view(r);
  const category=r.category||trip.category,food=category==='takeout',task=category==='task';let loc;try{loc=location.detail({...r,category},language,true);}catch(e){loc={area:'',building:r.dorm||trip.dorm||'',room:'',gender:'',genderKey:'',showDorm:false};}
  const destination=r.destinationType==='place'?clean(r.deliveryAddress)||clean(r.dorm):[loc.area,loc.building,loc.room?(zh?loc.room+'室':'Room '+loc.room):''].filter(Boolean).join(' ');
  const status=r.feedbackOpen?(zh?'问题反馈处理中':'Feedback in progress'):({taken:zh?'待取件':'To collect',collected:zh?'配送中':'Delivering',delivered:zh?'已送达 · 等待确认':'Delivered · awaiting confirmation',confirmed:zh?'已完成':'Completed',disputed:zh?'有反馈 · 审核中':'Issue under review',cancelled:zh?'已取消':'Cancelled',refunded:zh?'已退款':'Refunded'})[r.status]||(zh?'进行中':'In progress');
  let timing='';
  if(task&&r.dueAt)timing=(zh?'完成截止 ':'Complete by ')+clock(r.dueAt);
  else if(food&&r.night)timing=r.purchaseStatus==='needs_purchase'?(zh?'未下单 · 需垫付':'Not ordered · pay upfront'):(zh?'已下单':'Ordered');
  else if(food&&r.status==='taken')timing=r.arrived||r.arrivalAt&&r.arrivalAt<=now?(zh?'外卖已到':'Food is there now'):r.arrivalAt?(zh?'预计到达 ':'Arrives ')+clock(r.arrivalAt):'';
  let deadline='',deadlineLabel=zh?'送达截止':'Deliver by';
  if(food&&r.status==='collected'&&r.collectedAt)deadline=clock(r.collectedAt+15*60000);
  else if(food&&r.deliverBy&&['taken','collected'].includes(r.status))deadline=r.deliverBy;
  else if(category==='parcel'&&['taken','collected'].includes(r.status))deadline=clean(r.deadline);
  const pickup=food?(r.night?clean(r.shop):require('./takeaway-lockers').label(r.pickupPoint,language)):task?'':unique((r.parcelItems||[]).map(p=>name(p.pickupPoint))).join(' / ')||name(r.station||trip.station);
  return {id:r.id,category,title:task?clean(r.title):'',origin:food?(r.night?(zh?'夜市代买':'Night market'):routeLabel.pickup({...r,category},language)):name(r.station||trip.station),destination:name(destination)||name(trip.dorm),gender:loc.gender,genderKey:loc.genderKey,
   disputed:r.feedbackOpen,notice:require('./report-notice').text(r.reportNotice,false,zh),status,timing,deadline,deadlineLabel,pickup,pickupLabel:food?(r.night?(zh?'店名 / 摊位':'Shop / stall'):(zh?'外卖柜':'Locker')):(zh?'取件点':'Pickup'),
   note:clean(r.note),dropNote:runner.name(r.dropNote,language)||'',quantity:boxes(r),unit:task?(zh?'项':'tasks'):food?(zh?'袋':'bags'):(zh?'件':'parcels'),
   soup:!!r.soup,fragile:!!r.fragile,raised:Number(r.raised||0)>0,reward:Number(r.reward||0).toFixed(2)};
 });
 const hasDispute=items.some(r=>r.disputed),done=!hasDispute&&(trip.phase==='done'||trip.phase==='ended'||requests.length>0&&requests.every(r=>['confirmed','cancelled','refunded'].includes(r.status)));
 const genders=items.filter((r,i)=>r.genderKey&&items.findIndex(x=>x.genderKey===r.genderKey)===i).map(r=>({key:r.genderKey,label:r.gender}));
 const taskId=trip.category==='task'&&requests[0]?requests[0].id:'';
 return {...trip,taskId,done,hasDispute,items,genders,type:trip.category==='task'?(zh?'任务':'Task'):trip.category==='takeout'?(requests.some(r=>r.night)?(zh?'夜市代买':'Night market'):(zh?'外卖代取':'Takeaway')):(zh?'快递代取':'Parcels'),
  route:trip.category==='task'?(items[0]?.title||(zh?'任务':'Task')):(trip.category==='takeout'?(routeLabel.group(requests,language)||stationText(trip,language,routeLabel.place)):stationText(trip,language,name))+' → '+(trip.destinationType==='place'?name(trip.dorm):require('./trip-dorms').label(trip,language)),
  total:requests.reduce((sum,r)=>sum+Number(r.reward||0),0).toFixed(2),quantity:items.reduce((sum,r)=>sum+r.quantity,0),
  waiting:!requests.length&&!trip.cancelled&&trip.phase==='collect'&&Number(trip.joinUntil||0)>now,
  // 2026-11-26 waiting-trip card: title, pickup, buildings and room left, like the Open trips card in the hall
  tripTitle:trip.category==='takeout'?(zh?'外卖行程':'Takeaway trip'):trip.category==='task'?(zh?'顺路行程':'Errand trip'):(zh?'快递行程':'Parcel trip'),
  pickupText:trip.category==='task'?'':stationText(trip,language,name),
  destText:trip.destinationType==='place'?name(trip.dorm):require('./trip-dorms').label(trip,language),
  roomText:(()=>{const left=Math.max(0,Number(trip.remaining!=null?trip.remaining:trip.capacity)||0),unit=trip.category==='takeout'?(zh?'袋':(left===1?'bag':'bags')):(zh?'件':(left===1?'item':'items'));return zh?'还能带 '+left+' '+unit:'Room for '+left+' '+unit;})(),
  minutesLeft:Math.max(0,Math.ceil((Number(trip.joinUntil||0)-now)/60000)),
  waitingText:(()=>{const m=Math.max(0,Math.ceil((Number(trip.joinUntil||0)-now)/60000));return zh?'等待同学加入 · 还剩 '+m+' 分钟':'Waiting for students to join · '+m+' min left';})(),
  countText:(()=>{const n=items.length,q=items.reduce((sum,r)=>sum+r.quantity,0),unit=trip.category==='task'?(zh?'项':(q===1?'task':'tasks')):trip.category==='takeout'?(zh?'袋':(q===1?'bag':'bags')):(zh?'件':(q===1?'parcel':'parcels'));return (zh?n+' 单':n+(n===1?' order':' orders'))+(q?' · '+q+(zh?' ':' ')+unit:'');})()};
}
// A multi-stop trip stores its stations as a JSON list; show one short line instead of the raw text.
function stationText(trip,language,one){const ts=require('./trip-stations');const s=ts.list(trip.station).length>1?ts.short(trip,language):(ts.short(trip,language)||one(trip.station,language));return s||one(trip.station,language);}
module.exports={card};
