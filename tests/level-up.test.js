const assert=require('node:assert/strict'),fs=require('node:fs');
global.wx={getStorageSync:()=>null,setStorageSync(){},showToast(){}};
let def;global.Component=d=>{def=d;};

// The popup is driven by the loyalty notice queue; acknowledging goes through
// orders.act, so stub both that and the clip loader to keep the test offline.
const acked=[];
let onAck=()=>{};
const ordersPath=require.resolve('../utils/orders');
require.cache[ordersPath]={id:ordersPath,filename:ordersPath,loaded:true,exports:{
  subscribe:()=>()=>{},
  act:(name,payload)=>{acked.push([name,payload]);if(name==='ackLoyaltyNotice')onAck(payload);return Promise.resolve({});}
}};
const videoPath=require.resolve('../utils/yuni-video');
require.cache[videoPath]={id:videoPath,filename:videoPath,loaded:true,exports:{prepare:()=>Promise.resolve('wxfile://clip.mp4')}};

const store=require('../utils/store');store.reset();
onAck=({noticeId})=>store.update(s=>{s.progression={...s.progression,notices:(s.progression.notices||[]).filter(n=>n.id!==noticeId)};});
require('../components/level-up/index');

const make=()=>({data:structuredClone(def.data),setData(v){Object.assign(this.data,v);},...def.methods});
const queue=(points,level,notices)=>store.update(s=>{s.progression={points,level,notices};});

// Nothing queued: the popup stays shut.
let inst=make();
inst.check();
assert.equal(inst.data.open,false,'no notice, no popup');

// A level notice opens it with the tier name from yuni-level and the running points.
queue(150,3,[{id:'n1',type:'level',level:3}]);
inst=make();inst.check();
assert.equal(inst.data.open,true);
assert.equal(inst.data.noticeId,'n1');
assert.equal(inst.data.noticeType,'level');
assert.equal(inst.data.levelNo,3);
assert.equal(inst.data.name,'Yuni 达人','Chinese tier name comes from yuni-level');
assert.equal(inst.data.points,150);
assert.equal(inst.data.videoFailed,false,'level notices play the clip');

// English copy follows the language switch.
store.update(s=>{s.language='en';});
inst=make();inst.check();
assert.equal(inst.data.ui.title,'Level up!');
assert.equal(inst.data.name,'Yuni Pro');
store.update(s=>{s.language='zh';});

// A streak notice uses the still image and shows the bonus it carries.
queue(170,3,[{id:'n2',type:'weekly',points:20}]);
inst=make();inst.check();
assert.equal(inst.data.open,true);
assert.equal(inst.data.noticeType,'weekly');
assert.equal(inst.data.videoFailed,true,'streak notices skip the clip');
assert.equal(inst.data.bonusPoints,20);
assert.equal(inst.data.levelNo,0,'streak notices carry no tier');

// While a popup is on screen another notice cannot replace it mid-read.
queue(170,3,[{id:'n4',type:'level',level:3},{id:'n5',type:'weekly'}]);
inst=make();inst.check();
assert.equal(inst.data.noticeId,'n4','the first notice wins');
inst.check();
assert.equal(inst.data.noticeId,'n4','checking again while open changes nothing');

// The template keeps its two escape hatches: tap to close and a video fallback.
const xml=fs.readFileSync('components/level-up/index.wxml','utf8');
assert.match(xml,/bindtap="close"/);
assert.match(xml,/binderror="videoError"/);
assert.match(xml,/assets\/yuni-party\.png/,'a still image stands in when the clip cannot play');
assert.match(xml,/noticeType==='weekly'\?'✦ 7 DAY STREAK':'✦ LEVEL UP'/);
for(const p of ['jobs','earnings','profile','requests'])assert.match(fs.readFileSync('pages/'+p+'/index.wxml','utf8'),/<app-nav/,p+' mounts the shared bottom bar');
assert.match(fs.readFileSync('components/nav/index.wxml','utf8'),/<level-up\s*\/>/,'the popup rides with the shared bottom bar, so every tab gets it once');
assert.ok(require('../app.json').usingComponents['level-up']);
assert.ok(fs.statSync('pages/posted/yuni/yuni-levelup.mp4').size<300000);

(async()=>{
  // The clip is prepared asynchronously and only lands on the level notice.
  queue(150,3,[{id:'n6',type:'level',level:3}]);
  const level=make();level.check();
  await Promise.resolve();
  assert.equal(level.data.videoSrc,'wxfile://clip.mp4','the clip is attached once ready');

  // Closing hides it at once, acknowledges the notice and never reopens it.
  level.close();
  assert.equal(level.data.open,false,'closing hides the popup immediately');
  assert.deepEqual(acked.at(-1),['ackLoyaltyNotice',{noticeId:'n6'}]);
  await Promise.resolve();await Promise.resolve();
  assert.equal(level.data.acknowledging,false);
  assert.equal(level.data.open,false,'an acknowledged notice does not come back');
  assert.equal(level.data.videoSrc,'','the clip is released on close');

  // A second tap while acknowledging does not acknowledge twice.
  queue(150,3,[{id:'n7',type:'level',level:3}]);
  const twice=make();twice.check();twice.setData({acknowledging:true});
  const before=acked.length;
  twice.close();
  assert.equal(acked.length,before,'close is ignored while an ack is in flight');

  // The clip still comes from the yuni subpackage, cached after the first copy.
  delete require.cache[require.resolve('../utils/yuni-video')];
  const files={'/pages/posted/yuni/yuni-levelup.mp4':'clip'};let loaded=0;
  global.wx={env:{USER_DATA_PATH:'wxfile://usr'},loadSubpackage:o=>{loaded++;o.success();},
    getFileSystemManager:()=>({access:o=>files[o.path]?o.success():o.fail(),readFile:o=>files[o.filePath]?o.success({data:files[o.filePath]}):o.fail(new Error('missing')),writeFile:o=>{files[o.filePath]=o.data;o.success();}})};
  const video=require('../utils/yuni-video');
  assert.equal(await video.prepare('levelup'),'wxfile://usr/yuni-levelup-v1.mp4');
  assert.equal(loaded,1,'subpackage loaded before reading');
  await video.prepare('levelup');
  assert.equal(loaded,1,'cached copy skips the subpackage');
  console.log('Level-up popup: notice queue opens it once, tier name and points follow the language, streak notices skip the clip, acknowledging closes it for good, and the clip loads from the yuni subpackage.');
})().catch(e=>{console.error(e);process.exitCode=1;});
