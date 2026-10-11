const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const copyModule={exports:{}};
const legacyObject={keys:Object.keys,fromEntries:undefined,entries:undefined};
vm.runInNewContext(fs.readFileSync(require.resolve('../utils/me-copy'),'utf8'),{module:copyModule,Object:legacyObject});
const zh=copyModule.exports('zh'),en=copyModule.exports('en');
assert.equal(zh.stickers,'Yuni 贴纸');assert.equal(en.stickers,'Yuni stickers');assert.equal(en.orders,'orders');assert.equal(zh.start,'开始接单');
assert(Object.keys(en).every(k=>typeof en[k]==='string'&&en[k].length));
console.log('Me copy initializes both languages without Object.entries/fromEntries.');
