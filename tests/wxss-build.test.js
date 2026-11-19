const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');

function walk(dir,out=[]){
  for(const name of fs.readdirSync(dir)){
    if(name==='node_modules') continue;
    const file=path.join(dir,name);
    if(fs.statSync(file).isDirectory()) walk(file,out);
    else if(file.endsWith('.wxss')) out.push(file);
  }
  return out;
}
const sheets=walk(root).map(f=>path.relative(root,f));

// The devtools build registers every .wxss as a page/component module. A stylesheet parked in
// assets/ is not one, so the whole WXSS build fails with "编译 .wxss 文件错误" and the app never starts.
for(const sheet of sheets){
  assert.doesNotMatch(sheet,/^assets\//,`${sheet} must live beside a page or in utils/, not in assets/`);
}

for(const sheet of sheets){
  const text=read(sheet);
  for(const m of text.matchAll(/@import\s+["']([^"']+)["']/g)){
    const target=path.resolve(path.dirname(path.join(root,sheet)),m[1]);
    assert.ok(fs.existsSync(target),`${sheet} imports a missing file: ${m[1]}`);
    assert.ok(!path.relative(root,target).startsWith('assets/'),`${sheet} must not import from assets/: ${m[1]}`);
  }
  // WXSS is parsed by an old CSS engine: it rejects format() in @font-face and weight ranges.
  for(const face of text.matchAll(/@font-face\{[^}]*\}/g)){
    assert.doesNotMatch(face[0],/format\(/,`${sheet} uses format() in @font-face, which the WXSS build rejects`);
    const weight=face[0].match(/font-weight:([^;}]+)/);
    if(weight) assert.doesNotMatch(weight[1],/^\s*\d+\s+\d+\s*$/,`${sheet} declares a variable font weight range (${weight[1].trim()}); declare one @font-face per weight instead`);
  }
}

// Main-package WXSS cannot @import a subpackage file (WeChat reports it as "not found"
// and the page stays blank). Subpackages may import the main package; they may not
// import another subpackage's styles.
const app=JSON.parse(read('app.json'));
const subroots=(app.subpackages||app.subPackages||[]).map(s=>String(s.root||'').replace(/\/$/,'')).sort((a,b)=>b.length-a.length);
const pkg=rel=>{
  const name=rel.split(path.sep).join('/');
  return subroots.find(r=>name===r||name.startsWith(r+'/'))||'';
};
const shipped=sheets.filter(s=>{
  const name=s.split(path.sep).join('/');
  return name==='app.wxss'||name.startsWith('utils/')||name.startsWith('pages/')||name.startsWith('components/')||name.startsWith('stickers/');
});
for(const sheet of shipped){
  const text=read(sheet),from=pkg(sheet);
  for(const m of text.matchAll(/@import\s+["']([^"']+)["']/g)){
    const target=path.relative(root,path.resolve(path.dirname(path.join(root,sheet)),m[1])).split(path.sep).join('/');
    const to=pkg(target);
    assert.ok(!from||!to||from===to,`${sheet} in subpackage ${from} cannot @import ${target} from subpackage ${to}`);
    assert.ok(from||!to,`${sheet} is in the main package and cannot @import subpackage file ${target}`);
  }
}

// The invite page keeps its cover fonts inline for the same reason.
const invite=read('pages/invite/index.wxss');
assert.match(invite,/@font-face\{font-family:"Invite Serif";font-style:normal;font-weight:700;/);
assert.match(invite,/@font-face\{font-family:"Invite Serif";font-style:normal;font-weight:800;/);
assert.doesNotMatch(invite,/@import/);

console.log('WXSS build: no stray stylesheet under assets/, imports resolve, and font faces stay in the syntax the devtools build accepts.');
