const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {readCard}=require('../cloudfunctions/studentAccount/card');
const line=(DetectedText)=>({DetectedText,Confidence:99});
const card=["Xi'an Jiaotong-Liverpool University",'西交利物浦大学','Ming Li','李明','2512345','STUDENT ID 学生卡'].map(line);
assert.equal(readCard(card).readable,true);
assert.equal(readCard(card).studentName,'李明');
assert.equal(readCard(card).studentNumber,'2512345');
assert.equal(readCard(card.filter(x=>!['Ming Li','李明'].includes(x.DetectedText))).readable,false);
assert.equal(readCard(card.filter(x=>x.DetectedText!=='2512345')).readable,false);
assert.equal(readCard([...card,line('2512346')]).readable,false);
assert.equal(readCard([line("Xi'an Jiaotong-Liverpool University"),line('Ming Li'),line('2512345'),line('STUDENT ID')]).studentName,'Ming Li');
(async()=>{
 const {createHandler}=require('../cloudfunctions/studentAccount/handler');
 let repo,record={lastScanAt:9999999999,scanCount:100,scanDay:'2026-09-29'};
 const cloud={init(){},database:()=>({command:{set:value=>({__replace:value})},runTransaction:async fn=>fn({collection:()=>({doc:()=>({get:async()=>({data:record}),update:async({data})=>{for(const [key,value] of Object.entries(data)){if(value&&Object.prototype.hasOwnProperty.call(value,'__replace'))record[key]=value.__replace;else if(value&&typeof value==='object'&&record[key]===null)throw Object.assign(Error('Cannot create child field under null'),{errCode:-502001});else record[key]=value;}}})})})})};
 const exports={};
 vm.runInNewContext(fs.readFileSync(require.resolve('../cloudfunctions/studentAccount/index'),'utf8'),{require:n=>n==='wx-server-sdk'?cloud:n==='./handler'?{createHandler:opts=>{repo=opts.repo;return()=>{};}}:require(n),exports,process:{env:{}}});
 assert.equal(await repo.claimScan('u',1,'a'),true);
 assert.equal(await repo.claimScan('u',2,'b'),false);
 await repo.releaseScan('u','wrong');assert.equal(await repo.claimScan('u',3,'c'),false);
 await repo.releaseScan('u','a');assert.equal(await repo.claimScan('u',3,'c'),true);
 assert.equal(await repo.claimScan('u',65004,'d'),true);
 await repo.releaseScan('u','c');assert.equal(record.scanLock.token,'d');
 await repo.releaseScan('u','d');

 record.profile={name:'李明'};repo.get=async()=>record;repo.patch=async(_,patch)=>Object.assign(record,patch);
 let ocrCalls=0,deleted=0,mode='unreadable',resolveOCR,ocrStarted;
 const handle=createHandler({repo,getOpenId:()=> 'test',now:()=>100000,env:{STUDENT_HASH_SECRET:'a'.repeat(32)},loadImage:async()=> 'A'.repeat(32),deleteImage:async()=>{deleted++;},
 ocr:async()=>{ocrCalls++;if(mode==='throw')throw Error('service failed');if(mode==='block')return new Promise(resolve=>{resolveOCR=resolve;ocrStarted();});return mode==='success'?card:[];}});
 const prep=await handle({action:'prepareUpload'}),req={action:'scan',consent:true,fileID:'cloud://env/'+prep.cloudPath};
 for(let i=0;i<12;i++){const r=await handle(req);assert.equal(r.readable,false);assert.equal(record.scanLock,null);}
 assert.equal(ocrCalls,12);assert.equal(deleted,12);
 mode='throw';assert.equal((await handle(req)).code,'SERVICE_UNAVAILABLE');assert.equal(record.scanLock,null);
 mode='block';const started=new Promise(resolve=>ocrStarted=resolve),first=handle(req);await started;
 assert.equal((await handle(req)).code,'SCAN_IN_PROGRESS');resolveOCR([]);await first;assert.equal(record.scanLock,null);
 mode='success';assert.equal((await handle(req)).account.verification.status,'verified');
 console.log('Unlabelled vertical card; >10 immediate retries; legacy counters ignored; concurrent guard, exception release and expired lease recovery passed.');
 let def,selected=0,scanned=0;
 vm.runInNewContext(fs.readFileSync(require.resolve('../pages/student-check/index.js'),'utf8'),{
 Page:v=>def=v,require:n=>n.includes('account')?{scan:async()=>{scanned++;return {readable:false,reason:'name_unclear'};}}:n.includes('image-input')?{chooseImage:async()=>{selected++;return 'photo';}}:{},wx:{}
 });
 const page={...def,data:{...def.data,consent:true,retryScan:true},setData(v){Object.assign(this.data,v);}};
 await page.retry();assert.equal(selected,1);assert.equal(scanned,1);assert.equal(page.data.stage,'unreadable');assert.match(page.data.readHelp,/name/);assert.equal(page.data.busy,false);
 console.log('Try again reopens image picker and scans, with specific field failure feedback.');
})().catch(e=>{console.error(e);process.exitCode=1;});
