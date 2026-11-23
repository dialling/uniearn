// 后端地址「按环境自动切换」
// 开发者工具需勾选「不校验合法域名」才能访问 http 本地服务。
//
// 判定逻辑：
//   envVersion  develop = 开发版/预览（含模拟器与真机扫码预览）
//               trial   = 体验版
//               release = 正式版
//   platform    devtools = 在微信开发者工具模拟器里运行（与 Mac 同机 → 用 127.0.0.1）
//               ios/android = 真机（连不到 127.0.0.1 → 用 Mac 局域网 IP）

function getEnvVersion() {
  try {
    const info = wx.getAccountInfoSync && wx.getAccountInfoSync();
    return (info && info.miniProgram && info.miniProgram.envVersion) || 'develop';
  } catch (_) {
    return 'develop';
  }
}

function getPlatform() {
  try {
    if (wx.getDeviceInfo) return wx.getDeviceInfo().platform;
  } catch (_) {}
  try {
    if (wx.getSystemInfoSync) return wx.getSystemInfoSync().platform;
  } catch (_) {}
  return '';
}

const envVersion = getEnvVersion();
const isDevtools = getPlatform() === 'devtools';

// 各环境的后端地址
//   - 开发者工具模拟器：与本机同机，走本地 http 后端（需勾选「不校验合法域名」）
//   - 真机（预览 / 体验版 / 正式版）：必须走线上 HTTPS 合法域名（微信强制校验合法域名）
const HOSTS = {
  // 开发/预览：模拟器走本机 localhost；真机一律走线上 HTTPS
  // 合并版统一走线上：本机 8099 只在跑后端调试时用，开发者工具里多进程抢端口
  // 会出现「curl 正常、小程序 404」的错位，所以模拟器也直接对线上。
  develop: 'https://pararouter.cn',
  // 体验版（真机）：走线上 HTTPS
  trial: 'https://pararouter.cn',
  // 正式版：已上线 HTTPS（与微信后台「合法域名」保持一致）
  release: 'https://pararouter.cn',
};

const baseUrl = HOSTS[envVersion] || HOSTS.develop;
const wsUrl = baseUrl.replace(/^http/, 'ws') + '/ws';

module.exports = {
  baseUrl,
  wsUrl,
};

//  真机（预览/体验版/正式版）都会连线上 https://pararouter.cn（已配置合法域名，无需局域网 IP）。
//   开发者工具模拟器连本地 http://127.0.0.1:8099，需在「详情→本地设置」勾选「不校验合法域名」。
