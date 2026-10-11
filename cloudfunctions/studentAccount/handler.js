const crypto=require('crypto');
const {readCard}=require('./card');
const idFor=openId=>crypto.createHash('sha256').update(openId).digest('hex');
const fail=(code,error)=>({ok:false,code,error});
function validateProfile(input) {
  const p={};
  for(const key of ['name','phone','dorm','room','pickup'])p[key]=String((input||{})[key]||'').trim();
  p.phone=p.phone.replace(/\s/g,'');
  if(p.name.length<2||p.name.length>60||!/^1\d{10}$/.test(p.phone)||[p.dorm,p.room,p.pickup].some(v=>v.length>100))throw Error('Enter your name and an 11-digit phone number.');
  return p;
}
function publicAccount(a,id){if(a.loggedOut)return {id,loggedOut:true,hasProfile:!!a.profile,profile:null,verification:{status:'unverified'}};return {id,runnerRulesAccepted:!!a.runnerRulesAcceptedAt,profile:a.profile||null,verification:a.verification?{status:a.verification.status,checkedAt:a.verification.checkedAt||null,submittedAt:a.verification.submittedAt||null,studentName:a.verification.studentName||'',school:a.verification.school||'',studentLast4:a.verification.studentLast4||'',reason:a.verification.reason||''}:{status:'unverified'}};}
function createHandler({getOpenId,repo,ocr,env,loadImage,deleteImage,now=Date.now}) {
  return async function(event={}) {
    const openId=getOpenId();if(!openId)return fail('AUTH_REQUIRED','Open this Mini Program in WeChat to continue.');
    const id=idFor(openId),action=event.action||'status';
    let scanToken='',cleanupFile='',stage='load-account';
    try {
      const account=await repo.get(id)||{};
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
        if(account.loggedOut)return fail('LOGIN_REQUIRED','Upload your student card to log in first.');
        const profile={...(account.profile||{}),...validateProfile(event.profile)};
        // Name changes revoke approval; a new OCR submission and review are required.
        const patch={profile,updatedAt:now()};
        if(account.profile&&account.profile.name!==profile.name)patch.verification={status:'unverified'};
        await repo.patch(id,patch);return {ok:true,account:publicAccount({...account,...patch},id)};
      }
      if(action==='review') {
        const admins=String(env.REVIEWER_OPENIDS||'').split(',').map(x=>x.trim()).filter(Boolean);
        if(!admins.includes(openId))return fail('FORBIDDEN','Reviewer access required.');
        if(!/^[a-f0-9]{64}$/.test(event.accountId||'')||!['approve','reject'].includes(event.decision))return fail('INVALID_REVIEW','Invalid review.');
        const target=await repo.get(event.accountId);
        if(!target||!target.verification||target.verification.status!=='pending')return fail('NOT_PENDING','This account is not awaiting review.');
        const note=String(event.note||'').trim();
        if(note.length<10||note.length>300)return fail('REVIEW_NOTE','Record how you independently checked this student (10–300 characters).');
        const verification={...target.verification,status:event.decision==='approve'?'verified':'rejected',checkedAt:now(),reviewerId:id,reviewNote:note,reason:event.decision==='reject'?'Please contact support to complete your student check.':''};
        if(!await repo.review(event.accountId,target.verification,verification))return fail('REVIEW_CHANGED','The student check changed. Reload it before reviewing.');return {ok:true};
      }
      if(action==='prepareUpload'){
        if(!account.profile)return fail('PROFILE_REQUIRED','Save your information in Me first.');
        return {ok:true,cloudPath:'student-temp/'+id+'/'+crypto.randomBytes(16).toString('hex')+'.jpg'};
      }
      if(action!=='scan')return fail('INVALID_ACTION','Unknown action.');
      if(!account.profile)return fail('PROFILE_REQUIRED','Save your information in Me first.');
      if(!account.loggedOut&&account.verification&&account.verification.status==='verified')return {ok:true,account:publicAccount(account,id)};
      if(event.consent!==true)return fail('CONSENT_REQUIRED','Agree to send your card image for text recognition.');
      if(!env.STUDENT_HASH_SECRET||env.STUDENT_HASH_SECRET.length<32)return fail('SETUP_REQUIRED','Student check is not configured yet.');
      const fileID=event.fileID;
      const filePath=typeof fileID==='string'&&fileID.match(/^cloud:\/\/[^/]+\/(.+)$/);
      const prefix='student-temp/'+id+'/';
      if(!filePath||!filePath[1].startsWith(prefix)||!/^[a-f0-9]{32}\.jpg$/.test(filePath[1].slice(prefix.length)))return fail('INVALID_IMAGE','Please upload your student card again.');
      const token=crypto.randomBytes(16).toString('hex');
      stage='scan-lock';
      if(!await repo.claimScan(id,now(),token))return fail('SCAN_IN_PROGRESS','Your previous photo is still being processed. Please let it finish before submitting another.');
      scanToken=token;cleanupFile=fileID;
      stage='download-photo';
      const image=await loadImage(fileID);
      if(typeof image!=='string'||image.length<16||image.length>8388608||!/^[A-Za-z0-9+/]+={0,2}$/.test(image))return fail('INVALID_IMAGE','Choose a JPG or PNG image smaller than 6 MB.');
      stage='ocr';
      const read=readCard(await ocr(image),account.profile.name);
      if(!read.readable)return {ok:true,readable:false,reason:read.reason,photoStored:false};
      const studentHash=crypto.createHmac('sha256',env.STUDENT_HASH_SECRET).update(read.school+':'+read.studentNumber).digest('hex');
      const verification={status:'verified',method:'ocr',studentName:read.studentName,checkedAt:now(),studentHash,studentLast4:read.studentNumber.slice(-4),school:read.school,submittedAt:now()};
      stage='save-verification';
      if(!await repo.completeScan(id,account.authRevision||0,verification))return fail('SESSION_CHANGED','Your account was logged out while this photo was being processed. Please log in again.');
      // Do not return/store the raw image or complete student number.
      return {ok:true,readable:true,photoStored:false,account:publicAccount({...account,loggedOut:false,verification},id)};
    } catch(error) {
      if(error.message&&error.message.startsWith('Enter your name'))return fail('INVALID_PROFILE',error.message);
      const code=String(error.code||error.errCode||'UNKNOWN').replace(/[^A-Za-z0-9_.-]/g,'').slice(0,80);
      const message=String(error.message||error.errMsg||'').replace(/cloud:\/\/\S+/g,'[file]').replace(/[A-Za-z0-9+/=_-]{32,}/g,'[redacted]').replace(/\d{7,}/g,'[number]').slice(0,600);
      console.error('studentAccount failure',{action,stage,code,message});
      return fail('SERVICE_UNAVAILABLE','Student check failed at '+stage+' ('+code+'). Please contact support if retrying fails.');
    } finally {
      if(cleanupFile)try{await deleteImage(cleanupFile);}catch(_){}
      if(scanToken)try{await repo.releaseScan(id,scanToken);}catch(_){}
    }
  };
}
module.exports={createHandler,validateProfile,idFor,publicAccount};
