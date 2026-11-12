// Feedback has its own lifecycle: a taken order can have an unresolved ticket.
function state(r,tickets=[]){
 const own=tickets.some(t=>t.orderId===r.id&&t.status==='open');
 return {feedbackOpen:!!r.feedbackOpen||r.status==='disputed'||own,canResolveFeedback:!!r.canResolveFeedback||!!r.isMine&&r.status==='disputed'||own,feedbackResolutionCompletes:!!r.isMine&&r.status==='disputed'};
}
function view(r){return {...r,...state(r,require('./store').get().supportTickets||[])};}
module.exports={state,view};
