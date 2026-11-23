// Uniearn 的页面通过 account.call('sessionLogin'|'status') 拿账号，
// 合并版把这两步接到西浦跑（XP）的 HTTP 服务：/api/auth/login + token。
const api=require('./api'),util=require('./util'),store=require('./store');

function shape(user){
  const u=user||{};
  const status=u.runner_status==='approved'?'verified':u.runner_status==='pending'?'pending':u.runner_status==='rejected'?'rejected':'unverified';
  return {
    id:String(u.id||''), accountId:String(u.id||''),
    profile:{name:u.nickname||'',phone:u.phone||'',dorm:u.dorm||'',room:u.dorm_room||'',campusId:'sip',universityId:'xjtlu'},
    verification:{status,studentId:u.student_no||'',phoneVerified:!!u.phone},
    runnerRulesAccepted:status==='verified',
    loggedOut:false
  };
}

async function login(extra={}){
  const res=await api.login({nickname:extra.nickname||''});
  if(!res||res.ok!==true)throw Error(res&&res.message||'登录失败');
  util.setAuth(res.token,res.user);
  const account=shape(res.user);
  store.update(s=>{s.profile={...s.profile,name:account.profile.name,phone:account.profile.phone,accountId:account.accountId,onboarded:true,loggedOut:false,studentVerified:account.verification.status==='verified'};});
  return {account};
}

async function status(){
  if(!util.getToken()){const account=shape({});account.loggedOut=true;return {account};}
  try{
    const res=await api.get('/api/auth/me');
    const account=shape((res&&res.user)||{});
    store.update(s=>{s.profile={...s.profile,accountId:account.accountId,studentVerified:account.verification.status==='verified'};});
    return {account};
  }catch(e){
    if(e&&e.code==='UNAUTHORIZED'){const account=shape({});account.loggedOut=true;return {account};}
    throw e;
  }
}

// ---- 其余 account action 的 REST 映射 ----
async function call(action, extra={}){
  const api2=require('./api');
  switch(action){
    case 'sessionLogin': case 'wechatLogin': return login(extra);
    case 'status': return status();
    case 'logout': require('./util').clearAuth(); store.update(s=>{s.profile={...s.profile,loggedOut:true};}); return {account:{...shape({}),loggedOut:true}};
    case 'saveDisplayName': {
      const res=await api2.post('/api/auth/nickname',{nickname:String(extra.name||extra.displayName||'').trim()});
      return patchLocal(res&&res.user,{name:extra.name});
    }
    case 'saveDorm': {
      const res=await api2.post('/api/auth/dorm',{dorm_type:extra.gender||extra.dorm||''});
      return patchLocal(res&&res.user,{dorm:extra.dorm||''});
    }
    case 'saveAvatar': {
      const url=extra.url||extra.fileID||'';
      if(url&&/^https?:/.test(url)){try{await api2.post('/api/auth/avatar',{url});}catch(_){}}
      return patchLocal(null,{avatar:url});
    }
    case 'selectCampus': case 'campusInterest': case 'requestSchool': {
      store.update(s=>{s.profile={...s.profile,universityId:extra.universityId||s.profile.universityId||'xjtlu',campusId:extra.campusId||s.profile.campusId||'sip',onboarded:true};if(action==='campusInterest')s.campusInterest=extra;});
      return {account:shape(require('./util').getUser()||{})};
    }
    case 'agreeRules': {
      store.update(s=>{s.runnerRulesAccepted=true;});
      return {account:shape(require('./util').getUser()||{})};
    }
    case 'apply': {
      const a=extra.application||{};
      const res=await api2.post('/api/runner/apply',{real_name:a.realName||'',student_no:a.studentId||'',gender:a.gender||'',phone:a.phone||''});
      if(res&&res.ok===false)throw Error(res.message||'提交失败');
      return {account:shape((res&&res.user)||require('./util').getUser()||{})};
    }
    case 'adminLogin': return api2.post('/api/auth/admin-login',{username:extra.username,password:extra.password});
    case 'adminLogout': return {ok:true};
    case 'adminStatus': return api2.get('/api/admin/stats').catch(()=>({ok:false}));
    case 'adminDashboard': return api2.get('/api/admin/stats').catch(()=>({ok:false}));
    case 'adminOrders': return api2.get('/api/admin/orders',extra).catch(()=>({ok:false,list:[]}));
    default: throw Error('该账号操作尚未接入西浦跑后端：'+action);
  }
}
function patchLocal(user,patch){
  store.update(s=>{s.profile={...s.profile,...patch};});
  return {account:shape(user||require('./util').getUser()||{})};
}

module.exports={login,status,shape,call};
