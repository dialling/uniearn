const { config, getToken, clearAuth } = require('./util');

// 网络失败的 GET 自动重试一次。
// 校园网抖动，或运维正好在 pm2 reload（服务端会关掉 keep-alive 连接，客户端复用旧连接会拿到
// ECONNRESET）都会让某次请求莫名失败，用户看到的就是「加载失败」。
// 只重试 GET：POST/PUT/DELETE 自动重试可能造成重复下单、重复发消息，绝不重试。
const GET_RETRY_DELAY_MS = 400;

// 上传体积上限（字节）：超过就再压一道。服务器出口约 1Mbps，3MB 要传 24 秒以上，
// 再大就容易被微信 uploadFile 超时打断（用户只看到「上传失败」）。
const HUGE_UPLOAD_BYTES = 3 * 1024 * 1024;

// 401 时静默换一次新 token（wx.login 是免费的，不需要用户点任何东西），
// 再重放原请求；只有刷新也失败才把用户置为访客。
let refreshing = null;
function refreshToken() {
  if (refreshing) return refreshing;
  refreshing = new Promise((resolve, reject) => {
    wx.login({
      success(login) {
        if (!login || !login.code) return reject(Error('NO_CODE'));
        wx.request({
          url: config.baseUrl + '/api/auth/login',
          method: 'POST',
          data: { code: login.code },
          header: { 'Content-Type': 'application/json' },
          success(res) {
            const d = res.data || {};
            if (d.ok && d.token) { require('./util').setToken(d.token); resolve(d.token); }
            else reject(Error(d.message || 'RELOGIN_FAILED'));
          },
          fail: reject,
        });
      },
      fail: reject,
    });
  }).finally(() => { refreshing = null; });
  return refreshing;
}

function request(method, path, data = {}, attempt = 1) {
  const token = getToken();
  return new Promise((resolve, reject) => {
    wx.request({
      url: config.baseUrl + path,
      method,
      data,
      header: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
      },
      success(res) {
        const d = res.data || {};
        if (res.statusCode === 401) {
          // 先尝试静默续期：token 过期/清缓存都能自己恢复，用户无感
          // 2026-11-26: /api/auth/me also renews quietly. It used to be excluded with every /api/auth/ path, so an
          // expired token made the account check fail first: Start a trip treated the user as signed out (welcome
          // page -> straight back to Jobs) and the token was cleared, emptying My orders → I'm running.
          // Only the sign-in calls themselves stay excluded.
          if (attempt === 1 && !/^\/api\/auth\/(login|admin-login)\b/.test(path)) {
            refreshToken()
              .then(() => request(method, path, { ...data }, 2))
              .then(resolve, () => {
                clearAuth();
                const app = getApp();
                if (app && app.globalData) app.globalData.guest = true;
                reject({ code: 'UNAUTHORIZED', message: '登录已失效，请先登录' });
              });
            return;
          }
          clearAuth();
          const app = getApp();
          if (app && app.globalData) app.globalData.guest = true;
          reject({ code: 'UNAUTHORIZED', message: '登录已失效，请先登录' });
          return;
        }
        if (d.ok === false) {
          reject({ code: d.error || 'ERROR', message: d.message || '请求失败' });
          return;
        }
        resolve(d);
      },
      fail(err) {
        if (method === 'GET' && attempt === 1) {
          setTimeout(() => {
            request(method, path, data, attempt + 1).then(resolve, reject);
          }, GET_RETRY_DELAY_MS);
          return;
        }
        reject({ code: 'NETWORK', message: '网络异常：' + (err.errMsg || '') });
      },
    });
  });
}

