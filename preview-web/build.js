'use strict';
// Builds a browser preview of the mini program: WXML is parsed into render trees,
// WXSS is scoped like WeChat does it, and the page code plus the order/account cloud
// functions are bundled so runtime.js can run them against an in-browser cloud.
const fs = require('node:fs'), path = require('node:path');
const root = path.resolve(__dirname, '..'), out = path.join(__dirname, 'dist');
const rel = p => path.relative(root, p).split(path.sep).join('/');
const read = p => fs.readFileSync(path.join(root, p), 'utf8').replace(/^﻿/, '');
const exists = p => fs.existsSync(path.join(root, p));
const norm = p => path.posix.normalize(p).replace(/^\/+/, '');
const warnings = [];

function walk(dir, fn, skip = new Set(['node_modules', '.git'])) {
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    if (skip.has(name)) continue;
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) walk(p, fn, skip); else fn(p);
  }
}

// ---------------------------------------------------------------- WXML
const VOID = new Set(['input', 'image', 'import', 'include', 'switch', 'slider', 'icon', 'progress', 'textarea', 'canvas', 'video']);
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ensp: ' ', emsp: ' ' };
const decode = s => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : +e.slice(1)) : (ENT[e] ?? m));

function parseWxml(src) {
  const top = { n: '#root', a: {}, c: [] }, stack = [top];
  let i = 0;
  const skipMustache = j => { const e = src.indexOf('}}', j + 2); return e < 0 ? src.length : e + 2; };
  while (i < src.length) {
    if (src.startsWith('<!--', i)) { const e = src.indexOf('-->', i); i = e < 0 ? src.length : e + 3; continue; }
    if (src.startsWith('</', i)) {
      const e = src.indexOf('>', i), name = src.slice(i + 2, e).trim();
      const at = stack.map(n => n.n).lastIndexOf(name);
      if (at > 0) stack.length = at;
      i = e + 1; continue;
    }
    if (src[i] === '<' && /[a-zA-Z]/.test(src[i + 1] || '')) {
      let j = i + 1; while (j < src.length && /[\w-]/.test(src[j])) j++;
      const node = { n: src.slice(i + 1, j), a: {}, c: [] };
      let self = false;
      for (;;) {
        while (/\s/.test(src[j])) j++;
        if (src.startsWith('/>', j)) { self = true; j += 2; break; }
        if (src[j] === '>') { j++; break; }
        if (j >= src.length) break;
        let k = j; while (k < src.length && !/[\s=/>]/.test(src[k])) k++;
        const name = src.slice(j, k); j = k;
        while (/\s/.test(src[j])) j++;
        if (src[j] === '=') {
          j++; while (/\s/.test(src[j])) j++;
          const q = src[j];
          if (q === '"' || q === "'") {
            let e = j + 1;
            while (e < src.length && src[e] !== q) e = src.startsWith('{{', e) ? skipMustache(e) : e + 1;
            node.a[name] = src.slice(j + 1, e); j = e + 1;
          } else { let e = j; while (e < src.length && !/[\s>]/.test(src[e])) e++; node.a[name] = src.slice(j, e); j = e; }
        } else if (name) node.a[name] = '';
        else j++;
      }
      stack[stack.length - 1].c.push(node);
      if (!self && !VOID.has(node.n)) stack.push(node);
      i = j; continue;
    }
    let j = i;
    while (j < src.length) {
      if (src.startsWith('{{', j)) { j = skipMustache(j); continue; }
      if (src[j] === '<' && (src[j + 1] === '/' || src[j + 1] === '!' || /[a-zA-Z]/.test(src[j + 1] || ''))) break;
      j++;
    }
    const text = src.slice(i, j);
    if (text.trim()) stack[stack.length - 1].c.push({ text });
    i = j;
  }
  return top.c;
}

