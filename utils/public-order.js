const china=require('./china-time'),location=require('./hall-location'),rc=require('./runner-copy'),lockers=require('./takeaway-lockers'),post=require('./post-copy'),d=require('./domain');
// Construct a display model from public hall fields. Never spread a full order into it.
function view(r,language='zh'){
 if(!r)return null;
 const zh=language!=='en',food=r.category==='takeout',task=r.category==='task',loc=location.detail(r,language,false);
 const type=task?(zh?'其他任务':'Task'):food?(r.night?(zh?'夜市代买':'Night market'):(zh?'外卖代取':'Takeaway')):(zh?'快递代取':'Parcels');
 const status={waiting:['待接单','Waiting for a runner'],taken:['已接单','Taken'],collected:['配送中','On the way'],delivered:['已送达 · 待确认','Delivered · awaiting confirmation'],confirmed:['已完成','Completed'],cancelled:['已取消','Cancelled'],refunded:['已退款','Refunded'],disputed:['审核中','Under review']}[r.status]||[zh?'状态已更新':'Status updated', 'Status updated'];
 const destination=loc.showDorm?[loc.area,loc.building].filter(Boolean).join(' '):(zh?'其他地址 · 接单后可见':'Other address · visible after acceptance');
 const pickup=food&&!r.night?lockers.label(r.pickupPoint,language):task?'':rc.name(r.station,language);
 const count=task?1:d.boxes(r),unit=task?(zh?'个任务':'task'):food?(zh?'袋':count===1?'bag':'bags'):(zh?'件':count===1?'parcel':'parcels');
 const fields=[],add=(label,value)=>{if(value!==undefined&&value!==null&&String(value).trim())fields.push({label,value:String(value)});};
 add(zh?'任务类型':'Type',type);add(zh?'数量':'Quantity',count?count+' '+unit:(zh?'未填写':'Not set'));
 if(task)add(zh?'帮助方式':'Help type',r.taskMode==='online'?(zh?'线上帮助':'Online help'):(zh?'线下帮助':'Offline help'));
 if(!task){add(zh?'取件点':'Pickup point',pickup||(zh?'未填写':'Not set'));add(zh?'送达地点':'Destination',destination);if(loc.showDorm)add(zh?'宿舍类型':'Dorm type',loc.gender||(zh?'未填写':'Not set'));}
 if(food&&r.night){add(zh?'店铺':'Shop',r.shop);add(zh?'下单状态':'Food order',r.purchaseStatus==='needs_purchase'?(zh?'未下单 · 需跑手垫付':'Not ordered · runner pays upfront'):(zh?'已下单':'Already ordered'));}
 if(food&&!r.night)add(zh?'外卖到达状态':'Food arrival',r.arrived?(zh?'外卖已到':'Food is at the pickup point'):r.arrivalAt?(zh?'预计 ':'Expected ')+china.dateTime(r.arrivalAt):(zh?'暂未到达':'Not yet arrived'));
 if(food&&r.deliverBy)add(zh?'期望送达':'Deliver by',r.deliverBy);
 if(!food&&!task&&r.deadline)add(zh?'送达要求':'Deliver by',r.deadline);
 if(task&&r.dueAt)add(zh?'完成截止':'Complete by',china.dateTime(r.dueAt));
 if(r.closesAt)add(zh?'接单截止':'Accept by',china.dateTime(r.closesAt));
 if(r.createdAt)add(zh?'发布时间':'Posted at',china.dateTime(r.createdAt));
 const flags=[];if(r.soup)flags.push(zh?'含汤或饮料':'Soup or drinks');if(r.fragile)flags.push(zh?'易碎 · 请轻拿轻放':'Fragile · handle with care');if(Number(r.raised)>0)flags.push((zh?'已加价 ¥':'Offer raised ¥')+Number(r.raised).toFixed(2));
 const step=(zhName,enName,at)=>({name:zh?zhName:enName,at:at?china.dateTime(at):'—',done:!!at});
 const steps=[step('已发布','Posted',r.createdAt),step('已由认证学生接单','Taken by a verified student',r.takenAt)];
 if(!task)steps.push(step('已取件','Picked up',r.collectedAt));
 steps.push(step(task?'任务已完成 · 已提交凭证':'已送达 · 已提交凭证',task?'Task completed · proof submitted':'Delivered · proof submitted',r.deliveredAt),step('已确认','Confirmed',r.confirmedAt));
 return {id:String(r.id||''),category:r.category,status:r.status,statusLabel:status[zh?0:1],type,fields,flags,steps,note:food?String(r.note||'').trim():'',pickupPointDisplay:food&&!r.night?pickup:'',rewardText:Number.isFinite(Number(r.reward))?Number(r.reward).toFixed(2):'—',label:task?String(r.title||type):post.label(r.station,language)+' → '+destination};
}
module.exports={view};
