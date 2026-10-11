const assert=require('node:assert/strict'),fs=require('node:fs'),copy=require('../utils/help-copy');
const xml=fs.readFileSync(require.resolve('../pages/help/index.wxml'),'utf8');
assert(!xml.includes("{{zh?"));assert(!xml.includes("?'⌃'"));for(const m of xml.matchAll(/{{labels\.(\w+)}}/g)){assert.equal(typeof copy(true)[m[1]],'string');assert.equal(typeof copy(false)[m[1]],'string');assert(copy(false)[m[1]].length);}
assert.equal(copy(false).label1,'Answers first, then a person');assert(copy(true).label1.includes('解答'));
console.log('Help template binds complete bilingual labels without inline literal expressions.');
