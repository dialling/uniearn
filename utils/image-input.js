const MAX_EDGE=1280,QUALITY=60;
function chooseImage(sourceType=['camera','album']){return new Promise((resolve,reject)=>wx.chooseMedia({count:1,mediaType:['image'],sourceType,sizeType:['compressed'],success:r=>resolve(r.tempFiles[0].tempFilePath),fail:reject}));}
function chooseImages(sourceType=['camera','album'],count=3){return new Promise((resolve,reject)=>wx.chooseMedia({count,mediaType:['image'],sourceType,sizeType:['compressed'],success:r=>resolve(r.tempFiles.map(file=>file.tempFilePath)),fail:reject}));}
// chooseMedia's "compressed" still leaves phone photos at 1-3 MB, so shrink to a <=1280px JPEG before
// saving or uploading. Falls back to the original path whenever compressImage is unavailable.
function compress(path){
  return new Promise(resolve=>{
    if(!wx.compressImage)return resolve(path);
    const done=result=>resolve((result&&result.tempFilePath)||path);
    wx.compressImage({src:path,quality:QUALITY,compressedWidth:MAX_EDGE,success:done,fail:()=>{
      // compressedWidth needs base library 2.26.0; retry with quality only on older clients.
      wx.compressImage({src:path,quality:QUALITY,success:done,fail:()=>resolve(path)});
    }});
  });
}
function compressAll(paths){return Promise.all((paths||[]).map(path=>compress(path)));}
function info(path){return new Promise((resolve,reject)=>wx.getFileInfo({filePath:path,success:resolve,fail:reject}));}
async function base64(path){if((await info(path)).size>2*1024*1024)throw Error('Choose a JPG or PNG under 2 MB.');return new Promise((resolve,reject)=>wx.getFileSystemManager().readFile({filePath:path,encoding:'base64',success:r=>resolve(r.data),fail:reject}));}
module.exports={chooseImage,chooseImages,compress,compressAll,base64};
