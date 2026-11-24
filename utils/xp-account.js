// Uniearn 的页面通过 account.call('sessionLogin'|'status') 拿账号，
// 合并版把这两步接到西浦跑（XP）的 HTTP 服务：/api/auth/login + token。
const api = require('./api'), util = require('./util'), store = require('./store');

function shape(user) {
  const u = user || {};
  const status = u.runner_status === 'approved' ? 'verified' : u.runner_status === 'pending' ? 'pending' : u.runner_status === 'rejected' ? 'rejected' : 'unverified';
  return {
    id: String(u.id || ''), accountId: String(u.id || ''),
    profile: {
      name: u.nickname || '',
      displayName: u.nickname || '',
      avatarUrl: u.avatar_url || u.avatarUrl || '',
      phone: u.phone || '',
      dorm: u.dorm || '',
      room: u.dorm_room || '',
      pickup: u.pickup || '',
      campusId: 'sip',
      universityId: 'xjtlu'
    },
    verification: { status, studentId: u.student_no || '', phoneVerified: !!u.phone },
    runnerRulesAccepted: status === 'verified',
    loggedOut: false
  };
}

async function login(extra = {}) {
  const res = await api.login({ nickname: extra.nickname || '' });
  if (!res || res.ok !== true) throw Error((res && res.message) || '登录失败');
  util.setAuth(res.token, res.user);
  const account = shape(res.user);
  store.update(s => {
    s.profile = {
      ...s.profile,
      name: account.profile.name,
      displayName: account.profile.displayName || s.profile.displayName || '',
      avatarUrl: account.profile.avatarUrl || s.profile.avatarUrl || '',
      phone: account.profile.phone,
      dorm: account.profile.dorm || s.profile.dorm || '',
      room: account.profile.room || s.profile.room || '',
      accountId: account.accountId,
      onboarded: true,
      loggedOut: false,
      studentVerified: account.verification.status === 'verified'
    };
  });
  return { account };
}

async function status() {
  if (!util.getToken()) { const account = shape({}); account.loggedOut = true; return { account }; }
  try {
    const res = await api.get('/api/auth/me');
    const account = shape((res && res.user) || {});
    if (res && res.user) util.setAuth(util.getToken(), res.user);
    store.update(s => {
      s.profile = {
        ...s.profile,
        accountId: account.accountId,
        name: account.profile.name || s.profile.name || '',
        displayName: account.profile.displayName || s.profile.displayName || '',
        avatarUrl: account.profile.avatarUrl || s.profile.avatarUrl || '',
        dorm: account.profile.dorm || s.profile.dorm || '',
        room: account.profile.room || s.profile.room || '',
        studentVerified: account.verification.status === 'verified'
      };
    });
    return { account };
  } catch (e) {
    if (e && e.code === 'UNAUTHORIZED') { const account = shape({}); account.loggedOut = true; return { account }; }
    throw e;
  }
}

