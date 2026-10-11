const assert=require('node:assert/strict');
const {readCard}=require('../cloudfunctions/studentAccount/card');
const {createHandler,idFor}=require('../cloudfunctions/studentAccount/handler');
const line=(DetectedText,Confidence=99)=>({DetectedText,Confidence});
const clear=['西交利物浦大学','姓名：张三','学号 2345678'].map(x=>line(x));
assert.equal(readCard(clear).readable,true);
assert.equal(readCard(clear.filter(x=>!x.DetectedText.includes('姓名'))).readable,false);
assert.equal(readCard(clear.filter(x=>!x.DetectedText.includes('学号'))).readable,false);
assert.equal(readCard(clear.filter(x=>!x.DetectedText.includes('大学'))).readable,false);
assert.equal(readCard([line('XJTLU'),line('Name'),line('Test Student'),line('Student ID: 2345678')]).readable,false); // generic student label rejected
assert.equal(readCard([line('XJTLU'),line('Name'),line('Yichen Zhou'),line('Student ID: 2345678')]).readable,true);
assert.equal(readCard([...clear,line('学号 8765432')]).readable,false);
(async()=>{
 const records={},deleted=[];
 const repo={get:async id=>records[id],patch:async(id,v)=>{records[id]={...records[id],...v};},completeScan:async(id,rev,verification)=>{records[id]={...records[id],verification,loggedOut:false};return true;},claimScan:async()=>true};
 let caller='student',detections=clear,loads=0;
 const handle=createHandler({getOpenId:()=>caller,repo,ocr:async()=>detections,loadImage:async()=>{loads++;return 'A'.repeat(32);},deleteImage:async id=>deleted.push(id),env:{STUDENT_HASH_SECRET:'a'.repeat(32)},now:()=>123456});
 await handle({action:'saveProfile',profile:{name:'张三',phone:'13800000000'}});
 let r=await handle({action:'scan',consent:true,fileID:'cloud://env/student-temp/other/fake.jpg'});
 assert.equal(r.code,'INVALID_IMAGE');assert.equal(loads,0);
 let prep=await handle({action:'prepareUpload'});const fileID='cloud://env/'+prep.cloudPath;
 detections=clear.slice(0,2);
 r=await handle({action:'scan',consent:true,fileID});assert.equal(r.readable,false);assert.equal(records[idFor(caller)].verification,undefined);
 detections=clear;r=await handle({action:'scan',consent:true,fileID});
 assert.equal(r.account.verification.status,'verified');assert.equal(r.account.verification.studentName,'张三');assert.equal(r.account.verification.studentLast4,'5678');assert.equal(deleted.length,2);
 assert.ok(!JSON.stringify(records).includes('2345678'));
 caller='';assert.equal((await handle()).code,'AUTH_REQUIRED');
 console.log('Student card: required fields, ambiguity, caller isolation, auto registration, unreadable and cleanup passed.');
})().catch(e=>{console.error(e);process.exitCode=1});
