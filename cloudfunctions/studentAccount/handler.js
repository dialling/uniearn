const crypto=require('crypto');
const idFor=openId=>crypto.createHash('sha256').update(openId).digest('hex');
const fail=(code,error)=>({ok:false,code,error});
const ADMIN_TTL=12*3600000,ADMIN_MAX_FAILS=5,ADMIN_LOCK=15*60000;
const ORDER_BUCKETS={all:null,waiting:['waiting'],unpaid:['delivered'],completed:['confirmed']};
function validateProfile(input) {
  const p={};
  for(const key of ['name','phone','dorm','room','pickup'])p[key]=String((input||{})[key]||'').trim();
  p.phone=p.phone.replace(/\s/g,'');
  if(p.name.length<2||p.name.length>60||!/^1\d{10}$/.test(p.phone)||[p.dorm,p.room,p.pickup].some(v=>v.length>100))throw Error('Enter your name and an 11-digit phone number.');
  return p;
}
function validateApplication(input,zh) {
  const x=input||{};
  const realName=String(x.realName||'').trim().replace(/\s+/g,' '),gender=String(x.gender||''),phone=String(x.phone||'').replace(/\s/g,''),studentId=String(x.studentId||'').replace(/\s/g,'');
  if(realName.length<2||realName.length>40)return {code:'INVALID_NAME',error:zh?'请填写真实姓名（2–40 个字）。':'Enter your real name (2–40 characters).'};
  if(!/^1\d{10}$/.test(phone))return {code:'INVALID_PHONE',error:zh?'请填写 11 位手机号。':'Enter an 11-digit mobile number.'};
  if(!['male','female'].includes(gender))return {code:'INVALID_GENDER',error:zh?'请选择性别。':'Choose your gender.'};
  if(!/^\d{6,12}$/.test(studentId))return {code:'INVALID_STUDENT_ID',error:zh?'请填写正确的学号（6–12 位数字）。':'Enter your student ID (6–12 digits).'};
  return {value:{realName,gender,phone,studentId}};
}
// Hashing both sides first keeps timingSafeEqual usable for inputs of different length.
// ADMIN_ACCOUNTS holds several logins as "name:password;name2:password2"; ADMIN_USERNAME/ADMIN_PASSWORD still works as one more.
const adminAccounts=env=>String(env.ADMIN_ACCOUNTS||'').split(/[;\n]/).map(x=>{const i=x.indexOf(':');return i>0?{username:x.slice(0,i).trim(),password:x.slice(i+1).trim()}:null;}).filter(Boolean).concat(env.ADMIN_USERNAME?[{username:String(env.ADMIN_USERNAME),password:String(env.ADMIN_PASSWORD||'')}]:[]).filter(x=>x.username&&x.password.length>=8);
const sameSecret=(a,b)=>crypto.timingSafeEqual(crypto.createHash('sha256').update(String(a||'')).digest(),crypto.createHash('sha256').update(String(b||'')).digest());
function publicAccount(a,id){if(a.loggedOut)return {id,loggedOut:true,hasProfile:!!a.profile,profile:null,verification:{status:'unverified'}};return {id,runnerRulesAccepted:!!a.runnerRulesAcceptedAt,profile:a.profile||null,wechatPhone:a.wechatPhone||(a.profile&&a.profile.wechatPhone)||'',verification:a.verification?{status:a.verification.status,method:a.verification.method||'',checkedAt:a.verification.checkedAt||null,submittedAt:a.verification.submittedAt||null,studentName:a.verification.studentName||'',school:a.verification.school||'',studentLast4:a.verification.studentLast4||'',reason:a.verification.reason||'',phoneVerified:!!a.verification.phoneVerified}:{status:'unverified'}};}
function orderStats(requests){const count=list=>requests.filter(r=>list.includes(r.status)).length;return {total:requests.length,waiting:count(ORDER_BUCKETS.waiting),unpaid:count(ORDER_BUCKETS.unpaid),completed:count(ORDER_BUCKETS.completed)};}
function orderRow(r){return {id:String(r.id||''),category:r.category||'',status:r.status||'',title:String(r.title||'').slice(0,60),station:r.station||'',dorm:r.dorm||'',reward:Number(r.reward)||0,createdAt:r.createdAt||null};}
function createHandler({getOpenId,repo,env,now=Date.now}) {
  return async function(event={}) {
    const openId=getOpenId();if(!openId)return fail('AUTH_REQUIRED','Open this Mini Program in WeChat to continue.');
    const id=idFor(openId),action=event.action||'status',zh=event.lang!=='en';
    let stage='load-account';
    try {
      const account=await repo.get(id)||{};
      const reviewers=String(env.REVIEWER_OPENIDS||'').split(',').map(x=>x.trim()).filter(Boolean);
      // An admin session is bound to authRevision, so logging out or signing in again ends it.
      const isAdmin=reviewers.includes(openId)||!!(account.admin&&account.admin.until>now()&&account.admin.revision===(account.authRevision||0));
      if(action==='sessionLogin'){
        const profile=account.profile||{name:'',phone:'',dorm:'',room:'',pickup:''};
        const patch={profile,loggedOut:false,authRevision:(account.authRevision||0)+1,updatedAt:now()};
        await repo.patch(id,patch);return {ok:true,account:publicAccount({...account,...patch},id)};
      }
      if(['selectCampus','campusInterest','requestSchool'].includes(action)){
        if(account.loggedOut||!account.profile)return fail('LOGIN_REQUIRED','Sign in first.');
        let profile={...account.profile};
        if(action==='selectCampus'){
          if(event.universityId!=='xjtlu'||event.campusId!=='sip')return fail('CAMPUS_CLOSED','Only XJTLU SIP campus is open.');
          profile.universityId='xjtlu';profile.campusId='sip';
        }else if(action==='campusInterest'){
          if(event.campusId!=='taicang')return fail('INVALID_CAMPUS','Unknown campus.');profile.taicangInterested=true;
        }else{
          const school=String(event.school||'').trim();if(!school||school.length>100)return fail('INVALID_SCHOOL','Enter a university or city, up to 100 characters.');
          const requests=(profile.schoolRequests||[]).filter(x=>x.school!==school);profile.schoolRequests=[...requests,{school,at:now()}].slice(-10);
        }
        const patch={profile,updatedAt:now()};await repo.patch(id,patch);return {ok:true,account:publicAccount({...account,...patch},id)};
      }
      if(action==='status')return {ok:true,account:publicAccount(account,id)};
      if(action==='logout'){
        await repo.logout(id);
        return {ok:true,account:publicAccount({...account,loggedOut:true},id)};
      }
      if(action==='saveDorm'){
        if(account.loggedOut||!account.profile)return fail('LOGIN_REQUIRED','Sign in first.');
        const address={};for(const key of ['dorm','room','pickup']){if(typeof event[key]!=='string')return fail('INVALID_ADDRESS','Complete your building, room and pickup point.');address[key]=event[key].trim();if(!address[key]||address[key].length>100)return fail('INVALID_ADDRESS','Complete your building, room and pickup point.');}
        const profile={...account.profile,...address};const patch={profile,updatedAt:now()};await repo.patch(id,patch);return {ok:true,account:publicAccount({...account,...patch},id)};
      }
      if(action==='saveProfile') {
        if(account.loggedOut)return fail('LOGIN_REQUIRED','Sign in first.');
        const profile={...(account.profile||{}),...validateProfile(event.profile)};
        // Name changes revoke approval; a new runner application and admin review are required.
        const patch={profile,updatedAt:now()};
        if(account.profile&&account.profile.name!==profile.name)patch.verification={status:'unverified'};
        await repo.patch(id,patch);return {ok:true,account:publicAccount({...account,...patch},id)};
      }
      if(action==='apply') {
        if(account.loggedOut||!account.profile)return fail('LOGIN_REQUIRED',zh?'请先登录并填写个人信息。':'Sign in and save your profile first.');
        if(account.verification&&account.verification.status==='verified')return {ok:true,account:publicAccount(account,id)};
        const checked=validateApplication(event.application,zh);if(checked.error)return fail(checked.code,checked.error);
        const app=checked.value;
        stage='check-student-id';
        if((await repo.findStudent(app.studentId)).some(owner=>owner!==id))return fail('STUDENT_ID_USED',zh?'该学号已被其他账号申请，请联系管理员。':'This student ID is already used by another account. Contact an admin.');
        stage='check-phone';
        if(repo.findPhone&&(await repo.findPhone(app.phone)).some(owner=>owner!==id))return fail('PHONE_USED',zh?'该手机号已被其他跑手账号使用，请联系管理员处理。':'This phone number is already used by another runner account. Contact an admin.');
        const wechatPhone=account.wechatPhone||(account.profile&&account.profile.wechatPhone)||'',phoneVerified=!!wechatPhone&&wechatPhone===app.phone;
        const verification={status:'pending',method:'application',realName:app.realName,gender:app.gender,phone:app.phone,phoneVerified,phoneSource:phoneVerified?'wechat':'manual',studentId:app.studentId,studentName:app.realName,studentLast4:app.studentId.slice(-4),school:'XJTLU',submittedAt:now()};
        stage='save-application';
        const saved=await repo.submitApplication(id,account,verification,now());
        if(saved)return fail(saved,saved==='STUDENT_ID_USED'?(zh?'该学号已被其他账号申请，请联系管理员。':'This student ID is already used by another account. Contact an admin.'):(zh?'账号信息已变化，请刷新后重新申请。':'Your account changed. Refresh and apply again.'));
        return {ok:true,account:publicAccount({...account,verification},id)};
      }
      if(action==='agreeRules') {
        if(account.loggedOut||!account.verification||account.verification.status!=='verified')return fail('NOT_VERIFIED','Complete student verification first.');
        if(event.accepted!==true)return fail('RULES_REQUIRED','Agree to all five rules.');
        const patch={runnerRulesAcceptedAt:now(),runnerRulesVersion:'1.0'};await repo.patch(id,patch);
        return {ok:true,account:publicAccount({...account,...patch},id)};
      }
      if(action==='adminStatus')return {ok:true,admin:isAdmin};
      if(action==='adminLogin') {
        const admins=adminAccounts(env);
        if(!admins.length)return fail('ADMIN_SETUP',zh?'管理员账号尚未配置，请在云函数环境变量中设置 ADMIN_ACCOUNTS。':'Admin login is not configured. Set ADMIN_ACCOUNTS on the cloud function.');
        const tries=account.adminLogin||{};
        if(tries.lockedUntil>now())return fail('ADMIN_LOCKED',zh?'尝试次数过多，请 15 分钟后再试。':'Too many attempts. Try again in 15 minutes.');
        let matched=null;for(const a of admins){const ok=sameSecret(event.username,a.username)&sameSecret(event.password,a.password);if(ok&&!matched)matched=a;}
        if(!matched){
          const fails=(tries.fails||0)+1,locked=fails>=ADMIN_MAX_FAILS;
          await repo.patch(id,{adminLogin:{fails:locked?0:fails,lockedUntil:locked?now()+ADMIN_LOCK:0}});
          return fail('ADMIN_INVALID',zh?'账号或密码错误。':'Incorrect username or password.');
        }
        await repo.patch(id,{admin:{until:now()+ADMIN_TTL,revision:account.authRevision||0,at:now(),by:matched.username},adminLogin:{fails:0,lockedUntil:0}});
        return {ok:true,admin:true};
      }
      if(action==='adminLogout'){if(account.admin)await repo.patch(id,{admin:null});return {ok:true,admin:false};}
      if(['adminDashboard','adminOrders','review'].includes(action)&&!isAdmin)return fail('FORBIDDEN',zh?'请先登录管理员账号。':'Admin login required.');
      if(action==='adminDashboard') {
        stage='load-dashboard';
        const [counts,requests,pending,archived]=await Promise.all([repo.accountCounts(),repo.orderRequests(),repo.applications(50),repo.archivedCounts?repo.archivedCounts():{total:0,completed:0}]);
        const applications=pending.map(a=>({accountId:a._id,realName:a.verification.realName||a.verification.studentName||'',gender:a.verification.gender||'',phone:a.verification.phone||'',phoneVerified:!!a.verification.phoneVerified,studentId:a.verification.studentId||'',submittedAt:a.verification.submittedAt||null}));
        // Finished orders older than about a week live in the archive collection; only finished orders are archived.
        const live=orderStats(requests);
        return {ok:true,stats:{...live,total:live.total+archived.total,completed:live.completed+archived.completed,users:counts.users,runners:counts.runners,pending:counts.pending},applications};
      }
      if(action==='adminOrders') {
        if(!Object.prototype.hasOwnProperty.call(ORDER_BUCKETS,event.bucket))return fail('INVALID_BUCKET','Unknown order list.');
        stage='load-orders';
        const statuses=ORDER_BUCKETS[event.bucket],requests=await repo.orderRequests();
        const rows=requests.filter(r=>!statuses||statuses.includes(r.status)).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0)).slice(0,50).map(orderRow);
        return {ok:true,orders:rows};
      }
      if(action==='review') {
        if(!/^[a-f0-9]{64}$/.test(event.accountId||'')||!['approve','reject'].includes(event.decision))return fail('INVALID_REVIEW','Invalid review.');
        const target=await repo.get(event.accountId);
        if(!target||!target.verification||target.verification.status!=='pending')return fail('NOT_PENDING',zh?'该申请已处理或已撤回，请刷新。':'This application is no longer pending. Refresh the list.');
        const note=String(event.note||'').trim();
        if(note.length>300)return fail('REVIEW_NOTE',zh?'备注最多 300 字。':'Keep the note under 300 characters.');
        const rejected=event.decision==='reject';
        if(!rejected&&(await repo.findStudent(target.verification.studentId)).some(owner=>owner!==event.accountId))return fail('STUDENT_ID_USED',zh?'该学号存在其他申请或认证，请先核实重复记录。':'Another application or verified account uses this student ID. Resolve the duplicate first.');
        const verification={...target.verification,status:rejected?'rejected':'verified',checkedAt:now(),reviewerId:id,reviewNote:note,reason:rejected?(note||(zh?'信息未通过审核，请核对后重新提交。':'Your details could not be confirmed. Check them and apply again.')):''};
        if(!await repo.review(event.accountId,target.verification,verification))return fail('REVIEW_CHANGED',zh?'申请内容已变化，请刷新后再审核。':'The application changed. Reload it before reviewing.');
        return {ok:true};
      }
      return fail('INVALID_ACTION','Unknown action.');
    } catch(error) {
      if(error.message&&error.message.startsWith('Enter your name'))return fail('INVALID_PROFILE',error.message);
      const code=String(error.code||error.errCode||'UNKNOWN').replace(/[^A-Za-z0-9_.-]/g,'').slice(0,80);
      const message=String(error.message||error.errMsg||'').replace(/cloud:\/\/\S+/g,'[file]').replace(/[A-Za-z0-9+/=_-]{32,}/g,'[redacted]').replace(/\d{7,}/g,'[number]').slice(0,600);
      console.error('studentAccount failure',{action,stage,code,message});
      return fail('SERVICE_UNAVAILABLE','Account service failed at '+stage+' ('+code+'). Please contact support if retrying fails.');
    }
  };
}
module.exports={createHandler,validateProfile,validateApplication,orderStats,idFor,publicAccount};
