const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');

// Customer actions stay together above the runner action.
const nav=read('components/nav/index.wxml');
const modes=[...nav.matchAll(/class="sheet-choice [a-z]+" data-mode="([a-z]+)"/g)].map(m=>m[1]);
assert.deepEqual(modes,['request','task','trip'],'the post sheet groups customer actions above Start a trip');
assert.match(nav,/为顾客/);assert.match(nav,/For customers/);
assert.match(nav,/为跑手/);assert.match(nav,/For runners/);

// The task card is bilingual and names the needs people actually post.
assert.match(nav,/其他需求/);
assert.match(nav,/Something else/);
assert.match(nav,/class="sheet-new"/);
assert.match(nav,/src="\/assets\/sheet-task\.svg"/);
assert.match(nav,/src="\/assets\/sheet-yuan\.svg"/,'Start a trip uses the RMB icon at the existing image size');
assert.match(read('assets/sheet-yuan.svg'),/M5 4l7 8 7-8M12 12v8M6\.5 12h11M6\.5 16h11/,'the icon draws a yuan sign with two diagonals, two bars and one stem');
for(const word of ['枕头','课本','老师','签到']) assert.ok(nav.includes(word),`the third card should mention ${word}`);

// Only the last card drops its bottom margin, so the sheet still ends flush.
const navCss=read('components/nav/index.wxss');
assert.match(navCss,/\.sheet-choice\.trip\{margin-bottom:0\}/);
assert.doesNotMatch(navCss,/\.sheet-choice\.task\{[^}]*margin-bottom:0\}/);
assert.match(navCss,/\.sheet-runner-audience\{margin-top:8rpx\}/);
assert.match(navCss,/\.sheet-choice\.parcel\{animation-delay:\.08s\}\.sheet-choice\.task\{animation-delay:\.13s\}\.sheet-choice\.trip\{animation-delay:\.2s\}/);

// Routing: mode=task opens the free-form form, and that page has to be registered.
let opened=null,definition=null;
global.wx={navigateTo:o=>{opened=o;}};
global.Component=d=>{definition=d;};
require('../components/nav/index.js');
const self={setData(){}};
const tap=mode=>definition.methods.create.call(self,{currentTarget:{dataset:{mode}}});
tap('task');assert.equal(opened.url,'/pages/task-post/index','the task card opens the free-form task form');
tap('trip');assert.equal(opened.url,'/pages/trip-start/index?category=takeout');
tap('request');assert.equal(opened.url,'/pages/takeaway/index');
assert.ok(require('../app.json').pages.includes('pages/task-post/index'),'task-post must be registered to be reachable');

// The form keeps the requested shopping and textbook examples.
const form=read('pages/task-post/index.js');
for(const example of ['帮我买一个枕头或一个盆儿','帮我拿一下课本'])
  assert.ok(form.includes(example),`example missing from the task form: ${example}`);
assert.match(form,/en:\['Buy me a pillow or a basin'/,'the examples stay bilingual');

console.log('Post sheet: pick-up, trip and free-form task, with routing and bilingual examples');