function exprFn(expr, file, wrapObject) {
  let body = expr.trim();
  if (wrapObject && !/^\{[\s\S]*\}$/.test(body)) body = '{' + body + '}';
  if (wrapObject) body = '(' + body + ')';
  const code = 'function(s){with(s){return (' + body + ');}}';
  try { new Function('return ' + code); } catch (e) { warnings.push(file + ': cannot compile {{' + expr + '}}'); return 'undefined'; }
  return code;
}
function value(str, file, wrapObject) {
  const parts = [], re = /\{\{([\s\S]*?)\}\}/g; let last = 0, m;
  while ((m = re.exec(str))) { if (m.index > last) parts.push(JSON.stringify(decode(str.slice(last, m.index)))); parts.push(exprFn(m[1], file, wrapObject)); last = re.lastIndex; }
  if (!parts.length) return JSON.stringify(decode(str));
  if (last < str.length) parts.push(JSON.stringify(decode(str.slice(last))));
  if (parts.length === 1 && str.trim().startsWith('{{') && str.trim().endsWith('}}') && str.trim() === str) return parts[0];
  return '{p:[' + parts.join(',') + ']}';
}

const wxmlFiles = {};
function compileWxml(file) {
  if (wxmlFiles[file]) return;
  wxmlFiles[file] = 'null';
  const tree = parseWxml(read(file)), dir = path.posix.dirname(file), templates = {}, imports = [];
  const resolve = src => norm(src.startsWith('/') ? src : dir + '/' + src);
  function children(list) {
    const outList = [];
    let chain = null;
    for (const node of list) {
      if (node.text !== undefined) { chain = null; outList.push('{x:' + value(node.text, file) + '}'); continue; }
      if (node.n === 'import') { const f = resolve(node.a.src); compileWxml(f); imports.push(f); continue; }
      if (node.n === 'include') { const f = resolve(node.a.src); outList.push(...children(parseWxml(read(f)).filter(n => n.n !== 'template' || !('name' in n.a)))); continue; }
      if (node.n === 'wxs') continue;
      if (node.n === 'template' && 'name' in node.a) { templates[node.a.name] = '[' + children(node.c).join(',') + ']'; continue; }
      const a = node.a;
      if ('wx:elif' in a || 'wx:else' in a) {
        if (chain) { chain.push('[' + ('wx:else' in a ? 'null' : value(a['wx:elif'], file)) + ',' + element(node) + ']'); continue; }
        warnings.push(file + ': wx:elif/else without wx:if');
      }
      if ('wx:if' in a && !('wx:for' in a)) { chain = ['[' + value(a['wx:if'], file) + ',' + element(node) + ']']; outList.push({ chain }); continue; }
      chain = null;
      outList.push(element(node));
    }
    return outList.map(x => typeof x === 'string' ? x : '{if:[' + x.chain.join(',') + ']}');
  }
  function element(node) {
    const a = node.a;
    if ('wx:for' in a) {
      const rest = { ...node, a: { ...a } };
      for (const k of ['wx:for', 'wx:for-items', 'wx:for-item', 'wx:for-index', 'wx:key']) delete rest.a[k];
      const key = a['wx:key'];
      return '{for:' + value(a['wx:for'] || a['wx:for-items'], file) + ',item:' + JSON.stringify(a['wx:for-item'] || 'item') + ',index:' + JSON.stringify(a['wx:for-index'] || 'index') + ',key:' + JSON.stringify(key == null ? null : key.replace(/^\{\{|\}\}$/g, '').trim()) + ',body:' + element(rest) + '}';
    }
    if ('wx:if' in a) { const rest = { ...node, a: { ...a } }; delete rest.a['wx:if']; return '{if:[[' + value(a['wx:if'], file) + ',' + element(rest) + ']]}'; }
    if (node.n === 'template' && 'is' in a) return '{tpl:' + value(a.is, file) + (a.data ? ',data:' + value(a.data, file, true) : '') + '}';
    const attrs = [], events = [];
    for (const [k, v] of Object.entries(a)) {
      if (k === 'wx:elif' || k === 'wx:else') continue;
      const ev = /^(bind|catch|capture-bind|capture-catch|mut-bind):?(.+)$/.exec(k);
      if (ev) { events.push('[' + JSON.stringify(ev[2]) + ',' + (ev[1].includes('catch') ? 1 : 0) + ',' + value(v, file) + ']'); continue; }
      attrs.push(JSON.stringify(k) + ':' + value(v, file));
    }
    return '{n:' + JSON.stringify(node.n) + ',a:{' + attrs.join(',') + '}' + (events.length ? ',e:[' + events.join(',') + ']' : '') + (node.c.length ? ',c:[' + children(node.c).join(',') + ']' : '') + '}';
  }
  const nodes = children(tree);
  wxmlFiles[file] = '{c:[' + nodes.join(',') + '],t:{' + Object.entries(templates).map(([k, v]) => JSON.stringify(k) + ':' + v).join(',') + '},imp:' + JSON.stringify(imports) + ',dir:' + JSON.stringify(dir) + '}';
}

