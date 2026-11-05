const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
global.wx={getStorageSync:()=>null,setStorageSync(){}};let def;
global.Component=x=>def=x;
const acks=[];let finishVideo,failVideo;
const ordersPath=require.resolve('../utils/orders');require.cache[ordersPath]={id:ordersPath,filename:ordersPath,loaded:true,exports:{act:(action,args)=>{acks.push([action,args]);return Promise.reject(Error('offline'));}}};
const videoPath=require.resolve('../utils/yuni-video');let loaded=[];require.cache[videoPath]={id:videoPath,filename:videoPath,loaded:true,exports:{prepare:kind=>{loaded.push(kind);return new Promise((resolve,reject)=>{finishVideo=resolve;failVideo=reject;});}}};
const store=require('../utils/store'),bus=require('../utils/checkin'),china=require('../utils/china-time');
const today=china.dayKey(Date.now());
function account(id='a',points=0){store.reset();store.update(s=>{s.profile={...s.profile,onboarded:true,campusId:'sip',accountId:id};s.serverTime=Date.now();s.progressionAccountId=id;s.progression={points:10,notices:[{id:'checkin-'+today,type:'checkin',day:today,streak:points?7:3,cycleDay:points?7:3,points}]};});}
require('../components/daily-checkin/index');
const make=()=>({data:structuredClone(def.data),visible:true,setData(v){Object.assign(this.data,v)},...def.methods});
(async()=>{
 account();let p=make();p.check();assert.equal(p.data.open,true);assert.equal(p.data.streak,3);assert.equal(p.data.points,0);assert.match(p.data.hint,/4 天/);assert.equal(loaded.at(-1),'checkin');assert.equal(bus.pending(),true);
 const other=make();other.check();assert.equal(other.data.open,false,'multiple page hosts cannot show duplicate popups');
 finishVideo('wxfile://daily.mp4');await Promise.resolve();assert.equal(p.data.videoSrc,'wxfile://daily.mp4');
 p.videoEnded();assert.equal(p.data.videoSrc,'');assert.equal(p.data.videoDone,true,'the final still replaces the ended video');
 p.close();await Promise.resolve();assert.equal(bus.pending(),false);assert.equal(acks.at(-1)[0],'ackLoyaltyNotice');
 p=make();p.check();assert.equal(p.data.open,false,'even an offline acknowledgement cannot replay today locally');
 account('b',10);p=make();p.check();assert.equal(p.data.points,10);assert.equal(p.data.cycleDay,7);assert.equal(loaded.at(-1),'checkin-week');failVideo(Error('bad clip'));await Promise.resolve();assert.equal(p.data.videoFailed,true,'clip failure retains a closable success state');p.close();await Promise.resolve();
 account('c');store.update(s=>s.yuniTips=false);const count=loaded.length;p=make();p.check();assert.equal(p.data.open,true);assert.equal(p.data.motionEnabled,false);assert.equal(loaded.length,count,'motion-off shows a static success without loading video');p.close();await Promise.resolve();
 account('d');p=make();p.watch();p.check();store.update(s=>s.profile.loggedOut=true);assert.equal(p.data.open,false,'logout closes the popup without acking another identity');p.unwatch();
 account('e');p=make();p.check();const late=finishVideo;p.visible=false;p.hide();late('wxfile://late.mp4');await Promise.resolve();assert.equal(p.data.videoSrc,'','a hidden page cannot restart video');
 account('f');store.update(s=>s.progressionAccountId='old-account');p=make();p.check();assert.equal(p.data.open,false,'stale progression from another account cannot open');
 account('g');store.update(s=>s.serverTime=Date.now()-86400000);p.check();assert.equal(p.data.open,false,'a stale server snapshot cannot announce a new check-in');
 const xml=fs.readFileSync(path.join(__dirname,'../components/daily-checkin/index.wxml'),'utf8');assert.ok(xml.includes('muted="{{true}}"'));assert.ok(xml.includes('loop="{{false}}"'));assert.ok(xml.includes('binderror="videoError"'));assert.ok(xml.includes('bindtap="close"'));
assert.match(xml,/class="checkin-mask"[^>]*motionEnabled\?'':'--ue-animation:none/,'the overlay itself stops animating when motion is off');
 assert.match(fs.readFileSync(path.join(__dirname,'../components/lang-switch/index.wxml'),'utf8'),/<daily-checkin(?:\s[^>]*)?\/>/,'all page hooks mount check-in');
 const types=buffer=>{function boxes(start,end){const out=[];for(let p=start;p+8<=end;){let size=buffer.readUInt32BE(p);if(size<8||p+size>end)break;out.push({type:buffer.toString('ascii',p+4,p+8),start:p+8,end:p+size});p+=size;}return out;}const moov=boxes(0,buffer.length).find(x=>x.type==='moov');return boxes(moov.start,moov.end).filter(x=>x.type==='trak').map(t=>{const mdia=boxes(t.start,t.end).find(x=>x.type==='mdia'),hdlr=boxes(mdia.start,mdia.end).find(x=>x.type==='hdlr');return buffer.toString('ascii',hdlr.start+8,hdlr.start+12);});};
 for(const name of ['yuni-checkin','yuni-checkin-week']){const clip=fs.readFileSync(path.join(__dirname,'../pages/posted/yuni/'+name+'.mp4'));assert.deepEqual(types(clip),['vide'],'shipped clips physically contain no audio track');assert.ok(clip.length<300000);}
 console.log('Daily check-in popup: one display per day/account, cross-page coordination, real streak/points, weekly clip, offline ack, static/failure/ended fallbacks, lifecycle/account guards and silent MP4 tracks passed.');
})().catch(e=>{console.error(e);process.exitCode=1});
