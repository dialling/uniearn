// <video> does not accept code-package paths (DevTools shows a black box), so the
// bundled clip is copied once into the user data folder and played from there.
const VERSION='v1';
function prepare(kind){
  const name='yuni-'+(kind==='express'?'express':'takeout');
  const src='/pages/posted/yuni/'+name+'.mp4';
  return new Promise((resolve,reject)=>{
    const fs=wx.getFileSystemManager&&wx.getFileSystemManager();
    const root=wx.env&&wx.env.USER_DATA_PATH;
    if(!fs||!root){reject(new Error('no file system'));return;}
    const target=root+'/'+name+'-'+VERSION+'.mp4';
    fs.access({path:target,success:()=>resolve(target),fail:()=>{
      fs.readFile({filePath:src,success:res=>{
        fs.writeFile({filePath:target,data:res.data,success:()=>resolve(target),fail:reject});
      },fail:reject});
    }});
  });
}
module.exports={prepare};
