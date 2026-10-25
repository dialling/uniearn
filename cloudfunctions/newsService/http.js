const crypto=require('crypto'),auth=require('./auth'),{handleNews}=require('./news');
function imageType(buffer){
  if(buffer.length>8&&buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return 'png';
  if(buffer.length>3&&buffer[0]===255&&buffer[1]===216&&buffer[2]===255)return 'jpg';
  if(buffer.length>12&&buffer.toString('ascii',0,4)==='RIFF'&&buffer.toString('ascii',8,12)==='WEBP')return 'webp';return '';
}
function createHttpHandler({repo,cloud,settings,now=Date.now}){
  return async event=>{
    const headers={};for(const [key,value] of Object.entries(event.headers||{}))headers[key.toLowerCase()]=value;
    const origin=headers.origin||'',allowed=settings.allowedOrigins||[];
    let renewedToken='';
    const response=(statusCode,body)=>({statusCode,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...(allowed.includes(origin)?{'Access-Control-Allow-Origin':origin,'Vary':'Origin','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization'}:{})},body:JSON.stringify(renewedToken&&statusCode===200&&body.ok?{...body,sessionToken:renewedToken}:body)});
    if(origin&&!allowed.includes(origin))return response(403,{ok:false,error:'不允许的网页来源。'});
    if(event.httpMethod==='OPTIONS')return response(204,{});
    if(event.httpMethod!=='POST')return response(405,{ok:false,error:'Use POST.'});
    let input;
    try{const raw=event.isBase64Encoded?Buffer.from(event.body||'','base64').toString('utf8'):event.body;if(typeof raw!=='string'||raw.length>4400000)throw Error();input=JSON.parse(raw);if(!input||typeof input!=='object')throw Error();}catch(_){return response(400,{ok:false,error:'请求格式错误或内容过大。'});}
    try{
      let admin=await repo.getAdmin();
      if(input.action==='webStatus')return response(200,{ok:true,setupRequired:!admin});
      if(input.action==='webSetup'){
        if(admin)return response(409,{ok:false,error:'管理员已设置，请直接登录。'});
        if(!settings.setupTokenHash||!auth.equal(auth.hash(input.setupToken),settings.setupTokenHash))return response(403,{ok:false,error:'请使用你的专属首次设置链接。'});
        let record;try{record=await auth.createAdmin(input.username,input.password);}catch(e){return response(400,{ok:false,error:e.message});}
        if(!await repo.setupAdmin(record))return response(409,{ok:false,error:'管理员已设置，请直接登录。'});
        return response(200,{ok:true,token:auth.mintToken(record,now())});
      }
      if(!admin)return response(409,{ok:false,code:'SETUP_REQUIRED',error:'请先设置管理员账号。'});
      if(input.action==='webJoin'){
        if(typeof input.invite!=='string'||input.invite.length>100)return response(400,{ok:false,error:'邀请无效。'});
        let record;try{record=await auth.createAdmin(input.username,input.password);}catch(e){return response(400,{ok:false,error:e.message});}
        const id=await repo.claimInvite(input.invite,record,now());
        return response(200,{ok:true,token:auth.mintToken({...record,_id:id},now())});
      }
      if(input.action==='webLogin'){
        if(input.username!==admin.username&&repo.findStaff){
          const member=await repo.findStaff(String(input.username||'').trim());
          if(!member){await auth.checkPassword(admin,input.username,input.password);return response(401,{ok:false,error:'账号或密码错误。'});}
          if(member.disabled||member.lockedUntil>now())return response(429,{ok:false,error:'账号已停用或暂时锁定。'});
          const accepted=await auth.checkPassword(member,input.username,input.password),login=await repo.staffLogin(member._id,accepted,now());
          if(!accepted||!login.ok)return response(401,{ok:false,error:'账号或密码错误，或账号已锁定。'});
          return response(200,{ok:true,token:auth.mintToken(member,now())});
        }
        if(admin.lockedUntil>now())return response(429,{ok:false,error:'尝试次数过多，请 15 分钟后重试。'});
        const accepted=await auth.checkPassword(admin,input.username,input.password);
        const login=await repo.recordLogin(accepted,now());
        if(!login.ok)return response(429,login);
        if(!accepted)return response(401,{ok:false,error:'账号或密码错误。'});
        return response(200,{ok:true,token:auth.mintToken(admin,now())});
      }
      const token=String(headers.authorization||'').replace(/^Bearer /,''),actor=auth.tokenSubject(token);
      const identity=actor==='admin'?admin:repo.getStaff&&await repo.getStaff(actor);
      if(!identity||identity.disabled||!auth.verifyToken(token,identity,now()))return response(401,{ok:false,error:'登录已过期，请重新登录。'});
      if(auth.tokenExpiry(token)-now()<auth.SESSION_TTL-86400000)renewedToken=auth.mintToken({...identity,_id:actor},now());
      if(input.action==='webSession'){renewedToken='';return response(200,{ok:true,token:auth.mintToken({...identity,_id:actor},now())});}
      if(input.action==='webLogout'){renewedToken='';await repo.logoutSession(actor,identity.tokenKey,now());return response(200,{ok:true});}
      if(input.action==='webChangePassword'){
        renewedToken='';
        if(identity.lockedUntil>now())return response(429,{ok:false,error:'尝试次数过多，请 15 分钟后重试。'});
        const accepted=await auth.checkPassword(identity,identity.username,input.currentPassword);
        if(!accepted){const result=actor==='admin'?await repo.recordLogin(false,now()):await repo.staffLogin(actor,false,now());return response(result.ok?400:429,{ok:false,error:result.ok?'原密码不正确。':'尝试次数过多，请稍后重试。'});}
        if(input.currentPassword===input.newPassword)return response(400,{ok:false,error:'新密码不能与原密码相同。'});
        let record;try{record=await auth.createAdmin(identity.username,input.newPassword);}catch(e){return response(400,{ok:false,error:e.message});}
        const result=await repo.changePassword(actor,identity.passwordHash,record,now());
        return response(200,{ok:true,token:auth.mintToken({...record,_id:actor},now())});
      }
      if(String(input.action||'').startsWith('ops'))return response(200,await require('./operations').handleOperations({input,repo,actor,now}));
      if(input.action==='webUpload'){
        if(typeof input.base64!=='string'||input.base64.length>4200000||!/^[A-Za-z0-9+/]*={0,2}$/.test(input.base64))return response(400,{ok:false,error:'图片最大 3 MB，请使用 PNG、JPEG 或 WebP。'});
        const bytes=Buffer.from(input.base64,'base64'),ext=imageType(bytes);
        if(!ext||bytes.length>3*1024*1024)return response(400,{ok:false,error:'图片格式或大小不正确。'});
        const uploaded=await cloud.uploadFile({cloudPath:'news-covers/'+crypto.randomBytes(16).toString('hex')+'.'+ext,fileContent:bytes});
        const urls=await cloud.getTempFileURL({fileList:[uploaded.fileID]});
        return response(200,{ok:true,fileID:uploaded.fileID,url:urls.fileList[0].tempFileURL});
      }
      if(!['newsAdminList','newsSave','newsDelete'].includes(input.action))return response(400,{ok:false,error:'Unknown news action.'});
      const result=await handleNews({event:input,isAdmin:true,repo,id:actor,now});
      if(result.ok&&input.action!=='newsAdminList'&&repo.audit)await repo.audit(actor,input.action,String(input.id||result.id||'news'),{},now());
      if(result.ok&&result.items){
        const files=[...new Set(result.items.map(x=>x.cover).filter(Boolean))];
        if(files.length){const urls=await cloud.getTempFileURL({fileList:files});const map=Object.fromEntries(urls.fileList.map(x=>[x.fileID,x.tempFileURL||'']));result.items=result.items.map(x=>({...x,coverURL:map[x.cover]||''}));}
      }
      return response(result.ok?200:409,result);
    }catch(e){if(e.safe)return response(409,{ok:false,error:e.message});console.error('newsService failure',String(e.code||e.errCode||'UNKNOWN'));return response(503,{ok:false,error:'管理服务暂不可用，请稍后重试。'});}
  };
}
module.exports={createHttpHandler,imageType};
