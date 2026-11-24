const crypto=require('crypto');
const VERSION='2026.10.22-a1',sources=['direct','share','invite','qr','other'];
function before(state){return new Map(state.requests.map(r=>[r.id,{status:r.status,runnerId:r.runnerId,deliveredAt:r.deliveredAt,confirmedAt:r.confirmedAt}]));}
function annotate(state,old,actor,event,now){
 for(const r of state.requests){
  const previous=old.get(r.id),trip=state.trips.find(t=>t.id===r.runnerId);
  if(trip?.runnerAccountId)r.analyticsRunnerId=trip.runnerAccountId;
  if(!previous){r.analytics={version:event.analyticsVersion===VERSION?VERSION:'server-v1',source:sources.includes(event.analyticsSource)?event.analyticsSource:'other',stationCode:'p-'+crypto.createHash('sha256').update(String(r.station||'')).digest('hex').slice(0,10)};}
  if(!previous||previous.status!==r.status||previous.runnerId!==r.runnerId){
   const list=r.analyticsEvents||(r.analyticsEvents=[]);
   if(list.length<80)list.push({at:now,type:!previous?'posted':r.status,action:['create','accept','acceptBoxes','startTrip','pickup','deliver','confirm','cancel','runnerCancel','taskDone'].includes(event.action)?event.action:'automatic',actor});
   else r.analyticsHistoryCapped=true;
  }
 }
}
module.exports={before,annotate};
