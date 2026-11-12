// Order-linked support stays private to its reporter and the team.
const workflow=require('./workflow'),domain=require('./domain');
const reasons=['Not received','Wrong bag','Spilled or damaged','Something else'];
const check=(ok,message)=>{if(!ok)throw Error(message);};
function context(s,actor,id){
 const order=s.requests.find(r=>r.id===id),trip=order&&s.trips.find(t=>t.id===order.runnerId);
 check(order&&(order.ownerId===actor||trip&&trip.runnerAccountId===actor),'Only an order participant can send feedback.');
 return {order,owner:order.ownerId===actor};
}
function ticket(s,actor,r,now){
 const member=s.members[actor]||(s.members[actor]={marks:[]});member.supportTickets=member.supportTickets||[];
 let t=member.supportTickets.filter(t=>t.orderId===r.id&&t.status==='open').at(-1);
 if(!t){check(member.supportTickets.filter(t=>now-t.createdAt<86400000).length<10,'You can send up to 10 support requests a day.');t={id:'support-'+s.nextId++,topic:'order',orderId:r.id,orderCategory:r.category,createdAt:now,status:'open',messages:[]};member.supportTickets.push(t);member.supportTickets=member.supportTickets.slice(-50);}
 t.messages=t.messages||[];
 check(t.messages.filter(m=>now-m.at<86400000).length<50,'Too many messages today. Please wait for the team to reply.');
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
 check(reasons.includes(data.reason),'Choose a reason.');
 check(typeof data.note==='string'&&data.note.trim().length>=3&&data.note.trim().length<=500,'Describe the issue in 3–500 characters.');
 const note=data.note.trim(),photo=data.photo?validatePhoto(data.photo,actor,true):'';
 check(data.reason!=='Spilled or damaged'||photo,'Add a photo of the damage.');
 const t=ticket(s,actor,r,now);pause(r,owner,'team',now);
 if(owner&&r.status==='disputed')r.dispute={...(r.dispute||{}),reason:data.reason,note,photo,at:r.dispute?.at||now,updatedAt:now,contactOnly:false};
 t.messages.push({text:'Order #'+r.id+' · '+data.reason+'\n'+note,...(photo?{photo}:{}),at:now,mine:true});t.updatedAt=now;
 workflow.event(r,(owner?'Customer':'Runner')+' sent order feedback',now);
 return {ticketId:t.id,paused:owner&&r.status==='disputed'};
}
function closeTickets(s,id,now){
 for(const member of Object.values(s.members||{}))for(const t of member.supportTickets||[])if(t.orderId===id&&t.status==='open'){t.status='resolved';t.resolvedAt=now;}
}
function state(s,r,actor){
 const own=(s.members[actor]?.supportTickets||[]).some(t=>t.orderId===r.id&&t.status==='open');
 const any=Object.values(s.members||{}).some(m=>(m.supportTickets||[]).some(t=>t.orderId===r.id&&t.status==='open'));
 return {feedbackOpen:r.status==='disputed'||any,canResolveFeedback:r.ownerId===actor&&r.status==='disputed'||own,feedbackResolutionCompletes:r.ownerId===actor&&r.status==='disputed'};
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
module.exports={contact,submit,resolve,closeTickets,state};
