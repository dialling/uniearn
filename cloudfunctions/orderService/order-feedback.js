// Order-linked support stays private to its reporter and the team.
const workflow=require('./workflow'),domain=require('./domain');
// Same ids as utils/report-reasons.js; the screen picks the list by role and stage.
const customerReasons=['Report response','Runner not responding','Runner very late','Not received','Wrong bag','Spilled or damaged','Task not completed','Result differs','Something else'];
const runnerReasons=['Report response','Food not ready','Seal broken','Customer not responding','Cannot find address','Something else'];
const photoReasons=['Spilled or damaged','Seal broken'];
const check=(ok,message)=>{if(!ok)throw Error(message);};
function context(s,actor,id){
 const order=s.requests.find(r=>r.id===id),trip=order&&s.trips.find(t=>t.id===order.runnerId);
 check(order&&(order.ownerId===actor||trip&&trip.runnerAccountId===actor),'Only an order participant can send feedback.');
 return {order,owner:order.ownerId===actor};
}
function ticket(s,actor,r,now){
 const member=s.members[actor]||(s.members[actor]={marks:[]});member.supportTickets=member.supportTickets||[];
 let t=member.supportTickets.filter(t=>t.orderId===r.id&&t.status==='open').at(-1);
 if(!t){check(member.supportTickets.filter(t=>now-t.createdAt<86400000).length<100,'You can send up to 100 support requests a day.');t={id:'support-'+s.nextId++,topic:'order',orderId:r.id,orderCategory:r.category,createdAt:now,status:'open',messages:[]};member.supportTickets.push(t);member.supportTickets=member.supportTickets.slice(-150);}
 t.messages=t.messages||[];
 check(t.messages.filter(m=>now-m.at<86400000).length<500,'Too many messages today. Please wait for the team to reply.');
 return t;
}
function holdUntil(r,now){
 const window=workflow.reviewHours()*3600000;
 return Math.max((r.deliveredAt||now)+window,now+window);
}
function pause(r,owner,channel,now){
 if(!owner||r.status!=='delivered')return false;
 // expire() runs before every action: already settled orders are never reopened.
 r.status='disputed';
 r.settle_hold_until=holdUntil(r,now);
 r.dispute={reason:'Something else',note:'Customer requested help via '+channel,at:now,channel,contactOnly:true};
 workflow.event(r,'Order help requested · settlement paused',now);return true;
}
function contact(s,actor,data,now){
 check(['phone','message','team'].includes(data.channel),'Choose a contact option.');
 const {order:r,owner}=context(s,actor,data.id);
 if(data.channel!=='team'){
  const trip=s.trips.find(t=>t.id===r.runnerId);check(trip&&trip.runnerAccountId,'No runner is assigned to this order.');
  if(data.channel==='phone')check(owner?trip.runnerPhone:r.phone,'No phone number is available.');
  if(data.channel==='message')check(!r.deliveredAt||now<r.deliveredAt+86400000,'This chat closed 24 hours after delivery.');
 }
 const t=ticket(s,actor,r,now),paused=pause(r,owner,data.channel,now);
 // Keep repeat taps from filling the team inbox with identical contact notices.
 if(!(t.messages||[]).some(m=>m.contactChannel===data.channel))t.messages.push({text:'Order #'+r.id+' · '+(owner?'Customer':'Runner')+' requested '+data.channel+' support.',at:now,mine:true,contactChannel:data.channel});
 t.updatedAt=now;return {ticketId:t.id,paused:paused||owner&&r.status==='disputed'};
}
function submit(s,actor,data,now,validatePhoto){
 const {order:r,owner}=context(s,actor,data.id);
 // 2026-11-14: the feedback page is a chat with the team (pick a problem first, then plain messages).
 // The first message about an order must say what the problem is; later messages are plain chat.
 const started=(s.members[actor]?.supportTickets||[]).some(t=>t.orderId===r.id&&(t.messages||[]).some(m=>m.mine&&!m.contactChannel));
 check(started||!!data.reason,'Choose what the problem is first.');
 const reason=data.reason||'Something else';check((owner?customerReasons:runnerReasons).includes(reason),'Choose a reason.');
 check(typeof data.note==='string'&&data.note.trim().length>=1&&data.note.trim().length<=500,'Write a message up to 500 characters.');
 const note=data.note.trim(),photo=data.photo?validatePhoto(data.photo,actor,true):'';
 check(!photoReasons.includes(reason)||photo,reason==='Seal broken'?'Add a photo of the broken seal.':'Add a photo of the damage.');
 if(!owner&&reason==='Seal broken'&&!r.sealReportedAt)r.sealReportedAt=now;
 const t=ticket(s,actor,r,now);if(reason!=='Report response')pause(r,owner,'team',now);
 if(owner&&r.status==='disputed'&&(data.reason||r.dispute?.contactOnly!==false))r.dispute={...(r.dispute||{}),reason,note,photo:photo||r.dispute?.photo||'',at:r.dispute?.at||now,updatedAt:now,contactOnly:false};
 t.messages.push({text:(data.reason&&data.reason!=='Something else'?'['+data.reason+'] ':'')+note,note,...(data.reason?{reason:data.reason}:{}),...(photo?{photo}:{}),at:now,mine:true});t.readAt=now;t.updatedAt=now;
 if(t.messages.filter(m=>m.mine).length===1)workflow.event(r,(owner?'Customer':'Runner')+' contacted the UniEarn team',now);
 return {ticketId:t.id,paused:owner&&r.status==='disputed'};
}
function closeTickets(s,id,now){
 for(const member of Object.values(s.members||{}))for(const t of member.supportTickets||[])if(t.orderId===id&&t.status==='open'){t.status='resolved';t.resolvedAt=now;}
}
// No longer a topic (2026-11-14); kept so older reports with this reason stay hidden from the customer.
const SAFETY_REASONS=['Customer unsafe or rude'];
// The first reason a reporter picked decides how the other side sees the report.
function hiddenFromOther(t){const first=(t.messages||[]).find(m=>m.mine&&m.reason);return !!first&&SAFETY_REASONS.includes(first.reason);}
function state(s,r,actor){
 const own=(s.members[actor]?.supportTickets||[]).some(t=>t.orderId===r.id&&t.status==='open');
 // 2026-11-14 (user decision): any open report marks the order as an "Order issue" for both sides.
 // The reason, words and photos still stay private; only the neutral note (notice()) is shared.
 // A "Customer unsafe or rude" report is never shown to the customer, not even as an order issue; only the team sees it.
 const any=Object.entries(s.members||{}).some(([id,m])=>id!==actor&&(m.supportTickets||[]).some(t=>t.orderId===r.id&&t.status==='open'&&!(r.ownerId===actor&&hiddenFromOther(t))));
 return {feedbackOpen:r.status==='disputed'||own||any,canResolveFeedback:r.ownerId===actor&&r.status==='disputed'||own,feedbackResolutionCompletes:r.ownerId===actor&&r.status==='disputed'};
}
function resolve(s,actor,data,now){
 const {order:r,owner}=context(s,actor,data.id);
 if(owner&&r.status==='disputed'&&r.dispute){
  r.status='delivered';domain.confirm(s,r.id);r.confirmedAt=now;r.dispute.resolvedAt=now;r.dispute.resolvedBy='customer';
  workflow.event(r,'Customer resolved the issue · confirmed',now);closeTickets(s,r.id,now);return {id:r.id,completed:true};
 }
 const open=(s.members[actor]?.supportTickets||[]).filter(t=>t.orderId===r.id&&t.status==='open');
 check(open.length,'Only the reporter can resolve this feedback.');
 for(const t of open){t.status='resolved';t.resolvedAt=now;}
 workflow.event(r,'Reporter resolved feedback · order progress unchanged',now);return {id:r.id,completed:false};
}
function read(s,actor,data,now){const {order:r}=context(s,actor,data.id);for(const t of (s.members[actor]?.supportTickets||[]))if(t.orderId===r.id)t.readAt=now;return {id:r.id};}
// Team replies the participant has not opened yet, with the latest one for previews.
function unread(s,actor,id){const tickets=(s.members[actor]?.supportTickets||[]).filter(t=>t.orderId===id),team=tickets.flatMap(t=>(t.messages||[]).filter(m=>!m.mine&&m.at>(t.readAt||0)));const last=team[team.length-1];return {supportUnread:team.length,supportPreview:last?String(last.text||''):'',supportPreviewZh:last?String(last.textZh||last.text||''):''};}
// 2026-11-14 (user decision): the other participant sees the reason the reporter picked (e.g. "Customer not responding"),
// never the reporter's own words or photos. It shows while that report is open.
function notice(s,r,actor){
 const owner=r.ownerId===actor,trip=s.trips.find(t=>t.id===r.runnerId),other=owner?(trip&&trip.runnerAccountId):r.ownerId;
 if(!other||other===actor)return {reportNotice:''};
 const last=(s.members[other]?.supportTickets||[]).filter(t=>t.orderId===r.id&&t.status==='open').flatMap(t=>t.messages||[]).filter(m=>m.mine&&m.reason&&!SAFETY_REASONS.includes(m.reason)&&m.reason!=='Report response').sort((x,y)=>x.at-y.at).at(-1);
 return {reportNotice:last?last.reason:''};
}
// 2026-11-14: the Uniearn team can close an order's reports for both sides without asking either of them.
// Each open conversation gets a closing message (shown as an unread team reply) before it is closed.
const TEAM_CLOSE={
 resolved:['The UniEarn team has resolved this report.','UniEarn 团队已处理完这条反馈。'],
 release:['The UniEarn team reviewed this report and released the payout to the runner.','UniEarn 团队已审核，赏金已结算给跑手。'],
 refund:['The UniEarn team reviewed this report and refunded the order.','UniEarn 团队已审核，本单已退款。']
};
function teamClose(s,id,now,outcome='resolved'){
 const [text,textZh]=TEAM_CLOSE[outcome]||TEAM_CLOSE.resolved;let closed=0;
 for(const member of Object.values(s.members||{}))for(const t of member.supportTickets||[])if(t.orderId===id&&t.status==='open'){(t.messages||(t.messages=[])).push({text,textZh,at:now,mine:false,teamClose:outcome});t.status='resolved';t.resolvedAt=now;t.resolvedBy='team';closed++;}
 return closed;
}
module.exports={contact,submit,resolve,closeTickets,state,read,unread,notice,teamClose};
