const assert=require('node:assert/strict');
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
