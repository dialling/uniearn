function chooseImage(sourceType=['camera','album']){return new Promise((resolve,reject)=>wx.chooseMedia({count:1,mediaType:['image'],sourceType,sizeType:['compressed'],success:r=>resolve(r.tempFiles[0].tempFilePath),fail:reject}));}
function chooseImages(sourceType=['camera','album'],count=3){return new Promise((resolve,reject)=>wx.chooseMedia({count,mediaType:['image'],sourceType,sizeType:['compressed'],success:r=>resolve(r.tempFiles.map(file=>file.tempFilePath)),fail:reject}));}
function info(path){return new Promise((resolve,reject)=>wx.getFileInfo({filePath:path,success:resolve,fail:reject}));}
async function base64(path){if((await info(path)).size>2*1024*1024)throw Error('Choose a JPG or PNG under 2 MB.');return new Promise((resolve,reject)=>wx.getFileSystemManager().readFile({filePath:path,encoding:'base64',success:r=>resolve(r.data),fail:reject}));}
module.exports={chooseImage,chooseImages,base64};
