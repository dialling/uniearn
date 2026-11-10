const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');for(const name of ['utils/flow.wxss','pages/takeaway/index.wxss','pages/trip-start/index.wxss','pages/jobs/index.wxss']){const css=fs.readFileSync(path.join(root,name),'utf8');for(const rule of css.matchAll(/([^{}]+)\{/g)){const selector=rule[1].trim();assert.ok(!/(^|[\s>+~,])\*/.test(selector),name+' unsupported universal selector: '+selector);}}
console.log('New WXSS selectors checked for unsupported wildcard syntax');
