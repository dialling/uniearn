'use strict';
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..');
const src = path.join(root, 'cloudfunctions/orderService');
const dest = path.join(root, 'cloudfunctions/adminService/order-engine');
fs.mkdirSync(dest, {recursive: true});
for (const file of fs.readdirSync(src)) {
  if (file.endsWith('.js') && file !== 'index.js') fs.copyFileSync(path.join(src, file), path.join(dest, file));
}
console.log('Prepared adminService with the current order engine.');
