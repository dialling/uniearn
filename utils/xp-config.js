// Public server addresses only; never put keys here.
const LIVE = 'https://pararouter.cn';
const LOCAL = 'http://127.0.0.1:8099';

function envVersion() {
  try { return wx.getAccountInfoSync().miniProgram.envVersion || 'develop'; } catch (_) { return 'develop'; }
}
function platform() {
  try { if (wx.getDeviceInfo) return wx.getDeviceInfo().platform; } catch (_) {}
  try { return wx.getSystemInfoSync().platform; } catch (_) { return ''; }
}
// The DevTools simulator talks to a local XP server (tick "skip domain check");
// phones and trial/release builds always use the live HTTPS domain.
function baseUrl() {
  return envVersion() === 'develop' && platform() === 'devtools' ? LOCAL : LIVE;
}

module.exports = {baseUrl, platform};
