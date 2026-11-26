// 合并模式：所有原来的云函数调用都转到自有后端（pararouter.cn），不再依赖微信云开发。
// 只有在明确关闭 merge-mode（保留旧云环境）时才落到 wx.cloud。
const config = require('./ocr-config');
let initializedCloud;
const localFiles = new Map();   // fileID -> 本地临时路径，供 OCR 直传后端

function mergeMode() {
  try { return !!require('./merge-mode').enabled; } catch (_) { return false; }
}

function uploadOcr(mode, filePath) {
  const api = require('./api');
  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url: require('./config').baseUrl + '/api/ocr/' + mode,
      filePath,
      name: 'file',
      header: (() => { const t = require('./util').getToken(); return t ? { Authorization: 'Bearer ' + t } : {}; })(),
      success(res) {
        try {
          const d = JSON.parse(res.data || '{}');
          if (d && d.ok) resolve(d.fields || {});
          else reject(Error((d && d.message) || 'OCR failed'));
        } catch (e) { reject(e); }
      },
      fail(e) { reject(Error((e && e.errMsg) || 'OCR failed')); },
    });
  });
}

async function restCall(name, data = {}) {
  const api = require('./api');
  if (name === 'newsService') {
    if (data.action === 'analyticsBatch' || data.action === 'activityConfig') return { ok: true };
    if (data.action === 'newsList') return { ok: true, items: [] };   // 后端暂无资讯源，返回空列表而不是报错
    return { ok: false, error: '动态功能暂未开放' };
  }
  if (name === 'parseParcelScreenshot' || name === 'parseSmsScreenshot') {
    const mode = name === 'parseSmsScreenshot' ? 'sms' : 'parcel';
    if (data.action === 'prepareUpload') return { ok: true, cloudPath: 'ocr/' + Date.now() + '.jpg' };
    const path = localFiles.get(String(data.fileID || ''));
    if (!path) return { ok: false, error: '请重新选择截图' };
    const fields = await uploadOcr(mode, path);
    // 2026-11-26: utils/ocr.js and pages/sms-scan read r.fields; spreading alone left it undefined, so a read
    // screenshot still showed "couldn't read". Keep both shapes.
    return { ok: true, ...fields, fields };
  }
  if (name === 'studentAccount' && data.action === 'status') {
    const me = await api.get('/api/auth/me');
    return { ok: true, account: me && (me.account || me.user) || null };
  }
  if (name === 'orderService' && data.action === 'analytics') return { ok: true };
  throw Error('该云函数已迁移到自有后端，请更新到最新版本');
}

function restCloud() {
  return {
    async callFunction({ name, data }) { return { result: await restCall(name, data) }; },
    async uploadFile({ filePath }) {
      const id = 'local:' + filePath + ':' + Date.now();
      localFiles.set(id, filePath);
      return { fileID: id };
    },
    async deleteFile({ fileList }) { (fileList || []).forEach((id) => localFiles.delete(String(id))); return { fileList: [] }; },
    async getTempFileURL({ fileList }) {
      return { fileList: (fileList || []).map((id) => ({ fileID: id, tempFileURL: String(id) })) };
    },
  };
}

function ensureCloud() {
  const demo = require('./group-test-session');
  const session = demo.current();
  if (session) return { async callFunction({ name, data }) {
    if (name === 'orderService') return { result: await demo.call(data) };
    if (name === 'studentAccount' && data.action === 'status') {
      const result = await demo.call({ action: 'sync' });
      if (!result.ok) throw Error(result.error);
      return { result: { ok: true, account: { id: result.snapshot.accountId, profile: { name: session.role, phone: '13800000000', campusId: 'sip', universityId: 'xjtlu' }, verification: { status: 'verified' }, runnerRulesAccepted: true } } };
    }
    throw Error('请退出测试大厅后使用此服务');
  } };
  if (mergeMode()) return restCloud();
  if (!config.envId) throw Error('CloudBase ID is missing in this imported copy. Import the latest Uniearn project.');
  if (!wx.cloud || typeof wx.cloud.init !== 'function') throw Error('WeChat Cloud APIs are unavailable. Use a registered Mini Program AppID linked to this cloud environment and update the base library.');
  if (initializedCloud !== wx.cloud) { wx.cloud.init({ env: config.envId, traceUser: true }); initializedCloud = wx.cloud; }
  return wx.cloud;
}

module.exports = { ensureCloud };
