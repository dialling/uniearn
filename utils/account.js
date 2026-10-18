const {ensureCloud}=require('./cloud'),store=require('./store');
async function call(action,extra={}) {
  const wasVerified=!!store.get().profile.studentVerified;
  const cloud=ensureCloud();
  const {result}=await cloud.callFunction({name:'studentAccount',data:{action,lang:store.get().language==='en'?'en':'zh',...extra}});
  if(!result||!result.ok)throw Error(result&&result.error||'Could not reach the account service.');
  if(result.account&&!!result.account.loggedOut!==!!store.get().profile.loggedOut)require('./orders').invalidate();
 if(result.account)store.update(s=>{if(result.account.loggedOut){s.requests=[];s.trips=[];s.publicTrips=[];s.publicJobs=[];s.photoURLs={};s.rewards=null;s.preferences={};}s.profile={...s.profile,...(result.account.loggedOut?{name:'',phone:'',wechatPhone:'',dorm:'',room:'',pickup:'',universityId:'',campusId:''}:(result.account.profile||{})),...(!result.account.loggedOut&&result.account.wechatPhone?{wechatPhone:result.account.wechatPhone}:{}),runnerRulesAccepted:!!result.account.runnerRulesAccepted,loggedOut:!!result.account.loggedOut,onboarded:!!result.account.profile,studentVerified:result.account.verification.status==='verified',verification:result.account.verification,accountId:result.account.id};});
  if(!wasVerified&&result.account&&result.account.verification.status==='verified'&&!result.account.runnerRulesAccepted)require('./yuni-events').emit({key:'student-verified:'+result.account.id,title:store.get().language==='en'?'Student check passed!':'学生认证已通过！',text:store.get().language==='en'?'Next, read and accept the runner rules.':'下一步，阅读并接受跑手规则。',pose:'happy'});
  if(action==='agreeRules'&&result.account&&result.account.runnerRulesAccepted)require('./yuni-events').emit({key:'runner-ready:'+result.account.id,title:store.get().language==='en'?"You’re a runner!":'你已成为跑手！',text:store.get().language==='en'?'Take jobs on your way and earn.':'顺路接单，赚一点。',pose:'go'});
  return result;
}
async function requireRunner(){const r=await call('status');const p=store.get().profile;if(!p.name||!/^1\d{10}$/.test(p.phone||'')){require('./nav').navigateTo({url:'/pages/profile/index'});return false;}if(r.account.verification.status!=='verified'||!r.account.runnerRulesAccepted){require('./nav').navigateTo({url:store.get().profile.onboarded?'/pages/student-check/index':'/pages/welcome/index'});return false;}return true;}
module.exports={call,requireRunner};
