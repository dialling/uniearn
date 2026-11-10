const assert=require('node:assert/strict'),fs=require('node:fs');
let def,posted=[],uploaded=[];global.Page=x=>def=x;global.wx={getStorageSync:()=>null,setStorageSync(){},showToast(){},showModal:o=>o.success({confirm:true})};
const orders=require('../utils/orders');orders.act=async(action,args)=>{posted.push({action,args});};orders.upload=async p=>{uploaded.push(p);return 'cloud://test/order-photos/runner/'+'a'.repeat(32)+'.jpg';};
require('../pages/task/index');const page={...def,data:structuredClone(def.data),id:'task',setData(v){Object.assign(this.data,v)}};
(async()=>{
 await page.done();assert.equal(posted.length,1,'both photos and note are optional');assert.deepEqual(posted[0].args.photos,[]);
 page.setData({photos:['wxfile://proof.jpg'],note:''});await page.done();assert.equal(uploaded.length,1);assert.equal(posted[1].action,'taskDone');assert.equal(posted[1].args.note,'');assert.ok(posted[1].args.photos[0].startsWith('cloud://'));

 const xml=fs.readFileSync('pages/task/index.wxml','utf8');assert.match(xml,/class="progress-row task-progress-row"/);assert.doesNotMatch(xml,/order-progress-dot/);assert.match(xml,/wx:elif="\{\{!\(request.isRunner && request.status==='taken'\)\}\}"/);assert.match(xml,/upload-card upload-blue/);assert.match(xml,/disabled="\{\{photoBusy\|\|sending\}\}"/);
 const {postCopy}=require('../utils/post-copy');assert.match(postCopy('task','en').sendHint,/optional/);assert.match(postCopy('task','zh').sendHint,/选填/);
 console.log('Task completion: optional evidence, uniform upload card and shared progress style passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
