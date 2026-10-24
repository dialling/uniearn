const images=require('./image-input');
// wx.saveFile shares a 10 MB quota with no automatic expiry. Photos only need to
// survive until they are uploaded, so old copies are removed before each save.
const KEEP_MS=24*3600000,MAX_BYTES=6*1024*1024;
function toast(e){wx.showToast({title:e.message||String(e),icon:'none'});}
function confirm(title,content){return new Promise(resolve=>wx.showModal({title,content,success:r=>resolve(!!r.confirm),fail:()=>resolve(false)}));}
function savedFiles(){return new Promise(resolve=>{if(!wx.getSavedFileList)return resolve([]);wx.getSavedFileList({success:r=>resolve(r.fileList||[]),fail:()=>resolve([])});});}
function remove(filePath){return new Promise(resolve=>wx.removeSavedFile({filePath,complete:()=>resolve()}));}
async function cleanSaved(now=Date.now()){
  const files=(await savedFiles()).sort((a,b)=>a.createTime-b.createTime);
  let total=files.reduce((n,f)=>n+(f.size||0),0);
  for(const file of files){
    if(now-file.createTime*1000<KEEP_MS&&total<=MAX_BYTES)continue;
    await remove(file.filePath);total-=file.size||0;
  }
}
async function photo(source=['album']){
  const path=await images.chooseImage(source);
  try{await cleanSaved();}catch(_){}
  // If saving fails (for example the quota is full) the temporary path still works for this session.
  return new Promise(resolve=>wx.saveFile({tempFilePath:path,success:r=>resolve(r.savedFilePath),fail:()=>resolve(path)}));
}
function preview(path){if(path)wx.previewImage({urls:[path],current:path});}
async function photos(source=['album'],count=3){
 const paths=await images.chooseImages(source,count);
 try{await cleanSaved();}catch(_){}
 return Promise.all(paths.map(path=>new Promise(resolve=>wx.saveFile({tempFilePath:path,success:r=>resolve(r.savedFilePath),fail:()=>resolve(path)}))));
}
module.exports={toast,confirm,photo,photos,preview,cleanSaved};