// ---- 其余 account action 的 REST 映射 ----
async function call(action, extra = {}) {
  const api2 = require('./api');
  switch (action) {
    case 'sessionLogin': case 'wechatLogin': return login(extra);
    case 'status': return status();
    case 'logout':
      require('./util').clearAuth();
      store.update(s => { s.profile = { ...s.profile, loggedOut: true }; });
      return { account: { ...shape({}), loggedOut: true } };
    case 'saveDisplayName': {
      const displayName = String(extra.displayName || extra.name || '').trim();
      const res = await api2.post('/api/auth/nickname', { nickname: displayName });
      return patchLocal(res && res.user, { displayName, name: displayName });
    }
    case 'saveDorm': {
      const body = {
        dorm: extra.dorm || '',
        dorm_room: extra.room || '',
        pickup: extra.pickup || ''
      };
      if (['male', 'female'].includes(extra.gender)) body.dorm_type = extra.gender;
      const res = await api2.post('/api/auth/dorm', body);
      return patchLocal(res && res.user, {
        dorm: extra.dorm || '',
        room: extra.room || '',
        pickup: extra.pickup || ''
      });
    }
    case 'saveAvatar': {
      const url = extra.avatarUrl !== undefined ? extra.avatarUrl : (extra.url || extra.fileID || '');
      // /api/auth/avatar 是 multipart 上传，只收 file；本地已有 URL（/uploads/avatars/…）
      // 时用 /avatar-url 落库，否则别人看到的一直是微信头像。
      if (url) {
        if (/^\/uploads\/avatars\//.test(url)) await api2.post('/api/auth/avatar-url', { url });
        else if (/^https?:/.test(url)) await api2.post('/api/auth/avatar-url', { url }).catch(() => {});
      }
      return patchLocal(null, { avatarUrl: url });
    }
    case 'selectCampus': case 'campusInterest': case 'requestSchool': {
      store.update(s => {
        s.profile = {
          ...s.profile,
          universityId: extra.universityId || s.profile.universityId || 'xjtlu',
          campusId: extra.campusId || s.profile.campusId || 'sip',
          onboarded: true
        };
        if (action === 'campusInterest') s.campusInterest = extra;
      });
      return { account: shape(require('./util').getUser() || {}) };
    }
    case 'agreeRules': {
      // 认证中的用户 runner_status 还是 pending，shape() 不会给 runnerRulesAccepted，
      // 页面判断 accepted 时用 runnerRulesPending，这里两个一起置位，避免「点继续没反应」
      store.update(s => { s.runnerRulesAccepted = true; s.runnerRulesPending = true; });
      return { account: shape(require('./util').getUser() || {}) };
    }
    case 'apply': {
      const a = extra.application || {};
      const res = await api2.post('/api/runner/apply', {
        real_name: a.realName || '',
        student_no: a.studentId || '',
        gender: a.gender || '',
        phone: a.phone || ''
      });
      if (res && res.ok === false) throw Error(res.message || '提交失败');
      return { account: shape((res && res.user) || require('./util').getUser() || {}) };
    }
    case 'adminLogin': {
      const r = await api2.adminLogin(extra.username, extra.password);
      // 管理员登录返回的是管理员身份 token，换掉本地 token 后 /api/admin/* 才通得过
      if (r && r.token) { require('./util').setToken(r.token); wx.setStorageSync('admin_ok', '1'); }
      return r;
    }
    case 'adminLogout':
      wx.removeStorageSync('admin_ok');
      require('./util').clearToken();   // 管理员 token 不留在设备上
      return { ok: true };
    case 'adminStatus': {
      // 还没用管理员账号登录过就别打 /api/admin/stats，不然控制台一串 401
      if (wx.getStorageSync('admin_ok') !== '1') return { ok: true, admin: false };
      try {
        const res = await api2.get('/api/admin/stats');
        return { ok: true, admin: !!(res && res.ok !== false) };
      } catch (_) {
        wx.removeStorageSync('admin_ok');
        return { ok: true, admin: false };
      }
    }
    case 'adminDashboard': {
      if (wx.getStorageSync('admin_ok') !== '1') throw { code: 'UNAUTHORIZED', message: '请先用管理员账号登录' };
      const res = await api2.get('/api/admin/stats');
      const raw = (res && res.stats) || res || {};
      return {
        ok: true,
        stats: {
          total: Number(raw.total || 0),
          waiting: Number(raw.waiting || raw.pending || 0),
          unpaid: Number(raw.unpaid || 0),
          completed: Number(raw.completed || raw.confirmed || 0),
          users: Number(raw.users || 0),
          runners: Number(raw.runners || 0)
        },
        applications: Array.isArray(res && res.applications) ? res.applications : []
      };
    }
    case 'adminOrders': {
      const res = await api2.get('/api/admin/orders', extra);
      const rawList = (res && (res.orders || res.list)) || [];
      const toRequest = require('./xp-orders').toRequest;
      return { ok: true, orders: rawList.map(o => toRequest(o)) };
    }
    case 'review':
      return api2.post('/api/admin/runners/' + encodeURIComponent(String(extra.accountId || '')) + '/review', {
        decision: extra.decision,
        note: extra.note || ''
      });
    default:
      throw Error('该账号操作尚未接入西浦跑后端：' + action);
  }
}
function patchLocal(user, patch) {
  store.update(s => { s.profile = { ...s.profile, ...patch }; });
  const account = shape(user || require('./util').getUser() || {});
  account.profile = { ...account.profile, ...patch };
  return { account };
}

module.exports = { login, status, shape, call };
