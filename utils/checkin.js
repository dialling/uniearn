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
function currentNotice(state=store.get()){
 const p=state.profile||{},account=p.accountId,record=state.progression?.checkin||{},today=china.dayKey(state.serverTime||0);
 if(!p.onboarded||p.loggedOut||!p.campusId||!account||state.progressionAccountId!==account||!state.serverTime||today!==china.dayKey(Date.now())||record.day!==today)return null;
 const n=(state.progression?.notices||[]).find(n=>n.type==='checkin'&&n.day===today);
 const dailyPoints=Number(record.dailyPoints)||0,weeklyPoints=Number(record.rewardPoints)||0;
 return {...(n||{id:'checkin-'+today,type:'checkin',day:today,streak:record.streak,cycleDay:record.cycleDay,dailyPoints,weeklyPoints,points:dailyPoints+weeklyPoints}),accountId:account,key:account+':'+today,preview:true,acknowledged:!n};
}
function claim(reopen=false){if(active)return null;const n=reopen?currentNotice():notice();if(!n)return null;active=n.key;store.update(s=>{s.checkinSeen={...(s.checkinSeen||{}),[n.accountId]:n.day};});return n;}
const played=new Set();
function wasFed(token){if(!token?.key)return false;try{return played.has(token.key)||!!wx.getStorageSync('uniearn:yuni-fed:'+token.key);}catch(_){return played.has(token.key);}}
function markFed(token){if(!token?.key)return;played.add(token.key);try{wx.setStorageSync('uniearn:yuni-fed:'+token.key,true);}catch(_){} }
const collected=new Set();
function wasCollected(token){if(!token?.key)return false;try{return collected.has(token.key)||!!wx.getStorageSync('uniearn:yuni-collected:'+token.key);}catch(_){return collected.has(token.key);}}
function markCollected(token){if(!token?.key)return;collected.add(token.key);try{wx.setStorageSync('uniearn:yuni-collected:'+token.key,true);}catch(_){} }
function release(key){if(active!==key)return;active='';store.update(()=>{});}
function pending(){return !!active||!!notice();}
module.exports={notice,claim,release,pending,wasFed,markFed,wasCollected,markCollected};
