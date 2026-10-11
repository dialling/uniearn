const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
global.wx={};let def;global.Page=x=>def=x;global.Component=x=>def=x;
const root=path.resolve(__dirname,'..'),names=require('../app.json').pages.map(p=>p.split('/')[1]);
for(const name of names){require('../pages/'+name+'/index');const xml=fs.readFileSync(root+'/pages/'+name+'/index.wxml','utf8');assert.ok(!/{{[^}]*&amp;[^}]*}}/.test(xml),name+': encoded ampersand inside WXML expression');for(const m of xml.matchAll(/(?:bind(?:tap|input|change)|catchtap)="([\w]+)"/g)){assert.equal(typeof def[m[1]],'function',name+': missing handler '+m[1]);}for(const key of Object.keys(def)){if(typeof def[key]==='function')assert.ok(!(key in (def.data||{})),name+': handler/data name collision '+key);}}
for(const name of names){const xml=fs.readFileSync(root+'/pages/'+name+'/index.wxml','utf8');assert.ok(!/(?:data-field|mode)="handle[A-Z]/.test(xml),name+': event rename changed a field or picker mode');}
const app=require('../app.json');for(const page of app.pages)for(const ext of ['js','wxml','json'])assert.ok(fs.existsSync(root+'/'+page+'.'+ext),page+' missing '+ext);
console.log('New page bindings and registered page assets checked');
