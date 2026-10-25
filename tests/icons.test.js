const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');

// Every icon is a self-contained 24x24 stroke SVG: <image> cannot inherit currentColor.
const icons=['plus-white','plus-orange','check-white','x-muted','x-light'];
for(const name of icons){
  const svg=read(`assets/icons/${name}.svg`).trim();
  assert.match(svg,/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="24" height="24" viewBox="0 0 24 24"/,`${name} keeps the shared 24x24 grid`);
  assert.match(svg,/stroke="#[0-9a-f]{6}"/,`${name} bakes its colour`);
  assert.match(svg,/stroke-linecap="round"/,`${name} keeps round caps`);
  assert.doesNotMatch(svg,/currentColor/,`${name} must not rely on currentColor`);
}

// Any icon a template points at has to exist, so a typo cannot ship as a blank space.
const templates=['components/nav/index.wxml','pages/takeaway/index.wxml','pages/create/index.wxml'];
for(const file of templates){
  const refs=[...read(file).matchAll(/\/assets\/icons\/([a-z-]+)\.svg/g)].map(m=>m[1]);
  for(const name of new Set(refs)) assert.ok(fs.existsSync(path.join(root,'assets/icons',`${name}.svg`)),`${file} references a missing icon: ${name}`);
}

// Bottom bar: the plus and the sheet close are icons now, not full-width text glyphs.
const nav=read('components/nav/index.wxml');
assert.match(nav,/class="plus-icon"[^>]*src="\/assets\/icons\/plus-white\.svg"/);
assert.match(nav,/src="\{\{dark\?'\/assets\/icons\/x-light\.svg':'\/assets\/icons\/x-muted\.svg'\}\}"/);
assert.doesNotMatch(nav,/＋/);
assert.doesNotMatch(nav,/closeCreateSheet">×/);
const navCss=read('components/nav/index.wxss');
assert.match(navCss,/\.plus\{display:flex;align-items:center;justify-content:center/);
assert.match(navCss,/\.plus-icon\{width:42rpx;height:42rpx;display:block\}/);
assert.match(navCss,/\.sheet-close\{display:flex;align-items:center;justify-content:center\}/);
assert.match(navCss,/\.sheet-close-icon\{width:30rpx;height:30rpx;display:block\}/);
assert.match(navCss,/@keyframes sheet-close-unfold\{from\{opacity:0;transform:rotate\(-45deg\)/);

// Posting forms: add and selected marks use the same stroke set as the rest of the app.
for(const page of ['pages/takeaway/index.wxml','pages/create/index.wxml']){
  const t=read(page);
  assert.match(t,/class="addr-plus big" mode="aspectFit" src="\/assets\/icons\/plus-orange\.svg"/,`${page} add card uses the plus icon`);
  assert.match(t,/class="addr-plus" mode="aspectFit" src="\/assets\/icons\/plus-orange\.svg"/,`${page} add chip uses the plus icon`);
  assert.match(t,/class="addr-chip-check" mode="aspectFit" src="\/assets\/icons\/check-white\.svg"/,`${page} selected mark uses the check icon`);
  assert.doesNotMatch(t,/class="addr-plus[^"]*">＋/);
  assert.doesNotMatch(t,/class="addr-chip-check">✓/);
}
const shared=read('utils/post-form.wxss');
assert.match(shared,/\.addr-plus\{display:block;width:34rpx;height:34rpx;flex:none/);
assert.match(shared,/\.addr-plus\.big\{[^}]*width:76rpx;height:76rpx;padding:22rpx;box-sizing:border-box/);
assert.match(shared,/\.addr-chip-check\{[^}]*width:40rpx;height:40rpx;padding:11rpx;box-sizing:border-box/);
assert.match(shared,/\.addr-chip\.selected \.addr-chip-check\{opacity:1;transform:scale\(1\)\}/);

console.log('Icon set: stroke icons replace the text glyphs in the bottom bar, the create sheet and both posting forms.');
