const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');let count=0;
function check(file){const source=fs.readFileSync(file,'utf8').replace(/<!--[\s\S]*?-->/g,'').replace(/\{\{[\s\S]*?\}\}/g,''),stack=[];const tags=/<(\/?)([\w:-]+)\b(?:[^>"']|"[^"]*"|'[^']*')*?(\/?)>/g;for(const match of source.matchAll(tags)){const [,close,tag,self]=match;if(close){assert.equal(stack.pop(),tag,path.relative(root,file)+': mismatched closing '+tag);}else if(!self)stack.push(tag);}assert.deepEqual(stack,[],path.relative(root,file)+': unclosed tags');count++;}
function walk(dir){for(const item of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,item.name);if(item.isDirectory())walk(file);else if(file.endsWith('.wxml'))check(file);}}
walk(root+'/pages');walk(root+'/components');
const trip=fs.readFileSync(root+'/pages/trip/index.wxml','utf8');assert(trip.includes('bindtap="photo"'));assert(trip.includes('item.runnerPoints'));assert(!trip.includes('deliveryMinutes'));
console.log('WXML tag structure checked for '+count+' active page/component templates; delivery photo action retained.');
