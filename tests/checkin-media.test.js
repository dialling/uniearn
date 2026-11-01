const assert=require('node:assert/strict'),media=require('../utils/checkin-media');
const files={},reads=[],loads=[];let content='first clip';
global.wx={env:{USER_DATA_PATH:'wxfile://usr'},loadSubpackage:o=>{loads.push(o.name);o.success();},getFileSystemManager:()=>({access:o=>files[o.path]?o.success():o.fail(),readFile:o=>{reads.push(o.filePath);o.success({data:content});},writeFile:o=>{files[o.filePath]=o.data;o.success();}})};
const {prepare}=require('../utils/yuni-video');
(async()=>{
 const first=await prepare('checkin');assert.ok(first.endsWith('yuni-checkin-'+media.daily.version+'.mp4'));assert.equal(files[first],'first clip');
 assert.equal(await prepare('checkin'),first);assert.equal(reads.length,1,'same clip version reuses the cached file');
 media.daily.version='replacement-2';media.daily.file='replacement.mp4';content='new clip';
 const second=await prepare('checkin');assert.notEqual(second,first);assert.equal(files[second],'new clip');assert.equal(files[first],'first clip');assert.equal(reads.at(-1),'/pages/posted/yuni/replacement.mp4');
 const weekly=await prepare('checkin-week');assert.ok(weekly.endsWith('yuni-checkin-week-'+media.weekly.version+'.mp4'),'daily replacement does not invalidate the weekly clip');
 const level=await prepare('levelup');assert.equal(level,'wxfile://usr/yuni-levelup-v1.mp4','existing animations retain their cache version');
 assert.ok(loads.every(x=>x==='yuni'));assert.ok(media.daily.width>0&&media.daily.height>0);
 console.log('Check-in media template: per-clip file/version/poster/size configuration, replacement cache invalidation, weekly independence and unchanged existing animation cache passed.');
})().catch(e=>{console.error(e);process.exitCode=1});
