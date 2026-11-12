const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
let definition,videoResolve,videoCalls=0,saved;
global.wx={getStorageSync:()=>saved||null,setStorageSync:(key,value)=>{saved=structuredClone(value);},showToast(){}};
const store=require('../utils/store'),motion=require('../utils/motion');store.reset();
assert.equal(motion.enabled(),true);
store.update(s=>s.yuniTips=false);assert.equal(motion.duration(250),0);assert.match(motion.data().motionStyle,/--ue-animation:none/);
let originalLoaded=false,changes=[];
global.Page=def=>definition=def;motion.install();
Page({data:{value:1},onLoad(){originalLoaded=true;},onMotionChange(enabled){changes.push(enabled);}});
const make=def=>({...def,data:structuredClone(def.data),setData(patch){Object.assign(this.data,patch);}});
const first=make(definition);assert.equal(first.data.motionEnabled,false,'saved preference applies to the initial page data');first.onLoad();assert.equal(originalLoaded,true);assert.deepEqual(changes,[false]);
store.update(s=>s.yuniTips=true);assert.equal(first.data.motionEnabled,true);assert.equal(first.data.motionStyle,'');
store.update(s=>s.yuniTips=false);assert.equal(first.data.motionEnabled,false);assert.deepEqual(changes,[false,true,false]);
first.onUnload();store.update(s=>s.yuniTips=true);assert.equal(first.data.motionEnabled,false,'unloaded pages no longer subscribe');
const bus=require('../utils/yuni-events'),events=[];bus.reset();const off=bus.subscribe(e=>events.push(e.key));
store.update(s=>s.yuniTips=false);bus.emit({key:'muted'});bus.status({id:'order',status:'taken',isMine:true},1);assert.deepEqual(events,[]);
store.update(s=>s.yuniTips=true);bus.emit({key:'muted'});assert.deepEqual(events,[],'muted events do not replay when enabled');bus.emit({key:'enabled'});assert.deepEqual(events,['enabled']);off();bus.reset();
global.Page=def=>definition=def;
const videoPath=require.resolve('../utils/yuni-video');require.cache[videoPath]={id:videoPath,filename:videoPath,loaded:true,exports:{prepare(){videoCalls++;return new Promise(resolve=>videoResolve=resolve);}}};
require('../pages/request/index');let request=make(definition);
store.update(s=>s.yuniTips=false);request.onLoad({id:'r',celebrate:'1'});assert.equal(request.data.celebrate,false);request.loadVideo('takeout');assert.equal(videoCalls,0);
store.update(s=>s.yuniTips=true);request=make(definition);request.onLoad({id:'r',celebrate:'1'});request.loadVideo('takeout');assert.equal(videoCalls,1);
store.update(s=>s.yuniTips=false);request.onMotionChange(false);videoResolve('wxfile://late.mp4');
(async()=>{
 await Promise.resolve();assert.equal(request.data.celebrate,false);assert.equal(request.data.videoSrc,'','late video result cannot restart playback after disabling');
 let component;global.Component=x=>component=x;
 store.update(s=>{s.yuniTips=false;s.progression={level:2,points:20,notices:[{id:'level',type:'level',level:2}]};});
 require('../components/level-up/index');const level={data:structuredClone(component.data),setData(x){Object.assign(this.data,x);},...component.methods};
 level.check();assert.equal(level.data.open,false);assert.equal(videoCalls,1,'muted level-up never loads a clip');
 require('../components/yuni-assistant/index');const assistant={data:{...structuredClone(component.data),topic:'trip',stage:'collect'},setData(x){Object.assign(this.data,x);},...component.methods};
 assistant.listen();assert.equal(assistant.data.tips,false);store.update(s=>s.yuniTips=true);assert.equal(assistant.data.tips,true);
 bus.emit({key:'visible'});assert.equal(assistant.data.event.key,'visible');store.update(s=>s.yuniTips=false);assert.equal(assistant.data.event,null);assert.equal(assistant.data.toast,false);assistant.stop();
 require('../pages/levels/index');const levels=make(definition);levels.onMotionChange(false);assert.equal(levels.data.arcMoveMs,0);assert.equal(levels.data.dragX,0);
 // All stylesheet motion must respect the same inherited override, including isolated components.
 const root=path.resolve(__dirname,'..');
 function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(path.join(dir,entry.name)):[path.join(dir,entry.name)]);}
 const css=walk(root+'/pages').concat(walk(root+'/components'),walk(root+'/utils')).filter(p=>p.endsWith('.wxss'));
 for(const file of css){const source=fs.readFileSync(file,'utf8').replace(/\/\*[\s\S]*?\*\//g,'');for(const match of source.matchAll(/(?<![-\w])(animation|animation-name|transition)\s*:\s*([^;}]+)/g))assert.match(match[2],/^var\(--ue-/,path.relative(root,file)+' has uncontrolled motion');}
 for(const route of require('../app.json').pages){const xml=fs.readFileSync(root+'/'+route+'.wxml','utf8');assert.match(xml,/<view[^>]*style="\{\{motionStyle\}\}"/,route+' must carry the motion preference to all overlays/components');}
 const me=require('../utils/me-copy')('zh');assert.equal(me.tips,'动画与 Yuni 提示');
 console.log('Motion preference: first render, retained pages, persistence, event suppression, active/pending video stop, live component update, level gestures and all stylesheet motion passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
