const fs=require('fs'),path=require('path'),vm=require('vm'),{execFileSync}=require('child_process');
const root=path.resolve(__dirname,'..');let js=0,json=0;
function walk(dir){for(const name of fs.readdirSync(dir)){if(name==='node_modules')continue;const file=path.join(dir,name);if(fs.statSync(file).isDirectory())walk(file);else if(file.endsWith('.js')){new vm.Script(fs.readFileSync(file,'utf8'),{filename:file});js++;}else if(file.endsWith('.json')){JSON.parse(fs.readFileSync(file));json++;}}}
walk(root);console.log('Syntax checked: '+js+' JS files, '+json+' JSON files');
for(const test of fs.readdirSync(root+'/tests').filter(x=>x.endsWith('.test.js')))execFileSync(process.execPath,[root+'/tests/'+test],{stdio:'inherit'});
