'use strict';
const d=require('./domain');
function addTaskTip(s,id,amount,now=Date.now()){
 const r=s.requests.find(r=>r.id===id),trip=r&&s.trips.find(t=>t.id===r.runnerId);
 if(!r||r.category!=='task'||!['taken','delivered'].includes(r.status)||!trip||trip.cancelled||!trip.runnerAccountId||!trip.requestIds.includes(id))throw Error('Tips are available only for accepted tasks before confirmation.');
 if(typeof amount!=='number'||!Number.isFinite(amount)||amount<.01||!d.wholeCents(amount)||!Number.isSafeInteger(Math.round(amount*100))||!Number.isSafeInteger(Math.round(r.reward*100)+Math.round(amount*100)))throw Error('Enter a positive tip with up to 2 decimal places.');
 if(r.taskTipTripId&&r.taskTipTripId!==trip.id)throw Error('The runner changed. Refresh and try again.');
 r.taskTip=(Math.round(Number(r.taskTip||0)*100)+Math.round(amount*100))/100;
 r.reward=(Math.round(r.reward*100)+Math.round(amount*100))/100;
 r.taskTipTripId=trip.id;r.taskTipRunnerAccountId=trip.runnerAccountId;
 (r.history||(r.history=[])).push({label:'Tip added for runner: ¥'+amount.toFixed(2),at:now});
 return {id:r.id,tip:r.taskTip,reward:r.reward};
}
function returnTaskTip(r,now=Date.now()){
 if(r.category!=='task'||!(r.taskTip>0))return;
 const tip=Number(r.taskTip);r.reward=(Math.round(r.reward*100)-Math.round(tip*100))/100;
 r.taskTipRefunded=(Math.round(Number(r.taskTipRefunded||0)*100)+Math.round(tip*100))/100;
 r.taskTip=0;delete r.taskTipTripId;delete r.taskTipRunnerAccountId;
 (r.history||(r.history=[])).push({label:'Runner returned task · tip refunded: ¥'+tip.toFixed(2),at:now});
}
module.exports={addTaskTip,returnTaskTip};
