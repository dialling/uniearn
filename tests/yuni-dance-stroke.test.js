// 2026-11-16: Yuni only dances when the Dance button is tapped; stroking Yuni makes sounds (giggle, coo, purr).
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const js=fs.readFileSync(path.join(__dirname,'../components/yuni-stage/index.js'),'utf8');
const groove=js.match(/body: 'groove'/g)||[];assert.equal(groove.length,1,'only one dance pose in the code');
assert.match(js,/danceMove\(\) \{ sound\.dance\(\); this\.act\(\{ face: 'happy', wings: 'dance', body: 'groove'/,'the dance pose lives in danceMove');
const calls=(js.match(/this\.danceMove\(\)/g)||[]).length;assert.equal(calls,1,'danceMove runs from one place');
assert.match(js,/dance\(\) \{ sound\.unlock\(\); this\.wake\(true\); this\.rest\(\); this\.danceMove\(\);/,'that place is the Dance button');
assert.equal((js.match(/sound\.dance\(\)/g)||[]).length,1,'the dance tune only plays with the dance');
assert.match(js,/this\.stroke = 'shy'; sound\.giggle\(\)/,'a shy giggle when stroking starts');
assert.match(js,/this\.stroke = 'love'; sound\.coo\(\)/,'a happy coo when it turns to love');
assert.match(js,/sound\.purr\(this\.stroke === 'love'\)/,'a soft purr while stroking');
global.wx={getStorageSync:()=>null,setStorageSync(){}};const snd=require('../utils/yuni-sound');
for(const k of ['giggle','coo','purr','fanfare'])assert.equal(typeof snd[k],'function',k);
console.log('Yuni: dances only from the Dance button; stroking giggles, coos and purrs');
