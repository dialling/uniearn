const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),report=require('../scripts/package-size').inspect(root),{appRoot,ignored}=report,files=report.files.map(f=>f.file);
for(const dir of ['admin-web','tests','docs','legacy','design','motion-source','preview-web','scripts'])assert.ok(ignored(dir+'/app.json'),dir+' must not enter the mini program package');
for(const removed of ['UniEarn-GitHub-Changes','uniearn-upload'])assert.ok(!fs.existsSync(path.join(root,removed)),removed+' remains deleted');
assert.deepEqual(files.filter(p=>path.posix.basename(p)==='app.json'),['app.json'],'only the real app root can be packaged');
const app=JSON.parse(fs.readFileSync(path.join(appRoot,'app.json'),'utf8')),pages=[...app.pages];
for(const sub of app.subpackages||app.subPackages||[])pages.push(...sub.pages.map(p=>sub.root+'/'+p));
for(const p of pages)for(const ext of ['js','json','wxml'])assert.ok(files.includes(p+'.'+ext),'missing or excluded page: '+p+'.'+ext);
for(const p of Object.values(app.usingComponents||{})){const base=p.replace(/^\//,'');for(const ext of ['js','json','wxml'])assert.ok(files.includes(base+'.'+ext),'missing or excluded global component: '+base+'.'+ext);}
assert.ok(files.some(p=>p.startsWith('assets/')),'application images remain packaged');
for(const sub of app.subpackages||app.subPackages||[])assert.ok(files.some(p=>p.startsWith(sub.root+'/')),'subpackage remains packaged: '+sub.root);
console.log('WeChat upload package: historical source copies/server/docs excluded; app root, '+pages.length+' pages, global components, assets and subpackages remain included.');

// Keep headroom for WeChat compiler output rather than waiting for an upload failure.
for(const p of report.packages)assert.ok(p.bytes<=1.8*1024*1024,p.name+' exceeds the source-size budget: '+p.bytes+' bytes; run npm run size');
for(let i=1;i<=5;i++){assert.ok(!fs.existsSync(path.join(root,'assets/profile-ranks/avatar-'+i+'.png')),'unused source avatars stay deleted');assert.ok(files.includes('assets/profile-ranks/badge-'+i+'.png'),'active rank badges remain packaged');}
for(const name of ['star','helper','pro','ace','captain'])assert.ok(files.includes('assets/yuni-adventure-'+name+'.png'),'active transparent mascots remain packaged');
assert.ok(files.includes('assets/yuni-look.png'),'active yuni-look mascot remains packaged');
assert.ok(files.includes('assets/yuni-worried.png'),'active yuni-worried mascot remains packaged');
console.log('Package size budgets: '+report.packages.map(p=>p.name+' '+p.bytes+' bytes').join(', '));
