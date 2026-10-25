const {ensureCloud}=require('./cloud'),store=require('./store');
async function call(action,extra={}) {
  const wasVerified=!!store.get().profile.studentVerified;
  const cloud=ensureCloud();
  const {result}=await cloud.callFunction({name:'studentAccount',data:{action,lang:store.get().language==='en'?'en':'zh',...extra}});
  if(!result||!result.ok)throw Error(result&&result.error||'Could not reach the account service.');
  if(result.account&&!!result.account.loggedOut!==!!store.get().profile.loggedOut)require('./orders').invalidate();
 if(result.account)store.update(s=>{if(s.profile.accountId!==result.account.id)s.walletSummary=null;if(result.account.loggedOut){s.walletSummary=null;s.requests=[];s.trips=[];s.publicTrips=[];s.publicJobs=[];s.photoURLs={};s.rewards=null;s.preferences={};}s.profile={...s.profile,...(result.account.loggedOut?{name:'',phone:'',wechatPhone:'',dorm:'',room:'',pickup:'',universityId:'',campusId:''}:(result.account.profile||{})),...(!result.account.loggedOut&&result.account.wechatPhone?{wechatPhone:result.account.wechatPhone}:{}),runnerRulesAccepted:!!result.account.runnerRulesAccepted,loggedOut:!!result.account.loggedOut,onboarded:!!result.account.profile,studentVerified:result.account.verification.status==='verified',verification:result.account.verification,accountId:result.account.id};});
  if(!wasVerified&&result.account&&result.account.verification.status==='verified'&&!result.account.runnerRulesAccepted)require('./yuni-events').emit({key:'student-verified:'+result.account.id,title:store.get().language==='en'?'Student check passed!':'学生认证已通过！',text:store.get().language==='en'?'Next, read and accept the runner rules.':'下一步，阅读并接受跑手规则。',pose:'happy'});
  if(action==='agreeRules'&&result.account&&result.account.runnerRulesAccepted)require('./yuni-events').emit({key:'runner-ready:'+result.account.id,title:store.get().language==='en'?"You’re a runner!":'你已成为跑手！',text:store.get().language==='en'?'Take jobs on your way and earn.':'顺路接单，赚一点。',pose:'go'});
  return result;
}
async function requireRunner(){
 const r=await call('status'),a=r.account;
 if(a.loggedOut||!a.profile){require('./nav').navigateTo({url:'/pages/welcome/index'});return false;}
 if(a.verification.status!=='verified'||!a.runnerRulesAccepted){require('./nav').navigateTo({url:'/pages/student-check/index'});return false;}
 // The acceptance endpoint validates the stored reviewed contact. Older status
 // responses may omit it; a missing response field must not redirect to Me.
 return true;
}
module.exports={call,requireRunner};
