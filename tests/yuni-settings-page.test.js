// 2026-11-16: Me › Settings › Yuni holds the sound switch, tips and animations, the app guide and how to play.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
let def,relaunch='',nav='';
global.Page=x=>def=x;global.wx={getStorageSync:()=>null,setStorageSync(){},reLaunch:o=>relaunch=o.url,navigateTo:o=>nav=o.url,setNavigationBarTitle(){}};
const store=require('../utils/store');store.reset();store.update(s=>{s.language='en';});
require('../pages/yuni/index');
const p={...def,data:structuredClone(def.data),setData(v){Object.assign(this.data,v);}};
p.onShow();
assert.equal(p.data.soundOn,true);assert.equal(p.data.tipsOn,true);assert.equal(p.data.levelName,'Yuni Star');
p.sound({detail:{value:false}});assert.equal(store.get().yuniSounds,false,'sound switch is saved');
p.tips({detail:{value:false}});assert.equal(store.get().yuniTips,false,'tips switch is saved');
p.onShow();assert.equal(p.data.soundOn,false);assert.equal(p.data.tipsOn,false);
p.guide();assert.equal(relaunch,'/pages/jobs/index?guide=1','replays the Jobs page guide');
p.levels();assert.equal(nav,'/pages/levels/index');
const app=JSON.parse(fs.readFileSync(path.join(__dirname,'../app.json'),'utf8'));assert.ok(app.pages.concat(...(app.subpackages||[]).map(x=>x.pages.map(q=>x.root+'/'+q))).includes('pages/yuni/index'),'Yuni settings is registered (main or subpackage)');
const me=fs.readFileSync(path.join(__dirname,'../pages/profile/index.wxml'),'utf8');assert.match(me,/bindtap="yuni"/,'Me › Settings has a Yuni row');
const stage=fs.readFileSync(path.join(__dirname,'../components/yuni-stage/index.wxml'),'utf8');assert.doesNotMatch(stage,/ys-sound-btn/,'no speaker icon on the stage');
console.log('Yuni settings page: sound, tips, guide, levels; stage stays clean');
