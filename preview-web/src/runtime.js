'use strict';
// A small mini-program runtime for the browser: Page/Component/App, WXML rendering through
// Preact, the wx.* APIs the app uses, and a phone frame. Each phone has its own modules,
// storage and openid; all phones share one PreviewCloud so orders flow between them.
(function () {
  const { h, render, Component: PC, Fragment } = preact;
  const P = window.PREVIEW, { createLoader, normalize, dirname } = window.PreviewCloud;
  const W = 375, H = 812, STATUS = 44, NAV = 44, RPX = W / 750;
  const clone = v => v === undefined ? undefined : JSON.parse(JSON.stringify(v));
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const camel = s => s.toLowerCase().replace(/-([a-z])/g, (m, c) => c.toUpperCase());
  const rpxStyle = s => s == null ? s : String(s).replace(/(-?\d*\.?\d+)rpx/g, (m, n) => +(n * RPX).toFixed(3) + 'px');
  const isTrue = v => v !== undefined && v !== null && v !== false && v !== 'false';

  // ------------------------------------------------------------ expressions
  const scopeHandler = { has: () => true, get: (t, k) => k === Symbol.unscopables ? undefined : t[k] };
  const rootScope = data => new Proxy(data || {}, scopeHandler);
  function evalv(spec, scope) {
    if (typeof spec === 'string' || spec == null) return spec;
    if (typeof spec === 'function') { try { return spec(scope); } catch (_) { return undefined; } }
    return spec.p.map(x => typeof x === 'string' ? x : str(evalv(x, scope))).join('');
  }
  const str = v => v == null ? '' : String(v);

  // ------------------------------------------------------------ data paths
  function pathKeys(p) { const keys = []; String(p).replace(/[^.[\]]+|\[(\d+)\]/g, (m, n) => { keys.push(n !== undefined ? +n : m); }); return keys; }
  function setPath(obj, p, v) {
    const keys = pathKeys(p); let x = obj;
    for (let i = 0; i < keys.length - 1; i++) { if (x[keys[i]] == null || typeof x[keys[i]] !== 'object') x[keys[i]] = typeof keys[i + 1] === 'number' ? [] : {}; x = x[keys[i]]; }
    x[keys[keys.length - 1]] = v;
  }
  const getPath = (obj, p) => pathKeys(p).reduce((x, k) => x == null ? undefined : x[k], obj);

  // ------------------------------------------------------------ async API helper
  function api(name, fn) {
    return function (opts) {
      opts = opts || {};
      const promise = new Promise((res, rej) => { try { Promise.resolve(fn(opts)).then(res, rej); } catch (e) { rej(e); } })
        .then(r => ({ errMsg: name + ':ok', ...(r || {}) }), e => { const err = e instanceof Error ? e : Object.assign(Error((e && e.errMsg) || String(e)), e); if (!err.errMsg) err.errMsg = name + ':fail ' + err.message; throw err; });
      const wants = opts.success || opts.fail || opts.complete;
      promise.then(r => { try { opts.success && opts.success(r); } finally { opts.complete && opts.complete(r); } },
        e => { try { opts.fail && opts.fail(e); } finally { opts.complete && opts.complete(e); } });
      if (wants) { promise.catch(() => {}); return undefined; }
      return promise;
    };
  }

  // ------------------------------------------------------------ the phone runtime
  let seq = 0;
  class Phone {
    constructor(el, { id, openid, cloud, label }) {
      this.id = id; this.openid = openid; this.cloud = cloud; this.label = label;
      this.prefix = 'uniearn-preview:' + id + ':';
      this.memory = new Map(); this.files = new Map();
      this.stack = []; this.pageDefs = {}; this.compDefs = {}; this.loading = [];
      this.scale = 1;
      el.innerHTML = '';
      this.el = el;
      this.screenEl = document.createElement('div'); this.screenEl.className = 'pv-screen';
      this.root = document.createElement('div'); this.root.className = 'pv-root';
      this.overlay = document.createElement('div'); this.overlay.className = 'pv-overlay';
      this.screenEl.append(this.root, this.overlay); el.append(this.screenEl);
      this.wx = this.createWx();
      const g = Object.create(null), phone = this;
      g.wx = this.wx;
      g.Page = opts => { phone.pageDefs[phone.current()] = opts || {}; };
      g.Component = opts => { phone.compDefs[phone.current()] = opts || {}; };
      g.Behavior = opts => opts || {};
      g.App = opts => { phone.app = Object.assign({ globalData: {} }, opts || {}); };
      g.getApp = () => phone.app || { globalData: {} };
      g.getCurrentPages = () => phone.stack.slice();
      g.requirePlugin = () => ({});
      g.__wxConfig = { envVersion: 'develop', platform: 'ios' };
      this.globals = g;
      this.loader = createLoader(g, null, (key, start) => { if (start) this.loading.push(key.replace(/\.js$/, '')); else this.loading.pop(); });
    }
    current() { return this.loading[this.loading.length - 1]; }
    // The app keeps its language in the local store; the preview page sets it for both phones.
    setLanguage(lang, relaunch) {
      const store = this.loader.load('utils/store.js');
      if ((store.get().language === 'en' ? 'en' : 'zh') !== lang) store.update(s => { s.language = lang; });
      if (relaunch && this.page()) this.open('reLaunch', '/' + this.page().route + this.query(this.page().options));
    }
    query(o) { const q = Object.entries(o || {}).map(([k, v]) => k + '=' + v).join('&'); return q ? '?' + q : ''; }
    start(lang) {
      this.loader.load('app.js');
      if (lang) this.setLanguage(lang, false);
      this._clock = setInterval(() => this.refreshScreen(), 30000);
      const launch = { path: P.app.entryPagePath || P.app.pages[0], query: {}, scene: 1001, referrerInfo: {} };
      this.app = this.app || { globalData: {} };
      try { this.app.onLaunch && this.app.onLaunch(launch); } catch (e) { console.error(e); }
      try { this.app.onShow && this.app.onShow(launch); } catch (e) { console.error(e); }
      render(h(Screen, { phone: this }), this.root);
      this.open('reLaunch', '/' + launch.path);
    }

    // ---------------------------------------------------------- storage + files
    getItem(k) { try { const raw = localStorage.getItem(this.prefix + k); if (raw != null) return JSON.parse(raw); } catch (_) {} return this.memory.has(k) ? clone(this.memory.get(k)) : ''; }
    setItem(k, v) { const raw = JSON.stringify(v === undefined ? null : v); try { localStorage.setItem(this.prefix + k, raw); } catch (_) { this.memory.set(k, JSON.parse(raw)); } }
    removeItem(k) { try { localStorage.removeItem(this.prefix + k); } catch (_) {} this.memory.delete(k); }
    keys() { try { return Object.keys(localStorage).filter(k => k.startsWith(this.prefix)).map(k => k.slice(this.prefix.length)); } catch (_) { return [...this.memory.keys()]; } }
    resolveSrc(src, base) {
      if (!src) return '';
      src = String(src);
      if (/^(https?:|data:|blob:)/.test(src)) return src;
      if (src.startsWith('wxfile://')) return this.files.get(src) || this.cloud.file(src) || '';
      if (src.startsWith('cloud://')) return this.cloud.file(src);
      return normalize(src.startsWith('/') ? src : (base || '') + '/' + src);
    }

    // ---------------------------------------------------------- navigation
    page() { return this.stack[this.stack.length - 1]; }
    resolveRoute(url) {
      const [p, query = ''] = String(url || '').split('?');
      const from = this.page() ? dirname(this.page().route) : '';
      const route = normalize(p.startsWith('/') ? p : from + '/' + p);
      const options = {};
      query.split('&').filter(Boolean).forEach(pair => { const i = pair.indexOf('='); options[i < 0 ? pair : pair.slice(0, i)] = i < 0 ? '' : pair.slice(i + 1); });
      return { route, options };
    }
    open(kind, url, delta = 1) {
      if (kind === 'navigateBack') {
        if (this.stack.length <= 1) return Promise.reject(Error('navigateBack:fail cannot navigate back at first page.'));
        const n = Math.min(delta, this.stack.length - 1);
        for (let i = 0; i < n; i++) this.unload(this.stack.pop());
        this.show(this.page());
        this.refreshScreen();
        return Promise.resolve();
      }
      const { route, options } = this.resolveRoute(url);
      if (!P.pages[route]) return Promise.reject(Error(kind + ':fail page "' + route + '" is not found'));
      if (kind === 'navigateTo' && this.stack.length >= 10) return Promise.reject(Error('navigateTo:fail webview count limit exceed'));
      let page;
      try { page = this.createPage(route, options); } catch (e) { console.error('Page failed to load: ' + route, e); this.toast({ title: 'Page error: ' + e.message, icon: 'none', duration: 3000 }); return Promise.reject(e); }
      if (kind === 'navigateTo') { const top = this.page(); if (top) this.hide(top); }
      else if (kind === 'redirectTo') { const top = this.stack.pop(); if (top) this.unload(top); }
      else { while (this.stack.length) this.unload(this.stack.pop()); }
      this.stack.push(page);
      this.call(page, 'onLoad', clone(options));
      this.show(page);
      this.refreshScreen();
      return Promise.resolve();
    }
    call(target, name, ...args) {
      const fn = target && target[name];
      if (typeof fn !== 'function') return;
      try { const r = fn.apply(target, args); if (r && typeof r.catch === 'function') r.catch(e => console.error(name, e)); return r; }
      catch (e) { console.error(target.route || target.is, name, e); }
    }
    show(page) { this.call(page, 'onShow'); if (page._shownOnce) this.pageLifetime(page, 'show'); page._shownOnce = true; }
    hide(page) { this.call(page, 'onHide'); this.pageLifetime(page, 'hide'); }
    pageLifetime(page, name) { for (const c of page._comps) { const pl = c._def.pageLifetimes; if (pl && pl[name]) try { pl[name].call(c); } catch (e) { console.error(c.is, name, e); } } }
    unload(page) { this.call(page, 'onUnload'); page._dead = true; }
    refreshScreen() { this.screen && this.screen.forceUpdate(); }

    // ---------------------------------------------------------- pages
    createPage(route, options) {
      this.loader.load(route + '.js');
      const def = this.pageDefs[route];
      if (!def) throw Error('Page() was not called in ' + route + '.js');
      const page = {};
      for (const [k, v] of Object.entries(def)) page[k] = k === 'data' ? clone(v || {}) : typeof v === 'function' ? v : clone(v);
      page.data = page.data || {};
      const info = P.pages[route], win = P.app.window || {};
      Object.assign(page, {
        route, __route__: route, options, _id: ++seq, _comps: new Set(), _phone: this,
        _nav: { title: info.json.navigationBarTitleText ?? win.navigationBarTitleText ?? '', bg: info.json.navigationBarBackgroundColor || win.navigationBarBackgroundColor || '#ffffff', front: (info.json.navigationBarTextStyle || win.navigationBarTextStyle) === 'white' ? '#ffffff' : '#000000', custom: (info.json.navigationStyle || win.navigationStyle) === 'custom', loading: false },
        setData: (obj, cb) => this.setData(page, obj, cb),
        selectComponent: sel => this.selectComponent(page, sel),
        selectAllComponents: sel => [...page._comps].filter(c => matchComp(c, sel)),
        createSelectorQuery: () => new Query(this, page),
        createIntersectionObserver: o => this.wx.createIntersectionObserver(page, o),
        getOpenerEventChannel: () => ({ emit() {}, on() {}, once() {}, off() {} })
      });
      return page;
    }
    setData(inst, obj, cb) {
      const changed = [];
      for (const [k, v] of Object.entries(obj || {})) { setPath(inst.data, k, v); changed.push(k); }
      if (inst._def) this.runObservers(inst, changed);
      const host = inst._host;
      if (host && !inst._rendering) host.forceUpdate(cb ? () => setTimeout(cb) : undefined);
      else if (cb) setTimeout(cb);
    }
    selectComponent(owner, sel) { return [...(owner._comps || [])].find(c => matchComp(c, sel)) || null; }

    // ---------------------------------------------------------- components
    componentDef(path) {
      if (!this.compDefs[path]) this.loader.load(path + '.js');
      return this.compDefs[path] || {};
    }
    createComponent(hostView) {
      const props = hostView.props, path = props.path, def = this.componentDef(path), meta = P.components[path];
      const behaviors = (def.behaviors || []).filter(b => b && typeof b === 'object');
      const merged = { properties: {}, data: {}, methods: {}, observers: {}, lifetimes: {} };
      for (const src of [...behaviors, def]) {
        Object.assign(merged.properties, src.properties || {}); Object.assign(merged.data, clone(src.data || {}));
        Object.assign(merged.methods, src.methods || {}); Object.assign(merged.observers, src.observers || {});
        for (const k of ['created', 'attached', 'ready', 'detached', 'moved']) if (src[k] || (src.lifetimes || {})[k]) merged.lifetimes[k] = (src.lifetimes || {})[k] || src[k];
      }
      const propDefs = {};
      for (const [k, v] of Object.entries(merged.properties)) {
        const d = typeof v === 'function' || v === null ? { type: v } : v;
        const dflt = 'value' in d ? d.value : d.type === String ? '' : d.type === Number ? 0 : d.type === Boolean ? false : d.type === Array ? [] : d.type === Object ? null : null;
        propDefs[k] = { type: d.type, value: dflt, observer: d.observer };
      }
      const data = { ...merged.data };
      for (const [k, d] of Object.entries(propDefs)) data[k] = clone(d.value);
      const inst = Object.assign({}, merged.methods);
      const phone = this;
      Object.assign(inst, {
        is: path, id: props.id || '', dataset: props.dataset || {}, data, properties: data,
        _def: def, _merged: merged, _props: propDefs, _host: hostView, _page: props.ctx.page, _owner: props.ctx.owner, _cid: meta.cid, _comps: new Set(),
        setData: (obj, cb) => phone.setData(inst, obj, cb),
        triggerEvent(name, detail) { const fn = hostView.props.events[name]; if (fn) fn(null, detail, name); },
        selectComponent: sel => phone.selectComponent(inst, sel),
        selectAllComponents: sel => [...inst._comps].filter(c => matchComp(c, sel)),
        selectOwnerComponent: () => inst._owner,
        createSelectorQuery: () => new Query(phone, inst),
        createIntersectionObserver: o => phone.wx.createIntersectionObserver(inst, o),
        getPageId: () => 'page-' + (inst._page && inst._page._id)
      });
      inst._rendering = true;
      this.applyProps(inst, props.props, true);
      try { merged.lifetimes.created && merged.lifetimes.created.call(inst); } catch (e) { console.error(e); }
      props.ctx.owner._comps && props.ctx.owner._comps.add(inst);
      if (inst._page && inst._page !== props.ctx.owner) inst._page._comps.add(inst);
      try { merged.lifetimes.attached && merged.lifetimes.attached.call(inst); } catch (e) { console.error(path, 'attached', e); }
      inst._rendering = false;
      return inst;
    }
    applyProps(inst, values, initial) {
      const changed = [];
      for (const [k, d] of Object.entries(inst._props)) {
        if (!(k in values)) continue;
        let v = values[k];
        if (d.type === Number && typeof v === 'string') v = v === '' ? 0 : Number(v);
        else if (d.type === String && v != null && typeof v !== 'string') v = String(v);
        else if (d.type === Boolean && typeof v === 'string') v = v !== 'false';
        const old = inst.data[k];
        if (old === v || (typeof v === 'object' && JSON.stringify(old) === JSON.stringify(v))) continue;
        inst.data[k] = v; changed.push(k);
        if (d.observer) { const fn = typeof d.observer === 'string' ? inst[d.observer] : d.observer; try { fn && fn.call(inst, v, old); } catch (e) { console.error(e); } }
      }
      if (changed.length) this.runObservers(inst, changed);
    }
    runObservers(inst, changed) {
      const obs = inst._merged && inst._merged.observers;
      if (!obs) return;
      const roots = changed.map(k => String(pathKeys(k)[0]));
      for (const [key, fn] of Object.entries(obs)) {
        const fields = key.split(',').map(s => s.trim());
        if (!fields.some(f => f === '**' || roots.includes(f.split(/[.[]/)[0]))) continue;
        try { fn.apply(inst, fields.map(f => f === '**' ? inst.data : getPath(inst.data, f.replace(/\.\*\*$/, '')))); } catch (e) { console.error(inst.is, 'observer', key, e); }
      }
    }

    // ---------------------------------------------------------- overlay UI
    toast({ title = '', icon = 'success', duration = 1500, mask, image }) {
      clearTimeout(this._toastTimer);
      const box = this.overlayLayer('toast');
      const iconHtml = icon === 'none' && !image ? '' : image ? '<img class="pv-toast-img" src="' + esc(image) + '">' : '<div class="pv-toast-icon pv-' + esc(icon) + '"></div>';
      box.className = 'pv-layer pv-toast-layer' + (mask ? ' pv-mask' : '');
      box.innerHTML = '<div class="pv-toast ' + (iconHtml ? 'with-icon' : 'text-only') + '">' + iconHtml + '<div class="pv-toast-text">' + esc(title) + '</div></div>';
      if (icon !== 'loading' || duration) this._toastTimer = setTimeout(() => box.remove(), duration);
    }
    overlayLayer(name) { let el = this.overlay.querySelector('[data-layer="' + name + '"]'); if (!el) { el = document.createElement('div'); el.dataset.layer = name; this.overlay.append(el); } return el; }
    sheet(html, setup) {
      const el = document.createElement('div');
      el.className = 'pv-layer pv-mask pv-sheet-layer';
      el.innerHTML = html;
      this.overlay.append(el);
      requestAnimationFrame(() => el.classList.add('open'));
      const close = () => { el.classList.remove('open'); setTimeout(() => el.remove(), 180); };
      setup(el, close);
      return el;
    }
    modal(o) {
      return new Promise(resolve => {
        const showCancel = o.showCancel !== false;
        this.sheet('<div class="pv-modal"><div class="pv-modal-body">' + (o.title ? '<div class="pv-modal-title">' + esc(o.title) + '</div>' : '') +
          (o.editable ? '<textarea class="pv-modal-input" placeholder="' + esc(o.placeholderText || '') + '">' + esc(o.content || '') + '</textarea>' : o.content ? '<div class="pv-modal-content">' + esc(o.content) + '</div>' : '') +
          '</div><div class="pv-modal-actions">' + (showCancel ? '<button data-act="cancel" style="color:' + esc(o.cancelColor || '#000') + '">' + esc(o.cancelText || '取消') + '</button>' : '') +
          '<button data-act="confirm" style="color:' + esc(o.confirmColor || '#576b95') + '">' + esc(o.confirmText || '确定') + '</button></div></div>', (el, close) => {
          el.classList.add('pv-center');
          el.addEventListener('click', e => {
            const act = e.target.closest('[data-act]'); if (!act) return;
            const input = el.querySelector('textarea');
            close(); resolve({ confirm: act.dataset.act === 'confirm', cancel: act.dataset.act === 'cancel', content: input ? input.value : undefined });
          });
        });
      });
    }
    actionSheet(o) {
      return new Promise((resolve, reject) => {
        this.sheet('<div class="pv-sheet">' + (o.alertText ? '<div class="pv-sheet-title">' + esc(o.alertText) + '</div>' : '') + (o.itemList || []).map((t, i) => '<div class="pv-sheet-item" data-i="' + i + '" style="color:' + esc(o.itemColor || '#000') + '">' + esc(t) + '</div>').join('') + '<div class="pv-sheet-gap"></div><div class="pv-sheet-item" data-i="-1">取消</div></div>', (el, close) => {
          el.addEventListener('click', e => {
            const item = e.target.closest('[data-i]');
            if (!item && e.target !== el) return;
            close();
            const i = item ? +item.dataset.i : -1;
            if (i < 0) reject({ errMsg: 'showActionSheet:fail cancel' }); else resolve({ tapIndex: i });
          });
        });
      });
    }
    // mode="multiSelector": one column per list, OK returns the chosen index of each column.
    multiPicker(columns, current) {
      return new Promise(resolve => {
        const cur = columns.map((c, k) => Math.min(c.length - 1, Math.max(0, +((current || [])[k]) || 0)));
        const col = (c, k) => '<div class="pv-picker-list" data-col="' + k + '" style="flex:1;max-height:220px;overflow:auto">' + c.map((t, i) => '<div class="pv-picker-item' + (i === cur[k] ? ' on' : '') + '" data-c="' + k + '" data-v="' + i + '">' + esc(t) + '</div>').join('') + '</div>';
        this.sheet('<div class="pv-sheet pv-picker"><div class="pv-picker-head"><span data-act="cancel">取消</span><b>请选择</b><span data-act="ok" class="ok">确定</span></div><div style="display:flex;gap:4px">' + columns.map(col).join('') + '</div></div>', (el, close) => {
          el.addEventListener('click', e => {
            const item = e.target.closest('[data-c]');
            if (item) { const k = +item.dataset.c; cur[k] = +item.dataset.v; el.querySelectorAll('[data-c="' + k + '"]').forEach(x => x.classList.toggle('on', x === item)); return; }
            const act = e.target.closest('[data-act]');
            if (act || e.target === el) { close(); resolve(act && act.dataset.act === 'ok' ? cur.slice() : null); }
          });
          setTimeout(() => el.querySelectorAll('.on').forEach(on => on.scrollIntoView({ block: 'center' })));
        });
      });
    }
    picker(labels, current) {
      return new Promise(resolve => {
        this.sheet('<div class="pv-sheet pv-picker"><div class="pv-picker-head"><span data-i="-1">取消</span><b>请选择</b><span></span></div><div class="pv-picker-list">' + labels.map((t, i) => '<div class="pv-picker-item' + (i === current ? ' on' : '') + '" data-i="' + i + '">' + esc(t) + '</div>').join('') + '</div></div>', (el, close) => {
          el.addEventListener('click', e => {
            const item = e.target.closest('[data-i]');
            if (!item && e.target !== el) return;
            close(); resolve(item ? +item.dataset.i : -1);
          });
          const on = el.querySelector('.on'); if (on) setTimeout(() => on.scrollIntoView({ block: 'center' }));
        });
      });
    }
    dateTime(mode, value, start, end) {
      return new Promise(resolve => {
        this.sheet('<div class="pv-sheet pv-picker"><div class="pv-picker-head"><span data-act="cancel">取消</span><b>' + (mode === 'time' ? '选择时间' : '选择日期') + '</b><span data-act="ok" class="ok">确定</span></div><div class="pv-picker-native"><input type="' + (mode === 'time' ? 'time' : 'date') + '" value="' + esc(value || '') + '"' + (start ? ' min="' + esc(start) + '"' : '') + (end ? ' max="' + esc(end) + '"' : '') + '></div></div>', (el, close) => {
          const input = el.querySelector('input');
          if (!input.value) { const d = new Date(); input.value = mode === 'time' ? String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') : start || d.toISOString().slice(0, 10); }
          el.addEventListener('click', e => {
            const act = e.target.closest('[data-act]');
            if (!act && e.target !== el) return;
            close(); resolve(act && act.dataset.act === 'ok' ? input.value : null);
          });
        });
      });
    }
    previewImage(urls, current) {
      this.sheet('<div class="pv-preview"><img src="' + esc(this.resolveSrc(current || urls[0])) + '"></div>', (el, close) => { el.classList.add('pv-dark'); el.addEventListener('click', close); });
    }
    chooseImages(count) {
      return new Promise((resolve, reject) => {
        const input = document.createElement('input');
        input.type = 'file'; input.accept = 'image/*'; input.multiple = count > 1;
        input.onchange = async () => {
          const files = [...input.files].slice(0, count || 9);
          if (!files.length) return reject({ errMsg: 'chooseMedia:fail cancel' });
          const tempFiles = [];
          for (const f of files) {
            const url = await shrink(f), path = 'wxfile://tmp_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7) + '.jpg';
            this.files.set(path, url);
            tempFiles.push({ tempFilePath: path, path, size: Math.round(url.length * 0.75), fileType: 'image', width: 800, height: 800 });
          }
          resolve({ tempFiles, type: 'image', tempFilePaths: tempFiles.map(f => f.tempFilePath) });
        };
        input.click();
      });
    }

    // ---------------------------------------------------------- wx
    createWx() {
      const phone = this;
      const sys = () => { const p = phone.page(), custom = p && p._nav.custom; return { brand: 'Apple', model: 'iPhone 13 (preview)', pixelRatio: 3, screenWidth: W, screenHeight: H, windowWidth: W, windowHeight: custom ? H : H - STATUS - NAV, statusBarHeight: STATUS, language: 'zh_CN', version: '8.0.50', system: 'iOS 17.0', platform: 'ios', SDKVersion: '3.7.0', theme: 'light', safeArea: { top: STATUS, left: 0, right: W, bottom: H - 34, width: W, height: H - STATUS - 34 }, screenTop: custom ? 0 : STATUS + NAV, benchmarkLevel: 30 }; };
      const nav = kind => api(kind, o => phone.open(kind, o.url, o.delta));
      const wx = {
        // storage
        getStorageSync: k => phone.getItem(k), setStorageSync: (k, v) => phone.setItem(k, v), removeStorageSync: k => phone.removeItem(k), clearStorageSync: () => phone.keys().forEach(k => phone.removeItem(k)),
        getStorage: api('getStorage', o => { const v = phone.getItem(o.key); if (v === '') throw Error('getStorage:fail data not found'); return { data: v }; }),
        setStorage: api('setStorage', o => phone.setItem(o.key, o.data)), removeStorage: api('removeStorage', o => phone.removeItem(o.key)),
        clearStorage: api('clearStorage', () => wx.clearStorageSync()),
        getStorageInfoSync: () => ({ keys: phone.keys(), currentSize: 0, limitSize: 10240 }),
        // system
        getSystemInfoSync: sys, getSystemInfo: api('getSystemInfo', sys), getWindowInfo: sys, getDeviceInfo: sys, getAppBaseInfo: sys, getSystemSetting: () => ({}), getAppAuthorizeSetting: () => ({}),
        getMenuButtonBoundingClientRect: () => ({ width: 87, height: 32, top: 48, right: 368, bottom: 80, left: 281 }),
        getAccountInfoSync: () => ({ miniProgram: { appId: 'wxf6d43df037493a8c', envVersion: 'develop', version: '' } }),
        getLaunchOptionsSync: () => ({ path: P.app.entryPagePath, query: {}, scene: 1001 }), getEnterOptionsSync: () => ({ path: P.app.entryPagePath, query: {}, scene: 1001 }),
        canIUse: () => true, env: { USER_DATA_PATH: 'wxfile://usr' }, nextTick: fn => setTimeout(fn), getUpdateManager: () => ({ onCheckForUpdate() {}, onUpdateReady() {}, onUpdateFailed() {}, applyUpdate() {} }),
        onAppShow() {}, onAppHide() {}, offAppShow() {}, offAppHide() {}, onError() {}, onUnhandledRejection() {}, onMemoryWarning() {}, onNetworkStatusChange() {}, onThemeChange() {}, reportAnalytics() {}, reportEvent() {},
        getNetworkType: api('getNetworkType', () => ({ networkType: 'wifi' })),
        login: api('login', () => ({ code: 'preview-' + phone.openid })),
        getSetting: api('getSetting', () => ({ authSetting: {} })), openSetting: api('openSetting', () => ({ authSetting: {} })), authorize: api('authorize', () => ({})),
        requestSubscribeMessage: api('requestSubscribeMessage', o => Object.fromEntries((o.tmplIds || []).map(t => [t, 'accept']))),
        // navigation
        navigateTo: nav('navigateTo'), redirectTo: nav('redirectTo'), reLaunch: nav('reLaunch'), switchTab: nav('reLaunch'), navigateBack: api('navigateBack', o => phone.open('navigateBack', null, o.delta || 1)),
        navigateToMiniProgram: api('navigateToMiniProgram', () => { phone.toast({ title: 'Opening other mini programs is not available in the preview', icon: 'none' }); throw Error('not available'); }),
        setNavigationBarTitle: api('setNavigationBarTitle', o => { const p = phone.page(); if (p) { p._nav.title = o.title; phone.refreshScreen(); } }),
        setNavigationBarColor: api('setNavigationBarColor', o => { const p = phone.page(); if (p) { if (o.backgroundColor) p._nav.bg = o.backgroundColor; if (o.frontColor) p._nav.front = o.frontColor; phone.refreshScreen(); } }),
        showNavigationBarLoading() {}, hideNavigationBarLoading() {}, hideHomeButton() {}, setBackgroundColor: api('setBackgroundColor', () => {}), setBackgroundTextStyle: api('setBackgroundTextStyle', () => {}),
        showShareMenu: api('showShareMenu', () => {}), hideShareMenu: api('hideShareMenu', () => {}), updateShareMenu: api('updateShareMenu', () => {}),
        startPullDownRefresh: api('startPullDownRefresh', () => phone.call(phone.page(), 'onPullDownRefresh')), stopPullDownRefresh: api('stopPullDownRefresh', () => {}),
        pageScrollTo: api('pageScrollTo', o => { const p = phone.page(); const sc = p && p._scroller; if (!sc) return; let top = o.scrollTop || 0; if (o.selector) { const el = p._rootEl && p._rootEl.querySelector(o.selector); if (el) top = el.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop + (o.offsetTop || 0); } sc.scrollTo({ top, behavior: o.duration === 0 ? 'auto' : 'smooth' }); }),
        // interaction
        showToast: api('showToast', o => phone.toast(o)), hideToast: api('hideToast', () => { const t = phone.overlay.querySelector('[data-layer="toast"]'); if (t) t.remove(); }),
        showLoading: api('showLoading', o => phone.toast({ title: o.title, icon: 'loading', duration: 0, mask: o.mask })), hideLoading: api('hideLoading', () => { const t = phone.overlay.querySelector('[data-layer="toast"]'); if (t) t.remove(); }),
        showModal: api('showModal', o => phone.modal(o)), showActionSheet: api('showActionSheet', o => phone.actionSheet(o)),
        vibrateShort: api('vibrateShort', () => {}), vibrateLong: api('vibrateLong', () => {}),
        makePhoneCall: api('makePhoneCall', o => phone.toast({ title: 'Call ' + o.phoneNumber + ' (preview)', icon: 'none' })),
        setClipboardData: api('setClipboardData', o => { try { navigator.clipboard.writeText(String(o.data)); } catch (_) {} phone.toast({ title: '内容已复制', icon: 'none' }); }),
        getClipboardData: api('getClipboardData', async () => ({ data: await navigator.clipboard.readText().catch(() => '') })),
        // media + files
        chooseMedia: api('chooseMedia', o => phone.chooseImages(o.count || 9)),
        chooseImage: api('chooseImage', o => phone.chooseImages(o.count || 9)),
        chooseMessageFile: api('chooseMessageFile', o => phone.chooseImages(o.count || 1).then(r => ({ tempFiles: r.tempFiles.map(f => ({ path: f.tempFilePath, size: f.size, name: 'photo.jpg', type: 'image' })) }))),
        compressImage: api('compressImage', o => ({ tempFilePath: o.src })),
        getImageInfo: api('getImageInfo', o => new Promise((res, rej) => { const img = new Image(); img.onload = () => res({ width: img.naturalWidth, height: img.naturalHeight, path: o.src, type: 'jpeg', orientation: 'up' }); img.onerror = () => rej(Error('getImageInfo:fail')); img.src = phone.resolveSrc(o.src); })),
        getFileInfo: api('getFileInfo', o => ({ size: Math.round((phone.files.get(o.filePath) || '').length * 0.75) })),
        previewImage: api('previewImage', o => phone.previewImage(o.urls || [], o.current)), previewMedia: api('previewMedia', o => phone.previewImage((o.sources || []).map(s => s.url), (o.sources || [])[o.current || 0]?.url)),
        saveImageToPhotosAlbum: api('saveImageToPhotosAlbum', () => phone.toast({ title: 'Saved (preview)', icon: 'success' })),
        saveFile: api('saveFile', o => ({ savedFilePath: o.tempFilePath })), getSavedFileList: api('getSavedFileList', () => ({ fileList: [] })), removeSavedFile: api('removeSavedFile', () => {}),
        getFileSystemManager: () => ({
          readFile(o) { if (String(o.filePath).startsWith('/pages/') && String(o.filePath).endsWith('.mp4')) { o.success && o.success({ data: { packageFile: o.filePath } }); o.complete && o.complete(); return; } const url = phone.files.get(o.filePath) || ''; const data = o.encoding === 'base64' ? url.replace(/^data:[^,]*,/, '') : url; (url ? o.success : o.fail)?.(url ? { data } : { errMsg: 'readFile:fail no such file' }); o.complete && o.complete(); },
          readFileSync(p, e) { const url = phone.files.get(p) || ''; return e === 'base64' ? url.replace(/^data:[^,]*,/, '') : url; },
          access(o) { o.fail && o.fail({ errMsg: 'access:fail' }); }, accessSync() { throw Error('no such file'); },
          writeFile(o) { if (o.data && o.data.packageFile) phone.files.set(o.filePath, phone.resolveSrc(o.data.packageFile)); o.success && o.success({}); }, unlink(o) { o.success && o.success({}); }, mkdir(o) { o.success && o.success({}); },
          getFileInfo(o) { o.success && o.success({ size: 0 }); }, stat(o) { o.fail && o.fail({ errMsg: 'stat:fail' }); }, readdir(o) { o.success && o.success({ files: [] }); }
        }),
        downloadFile: api('downloadFile', o => ({ tempFilePath: o.url, statusCode: 200 })),
        request: api('request', () => { throw Error('Network requests are disabled in the preview.'); }),
        loadSubpackage: o => { setTimeout(() => { o && o.success && o.success({}); o && o.complete && o.complete({}); }); return { onProgressUpdate() {} }; },
        loadFontFace: api('loadFontFace', () => {}),
        createVideoContext: () => ({ play() {}, pause() {}, stop() {}, seek() {}, requestFullScreen() {}, exitFullScreen() {} }),
        createInnerAudioContext: () => ({ play() {}, pause() {}, stop() {}, destroy() {}, onEnded() {}, onError() {}, onCanplay() {} }),
        // Real Web Audio so Yuni's sounds play in the preview, like wx.createWebAudioContext on a phone.
        createWebAudioContext: () => { const AC = window.AudioContext || window.webkitAudioContext; return AC ? new AC() : {}; },
        createAnimation: () => { const a = new Proxy({}, { get: (t, k) => k === 'export' ? () => [] : () => a }); return a; },
        createSelectorQuery: () => new Query(phone, null),
        createIntersectionObserver: (owner, opts = {}) => new Observer(phone, owner, opts),
        cloud: {
          init() {}, inited: true,
          callFunction: api('cloud.callFunction', async o => ({ result: await phone.cloud.call(phone.openid, o.name, o.data), requestID: 'preview' })),
          uploadFile: api('cloud.uploadFile', o => { const url = phone.files.get(o.filePath) || phone.resolveSrc(o.filePath); return { fileID: phone.cloud.saveFile(o.cloudPath, url), statusCode: 200 }; }),
          deleteFile: api('cloud.deleteFile', o => ({ fileList: (o.fileList || []).map(id => ({ fileID: id, status: 0 })) })),
          getTempFileURL: api('cloud.getTempFileURL', o => ({ fileList: (o.fileList || []).map(x => { const id = typeof x === 'string' ? x : x.fileID; return { fileID: id, tempFileURL: phone.cloud.file(id), status: 0 }; }) })),
          database: () => { throw Error('Client-side database access is not used by this app.'); }
        }
      };
      return new Proxy(wx, { get(t, k) { if (k in t) return t[k]; if (typeof k !== 'string') return undefined; return api(k, () => { console.warn('wx.' + k + ' is not simulated in the preview'); return {}; }); } });
    }
  }

  function matchComp(c, sel) { return sel.startsWith('#') ? c.id === sel.slice(1) : sel.startsWith('.') ? String(c._host.props.hostClass || '').split(/\s+/).includes(sel.slice(1)) : false; }
  async function shrink(file) {
    const url = await new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(file); });
    try {
      const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
      const k = Math.min(1, 900 / Math.max(img.width, img.height)), c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      return c.toDataURL('image/jpeg', 0.72);
    } catch (_) { return url; }
  }

  // ------------------------------------------------------------ selector query + observer
  class Query {
    constructor(phone, owner) { this.phone = phone; this.owner = owner; this.ops = []; }
    in(owner) { this.owner = owner; return this; }
    root() {
      const o = this.owner || this.phone.page();
      if (!o) return null;
      return o._cid ? o._el : o._rootEl;
    }
    sel(s) { const o = this.owner; return o && o._cid ? s.replace(/\.(-?[_a-zA-Z][\w-]*)/g, '.' + o._cid + '-$1') : s; }
    select(s) { return new NodesRef(this, s, false); }
    selectAll(s) { return new NodesRef(this, s, true); }
    selectViewport() { return new NodesRef(this, null, false); }
    exec(cb) { setTimeout(() => { const res = this.ops.map(op => { try { return op(); } catch (e) { return null; } }); cb && cb(res); }, 30); return this; }
  }
  class NodesRef {
    constructor(q, s, all) { this.q = q; this.s = s; this.all = all; }
    nodes() {
      const page = this.q.phone.page(), root = this.q.root();
      if (this.s === null) return [page && page._scroller];
      if (!root) return [];
      const s = this.q.sel(this.s);
      return this.all ? [...root.querySelectorAll(s)] : [root.querySelector(s)].filter(Boolean);
    }
    info(el, f) {
      if (!el) return null;
      const phone = this.q.phone, page = phone.page(), k = phone.scale || 1;
      const base = page && page._layer ? page._layer.getBoundingClientRect() : { left: 0, top: 0 };
      const r = el.getBoundingClientRect(), out = {};
      if (f.id) out.id = el.id;
      if (f.dataset) out.dataset = el.__ds || {};
      if (f.rect || f.size || f.boundingClientRect) Object.assign(out, { left: (r.left - base.left) / k, top: (r.top - base.top) / k, right: (r.right - base.left) / k, bottom: (r.bottom - base.top) / k, width: r.width / k, height: r.height / k });
      if (this.s === null) Object.assign(out, { width: W, height: el ? el.clientHeight : H, scrollTop: el ? el.scrollTop : 0, scrollLeft: 0, scrollHeight: el ? el.scrollHeight : H });
      if (f.scrollOffset) Object.assign(out, { scrollTop: el.scrollTop, scrollLeft: el.scrollLeft, scrollHeight: el.scrollHeight, scrollWidth: el.scrollWidth });
      if (f.node) { out.node = el.tagName === 'CANVAS' ? canvasNode(el) : el; }
      if (f.computedStyle) { const cs = getComputedStyle(el); for (const p of f.computedStyle) out[p] = cs.getPropertyValue(p.replace(/[A-Z]/g, m => '-' + m.toLowerCase())); }
      return out;
    }
    op(f, cb) { this.q.ops.push(() => { const list = this.nodes().map(el => this.info(el, f)); const r = this.all ? list : (list[0] || null); cb && cb(r); return r; }); return this.q; }
    boundingClientRect(cb) { return this.op({ rect: true, id: true, dataset: true }, cb); }
    fields(f, cb) { return this.op(f, cb); }
    scrollOffset(cb) { return this.op({ scrollOffset: true, id: true, dataset: true }, cb); }
    node(cb) { return this.op({ node: true }, cb); }
    context(cb) { return this.op({ node: true }, r => cb && cb({ context: r && r.node && r.node.getContext && r.node.getContext('2d') })); }
  }
  function canvasNode(el) {
    if (!el.createImage) { el.createImage = () => new Image(); el.requestAnimationFrame = f => requestAnimationFrame(f); el.cancelAnimationFrame = id => cancelAnimationFrame(id); }
    return el;
  }
  class Observer {
    constructor(phone, owner, opts) { this.phone = phone; this.owner = owner; this.opts = opts; this.io = null; this.margins = {}; }
    relativeToViewport(m) { this.margins = m || {}; return this; }
    relativeTo(s, m) { this.margins = m || {}; return this; }
    observe(sel, cb) {
      setTimeout(() => {
        const q = new Query(this.phone, this.owner), root = q.root();
        if (!root || !window.IntersectionObserver) return;
        const page = this.phone.page();
        this.io = new IntersectionObserver(entries => entries.forEach(e => cb({ id: e.target.id, dataset: e.target.__ds || {}, intersectionRatio: e.intersectionRatio, intersectionRect: e.intersectionRect, boundingClientRect: e.boundingClientRect, relativeRect: e.rootBounds, time: Date.now() })), { root: page && page._scroller, threshold: this.opts.thresholds || [0] });
        const s = q.sel(sel), els = this.opts.observeAll ? root.querySelectorAll(s) : [root.querySelector(s)];
        els.forEach(el => el && this.io.observe(el));
      }, 60);
      return this;
    }
    disconnect() { if (this.io) this.io.disconnect(); }
  }

  // ------------------------------------------------------------ WXML -> vnodes
  function prefixClass(cls, ctx) {
    if (!cls) return cls;
    if (!ctx.cid) return String(cls);
    return String(cls).split(/\s+/).filter(Boolean).map(t => ctx.cid + '-' + t).join(' ');
  }
  function templatesOf(file) {
    const f = P.wxml[file]; if (!f) return {};
    const t = {};
    for (const imp of f.imp) { const g = P.wxml[imp]; if (g) for (const [k, v] of Object.entries(g.t)) t[k] = { nodes: v, file: imp }; }
    for (const [k, v] of Object.entries(f.t)) t[k] = { nodes: v, file };
    return t;
  }
  // Each wx:if chain gets its own key (which chain + which branch), put straight on the element when the branch is one element
  // (an extra Fragment layer per wx:if made Preact lose track of nodes when list items with headings moved: 'insertBefore: not a child').
  // Each wx:if chain gets its own key (which chain + which branch). A key made from the branch alone ('if0') was shared by
  // sibling chains, so Preact mixed up their elements ('insertBefore: not a child') and pages stopped updating.
  let ifSeq = 0; const ifIds = new WeakMap();
  function ifKey(node) { let id = ifIds.get(node); if (!id) { id = 'if' + (++ifSeq); ifIds.set(node, id); } return id; }
  function renderNodes(nodes, scope, ctx) { const out = []; if (nodes) for (const n of nodes) renderNode(n, scope, ctx, out); return out; }
  function renderNode(node, scope, ctx, out) {
    if ('x' in node) { const t = evalv(node.x, scope); if (t !== '' && t != null) out.push(str(t)); return; }
    // Like WeChat, every wx:if chain keeps its own slot (a keyed fragment, or an empty hole when nothing shows), so a
    // sibling appearing or disappearing never shifts and rebuilds the elements after it (which restarted CSS animations).
    if (node.if) { let pick = -1; const kids = []; for (let i = 0; i < node.if.length; i++) { const [cond, n] = node.if[i]; if (cond === null || evalv(cond, scope)) { pick = i; renderNode(n, scope, ctx, kids); break; } } if (pick < 0) { out.push(null); return; } const key = ifKey(node) + ':' + pick; out.push(kids.length === 1 && kids[0] && typeof kids[0] === 'object' ? preact.cloneElement(kids[0], { key }) : h(Fragment, { key }, kids)); return; }
    if (node.for) {
      let list = evalv(node.for, scope), entries;
      if (typeof list === 'number') entries = Array.from({ length: list }, (_, i) => [i, i]);
      else if (typeof list === 'string') entries = [...list].map((c, i) => [i, c]);
      else if (Array.isArray(list)) entries = list.map((v, i) => [i, v]);
      else if (list && typeof list === 'object') entries = Object.entries(list).map(([k, v]) => [k, v]);
      else entries = [];
      const seen = new Set();
      for (const [i, v] of entries) {
        const child = Object.create(scope);
        Object.defineProperty(child, node.item, { value: v, enumerable: true, writable: true });
        Object.defineProperty(child, node.index, { value: i, enumerable: true, writable: true });
        let key = node.key === '*this' ? v : node.key && v && typeof v === 'object' ? v[node.key] : i;
        key = String(key); if (seen.has(key)) key += '#' + i; seen.add(key);
        // One flat, fully keyed list (no Fragment per item): each element gets 'item key / element key'. Nested Fragments with
        // empty wx:if holes made Preact lose nodes when an item's heading moved to another item ('insertBefore: not a child').
        const kids = renderNodes([node.body], child, ctx);
        kids.forEach((k, j) => out.push(k && typeof k === 'object' ? preact.cloneElement(k, { key: key + '/' + (k.key != null ? k.key : j) }) : k == null ? null : h(Fragment, { key: key + '/t' + j }, k)));
      }
      return;
    }
    if (node.tpl !== undefined) {
      const name = evalv(node.tpl, scope), tpl = ctx.tpls[name];
      if (!tpl) return;
      const data = node.data ? evalv(node.data, scope) : {};
      out.push(...renderNodes(tpl.nodes, rootScope(data || {}), { ...ctx, tpls: templatesOf(tpl.file), base: P.wxml[tpl.file].dir }));
      return;
    }
    if (node.n === 'block') { out.push(...renderNodes(node.c, scope, ctx)); return; }
    if (node.n === 'slot') { const name = node.a.name ? evalv(node.a.name, scope) : ''; out.push(...((ctx.slots && ctx.slots[name || '']) || [])); return; }
    out.push(renderElement(node, scope, ctx));
  }

  const TOUCH = { touchstart: 'onPointerDown', touchmove: 'onPointerMove', touchend: 'onPointerUp', touchcancel: 'onPointerCancel' };
  // Touch positions use the same origin as selector-query rects (the page layer), as on a real phone.
  function touchList(e) { if (!e || e.clientX === undefined) return []; const layer = e.target && e.target.closest ? e.target.closest('.pv-page-layer') : null, base = layer ? layer.getBoundingClientRect() : { left: 0, top: 0 }; return [{ identifier: e.pointerId || 0, clientX: (e.clientX - base.left) / (e.__k || 1), clientY: (e.clientY - base.top) / (e.__k || 1), pageX: e.clientX, pageY: e.clientY, x: e.clientX, y: e.clientY }]; }
  function makeEvent(type, dom, detail, cur) {
    const target = dom && dom.target && dom.target.closest ? dom.target.closest('[data-wx]') || dom.target : null;
    const touches = touchList(dom);
    return {
      type, timeStamp: Date.now(), detail: detail !== undefined ? detail : (dom && dom.clientX !== undefined ? { x: dom.clientX, y: dom.clientY } : {}),
      target: { id: target ? target.id || '' : cur.id || '', dataset: target && target.__ds ? target.__ds : cur.dataset || {} },
      currentTarget: { id: cur.id || '', dataset: cur.dataset || {} },
      touches: type === 'touchend' ? [] : touches, changedTouches: touches, mark: {}
    };
  }
  function handler(spec, scope, ctx, isCatch, type, cur) {
    return (dom, detail, overrideType) => {
      if (isCatch && dom && dom.stopPropagation) dom.stopPropagation();
      const name = evalv(spec, scope), owner = ctx.owner;
      if (typeof name === 'function') return name(makeEvent(overrideType || type, dom, detail, cur));
      const fn = owner && owner[name];
      if (typeof fn !== 'function') { if (name) console.warn('No handler "' + name + '" on ' + (owner && (owner.route || owner.is))); return; }
      try { const r = fn.call(owner, makeEvent(overrideType || type, dom, detail, cur)); if (r && r.catch) r.catch(e => console.error(name, e)); return r; }
      catch (e) { console.error((owner.route || owner.is) + '.' + name, e); }
    };
  }

  function renderElement(node, scope, ctx) {
    const name = node.n, attrs = {}, dataset = {};
    for (const [k, spec] of Object.entries(node.a)) { const v = evalv(spec, scope); attrs[k] = v; if (k.startsWith('data-')) dataset[camel(k.slice(5))] = v; }
    const cur = { id: attrs.id || '', dataset };
    const events = {};
    for (const [type, isCatch, spec] of node.e || []) events[type] = handler(spec, scope, ctx, isCatch, type, cur);
    const usingPath = ctx.using[name];
    if (usingPath && P.components[usingPath]) return renderComponent(usingPath, name, node, attrs, events, dataset, scope, ctx);

    const props = { 'data-wx': '', ref: el => { if (el) el.__ds = dataset; } };
    if (attrs.class) props.class = prefixClass(attrs.class, ctx);
    if (attrs.style) props.style = rpxStyle(attrs.style);
    if (attrs.id) props.id = attrs.id;
    if (isTrue(attrs.hidden) && attrs.hidden !== '') props.hidden = true; else if (attrs.hidden === '') props.hidden = true;
    const disabled = isTrue(attrs.disabled) || attrs.disabled === '';
    // tap, touch and hover-class
    if (events.tap || events.longpress || events.longtap) {
      const tap = events.tap, longp = events.longpress || events.longtap;
      if (name === 'button' && disabled) {} else {
        if (tap) props.onClick = e => { if (!e.__wxLong) tap(e); };
        if (longp) props.onContextMenu = e => { e.preventDefault(); longp(e); };
      }
    }
    for (const [t, key] of Object.entries(TOUCH)) if (events[t]) {
      const fn = events[t];
      props[key] = e => { if (t === 'touchstart') e.currentTarget.__pressed = true; if (t === 'touchmove' && !e.currentTarget.__pressed) return; if (t === 'touchend' || t === 'touchcancel') e.currentTarget.__pressed = false; fn(e); };
    }
    const hover = name === 'button' && attrs['hover-class'] === undefined ? 'button-hover' : attrs['hover-class'];
    if (hover && hover !== 'none' && !disabled) {
      const cls = prefixClass(hover, ctx).split(' '), stay = +(attrs['hover-stay-time'] || 70), stop = attrs['hover-stop-propagation'] !== undefined && isTrue(attrs['hover-stop-propagation'] === '' ? true : attrs['hover-stop-propagation']);
      const prevDown = props.onPointerDown, prevUp = props.onPointerUp;
      props.onPointerDown = e => { if (stop) e.__hoverStopped = false; if (!e.__hoverStopped) { const el = e.currentTarget; clearTimeout(el.__hv); el.classList.add(...cls); if (stop) e.__hoverStopped = true; } prevDown && prevDown(e); };
      const off = e => { const el = e.currentTarget; clearTimeout(el.__hv); el.__hv = setTimeout(() => el.classList.remove(...cls), stay); };
      props.onPointerUp = e => { off(e); prevUp && prevUp(e); };
      props.onPointerLeave = off; props.onPointerCancel = off;
    }
    const kids = () => renderNodes(node.c, scope, ctx);
    const base = ctx.base;
    switch (name) {
      case 'view': return h('wx-view', props, kids());
      case 'text': return h('wx-text', props, kids());
      case 'image': {
        const mode = attrs.mode || 'scaleToFill', src = ctx.phone.resolveSrc(attrs.src, base);
        props['data-mode'] = mode;
        const fit = { scaleToFill: 'fill', aspectFit: 'contain', aspectFill: 'cover', widthFix: 'fill', heightFix: 'fill' }[mode] || 'none';
        return h('wx-image', props, src ? h('img', { src, draggable: false, style: { objectFit: fit, objectPosition: fit === 'none' ? mode : undefined }, onError: events.error ? e => events.error(e, { errMsg: 'image load failed' }) : undefined, onLoad: events.load ? e => events.load(e, { width: e.target.naturalWidth, height: e.target.naturalHeight }) : undefined }) : null);
      }
      case 'button': {
        for (const k of ['type', 'size']) if (attrs[k]) props[k] = attrs[k];
        if (isTrue(attrs.plain) || attrs.plain === '') props.plain = '';
        if (disabled) props.disabled = '';
        const ot = attrs['open-type'];
        if (ot && !disabled) {
          const tap = props.onClick;
          props.onClick = e => {
            tap && tap(e);
            if (ot === 'getPhoneNumber' && events.getphonenumber) events.getphonenumber(e, { errMsg: 'getPhoneNumber:fail preview', code: '' });
            else if (ot === 'chooseAvatar' && events.chooseavatar) ctx.phone.chooseImages(1).then(r => events.chooseavatar(e, { avatarUrl: r.tempFiles[0].tempFilePath })).catch(() => {});
            else if (ot === 'share') {
              // Preview stand-in for WeChat sharing: hand the page's share link to the other phones.
              const top = ctx.phone.stack[ctx.phone.stack.length - 1], msg = top && top.onShareAppMessage ? (top.onShareAppMessage() || {}) : {};
              if (msg.path) { window.dispatchEvent(new CustomEvent('preview-share', { detail: { from: ctx.phone.id, label: ctx.phone.label, title: msg.title || '', path: msg.path } })); ctx.phone.toast({ title: 'Shared to the Friend phone', icon: 'none' }); }
              else ctx.phone.toast({ title: 'Sharing opens in WeChat only', icon: 'none' });
            }
            else if (ot === 'contact') ctx.phone.toast({ title: 'Customer service opens in WeChat only', icon: 'none' });
            else if (ot === 'openSetting' && events.opensetting) events.opensetting(e, { authSetting: {} });
          };
        }
        return h('wx-button', props, isTrue(attrs.loading) ? [h('span', { class: 'pv-btn-loading' }), ...kids()] : kids());
      }
      case 'input': case 'textarea': return h(WxInput, { props, attrs, events, multi: name === 'textarea' });
      case 'picker': return h(WxPicker, { props, attrs, events, phone: ctx.phone, children: kids() });
      case 'switch': return h(WxSwitch, { props, attrs, events });
      case 'slider': return h('wx-slider', props, h('input', { type: 'range', min: attrs.min ?? 0, max: attrs.max ?? 100, step: attrs.step ?? 1, value: attrs.value ?? 0, disabled, onChange: e => events.change && events.change(e, { value: +e.target.value }), onInput: e => events.changing && events.changing(e, { value: +e.target.value }) }));
      case 'scroll-view': return h(WxScroll, { props, attrs, events, children: kids() });
      case 'video': return h('video', { ...props, src: ctx.phone.resolveSrc(attrs.src, base), poster: attrs.poster ? ctx.phone.resolveSrc(attrs.poster, base) : undefined, controls: attrs.controls === undefined || isTrue(attrs.controls), autoplay: isTrue(attrs.autoplay) || attrs.autoplay === '', loop: isTrue(attrs.loop) || attrs.loop === '', muted: isTrue(attrs.muted) || attrs.muted === '', playsinline: true, style: [rpxStyle(attrs.style), attrs['object-fit'] ? 'object-fit:' + (attrs['object-fit'] === 'fill' ? 'fill' : attrs['object-fit']) : ''].filter(Boolean).join(';'), onEnded: events.ended ? e => events.ended(e, {}) : undefined, onPlay: events.play ? e => events.play(e, {}) : undefined });
      case 'canvas': return h('canvas', props);
      default: return h('wx-' + name, props, kids());
    }
  }

  function renderComponent(path, tag, node, attrs, events, dataset, scope, ctx) {
    const propValues = {};
    for (const [k, v] of Object.entries(attrs)) if (!['class', 'style', 'id', 'hidden', 'slot'].includes(k) && !k.startsWith('data-')) propValues[camel(k)] = v === '' ? true : v;
    const slots = { '': [] };
    for (const child of node.c || []) {
      const slotName = child.a && child.a.slot ? evalv(child.a.slot, scope) : '';
      (slots[slotName] = slots[slotName] || []).push(...renderNodes([child], scope, ctx));
    }
    return h(CompHost, { path, tag, props: propValues, events, dataset, id: attrs.id || '', hostClass: attrs.class ? prefixClass(attrs.class, ctx) : '', hostStyle: attrs.style ? rpxStyle(attrs.style) : '', hidden: isTrue(attrs.hidden) || attrs.hidden === '', slots, ctx });
  }

  class CompHost extends PC {
    constructor(props) { super(props); this.inst = props.ctx.phone.createComponent(this); }
    render() {
      const p = this.props, inst = this.inst, phone = p.ctx.phone, meta = P.components[p.path];
      inst._rendering = true;
      try {
        phone.applyProps(inst, p.props);
        const file = p.path + '.wxml', wx = P.wxml[file];
        const ctx = { phone, owner: inst, page: p.ctx.page, cid: meta.cid, using: { ...P.globalUsing, ...meta.using }, tpls: templatesOf(file), base: wx ? wx.dir : dirname(p.path), slots: p.slots };
        const tagName = p.tag.includes('-') ? p.tag : 'wxc-' + p.tag;
        return h(tagName, { class: p.hostClass || undefined, style: p.hostStyle || undefined, id: p.id || undefined, hidden: p.hidden || undefined, 'data-host': meta.cid, ref: el => { inst._el = el; } }, wx ? renderNodes(wx.c, rootScope(inst.data), ctx) : null);
      } finally { inst._rendering = false; }
    }
    componentDidMount() { const l = this.inst._merged.lifetimes; if (l.ready) try { l.ready.call(this.inst); } catch (e) { console.error(this.inst.is, 'ready', e); } }
    componentWillUnmount() {
      const inst = this.inst, l = inst._merged.lifetimes;
      if (l.detached) try { l.detached.call(inst); } catch (e) { console.error(e); }
      const owner = this.props.ctx.owner; owner._comps && owner._comps.delete(inst);
      if (inst._page) inst._page._comps.delete(inst);
    }
  }

  class WxInput extends PC {
    componentDidMount() { this.sync(true); if (this.focusWanted()) setTimeout(() => this.el && this.el.focus(), 50); }
    componentDidUpdate(prev) { this.sync(false, prev); if (this.focusWanted() && !(prev.attrs.focus !== undefined && isTrue(prev.attrs.focus))) setTimeout(() => this.el && this.el.focus(), 30); }
    focusWanted() { const f = this.props.attrs.focus, a = this.props.attrs['auto-focus']; return (f !== undefined && (f === '' || isTrue(f))) || (a !== undefined && (a === '' || isTrue(a))); }
    sync(initial, prev) {
      const v = this.props.attrs.value, el = this.el; if (!el) return;
      if (initial || !prev || prev.attrs.value !== v) { const s = v == null ? '' : String(v); if (el.value !== s) el.value = s; }
    }
    render() {
      const { props, attrs, events, multi } = this.props;
      const type = attrs.type, max = attrs.maxlength === undefined ? 140 : +attrs.maxlength;
      const emit = (k, e, d) => events[k] ? events[k](e, d) : undefined;
      const el = {
        ...props, ref: el => { this.el = el; props.ref(el); },
        placeholder: attrs.placeholder, disabled: isTrue(attrs.disabled) || attrs.disabled === '',
        maxLength: max >= 0 ? max : undefined,
        onInput: e => { const r = emit('input', e, { value: e.target.value, cursor: e.target.selectionStart, keyCode: 0 }); if (typeof r === 'string' || typeof r === 'number') e.target.value = String(r); else if (r && typeof r === 'object' && 'value' in r) e.target.value = String(r.value); },
        onFocus: e => emit('focus', e, { value: e.target.value, height: 0 }),
        onBlur: e => emit('blur', e, { value: e.target.value, cursor: e.target.selectionStart }),
        onKeyDown: e => { if (e.key === 'Enter' && (!multi || attrs['confirm-type'] === 'send' || attrs['confirm-type'] === 'done')) { if (multi) e.preventDefault(); emit('confirm', e, { value: e.target.value }); if (!multi && attrs['confirm-hold'] === undefined) e.target.blur(); } },
        onChange: undefined
      };
      if (attrs['placeholder-style']) el['data-ph'] = '';
      if (!multi) { el.type = isTrue(attrs.password) || attrs.password === '' || type === 'safe-password' ? 'password' : 'text'; if (type === 'number' || type === 'digit' || type === 'idcard') el.inputMode = type === 'digit' ? 'decimal' : type === 'number' ? 'numeric' : 'text'; }
      if (multi && (isTrue(attrs['auto-height']) || attrs['auto-height'] === '')) el.class = (el.class || '') + ' pv-autoheight';
      return h(multi ? 'textarea' : 'input', el);
    }
  }
  class WxPicker extends PC {
    async open(e) {
      const { attrs, events, phone } = this.props;
      if (isTrue(attrs.disabled) || attrs.disabled === '') return;
      const mode = attrs.mode || 'selector';
      if (mode === 'date' || mode === 'time') {
        const pad = n => String(n).padStart(2, '0');
        let v;
        if (mode === 'date') {
          // Like WeChat: month | day | year wheels.
          const now = new Date(), cur = String(attrs.value || '').split('-').map(Number), y0 = Number(String(attrs.start || '').slice(0, 4)) || now.getFullYear();
          const months = ['January','February','March','April','May','June','July','August','September','October','November','December'], days = Array.from({ length: 31 }, (_, i) => String(i + 1)), years = Array.from({ length: 6 }, (_, i) => String(y0 + i));
          const pick = await phone.multiPicker([months, days, years], [(cur[1] || now.getMonth() + 1) - 1, (cur[2] || now.getDate()) - 1, Math.max(0, (cur[0] || y0) - y0)]);
          if (pick) { const y = y0 + pick[2], m = pick[0] + 1, last = new Date(y, m, 0).getDate(); v = y + '-' + pad(m) + '-' + pad(Math.min(pick[1] + 1, last)); if (attrs.start && v < attrs.start) v = attrs.start; }
        } else {
          // Like WeChat: hour | minute | AM/PM wheels.
          const t = String(attrs.value || '12:00').split(':').map(Number), h = t[0] || 0, hours = Array.from({ length: 12 }, (_, i) => String(i + 1)), minutes = Array.from({ length: 60 }, (_, i) => pad(i));
          const pick = await phone.multiPicker([hours, minutes, ['AM', 'PM']], [((h % 12) || 12) - 1, t[1] || 0, h >= 12 ? 1 : 0]);
          if (pick) { const hh = (pick[0] + 1) % 12 + (pick[2] ? 12 : 0); v = pad(hh) + ':' + pad(pick[1]); }
        }
        if (v == null) { events.cancel && events.cancel(e, {}); return; }
        events.change && events.change(e, { value: v });
        return;
      }
      if (mode === 'multiSelector') {
        const cols = (Array.isArray(attrs.range) ? attrs.range : []).map(c => (Array.isArray(c) ? c : []).map(x => attrs['range-key'] && x && typeof x === 'object' ? x[attrs['range-key']] : x).map(str));
        const v = await phone.multiPicker(cols, Array.isArray(attrs.value) ? attrs.value : []);
        if (!v) { events.cancel && events.cancel(e, {}); return; }
        events.change && events.change(e, { value: v });
        return;
      }
      const range = Array.isArray(attrs.range) ? attrs.range : [];
      const labels = range.map(x => attrs['range-key'] && x && typeof x === 'object' ? x[attrs['range-key']] : x).map(str);
      const i = await phone.picker(labels, +attrs.value || 0);
      if (i < 0) { events.cancel && events.cancel(e, {}); return; }
      events.change && events.change(e, { value: i });
    }
    render() { const p = this.props.props; return h('wx-picker', { ...p, onClick: e => { p.onClick && p.onClick(e); this.open(e); } }, this.props.children); }
  }
  class WxSwitch extends PC {
    constructor(p) { super(p); this.state = { on: isTrue(p.attrs.checked) || p.attrs.checked === '' }; this.last = p.attrs.checked; }
    render() {
      const { props, attrs, events } = this.props;
      if (attrs.checked !== this.last) { this.last = attrs.checked; this.state.on = isTrue(attrs.checked) || attrs.checked === ''; }
      const on = this.state.on, color = attrs.color || '#07c160';
      return h('wx-switch', { ...props, onClick: e => { if (isTrue(attrs.disabled)) return; const v = !this.state.on; this.setState({ on: v }); events.change && events.change(e, { value: v }); props.onClick && props.onClick(e); } },
        attrs.type === 'checkbox' ? h('span', { class: 'pv-check' + (on ? ' on' : ''), style: on ? { background: color, borderColor: color } : null }) : h('span', { class: 'pv-switch' + (on ? ' on' : ''), style: on ? { background: color, borderColor: color } : null }));
    }
  }
  class WxScroll extends PC {
    componentDidMount() { this.apply({ attrs: {} }); }
    componentDidUpdate(prev) { this.apply(prev); }
    apply(prev) {
      const a = this.props.attrs, el = this.el; if (!el) return;
      const smooth = isTrue(a['scroll-with-animation']) || a['scroll-with-animation'] === '' ? 'smooth' : 'auto';
      if (a['scroll-into-view'] && a['scroll-into-view'] !== prev.attrs['scroll-into-view']) {
        const t = el.querySelector('#' + CSS.escape(a['scroll-into-view']));
        if (t) { const r = t.getBoundingClientRect(), pr = el.getBoundingClientRect(); el.scrollBy({ left: (r.left - pr.left) / (this.k() || 1), top: (r.top - pr.top) / (this.k() || 1), behavior: smooth }); }
      }
      if (a['scroll-top'] !== undefined && a['scroll-top'] !== prev.attrs['scroll-top']) el.scrollTo({ top: +rpxStyle(String(a['scroll-top'])).replace('px', '') || 0, behavior: smooth });
      if (a['scroll-left'] !== undefined && a['scroll-left'] !== prev.attrs['scroll-left']) el.scrollTo({ left: +a['scroll-left'] || 0, behavior: smooth });
    }
    k() { return 1; }
    render() {
      const { props, attrs, events } = this.props;
      const x = attrs['scroll-x'] !== undefined && (attrs['scroll-x'] === '' || isTrue(attrs['scroll-x'])), y = attrs['scroll-y'] !== undefined && (attrs['scroll-y'] === '' || isTrue(attrs['scroll-y']));
      let lowerFired = false;
      return h('wx-scroll-view', { ...props, 'data-x': x ? '' : undefined, 'data-y': y ? '' : undefined, ref: el => { this.el = el; props.ref(el); }, onScroll: e => {
        const el = e.currentTarget;
        events.scroll && events.scroll(e, { scrollTop: el.scrollTop, scrollLeft: el.scrollLeft, scrollHeight: el.scrollHeight, scrollWidth: el.scrollWidth, deltaX: 0, deltaY: 0 });
        const near = y ? el.scrollHeight - el.scrollTop - el.clientHeight < (+attrs['lower-threshold'] || 50) : el.scrollWidth - el.scrollLeft - el.clientWidth < (+attrs['lower-threshold'] || 50);
        if (near && !lowerFired && events.scrolltolower) { lowerFired = true; events.scrolltolower(e, {}); } else if (!near) lowerFired = false;
      } }, this.props.children);
    }
  }

  // ------------------------------------------------------------ pages + phone chrome
  class PageView extends PC {
    constructor(p) { super(p); p.page._host = this; }
    componentDidMount() { const page = this.props.page; page._rendered = true; this.props.phone.call(page, 'onReady'); }
    componentWillUnmount() { this.props.page._host = null; }
    render() {
      const { page, phone, active } = this.props, info = P.pages[page.route], file = page.route + '.wxml', wx = P.wxml[file];
      const ctx = { phone, owner: page, page, cid: '', using: { ...P.globalUsing, ...info.using }, tpls: templatesOf(file), base: wx.dir };
      const top = page._nav.custom ? 0 : STATUS + NAV;
      let lastBottom = 0;
      return h('div', { class: 'pv-page-layer', style: { top: top + 'px', display: active ? 'block' : 'none', '--vh': ((H - top) / 100) + 'px', '--vw': (W / 100) + 'px' }, ref: el => { page._layer = el; } },
        h('div', { class: 'pv-scroller', ref: el => { page._scroller = el; }, onScroll: e => {
          const el = e.currentTarget; phone.call(page, 'onPageScroll', { scrollTop: el.scrollTop });
          const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
          if (atBottom && !lastBottom) phone.call(page, 'onReachBottom'); lastBottom = atBottom;
        } }, h('div', { class: 'wx-page', 'data-page': page.route, ref: el => { page._rootEl = el; } }, renderNodes(wx.c, rootScope(page.data), ctx))));
    }
  }
  class Screen extends PC {
    constructor(p) { super(p); p.phone.screen = this; }
    render() {
      const phone = this.props.phone, page = phone.page(), nav = page ? page._nav : { title: '', bg: '#fff', front: '#000', custom: false };
      const now = new Date(), time = now.getHours() + ':' + String(now.getMinutes()).padStart(2, '0');
      const home = P.app.entryPagePath || P.app.pages[0];
      const left = phone.stack.length > 1 ? h('div', { class: 'pv-nav-back', onClick: () => phone.open('navigateBack', null, 1) }, h('svg', { viewBox: '0 0 12 24', width: 12, height: 24 }, h('path', { d: 'M10 3 2 12l8 9', fill: 'none', stroke: nav.front, 'stroke-width': 2.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })))
        : page && page.route !== home ? h('div', { class: 'pv-nav-home', onClick: () => phone.open('reLaunch', '/' + home) }, h('svg', { viewBox: '0 0 24 24', width: 20, height: 20 }, h('path', { d: 'M3 11.5 12 4l9 7.5M5.5 9.5V20h4.5v-6h4v6h4.5V9.5', fill: 'none', stroke: '#000', 'stroke-width': 1.8, 'stroke-linejoin': 'round' }))) : null;
      return h(Fragment, null,
        h('div', { class: 'pv-status', style: { color: nav.custom ? '#000' : nav.front, background: nav.custom ? 'transparent' : nav.bg } }, h('span', null, time), h('span', { class: 'pv-status-icons' }, '●●●  ▭')),
        nav.custom ? null : h('div', { class: 'pv-nav', style: { background: nav.bg, color: nav.front } }, left, h('div', { class: 'pv-nav-title' }, nav.title)),
        h('div', { class: 'pv-capsule' + (nav.front === '#ffffff' && !nav.custom ? ' dark' : '') }, h('span', { class: 'pv-dots' }, '•••'), h('span', { class: 'pv-cap-line' }), h('span', { class: 'pv-cap-circle' })),
        phone.stack.map(p => h(PageView, { key: p._id, page: p, phone, active: p === page })),
        h('div', { class: 'pv-home-indicator' }));
    }
  }

  window.PreviewRuntime = { Phone };
})();
