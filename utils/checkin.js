const store=require('./store'),china=require('./china-time');
let active='';
function notice(state=store.get()){
 const p=state.profile||{},account=p.accountId;
 if(!p.onboarded||p.loggedOut||!p.campusId||!account||state.progressionAccountId!==account)return null;
 const today=china.dayKey(Date.now());
 if(!state.serverTime||china.dayKey(state.serverTime)!==today)return null;
 const n=(state.progression?.notices||[]).find(n=>n.type==='checkin'&&n.day===today);
 return n&&(state.checkinSeen||{})[account]!==today?{...n,accountId:account,key:account+':'+today}:null;
}
function claim(){if(active)return null;const n=notice();if(!n)return null;active=n.key;store.update(s=>{s.checkinSeen={...(s.checkinSeen||{}),[n.accountId]:n.day};});return n;}
function release(key){if(active!==key)return;active='';store.update(()=>{});}
function pending(){return !!active||!!notice();}
module.exports={notice,claim,release,pending};
