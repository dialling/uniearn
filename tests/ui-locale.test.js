const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

for(const page of ['create','request','trip','task','earnings','rewards','student-check','route-edit']){
  const content=fs.readFileSync(path.join(__dirname,'..','pages',page,'index.wxml'),'utf8');
  assert.equal((content.match(/\{\{/g)||[]).length,(content.match(/\}\}/g)||[]).length,page+' has an unmatched WXML expression');
  assert.doesNotMatch(content,/\{\{[^}]*\{\{|>\|\|/,page+' has a nested or broken WXML expression');
}
console.log('Edited WXML expression boundaries passed.');
