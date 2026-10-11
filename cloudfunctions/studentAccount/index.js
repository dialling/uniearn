const cloud=require('wx-server-sdk');
cloud.init({env:cloud.DYNAMIC_CURRENT_ENV});
const db=cloud.database(), collection='uniearn_accounts';
const {createHandler}=require('./handler');
const repo={
  async logout(id){return db.runTransaction(async tx=>{
    const ref=tx.collection(collection).doc(id),a=(await ref.get()).data;
    await ref.update({data:{loggedOut:true,authRevision:(a.authRevision||0)+1}});
  });},
  async completeScan(id,expected,verification){return db.runTransaction(async tx=>{
    const ref=tx.collection(collection).doc(id),a=(await ref.get()).data;
    if((a.authRevision||0)!==expected)return false;
    await ref.update({data:{verification:db.command.set(verification),loggedOut:false}});return true;
  });},
  async review(id,expected,verification){return db.runTransaction(async tx=>{const ref=tx.collection(collection).doc(id),a=(await ref.get()).data,v=a.verification;if(!v||v.status!=='pending'||v.studentHash!==expected.studentHash||v.submittedAt!==expected.submittedAt)return false;await ref.update({data:{verification:db.command.set(verification)}});return true;});},
  async get(id){const r=await db.collection(collection).where({_id:id}).limit(1).get();return r.data[0]||null;},
  async patch(id,patch){await db.runTransaction(async tx=>{const ref=tx.collection(collection).doc(id);let old;try{old=(await ref.get()).data;}catch(e){if(!/not exist|not found|does not exist/i.test(e.message||''))throw e;}const data={...(old||{}),...patch};delete data._id;await ref.set({data});});},
  async claimScan(id,time,token){return db.runTransaction(async tx=>{
    const ref=tx.collection(collection).doc(id),a=(await ref.get()).data;
    if(a.scanLock&&a.scanLock.until>time)return false;
    // Replace the whole object: an earlier scan leaves scanLock=null, which
    // cannot accept dotted child-field updates in the database.
    await ref.update({data:{scanLock:db.command.set({token,until:time+65000})}});return true;
  });},
  async releaseScan(id,token){return db.runTransaction(async tx=>{
    const ref=tx.collection(collection).doc(id),a=(await ref.get()).data;
    if(a.scanLock&&a.scanLock.token===token)await ref.update({data:{scanLock:null}});
  });}
};
async function ocr(image){
  if(!process.env.TENCENT_SECRET_ID||!process.env.TENCENT_SECRET_KEY)throw Error('OCR is not configured');
  const Client=require('tencentcloud-sdk-nodejs-ocr').ocr.v20181119.Client;
  const client=new Client({credential:{secretId:process.env.TENCENT_SECRET_ID,secretKey:process.env.TENCENT_SECRET_KEY},region:process.env.TENCENT_OCR_REGION||'ap-shanghai',profile:{httpProfile:{endpoint:'ocr.tencentcloudapi.com',reqTimeout:20}}});
  const result=await client.GeneralBasicOCR({ImageBase64:image,LanguageType:'zh'});return result.TextDetections||[];
}
const cardHandler=createHandler({getOpenId:()=>cloud.getWXContext().OPENID,repo,ocr,env:process.env,loadImage:async fileID=>{const r=await cloud.downloadFile({fileID});if(!r.fileContent||!r.fileContent.length||r.fileContent.length>6*1024*1024)throw Error("Invalid image size");return r.fileContent.toString("base64");},deleteImage:fileID=>cloud.deleteFile({fileList:[fileID]})});

exports.main=async event=>{if(event?.action==='wechatLogin'){try{const openid=cloud.getWXContext().OPENID;if(!openid||!event.code)throw Error('Use the phone authorization button in WeChat.');const id=require('./handler').idFor(openid),a=await repo.get(id)||{};const res=await cloud.openapi.phonenumber.getPhoneNumber({code:event.code});const phone=res.phoneInfo?.purePhoneNumber;if(!/^1\d{10}$/.test(phone||''))throw Error('A mainland mobile number is needed for campus deliveries.');const profile={...(a.profile||{}),name:String(a.profile?.name||event.name||'Student').slice(0,60),phone,wechatPhone:phone};await repo.patch(id,{profile,loggedOut:false,authRevision:(a.authRevision||0)+1,updatedAt:Date.now()});return {ok:true,account:require('./handler').publicAccount({...a,profile,loggedOut:false},id)};}catch(e){return {ok:false,error:e.message||'WeChat phone authorization is unavailable. Use manual registration.'};}}if(["sendEmailCode","checkEmailCode","agreeRules"].includes(event?.action)){try{return await require("./email").handle(cloud,event);}catch(e){return {ok:false,error:e.message||"Account service unavailable"};}}return cardHandler(event);};
