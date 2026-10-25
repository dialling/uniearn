const {ensureCloud}=require('./cloud');
async function recognize(path){
 const cloud=ensureCloud();let fileID='';const started=Date.now();
 try{
  const p=(await cloud.callFunction({name:'parseParcelScreenshot',data:{action:'prepareUpload'}})).result;
  if(!p||!p.ok)throw Error(p&&p.error||'Could not prepare upload.');
  fileID=(await cloud.uploadFile({cloudPath:p.cloudPath,filePath:path})).fileID;
  const r=(await cloud.callFunction({name:'parseParcelScreenshot',data:{fileID}})).result;
  if(!r||!r.ok)throw Error(r&&r.error||'Could not read screenshot.');
  try{require('./analytics').record('ocr_result',{result:'ok',duration:Date.now()-started,needsReview:!!r.fields?.needsReview?.length});}catch(_){}return r.fields;
 }catch(e){try{require('./analytics').record('ocr_result',{result:'unknown',duration:Date.now()-started});}catch(_){}throw e;}finally{if(fileID)try{await cloud.deleteFile({fileList:[fileID]});}catch(_){}}
}
module.exports={recognize};