// ---------------------------------------------------------------- WXSS
const TAGS = 'view|text|image|button|scroll-view|picker|switch|slider|icon|navigator|swiper|swiper-item|rich-text|label|form|cover-view|cover-image|progress|checkbox|radio|checkbox-group|radio-group|movable-view|movable-area';
const TAG_RE = new RegExp('(^|[\\s>+~(,])(' + TAGS + ')(?=$|[\\s.:#\\[>+~),])', 'g');
function loadCss(file, seen = new Set()) {
  if (seen.has(file) || !exists(file)) return '';
  seen.add(file);
  const dir = path.posix.dirname(file);
  let css = read(file).replace(/\/\*[\s\S]*?\*\//g, '');
  css = css.replace(/@import\s+(?:url\()?["']([^"']+)["']\)?\s*;?/g, (m, f) => loadCss(norm(f.startsWith('/') ? f : dir + '/' + f), seen));
  css = css.replace(/url\(\s*(["']?)([^"')]+)\1\s*\)/g, (m, q, u) => /^(data:|https?:|#)/.test(u) ? m : 'url("' + norm(u.startsWith('/') ? u : dir + '/' + u) + '")');
  return css;
}
function units(css) {
  return css
    .replace(/(-?\d*\.?\d+)rpx/g, (m, n) => +(n * 0.5).toFixed(3) + 'px')
    .replace(/(-?\d*\.?\d+)(vh|vw)\b/g, (m, n, u) => 'calc(' + n + ' * var(--' + u + '))')
    .replace(/(?:env|constant)\(\s*safe-area-inset-bottom\s*\)/g, '34px')
    .replace(/(?:env|constant)\(\s*safe-area-inset-(?:top|left|right)\s*\)/g, '0px');
}
function splitSelectors(sel) {
  const list = []; let depth = 0, cur = '';
  for (const ch of sel) { if (ch === '(') depth++; if (ch === ')') depth--; if (ch === ',' && !depth) { list.push(cur); cur = ''; } else cur += ch; }
  list.push(cur); return list.map(s => s.trim()).filter(Boolean);
}
function mapSelector(sel, scope) {
  let s = sel.replace(TAG_RE, '$1wx-$2');
  if (scope.cid) {
    s = s.replace(/:host/g, '[data-host="' + scope.cid + '"]').replace(/\.(-?[_a-zA-Z][\w-]*)/g, '.' + scope.cid + '-$1');
    return s;
  }
  const pageRoot = scope.page ? ':where(.wx-page[data-page="' + scope.page + '"])' : ':where(.wx-page)';
  if (/^page(?=$|[\s.:#\[>+~])/.test(s)) return pageRoot + s.slice(4);
  return scope.page ? pageRoot + ' ' + s : s;
}
function scopeCss(css, scope) {
  let outCss = '', i = 0;
  while (i < css.length) {
    const brace = css.indexOf('{', i);
    if (brace < 0) break;
    const head = css.slice(i, brace).trim();
    let depth = 1, j = brace + 1;
    while (j < css.length && depth) { if (css[j] === '{') depth++; else if (css[j] === '}') depth--; j++; }
    const body = css.slice(brace + 1, j - 1);
    if (/^@(media|supports)/.test(head)) outCss += head + '{' + scopeCss(body, scope) + '}\n';
    else if (head.startsWith('@')) outCss += head + '{' + body + '}\n';
    else if (head) outCss += splitSelectors(head).map(s => mapSelector(s, scope)).join(',') + '{' + body + '}\n';
    i = j;
  }
  return outCss;
}

// ---------------------------------------------------------------- collect
const appJson = JSON.parse(read('app.json'));
const pages = [...appJson.pages];
for (const sp of appJson.subpackages || appJson.subPackages || []) for (const p of sp.pages) pages.push(norm(sp.root + '/' + p));

const components = {};
let cidSeq = 0;
function resolveComponent(from, ref) { return norm(ref.startsWith('/') ? ref : path.posix.dirname(from) + '/' + ref); }
function usingOf(file, json) {
  const using = {};
  for (const [tag, ref] of Object.entries(json.usingComponents || {})) { const p = resolveComponent(file, ref); using[tag] = p; addComponent(p); }
  return using;
}
function addComponent(p) {
  if (components[p]) return;
  components[p] = { cid: 'c' + (cidSeq++) };
  const json = exists(p + '.json') ? JSON.parse(read(p + '.json')) : {};
  components[p].json = json;
  components[p].using = usingOf(p, json);
  if (exists(p + '.wxml')) compileWxml(p + '.wxml');
}
const globalUsing = usingOf('app', appJson);
const pageInfo = {};
for (const p of pages) {
  const json = exists(p + '.json') ? JSON.parse(read(p + '.json')) : {};
  pageInfo[p] = { json, using: usingOf(p, json) };
  compileWxml(p + '.wxml');
}

let css = '';
css += scopeCss(units(loadCss('app.wxss')), {});
for (const p of pages) css += scopeCss(units(loadCss(p + '.wxss')), { page: p });
for (const [p, c] of Object.entries(components)) css += scopeCss(units(loadCss(p + '.wxss')), { cid: c.cid });

// Every JS/JSON file the pages can require, plus the cloud functions the preview cloud runs.
const modules = [], jsonFiles = {};
const CLOUD = ['orderService', 'studentAccount', 'newsService'];
function addCode(file, list) {
  const key = rel(file);
  if (key.endsWith('.json')) { try { jsonFiles[key] = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, '')); } catch (_) {} return; }
  if (!key.endsWith('.js')) return;
  list.push(JSON.stringify(key) + ':function(require,module,exports,__g){with(__g){\n' + fs.readFileSync(file, 'utf8').replace(/^﻿/, '').replace(/^#!.*/, '') + '\n}}');
}
addCode(path.join(root, 'app.js'), modules);
for (const dir of ['utils', 'pages', 'components']) walk(path.join(root, dir), f => addCode(f, modules));
for (const name of CLOUD) walk(path.join(root, 'cloudfunctions', name), f => addCode(f, modules));

// ---------------------------------------------------------------- write
// Files are overwritten in place: Dropbox can hold a lock on the folder itself.
fs.mkdirSync(out, { recursive: true });
const STATIC = /\.(png|jpe?g|gif|svg|webp|mp4|mp3)$/i;
for (const dir of ['assets', 'pages', 'components', 'utils']) walk(path.join(root, dir), f => {
  if (!STATIC.test(f)) return;
  const dest = path.join(out, rel(f));
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(f, dest);
});
const bundle = 'window.PREVIEW={app:' + JSON.stringify(appJson) + ',globalUsing:' + JSON.stringify(globalUsing) +
  ',pages:' + JSON.stringify(pageInfo) + ',components:' + JSON.stringify(components) +
  ',json:' + JSON.stringify(jsonFiles) +
  ',wxml:{' + Object.entries(wxmlFiles).map(([k, v]) => JSON.stringify(k) + ':' + v).join(',\n') + '}' +
  ',modules:{\n' + modules.join(',\n') + '\n}};\n';
fs.writeFileSync(path.join(out, 'bundle.js'), bundle);
fs.writeFileSync(path.join(out, 'app.css'), css);
for (const f of ['index.html', 'runtime.js', 'cloud.js', 'base.css']) fs.copyFileSync(path.join(__dirname, 'src', f), path.join(out, f));
console.log('Preview built: ' + pages.length + ' pages, ' + Object.keys(components).length + ' components, ' + modules.length + ' modules -> ' + rel(out));
if (warnings.length) console.log(warnings.map(w => '  warn: ' + w).join('\n'));
