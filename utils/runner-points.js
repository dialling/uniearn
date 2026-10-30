// Predict the runner-role award; personal customer orders never consume it.
function quote(state,request){
 const rewards=state.rewards||{},activities=rewards.activities||{},config=activities.config||{},task=(config.tasks||[]).find(t=>t.kind==='runner_order');
 const regular=task&&Number.isFinite(task.points)?task.points:15,first=task&&task.firstCompletion&&Number.isFinite(task.firstCompletion.points)?task.firstCompletion.points:20;
 if(request&&Number.isFinite(request.runnerPointsAwarded))return request.runnerPointsAwarded;
 if(request&&['cancelled','refunded'].includes(request.status))return 0;
 if(task&&task.enabled===false||config.pointsProgram&&config.pointsProgram.status==='paused')return 0;
 const runnerOrders=(state.requests||[]).filter(r=>r.isRunner),confirmed=runnerOrders.filter(r=>r.status==='confirmed').sort((a,b)=>(a.confirmedAt||a.deliveredAt||0)-(b.confirmedAt||b.deliveredAt||0)||String(a.id).localeCompare(String(b.id)));
 const delivered=runnerOrders.filter(r=>r.status==='delivered').length;
 const archived=Math.max(0,Number((state.profile||{}).jobsDone||0)-confirmed.length-delivered);
 if(request&&request.status==='confirmed')return !archived&&confirmed[0]&&confirmed[0].id===request.id?first:regular;
 const completedRunner=archived>0||confirmed.length>0||(state.progression||{}).firstRunnerOrder===true;
 return completedRunner?regular:first;
}
module.exports={quote};
