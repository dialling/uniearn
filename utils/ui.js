const images=require('./image-input');
function toast(e){wx.showToast({title:e.message||String(e),icon:'none'});}
function confirm(title,content){return new Promise(resolve=>wx.showModal({title,content,success:r=>resolve(!!r.confirm),fail:()=>resolve(false)}));}
async function photo(source=['album']){const path=await images.chooseImage(source);return new Promise((resolve,reject)=>wx.saveFile({tempFilePath:path,success:r=>resolve(r.savedFilePath),fail:()=>reject(Error('Could not save the photo. Please try again.'))}));}
function preview(path){if(path)wx.previewImage({urls:[path],current:path});}
module.exports={toast,confirm,photo,preview};
