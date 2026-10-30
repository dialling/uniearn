const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),project=JSON.parse(fs.readFileSync(path.join(root,'project.config.json'),'utf8')),appRoot=path.resolve(root,project.miniprogramRoot||'.');
const slash=s=>s.replace(/\\/g,'/').replace(/^\.\//,'').replace(/\/$/,'');
const ignored=relative=>(project.packOptions?.ignore||[]).some(rule=>{const value=slash(rule.value),p=slash(relative);return rule.type==='folder'?(p===value||p.startsWith(value+'/')):rule.type==='file'?p===value:rule.type==='suffix'?p.endsWith(value):rule.type==='prefix'?p.startsWith(value):false;});
for(const dir of ['UniEarn-GitHub-Changes','uniearn-upload','admin-web','tests','docs','cloudfunctions'])assert.ok(ignored(dir+'/app.json'),dir+' must not enter the mini program package');
const files=[];function walk(dir,relative=''){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const rel=slash(path.join(relative,e.name));if(ignored(rel))continue;if(e.isDirectory())walk(path.join(dir,e.name),rel);else files.push(rel);}}walk(appRoot);
assert.deepEqual(files.filter(p=>path.posix.basename(p)==='app.json'),['app.json'],'only the real app root can be packaged');
const app=JSON.parse(fs.readFileSync(path.join(appRoot,'app.json'),'utf8')),pages=[...app.pages];
for(const sub of app.subpackages||app.subPackages||[])pages.push(...sub.pages.map(p=>sub.root+'/'+p));
for(const p of pages)for(const ext of ['js','json','wxml'])assert.ok(files.includes(p+'.'+ext),'missing or excluded page: '+p+'.'+ext);
for(const p of Object.values(app.usingComponents||{})){const base=p.replace(/^\//,'');for(const ext of ['js','json','wxml'])assert.ok(files.includes(base+'.'+ext),'missing or excluded global component: '+base+'.'+ext);}
assert.ok(files.some(p=>p.startsWith('assets/')),'application images remain packaged');
for(const sub of app.subpackages||app.subPackages||[])assert.ok(files.some(p=>p.startsWith(sub.root+'/')),'subpackage remains packaged: '+sub.root);
console.log('WeChat upload package: historical source copies/server/docs excluded; app root, '+pages.length+' pages, global components, assets and subpackages remain included.');
