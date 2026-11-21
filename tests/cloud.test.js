const assert=require('node:assert/strict');
// The XP Express build replaces cloud functions with a REST adapter; OCR stays intentionally off there.
const xpBuild=/xp-backend/.test(require('fs').readFileSync(require.resolve('../utils/cloud'),'utf8'));
if(xpBuild){
  global.wx={getStorageSync(){return null;},setStorageSync(){}};
  global.App=definition=>definition.onLaunch();
  require('../app');
  (async()=>{
    await assert.rejects(require('../utils/ocr').recognize('/sample.png'),/截图识别暂不可用|not available/);
    console.log('XP backend: screenshot OCR reports unavailable without cloud functions.');
  })().catch(error=>{console.error(error);process.exitCode=1;});
}
// A top-level return is not valid for scripts/check.js, which compiles every file as a plain script.
if(!xpBuild){
const calls=[];
global.wx={
  cloud:{
    async uploadFile(){calls.push(['upload']);return{fileID:'cloud://test/ocr-temp/test.jpg'};},
    async deleteFile(){calls.push(['delete']);},
    init(options){calls.push(['init',options.env]);},
    async callFunction(options){calls.push(['call',options.name]);return {result:{ok:true,cloudPath:'ocr-temp/test.jpg',fields:{pickupCode:'12-3-4567'},account:{id:'test',profile:null,verification:{status:'unverified'}}}};}
  },
  getFileInfo({success}){success({size:100});},
  getFileSystemManager(){return {readFile({success}){success({data:'c2FtcGxl'});}};},
  getStorageSync(){return null;},setStorageSync(){}
};
global.App=definition=>definition.onLaunch();
require('../app');
const {recognize}=require('../utils/ocr');
const {call}=require('../utils/account');
(async()=>{
  await recognize('/sample.png');await call('status');
  assert.deepEqual(calls,[
    ['init','cloud1-d1g757cev03375e35'],
    ['call','parseParcelScreenshot'],['upload'],['call','parseParcelScreenshot'],['delete'],['call','studentAccount']
  ]);
  // DevTools hot reload can execute a page call without launching App again.
  const {ensureCloud}=require('../utils/cloud');
  const original=wx.cloud;
  wx.cloud={...original,init(options){calls.push(['init',options.env]);}};
  ensureCloud();
  assert.equal(calls.at(-1)[0],'init');
  console.log('Cloud initialized before OCR and account calls, including after SDK replacement');
})().catch(error=>{console.error(error);process.exitCode=1;});
}
