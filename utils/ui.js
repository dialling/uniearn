const images=require('./image-input');
// wx.saveFile shares a 10 MB quota with no automatic expiry. Photos only need to
// survive until they are uploaded, so old copies are cleared in the background.
const KEEP_MS=24*3600000,MAX_BYTES=6*1024*1024;
function toast(e){wx.showToast({title:e.message||String(e),icon:'none'});}
function confirm(title,content){return new Promise(resolve=>{const ask=left=>wx.showModal({title,content,success:r=>resolve(!!r.confirm),fail:()=>{if(left>0)return setTimeout(()=>ask(left-1),350);wx.showToast({title:'弹窗没打开，请再点一次',icon:'none'});resolve(false);}});ask(1);});}
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
  const path=await images.compress(await images.chooseImage(source));
  // Old copies are cleared in the background: awaiting the file list blocked the tap for seconds.
  cleanSaved().catch(()=>{});
  return path; // Temporary paths remain usable throughout this mini-program session.
}
function preview(path){if(path)wx.previewImage({urls:[path],current:path});}
async function photos(source=['album'],count=3){
 const paths=await images.compressAll(await images.chooseImages(source,count));
 cleanSaved().catch(()=>{});
 return paths;
}
module.exports={toast,confirm,photo,photos,preview,cleanSaved};
