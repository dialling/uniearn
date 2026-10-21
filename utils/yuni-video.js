// <video> does not accept code-package paths (DevTools shows a black box), so the
// bundled clip is copied once into the user data folder and played from there.
const VERSION='v1';
function prepare(kind){
  const name='yuni-'+(['express','levelup'].includes(kind)?kind:'takeout');
  const src='/pages/posted/yuni/'+name+'.mp4';
  return new Promise((resolve,reject)=>{
    const fs=wx.getFileSystemManager&&wx.getFileSystemManager();
    const root=wx.env&&wx.env.USER_DATA_PATH;
    if(!fs||!root){reject(new Error('no file system'));return;}
    const target=root+'/'+name+'-'+VERSION+'.mp4';
    const copy=()=>fs.readFile({filePath:src,success:res=>{
      fs.writeFile({filePath:target,data:res.data,success:()=>resolve(target),fail:reject});
    },fail:reject});
    // The clips live in the "yuni" subpackage; pages outside it must load it before reading.
    const load=()=>wx.loadSubpackage?wx.loadSubpackage({name:'yuni',success:copy,fail:reject}):copy();
    fs.access({path:target,success:()=>resolve(target),fail:load});
  });
}
module.exports={prepare};
