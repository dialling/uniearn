'use strict';
// In-browser stand-in for WeChat CloudBase: a small document database, file storage and the
// real cloud function code from cloudfunctions/, all saved to localStorage.
(function () {
  const P = window.PREVIEW;
  const clone = v => v === undefined ? undefined : JSON.parse(JSON.stringify(v));
  const STORE = 'uniearn-preview:cloud';

  // ------------------------------------------------------------ CommonJS loader
  function dirname(p) { const i = p.lastIndexOf('/'); return i < 0 ? '' : p.slice(0, i); }
  function normalize(p) {
    const outParts = [];
    for (const part of p.split('/')) { if (!part || part === '.') continue; if (part === '..') outParts.pop(); else outParts.push(part); }
    return outParts.join('/');
  }
  function createLoader(globals, builtins, onLoad) {
    const cache = {};
    function resolve(from, req) {
      const base = req.startsWith('/') ? normalize(req) : normalize(dirname(from) + '/' + req);
      for (const c of [base, base + '.js', base + '.json', base + '/index.js']) if (P.modules[c] || c in P.json) return c;
      return null;
    }
    function load(key) {
      if (cache[key]) return cache[key].exports;
      if (key in P.json) { cache[key] = { exports: clone(P.json[key]) }; return cache[key].exports; }
      const module = { exports: {}, id: key };
      cache[key] = module;
      const req = r => {
        if (builtins && Object.prototype.hasOwnProperty.call(builtins, r)) return builtins[r];
        const k = resolve(key, r);
        if (!k) { const e = Error("Cannot find module '" + r + "' from " + key); e.code = 'MODULE_NOT_FOUND'; throw e; }
        return load(k);
      };
      onLoad && onLoad(key, true);
      try { P.modules[key].call(module.exports, req, module, module.exports, globals); }
      catch (e) { delete cache[key]; throw e; }
      finally { onLoad && onLoad(key, false); }
      return module.exports;
    }
    return { load, resolve, has: k => !!P.modules[k] };
  }

  // ------------------------------------------------------------ Buffer + crypto
  const enc = new TextEncoder(), dec = new TextDecoder();
  class Buf extends Uint8Array {
    static from(x, encoding) {
      if (typeof x === 'string') {
        if (encoding === 'hex') return new Buf((x.match(/../g) || []).map(h => parseInt(h, 16)));
        if (encoding === 'base64' || encoding === 'base64url') { const s = atob(x.replace(/-/g, '+').replace(/_/g, '/')); return new Buf([...s].map(c => c.charCodeAt(0))); }
        return new Buf(enc.encode(x));
      }
      return new Buf(x);
    }
    static byteLength(s) { return typeof s === 'string' ? enc.encode(s).length : s.length; }
    static isBuffer(x) { return x instanceof Buf; }
    static alloc(n) { return new Buf(n); }
    static concat(list) { const all = new Buf(list.reduce((n, b) => n + b.length, 0)); let o = 0; for (const b of list) { all.set(b, o); o += b.length; } return all; }
    toString(encoding) {
      if (encoding === 'hex') return [...this].map(b => b.toString(16).padStart(2, '0')).join('');
      if (encoding === 'base64' || encoding === 'base64url') {
        let s = ''; for (const b of this) s += String.fromCharCode(b);
        const b64 = btoa(s);
        return encoding === 'base64' ? b64 : b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      }
      return dec.decode(this);
    }
    equals(o) { return this.length === o.length && this.every((b, i) => b === o[i]); }
  }
  const K = new Uint32Array([0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2]);
  function sha256(bytes) {
    const l = bytes.length, withPad = new Uint8Array(((l + 9 + 63) >> 6) << 6);
    withPad.set(bytes); withPad[l] = 0x80;
    const view = new DataView(withPad.buffer);
    view.setUint32(withPad.length - 4, l * 8); view.setUint32(withPad.length - 8, Math.floor(l / 0x20000000));
    const H = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]), W = new Uint32Array(64);
    const r = (x, n) => (x >>> n) | (x << (32 - n));
    for (let o = 0; o < withPad.length; o += 64) {
      for (let t = 0; t < 16; t++) W[t] = view.getUint32(o + t * 4);
      for (let t = 16; t < 64; t++) W[t] = (r(W[t - 15], 7) ^ r(W[t - 15], 18) ^ (W[t - 15] >>> 3)) + W[t - 16] + (r(W[t - 2], 17) ^ r(W[t - 2], 19) ^ (W[t - 2] >>> 10)) + W[t - 7];
      let [a, b, c, d, e, f, g, h] = H;
      for (let t = 0; t < 64; t++) {
        const t1 = (h + (r(e, 6) ^ r(e, 11) ^ r(e, 25)) + ((e & f) ^ (~e & g)) + K[t] + W[t]) >>> 0;
        const t2 = ((r(a, 2) ^ r(a, 13) ^ r(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
        h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
      }
      H[0] += a; H[1] += b; H[2] += c; H[3] += d; H[4] += e; H[5] += f; H[6] += g; H[7] += h;
    }
    const outBytes = new Buf(32), ov = new DataView(outBytes.buffer);
    H.forEach((v, i) => ov.setUint32(i * 4, v));
    return outBytes;
  }
  const toBytes = (d, encoding) => typeof d === 'string' ? Buf.from(d, encoding) : new Uint8Array(d.buffer ? d : enc.encode(String(d)));
  function hasher(fn) {
    const parts = [];
    return { update(d, encoding) { parts.push(toBytes(d, encoding)); return this; }, digest(encoding) { const b = fn(Buf.concat(parts)); return encoding ? b.toString(encoding) : b; } };
  }
  function hmac(key, msg) {
    let k = toBytes(key); if (k.length > 64) k = sha256(k);
    const pad = new Uint8Array(64); pad.set(k);
    const ipad = pad.map(b => b ^ 0x36), opad = pad.map(b => b ^ 0x5c);
    return sha256(Buf.concat([opad, sha256(Buf.concat([ipad, msg]))]));
  }
  const random = n => { const b = new Buf(n); crypto.getRandomValues(b); return b; };
  const cryptoModule = {
    createHash: () => hasher(sha256),
    createHmac: (alg, key) => hasher(m => hmac(key, m)),
    randomBytes: n => random(n),
    randomInt: (a, b) => { if (b === undefined) { b = a; a = 0; } return a + Math.floor(Math.random() * (b - a)); },
    randomUUID: () => crypto.randomUUID ? crypto.randomUUID() : random(16).toString('hex'),
    timingSafeEqual: (a, b) => { if (a.length !== b.length) throw RangeError('Input buffers must have the same byte length'); let d = 0; for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i]; return d === 0; }
  };

  // ------------------------------------------------------------ document database
  const CMD = Symbol('command');
  const command = {};
  for (const op of ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'nin', 'exists', 'set', 'inc', 'mul', 'remove', 'push', 'pull', 'unshift', 'and', 'or'])
    command[op] = (...args) => ({ [CMD]: op, args });
  const isCmd = v => v && typeof v === 'object' && v[CMD];
  const plain = v => v && typeof v === 'object' && !Array.isArray(v) && !isCmd(v);
  const getPath = (o, p) => p.split('.').reduce((x, k) => x == null ? undefined : x[k], o);
  function setPath(o, p, v) { const keys = p.split('.'); let x = o; keys.slice(0, -1).forEach(k => { if (!plain(x[k]) && !Array.isArray(x[k])) x[k] = {}; x = x[k]; }); x[keys[keys.length - 1]] = v; }
  function delPath(o, p) { const keys = p.split('.'), x = getPath(o, keys.slice(0, -1).join('.')) ?? (keys.length === 1 ? o : null); if (x) delete x[keys[keys.length - 1]]; }
  function matchValue(actual, cond) {
    if (isCmd(cond)) {
      const [x] = cond.args;
      switch (cond[CMD]) {
        case 'eq': return JSON.stringify(actual) === JSON.stringify(x);
        case 'neq': return JSON.stringify(actual) !== JSON.stringify(x);
        case 'gt': return actual > x; case 'gte': return actual >= x; case 'lt': return actual < x; case 'lte': return actual <= x;
        case 'in': return x.some(v => JSON.stringify(v) === JSON.stringify(actual));
        case 'nin': return !x.some(v => JSON.stringify(v) === JSON.stringify(actual));
        case 'exists': return (actual !== undefined) === !!x;
        case 'and': return cond.args.flat().every(c => matchValue(actual, c));
        case 'or': return cond.args.flat().some(c => matchValue(actual, c));
      }
      return false;
    }
    if (Array.isArray(actual) && !Array.isArray(cond)) return actual.some(v => JSON.stringify(v) === JSON.stringify(cond));
    return JSON.stringify(actual) === JSON.stringify(cond);
  }
  function matches(doc, query, prefix = '') {
    return Object.entries(query || {}).every(([k, cond]) => {
      const p = prefix ? prefix + '.' + k : k;
      if (plain(cond)) return matches(doc, cond, p);
      return matchValue(getPath(doc, p), cond);
    });
  }
  function applyUpdate(doc, data, prefix = '') {
    for (const [k, v] of Object.entries(data || {})) {
      const p = prefix ? prefix + '.' + k : k;
      if (isCmd(v)) {
        const [x] = v.args, cur = getPath(doc, p);
        switch (v[CMD]) {
          case 'set': setPath(doc, p, clone(x)); break;
          case 'inc': setPath(doc, p, (cur || 0) + x); break;
          case 'mul': setPath(doc, p, (cur || 0) * x); break;
          case 'remove': delPath(doc, p); break;
          case 'push': setPath(doc, p, (cur || []).concat(clone(Array.isArray(x) ? x : (x && x.each) || [x]))); break;
          case 'unshift': setPath(doc, p, clone(Array.isArray(x) ? x : [x]).concat(cur || [])); break;
          case 'pull': setPath(doc, p, (cur || []).filter(item => !matchValue(item, x))); break;
        }
      } else if (plain(v) && Object.keys(v).length) applyUpdate(doc, v, p);
      else setPath(doc, p, clone(v));
    }
  }
  const notFound = (name, id) => { const e = Error('document.get:fail document with _id ' + id + ' does not exist'); e.errCode = -502005; return e; };

  function createDatabase(state) {
    const col = name => (state.collections[name] = state.collections[name] || {});
    const strip = d => { const c = clone(d); return c; };
    function docRef(name, id) {
      return {
        async get() { const d = col(name)[id]; if (!d) throw notFound(name, id); return { data: strip(d), errMsg: 'document.get:ok' }; },
        async set({ data }) { const d = clone(data); delete d._id; col(name)[id] = { ...d, _id: id }; return { _id: id, stats: { updated: 1, created: 1 } }; },
        async update({ data }) { const d = col(name)[id]; if (!d) return { stats: { updated: 0 } }; applyUpdate(d, data); return { stats: { updated: 1 } }; },
        async remove() { const had = !!col(name)[id]; delete col(name)[id]; return { stats: { removed: had ? 1 : 0 } }; }
      };
    }
    function query(name, where = null, opts = {}) {
      const rows = () => {
        let list = Object.values(col(name)).filter(d => !where || matches(d, where));
        for (const [field, dir] of (opts.order || []).slice().reverse()) list.sort((a, b) => { const x = getPath(a, field), y = getPath(b, field); return (x > y ? 1 : x < y ? -1 : 0) * (dir === 'desc' ? -1 : 1); });
        return list.slice(opts.skip || 0, (opts.skip || 0) + (opts.limit || 100));
      };
      const next = extra => query(name, where, { ...opts, ...extra });
      return {
        where: q => query(name, q, opts),
        orderBy: (field, dir) => next({ order: [...(opts.order || []), [field, dir]] }),
        limit: n => next({ limit: n }), skip: n => next({ skip: n }), field: () => next({}),
        async get() { return { data: rows().map(strip), errMsg: 'collection.get:ok' }; },
        async count() { return { total: Object.values(col(name)).filter(d => !where || matches(d, where)).length }; },
        async update({ data }) { const list = Object.values(col(name)).filter(d => !where || matches(d, where)); list.forEach(d => applyUpdate(d, data)); return { stats: { updated: list.length } }; },
        async remove() { const list = Object.entries(col(name)).filter(([, d]) => !where || matches(d, where)); list.forEach(([id]) => delete col(name)[id]); return { stats: { removed: list.length } }; }
      };
    }
    const collection = name => ({ ...query(name), doc: id => docRef(name, String(id)), async add({ data }) { const id = random(12).toString('hex'); col(name)[id] = { ...clone(data), _id: id }; return { _id: id }; } });
    return {
      command, collection,
      serverDate: () => new Date(),
      RegExp: o => new RegExp(o.regexp || o, o.options || ''),
      async runTransaction(fn) {
        const snapshot = JSON.stringify(state.collections);
        const tx = { collection: name => ({ doc: id => docRef(name, String(id)) }), async rollback(reason) { throw { __rollback: true, reason }; } };
        try { return await fn(tx); }
        catch (e) { state.collections = JSON.parse(snapshot); if (e && e.__rollback) throw e.reason; throw e; }
      },
      async startTransaction() {
        const snapshot = JSON.stringify(state.collections);
        return { collection: name => ({ doc: id => docRef(name, String(id)) }), async commit() {}, async rollback() { state.collections = JSON.parse(snapshot); } };
      }
    };
  }

  // ------------------------------------------------------------ host
  class CloudHost {
    constructor() {
      this.state = this.restore() || { collections: {}, files: {}, seeded: false };
      this.queue = Promise.resolve();
      this.openid = '';
      this.listeners = new Set();
      const host = this;
      const db = createDatabase(this.state);
      this.db = () => db;
      const openapi = new Proxy({}, { get: () => new Proxy({}, { get: () => async () => { throw Error('WeChat open APIs are not available in the preview.'); } }) });
      const sdk = {
        DYNAMIC_CURRENT_ENV: 'preview-env', init() {},
        getWXContext: () => ({ OPENID: host.openid, APPID: 'wxf6d43df037493a8c', ENV: 'preview-env', UNIONID: '' }),
        database: () => host.db(),
        async getTempFileURL({ fileList }) { return { fileList: fileList.map(x => { const id = typeof x === 'string' ? x : x.fileID; return { fileID: id, tempFileURL: host.state.files[id] || '', status: host.state.files[id] ? 0 : -1 }; }) }; },
        async deleteFile({ fileList }) { return { fileList: fileList.map(id => { delete host.state.files[id]; return { fileID: id, status: 0 }; }) }; },
        async uploadFile({ cloudPath, fileContent }) { const id = 'cloud://preview-env/' + cloudPath; host.state.files[id] = String(fileContent || ''); return { fileID: id }; },
        async downloadFile() { return { fileContent: Buf.from('') }; },
        async callFunction({ name, data }) { return { result: await host.invoke(name, data) }; },
        openapi
      };
      const unavailable = name => new Proxy({}, { get: (t, k) => k === '__esModule' ? false : () => { throw Error(name + ' is not available in the preview.'); } });
      const builtins = {
        'wx-server-sdk': sdk, crypto: cryptoModule, buffer: { Buffer: Buf },
        util: { promisify: fn => (...a) => new Promise((res, rej) => fn(...a, (e, v) => e ? rej(e) : res(v))), inspect: x => JSON.stringify(x), format: (...a) => a.join(' '), TextEncoder, TextDecoder, types: {} },
        nodemailer: { createTransport: () => ({ sendMail: async () => { throw Error('Email sending is turned off in the preview.'); }, verify: async () => true }) },
        https: unavailable('https'), http: unavailable('http'), fs: unavailable('fs'), path: { join: (...a) => a.join('/'), basename: p => p.split('/').pop() }
      };
      const g = Object.create(null);
      g.process = { env: { REVIEWER_OPENIDS: 'preview-reviewer' }, version: 'v18.0.0', nextTick: f => Promise.resolve().then(f) };
      g.Buffer = Buf;
      g.global = globalThis;
      this.loader = createLoader(g, builtins);
    }
    restore() { try { const raw = localStorage.getItem(STORE); return raw ? JSON.parse(raw) : null; } catch (_) { return null; } }
    persist() {
      try { localStorage.setItem(STORE, JSON.stringify(this.state)); }
      catch (_) { // Photos are the large part; drop the oldest ones before giving up.
        const ids = Object.keys(this.state.files);
        if (ids.length) { delete this.state.files[ids[0]]; this.persist(); }
      }
      for (const fn of this.listeners) try { fn(); } catch (_) {}
    }
    reset() { try { Object.keys(localStorage).filter(k => k.startsWith('uniearn-preview:')).forEach(k => localStorage.removeItem(k)); } catch (_) {} }
    async invoke(name, data) {
      const key = 'cloudfunctions/' + name + '/index.js';
      if (!this.loader.has(key)) { const e = Error('cloud.callFunction:fail -501000 FunctionName parameter could not be found (' + name + ' runs only in WeChat).'); e.errCode = -501000; throw e; }
      const fn = this.loader.load(key);
      return fn.main(clone(data) || {}, { function_name: name });
    }
    call(openid, name, data) {
      const run = async () => {
        this.openid = openid;
        try {
          const result = clone(await this.invoke(name, data));
          await this.afterCall(openid, name, data || {}, result);
          return result;
        } finally { this.persist(); }
      };
      const p = this.queue.then(run, run);
      this.queue = p.catch(() => {});
      return p;
    }
    // The preview has no staff reviewing runner applications, so approve them straight away.
    async afterCall(openid, name, data, result) {
      if (name === 'studentAccount' && data.action === 'apply' && result && result.ok && result.account && result.account.verification && result.account.verification.status === 'pending') {
        this.openid = 'preview-reviewer';
        const accountId = cryptoModule.createHash('sha256').update(openid).digest('hex');
        await this.invoke('studentAccount', { action: 'review', accountId, decision: 'approve', note: 'Approved automatically in the preview' });
        this.openid = openid;
      }
    }
    saveFile(cloudPath, dataUrl) { const id = 'cloud://preview-env/' + cloudPath; this.state.files[id] = dataUrl; this.persist(); return id; }
    file(id) { return this.state.files[id] || ''; }
    async seed(steps) {
      if (this.state.seeded) return;
      const now = Date.now();
      this.state.collections.uniearn_order_state = { 'team-test': { _id: 'team-test', nextId: 1, requests: [], trips: [], members: {}, receipts: {}, revision: 0, loyaltyStartedAt: now } };
      this.state.seeded = true;
      try { await steps(this); } catch (e) { console.warn('Preview demo data was only partly created', e); }
      this.persist();
    }
  }

  window.PreviewCloud = { CloudHost, createLoader, normalize, dirname, Buf, cryptoModule };
})();
