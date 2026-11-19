const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
function walk(dir,out=[]){
  for(const name of fs.readdirSync(dir)){
    if(name==='node_modules')continue;
    const file=path.join(dir,name);
    if(fs.statSync(file).isDirectory())walk(file,out);
    else if(file.endsWith('.wxml'))out.push(file);
  }
  return out;
}
const files=[...walk(path.join(root,'pages')),...walk(path.join(root,'components')),...walk(path.join(root,'utils'))];
let checked=0;
for(const file of files){
  const rel=path.relative(root,file),text=fs.readFileSync(file,'utf8');
  const exprs=[...text.matchAll(/\{\{([\s\S]*?)\}\}/g)];
  for(const m of exprs){
    checked++;
    assert.doesNotMatch(m[1],/\\['"]/,`${rel} uses a JS-style backslash escape in {{ }}, which WXML rejects (did you forget }}, ' or "). Write a typographic apostrophe or move the copy to JS.`);
  }
}
assert.ok(checked>0,'expected mustache expressions in shipped templates');
console.log('WXML mustaches: '+checked+' expressions in '+files.length+' templates have no JS backslash escapes.');
