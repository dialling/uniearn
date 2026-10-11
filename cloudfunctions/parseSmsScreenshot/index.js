const cloud=require('wx-server-sdk'),crypto=require('crypto');
cloud.init({env:cloud.DYNAMIC_CURRENT_ENV});
const {parseSms}=require('./parser');
exports.main=async(event={})=>{
 const openId=cloud.getWXContext().OPENID;if(!openId)return{ok:false,error:'Open this Mini Program in WeChat to scan.'};
 const prefix='sms-temp/'+crypto.createHash('sha256').update(openId).digest('hex')+'/';
 if(event.action==='prepareUpload')return{ok:true,cloudPath:prefix+crypto.randomBytes(16).toString('hex')+'.jpg'};
 const fileID=event.fileID;
 if(typeof fileID!=='string'||fileID.length>1024)return{ok:false,error:'Invalid screenshot file.'};
 const match=fileID.match(/^cloud:\/\/[^/]+\/(.+)$/),path=match&&match[1];
 if(!path||!path.startsWith(prefix)||!/^[a-f0-9]{32}\.jpg$/.test(path.slice(prefix.length)))return{ok:false,error:'Invalid screenshot location.'};
 if(!process.env.TENCENT_SECRET_ID||!process.env.TENCENT_SECRET_KEY)return{ok:false,error:'OCR credentials are not configured in the cloud function'};
 try{
  const db=cloud.database(),id=crypto.createHash('sha256').update(openId).digest('hex');
  const allowed=await db.runTransaction(async tx=>{const ref=tx.collection('uniearn_ocr_limits').doc(id);let record;try{record=(await ref.get()).data;}catch(e){if(!/not exist|not found|does not exist/i.test(e.message||''))throw e;}const now=Date.now();if(record&&now-record.lastAt<5000)return false;const day=new Date(now).toISOString().slice(0,10),used=record&&record.day===day?record.count:0;if(used>=100)return false;await ref.set({data:{lastAt:now,day,count:used+1}});return true;});
  if(!allowed)return{ok:false,error:'Scan limit reached. Wait a moment or enter the code manually.'};
  const downloaded=await cloud.downloadFile({fileID}),buffer=downloaded.fileContent;
  if(!buffer||!buffer.length||buffer.length>6*1024*1024)return{ok:false,error:'Please use a JPG or PNG screenshot under 6 MB.'};
  const base64=buffer.toString('base64');
  const Client=require('tencentcloud-sdk-nodejs-ocr').ocr.v20181119.Client;
  const client=new Client({credential:{secretId:process.env.TENCENT_SECRET_ID,secretKey:process.env.TENCENT_SECRET_KEY},region:process.env.TENCENT_OCR_REGION||'ap-shanghai',profile:{httpProfile:{endpoint:'ocr.tencentcloudapi.com',reqTimeout:20}}});
  const result=await client.GeneralBasicOCR({ImageBase64:base64,LanguageType:'zh'});
  const detections=result.TextDetections||[],sms=parseSms(detections,Date.now()),parcel=require('./parcel-parser').parseText(detections);const candidates=sms.candidates||[];
  for(const c of (parcel.candidates||[])){const old=candidates.find(x=>x.code===c.code);if(old){if(!old.point)old.point=c.point;if(!old.address)old.address=c.address;}else candidates.push(c);}
  return{ok:true,fields:{...sms,candidates:candidates.map((c,i)=>({...c,id:String(i)})),note:'Review the codes and select parcels from one pickup point.'}};
 }catch(e){const code=String(e.code||e.errCode||'UnknownError').replace(/[^A-Za-z0-9_.-]/g,'').slice(0,100);return{ok:false,error:'SMS OCR failed: '+code};}finally{try{await cloud.deleteFile({fileList:[fileID]});}catch(_){}}
};
