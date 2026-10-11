const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'..');
let definition,emitted,back=false;
const parser=require('../cloudfunctions/parseSmsScreenshot/parser');
vm.runInNewContext(fs.readFileSync(path.join(root,'pages/sms-scan/index.js'),'utf8'),{
 require:n=>n==='./parser'?parser:n==='../../utils/pickup-point'?require('../utils/pickup-point'):{ensureCloud:()=>({})},Page:p=>definition=p,
 wx:{navigateBack:()=>{back=true;}}
});
const page={...definition,data:JSON.parse(JSON.stringify(definition.data)),setData(v){Object.assign(this.data,v);},getOpenerEventChannel(){return{emit:(name,v)=>{emitted={name,v};}};}};
page.applyResult({candidates:[{id:'0',code:'1-2-8011',selected:true,point:'Station One'},{id:'1',code:'1-1-0881',selected:true,point:'Station One'}]});
assert.equal(page.data.selectedCount,2);
page.toggle({currentTarget:{dataset:{i:1}}});assert.equal(page.data.selectedCount,1);
page.confirm();assert.equal(emitted.name,'smsSelected');assert.equal(emitted.v.codes.join(','),'1-2-8011');assert.ok(back);
emitted=null;page.data.candidates=Array.from({length:6},(_,i)=>({code:'1-1-100'+i,selected:true,point:'Station One'}));page.confirm();assert.equal(emitted,null);
page.data.candidates=[{code:'1-1-1001',selected:true,point:'A'},{code:'1-1-1002',selected:true,point:'B'}];page.confirm();assert.equal(emitted,null);
assert.match(page.data.error,/different pickup points/);
assert.equal(parser.dateOf('Dec 31 at 12:00',Date.parse('2026-01-01T01:00:00Z')),Math.floor(Date.UTC(2025,11,31)/86400000));
console.log('Review page: select/deselect, event payload, parcel cap, mixed-station guard; year boundary passed.');
(async()=>{
 let input,deleted=[],downloads=0;const cloud={init(){},DYNAMIC_CURRENT_ENV:'test',getWXContext(){return{OPENID:'test-user'};},database(){return{runTransaction:async f=>f({collection:()=>({doc:()=>({get:async()=>({data:null}),set:async()=>{}})})})};},downloadFile:async()=>{downloads++;return{fileContent:Buffer.from('image-test')};},deleteFile:async({fileList})=>deleted.push(...fileList)};
 const module={exports:{}};
 vm.runInNewContext(fs.readFileSync(path.join(root,'cloudfunctions/parseSmsScreenshot/index.js'),'utf8'),{exports:module.exports,require:n=>n==='wx-server-sdk'?cloud:n==='crypto'?require('node:crypto'):n==='./parser'?parser:n==='./parcel-parser'?require('../cloudfunctions/parseSmsScreenshot/parcel-parser'):{ocr:{v20181119:{Client:class{async GeneralBasicOCR(v){input=v;return{TextDetections:[{DetectedText:'Today 11:00'},{DetectedText:'【菜鸟驿站】凭1-2-8011到太仓青草巷广场二十一号店取件'}]};}}}}},process:{env:{TENCENT_SECRET_ID:'test-only',TENCENT_SECRET_KEY:'test-only'}},Buffer});
 const prepare=await module.exports.main({action:'prepareUpload'});assert.ok(prepare.ok);assert.equal(downloads,0);
 const bad=await module.exports.main({fileID:'cloud://test/sms-temp/other-user/fake.jpg'});assert.equal(bad.ok,false);assert.equal(downloads,0);
 const fileID='cloud://test/'+prepare.cloudPath,result=await module.exports.main({fileID});assert.ok(result.ok);assert.equal(input.LanguageType,'zh');assert.equal(result.fields.candidates[0].code,'1-2-8011');assert.ok(deleted.includes(fileID));
 console.log('Cloud flow: file-only prepare/request, caller folder isolation, OCR language, parser integration and temporary file cleanup passed (mock SDK).');
})().catch(e=>{console.error(e);process.exitCode=1;});
