// 2026-11-16: every animation name in Yuni's stage is defined once. A reused name silently replaces the earlier
// animation (the eagle's resting "breathe" once bent Yuni's idle pose 40 degrees).
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const css=fs.readFileSync(path.join(__dirname,'../components/yuni-stage/index.wxss'),'utf8');
const names=(css.match(/@keyframes\s+[\w-]+/g)||[]).map(k=>k.split(/\s+/)[1]);
const dup=names.filter((n,i)=>names.indexOf(n)!==i);
assert.deepEqual(dup,[],'animation names used twice: '+dup.join(', '));
assert.match(css,/@keyframes ys-breathe\{0%,100%\{transform:scale\(1,1\)\}/,'Yuni idles upright');
console.log('Yuni stage: '+names.length+' animation names, all unique');
