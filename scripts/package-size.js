const fs=require('node:fs'),path=require('node:path');
const slash=s=>s.replace(/\\/g,'/').replace(/^\.\//,'').replace(/\/$/,'');
function inspect(root=path.resolve(__dirname,'..')){
 const project=JSON.parse(fs.readFileSync(path.join(root,'project.config.json'),'utf8')),appRoot=path.resolve(root,project.miniprogramRoot||'.');
 const ignored=relative=>(project.packOptions?.ignore||[]).some(rule=>{const value=slash(rule.value),p=slash(relative);return rule.type==='folder'?(p===value||p.startsWith(value+'/')):rule.type==='file'?p===value:rule.type==='suffix'?p.endsWith(value):rule.type==='prefix'?p.startsWith(value):false;});
 const app=JSON.parse(fs.readFileSync(path.join(appRoot,'app.json'),'utf8')),subs=app.subpackages||app.subPackages||[],files=[];
 function walk(dir,relative=''){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const rel=slash(path.join(relative,e.name));if(ignored(rel))continue;if(e.isDirectory())walk(path.join(dir,e.name),rel);else if(e.isFile())files.push({file:rel,bytes:fs.statSync(path.join(dir,e.name)).size,package:subs.find(s=>rel.startsWith(s.root+'/'))?.root||'main'});}}
 walk(appRoot);
 const packages=['main',...subs.map(s=>s.root)].map(name=>({name,files:files.filter(f=>f.package===name).length,bytes:files.filter(f=>f.package===name).reduce((n,f)=>n+f.bytes,0)}));
 return {appRoot,app,ignored,files,packages,totalBytes:packages.reduce((n,p)=>n+p.bytes,0)};
}
if(require.main===module){const report=inspect();for(const p of report.packages)console.log(p.name+': '+p.bytes+' bytes ('+(p.bytes/1024/1024).toFixed(2)+' MiB), '+p.files+' files');console.log('Total: '+report.totalBytes+' bytes ('+(report.totalBytes/1024/1024).toFixed(2)+' MiB). Source sizes before compiler minification and packaging overhead.');}
module.exports={inspect};
