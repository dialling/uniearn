const config = require('./xp-config');
const KEY = 'xp_auth_v1';
let session, loggingIn = null;

function load() {
  if (session === undefined) { try { session = wx.getStorageSync(KEY) || null; } catch (_) { session = null; } }
  return session;
}
function save(value) {
  session = value || null;
  try { if (session) wx.setStorageSync(KEY, session); else wx.removeStorageSync(KEY); } catch (_) {}
}
function failure(code, message, status) {
  const error = Error(message || code || 'Request failed');
  error.code = code || 'ERROR'; error.status = status || 0; error.business = true;
  return error;
}
function network(err) {
  const error = Error('Network error' + (err && err.errMsg ? ': ' + err.errMsg : ''));
  error.code = 'NETWORK';
  return error;
}
function raw(method, path, data, token, options = {}) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: config.baseUrl() + path, method, data,
      ...(options.timeout ? {timeout: options.timeout} : {}),
      header: {'Content-Type': 'application/json', ...(token ? {Authorization: 'Bearer ' + token} : {})},
      success(res) {
        const d = res.data && typeof res.data === 'object' ? res.data : {};
        if (res.statusCode === 401) return reject(failure('UNAUTHORIZED', d.message, 401));
        if (d.ok === false || res.statusCode >= 400) {
          const error = failure(d.error, d.message || 'HTTP ' + res.statusCode, res.statusCode);
          if (typeof d.english === 'string') error.english = d.english;
          return reject(error);
        }
        resolve(d);
      },
      fail: err => reject(network(err))
    });
  });
}
function wxCode() {
  return new Promise((resolve, reject) => wx.login({
    success: r => r.code ? resolve(r.code) : reject(failure('WXLOGIN', 'WeChat login failed')),
    fail: e => reject(failure('WXLOGIN', 'WeChat login failed' + (e && e.errMsg ? ': ' + e.errMsg : '')))
  }));
}
function login() {
  if (loggingIn) return loggingIn;
  loggingIn = (async () => {
    const d = await raw('POST', '/api/auth/login', {code: await wxCode()});
    if (!d.token) throw failure('LOGIN', 'Login failed');
    save({token: d.token, user: d.user || null, at: Date.now()});
    return session;
  })();
  const done = () => { loggingIn = null; };
  loggingIn.then(done, done);
  return loggingIn;
}
// Read-only routes the server answers without an account, so the preview mode can show the job board.
const PUBLIC_GET = [/^\/api\/orders(\?|$)/, /^\/api\/orders\/progress(\?|$)/, /^\/api\/orders\/\d+(\?|$)/, /^\/api\/trips(\?|$)/,
  /^\/api\/loyalty\/rules$/, /^\/api\/reports\/reasons$/, /^\/api\/cs\/info$/];
// No account yet (preview mode): only an explicit sign-in creates one. Actions ask the person to sign in.
function guest(ask) {
  const g = require('./guest');
  if (ask) g.prompt();
  return g.error();
}
async function token(ask) {
  const s = load();
  if (s && s.token) return s.token;
  throw guest(ask);
}
// One silent re-login on 401 for someone who has signed in before: XP tokens last 7 days and wx.login needs no user tap.
async function request(method, path, data, options) {
  const s = load();
  if (!(s && s.token) && method === 'GET' && PUBLIC_GET.some(re => re.test(path))) return raw(method, path, data, '', options);
  const tok = await token(method !== 'GET');
  try { return await raw(method, path, data, tok, options); }
  catch (e) {
    if (e.status !== 401 || options && options.noRelogin) throw e;
    return raw(method, path, data, (await login()).token, options);
  }
}
function rawUpload(path, filePath, name, tok) {
  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url: config.baseUrl() + path, filePath, name: name || 'file',
      header: tok ? {Authorization: 'Bearer ' + tok} : {},
      success(res) {
        let d = {};
        try { d = JSON.parse(res.data || '{}'); } catch (_) {}
        if (res.statusCode === 401) return reject(failure('UNAUTHORIZED', d.message, 401));
        if (res.statusCode === 413) return reject(failure('TOO_LARGE', 'Photo too large', 413));
        if (d.ok === false || res.statusCode >= 400) return reject(failure(d.error || 'UPLOAD_FAILED', d.message || 'HTTP ' + res.statusCode, res.statusCode));
        resolve(d);
      },
      fail: err => reject(network(err))
    });
  });
}
async function upload(path, filePath, name) {
  const tok = await token(true);
  try { return await rawUpload(path, filePath, name, tok); }
  catch (e) {
    if (e.status !== 401) throw e;
    return rawUpload(path, filePath, name, (await login()).token);
  }
}

module.exports = {
  request, upload, login, requestWithToken: raw,
  get: path => request('GET', path),
  post: (path, data, options) => request('POST', path, data || {}, options),
  logout: () => save(null),
  signedIn: () => !!(load() && load().token),
  user: () => (load() || {}).user || null,
  setUser(user) { const s = load(); if (s) save({...s, user}); },
  absolute: url => !url ? '' : /^https?:\/\//.test(url) ? url : config.baseUrl() + url
};
