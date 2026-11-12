const assert=require('node:assert/strict'),fs=require('node:fs');
let def,posted=[],uploaded=[];global.Page=x=>def=x;global.wx={getStorageSync:()=>null,setStorageSync(){},showToast(){}};
const orders=require('../utils/orders');orders.act=async(action,args)=>{posted.push({action,args});};orders.upload=async p=>{uploaded.push(p);return 'cloud://test/order-photos/runner/'+'a'.repeat(32)+'.jpg';};
require('../pages/task/index');const page={...def,data:structuredClone(def.data),id:'task',setData(v){Object.assign(this.data,v)}};
(async()=>{
 await page.done();assert.equal(posted.length,1,'photo-free completion is allowed');assert.equal(uploaded.length,0);posted=[];
 page.setData({photo:'wxfile://proof.jpg',note:''});await page.done();assert.equal(uploaded.length,1);assert.equal(posted[0].action,'taskDone');assert.equal(posted[0].args.note,'','note is optional');assert.ok(posted[0].args.photo.startsWith('cloud://'));
 const xml=fs.readFileSync('pages/task/index.wxml','utf8');assert.match(xml,/class="progress-row task-progress-row"/);assert.doesNotMatch(xml,/order-progress-dot/);assert.match(xml,/wx:elif="\{\{!request.feedbackOpen && !\(request.isRunner && request.status==='taken'\)\}\}"/);assert.match(xml,/src="\/assets\/camera.svg"/);assert.match(xml,/disabled="\{\{sending\}\}"/);
 const {postCopy}=require('../utils/post-copy');assert.match(postCopy('task','en').sendHint,/note is optional/);assert.match(postCopy('task','zh').takePhoto,/选填/);assert.match(postCopy('task','en').notePlaceholder,/optional/);
 console.log('Task completion: required-photo client guard, upload-before-submit, optional note, camera icon, shared progress style and runner banner removal passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