module.exports = {
  get: (path, params = {}) => {
    const qs = Object.entries(params).filter(([, v]) => v !== '' && v != null)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
    return request('GET', path + (qs ? '?' + qs : ''));
  },
  post: (path, data = {}) => request('POST', path, data),
  put: (path, data = {}) => request('PUT', path, data),
  del: (path) => request('DELETE', path),

  // 微信登录
  login(profile) {
    return new Promise((resolve, reject) => {
      wx.login({
        success(r) {
          wx.request({
            url: config.baseUrl + '/api/auth/login',
            method: 'POST',
            data: { code: r.code, ...profile },
            success(res) { resolve(res.data); },
            fail: (e) => reject({ code: 'NETWORK', message: '登录失败：' + (e.errMsg || '') }),
          });
        },
        fail: (e) => reject({ code: 'WXLOGIN', message: '微信授权失败' }),
      });
    });
  },

  // 消息红点：未读聊天 + 未读订单通知
  unread: () => request('GET', '/api/messages/unread'),
  // 系统通知列表（被接单 / 已取货 / 已送达 / 被取消…）
  notifications: () => request('GET', '/api/messages/notifications'),
  // 看完通知 → 标记已读（红点消失）
  markNotificationsRead: () => request('POST', '/api/messages/notifications/read', {}),

  // 管理员登录（账号 + 密码，不走 wx.login 的 401 清理逻辑）
  adminLogin(username, password) {
    return new Promise((resolve, reject) => {
      wx.request({
        url: config.baseUrl + '/api/auth/admin-login',
        method: 'POST',
        data: { username, password },
        header: { 'Content-Type': 'application/json' },
        success(res) {
          const d = res.data || {};
          if (d.ok === false) {
            reject({ code: d.error || 'ERROR', message: d.message || '登录失败' });
            return;
          }
          resolve(d);
        },
        fail: (e) => reject({ code: 'NETWORK', message: '登录失败：' + (e.errMsg || '') }),
      });
    });
  },

  // ---- 消息 ----
  // 会话列表
  conversations: () => request('GET', '/api/messages/conversations'),
  // 某订单的对话（拉取 + 标记已读）——旧入口，保留兼容
  messages: (orderId) => request('GET', '/api/messages/order/' + orderId),
  // 与某人的全部对话（跨所有共同订单）——会话按「人」聚合后用这个
  peerMessages: (peerId) => request('GET', '/api/messages/peer/' + peerId),
  sendToPeer: (peerId, content, orderId) =>
    request('POST', '/api/messages/peer/' + peerId, { content, order_id: orderId }),

  // ---- 上传 ----
  /**
   * 选择图片后统一做一次压缩再上传。
   * 微信 chooseMedia 的 sizeType:'compressed' 只是「压缩过的图」，实拍照片仍常有 200KB~1MB，
   * 而服务器出口带宽只有 ~1Mbps：一张 500KB 的凭证下载要 4 秒以上。
   * 这里再用 wx.compressImage 压一道（质量 70、最长边 1280），体积通常能再降 50%~80%，
   * 上传更快、后续跑腿员/发布人查看时也更省流量。压缩失败就用原图，绝不因为压缩挡住业务。
   */
  /**
   * 读图片的原始宽高（拿不到就返回 null，绝不抛错）。
   * 必须知道原图比例才能等比压缩 —— 不知道就只能不指定尺寸。
   */
  imageSizeOf(filePath) {
    if (!filePath || typeof wx.getImageInfo !== 'function') return Promise.resolve(null);
    return new Promise((resolve) => {
      let done = false;
      const fin = (v) => { if (!done) { done = true; resolve(v); } };
      try {
        wx.getImageInfo({
          src: filePath,
          success: (r) => fin(r && r.width && r.height ? { w: r.width, h: r.height } : null),
          fail: () => fin(null),
        });
        setTimeout(() => fin(null), 4000);       // 兜底：回调不来就当不知道尺寸
      } catch (_) { fin(null); }
    });
  },

  compressImage(filePath, { quality = 70, maxSide = 1280 } = {}) {
    if (!filePath || typeof wx.compressImage !== 'function') return Promise.resolve(filePath);
    // 一次尝试：部分老基础库不支持 compressedWidth/Height，失败后只带 quality 再试一次
    const attempt = (opts) => new Promise((resolve) => {
      let done = false;
      const ok = (p) => { if (!done) { done = true; resolve(p || ''); } };
      try {
        wx.compressImage({ src: filePath, quality, ...opts, success: (r) => ok(r && r.tempFilePath), fail: () => ok('') });
        setTimeout(() => ok(''), 5000);          // 兜底：回调不来就放弃压缩
      } catch (_) { ok(''); }
    });
    // 等比缩放：**只按最长边算另一边**。
    // 以前宽和高都填 maxSide（1280×1280），等于把任何比例的图硬压成正方形 ——
    // 竖图被压扁、宽图被拉高，用户看到的就是「图片变形、看不清」。
    const dimsFor = (info) => {
      if (!info || !info.w || !info.h) return {};                 // 不知道比例 → 不改尺寸
      const scale = Math.min(1, maxSide / Math.max(info.w, info.h));
      if (scale >= 1) return {};                                   // 本来就小 → 只降质量，绝不放大
      return {
        compressedWidth: Math.round(info.w * scale),
        compressedHeight: Math.round(info.h * scale),
      };
    };
    return this.imageSizeOf(filePath)
      .then((info) => attempt(dimsFor(info)))
      .then((p) => p || attempt({}))            // 带尺寸失败 → 只降质量（宁可不缩，也不能拉变形）
      .then((p) => p || filePath)
      .catch(() => filePath);
  },

  /** 读本地文件体积（拿不到就返回 0，绝不抛错） */
  fileSizeOf(filePath) {
    try {
      const fs = wx.getFileSystemManager && wx.getFileSystemManager();
      if (!fs || typeof fs.statSync !== 'function') return 0;
      const s = fs.statSync(filePath);
      return Number((s && (s.size || (s.stats && s.stats.size))) || 0) || 0;
    } catch (_) { return 0; }
  },

  /**
   * 压缩后依然很大时的兜底：小程序基础库较老、或用户选的是原图（sizeType 被系统忽略）时，
   * compressImage 可能失败并回退成原图 —— 实测 5MB 的照片经服务器 ~1Mbps 出口要传 45 秒，
   * 很容易被微信 uploadFile 的超时打断（用户看到的就是「照片传不上去」）。
   * 这里再看一眼体积，超过 3MB 就用更低画质再压一道。全程 best-effort。
   */
  shrinkIfHuge(filePath) {
    const size = this.fileSizeOf(filePath);
    if (!size || size <= HUGE_UPLOAD_BYTES) return Promise.resolve(filePath);
    return this.compressImage(filePath, { quality: 50, maxSide: 1000 }).then((p) => p || filePath);
  },

  /** multipart 上传（凭证 / 订单图 / 学生证等）：返回后端 JSON（含 url） */
  upload(path, name, filePath, { compress = true } = {}) {
    const send = (p) => new Promise((resolve, reject) => {
      const token = getToken();
      wx.uploadFile({
        url: config.baseUrl + path,
        filePath: p,
        name,
        header: token ? { Authorization: 'Bearer ' + token } : {},
        success(res) {
          let d;
          const raw = res.data || '';
          try { d = JSON.parse(raw); } catch (_) { d = {}; }
          if (res.statusCode === 401) {
            clearAuth();
            const app = getApp();
            if (app && app.globalData) app.globalData.guest = true;
            reject({ code: 'UNAUTHORIZED', message: '登录已失效，请先登录' });
            return;
          }
          // 413 是 nginx（不在 Node 里）返回的 HTML，JSON.parse 会失败 → 以前只会显示「上传失败」，
          // 看不出是图片太大。这里单独给一句能指导操作的提示。
          if (res.statusCode === 413) {
            reject({ code: 'TOO_LARGE', message: '图片太大，上传被服务器拒绝：请重拍或用相册里更小的照片' });
            return;
          }
          if (res.statusCode < 200 || res.statusCode >= 300) {
            reject({ code: d.error || 'UPLOAD_FAILED', message: d.message || ('上传失败（服务器返回 ' + res.statusCode + '）') });
            return;
          }
          if (d.ok === false) {
            reject({ code: d.error || 'ERROR', message: d.message || '上传失败' });
            return;
          }
          resolve(d);
        },
        fail: (e) => {
          const msg = String((e && e.errMsg) || '');
          // 真机上最常见的一种「上传失败」根本不是网络问题，而是微信后台没配 uploadFile 合法域名
          // （它是独立于 request 域名的一项）。把原因直接说出来，省得当成服务器故障排查半天。
          if (/domain/i.test(msg)) {
            reject({
              code: 'DOMAIN_NOT_ALLOWED',
              message: '上传失败：当前服务器域名不在小程序的 uploadFile 合法域名里，请在微信公众平台配置后重试',
            });
            return;
          }
          reject({ code: 'NETWORK', message: '上传失败：' + (msg || '网络异常') + '（请检查网络后重试）' });
        },
      });
    });
    return (compress ? this.compressImage(filePath).then((p) => this.shrinkIfHuge(p)) : Promise.resolve(filePath)).then(send);
  },

  // 下单图片上传（选填）：返回 { ok, url }
  // 跑腿凭证（取件 / 送达）：返回 { ok, url }
  uploadOrderProof(filePath) {
    return this.upload('/api/orders/proof', 'file', filePath);
  },
  uploadOrderImage(filePath) {
    return this.upload('/api/orders/upload', 'file', filePath);
  },
};
