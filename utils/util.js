const config = require('./config');

const STATUS_LABEL = { pending: '未接单', accepted: '已接单', picked_up: '配送中', completed: '已送达', cancelled: '已取消' };
const TYPE_LABEL = { food: '外卖代取', express: '快递代取', buy: '代买', other: '其他', night: '夜市代买' };
const TYPE_ICON = { food: '', express: '', buy: '', other: '' }; // 统一不使用 emoji 图标
// 系统通知的单字图标（订单事件 → 一个字）
const NOTIFY_ICON = { accepted: '接', picked_up: '取', completed: '达', confirmed: '结', cancelled: '取', released: '退', settled: '付', expired: '超', pickup_remind: '催' };

module.exports = {
  /**
   * 把服务端返回的一条系统通知装饰成界面要的字段。
   * 「消息」页（只显示最新一条的预览）和「系统通知」页（完整列表）共用同一份，
   * 避免两边各写一份、改一处忘了另一处。
   */
  notifyOf(n) {
    const x = n || {};
    return {
      id: x.id,
      order_id: x.order_id,
      event: x.event,
      // 兼容尚未更新的服务端：旧接口会把 confirmed 原样显示成英文。
      label: x.event === 'confirmed' || /^confirm(?:ed)?$/i.test(String(x.label || '').trim()) ? '订单已确认结单' : (x.label || ''),
      icon: NOTIFY_ICON[x.event] || '单',
      title: x.title || ('订单 ' + (x.order_no || '')),
      timeText: x.created_at ? String(x.created_at).slice(5, 16) : '',
      unread: !!x.unread,
      roleText: x.role === 'publisher' ? '我的单' : '我接的单',
      actorText: x.actor_name ? ' · ' + x.actor_name : '',
    };
  },
  config,
  // 平台定价（与后端 server/src/pricing.js 保持一致）：基础 3 元；文星 3 楼及以上 +1 元
  PRICE_BASE_CENTS: 300,
  // 平台服务费（与后端 SERVICE_FEE_CENTS 一致）：目前免收
  SERVICE_FEE_CENTS: 0,
  // 按类型的固定单价（与后端 TYPE_BASE_CENTS 一致）：夜市代买 4 元/单
  PRICE_TYPE_BASE_CENTS: { food: 300, buy: 300, other: 300, night: 400 },
  // 会计时（1 小时无人接单自动取消）的类型（与后端 TIMED_TYPES 一致）
  TIMED_TYPES: ['food', 'night'],
  isTimedType(type) { return this.TIMED_TYPES.indexOf(String(type || '')) >= 0; },
  // 必须写「具体店铺」的类型（夜市档口多，不写清跑手找不到）
  needsShop(type) { return String(type || '') === 'night'; },
  PRICE_HIGH_FLOOR_MIN: 3,
  PRICE_HIGH_FLOOR_SURCHARGE_CENTS: 100,
  PRICE_HIGH_FLOOR_AREAS: ['文星'],
  // 快递代取按大小定价（与后端 EXPRESS_SIZES 保持一致）
  //  小件 3 元 / 中件 4 元 / 大件 5 元 / 超大件 10 元；desc 是档位的完整说明（超大件必须说清边界）
  EXPRESS_SIZES: [
    { key: 'small',  label: '小件',   hint: '文件、钥匙、小药盒', cents: 300, desc: '能一只手拿、装得进书包：文件袋、钥匙、小药盒、手机壳等小包快递。' },
    { key: 'medium', label: '中件',   hint: '衣服、鞋、书包',     cents: 400, desc: '一个鞋盒到一件外套的大小：衣服、鞋、书包、小电器，一只手抱起不费力。' },
    { key: 'large',  label: '大件',   hint: '棉被、成箱纸巾',     cents: 500, desc: '要双手抱着走：棉被、羽绒服、成箱纸巾/零食、大号快递箱。' },
    { key: 'xlarge', label: '超大件', hint: '整箱水、被褥、桌椅', cents: 1000, desc: '大重量或大体积的单件，一个人能搬、只是比较费力：整箱矿泉水饮料、被褥打包、行李箱、成箱纸巾、宿舍桌椅、折叠床。贵重物品请自行取件，不要下单代取。' },
  ],
  expressSize(key) { return this.EXPRESS_SIZES.filter(x => x.key === String(key || ''))[0] || null; },
  expressSizeDesc(key) { const sz = this.expressSize(key); return sz ? sz.desc : ''; },
  needsSize(type) { return String(type || '') === 'express'; },

  // ---- 多件快递（与后端 normalizeSizeCounts/sizeCounts* 保持一致）----
  // 同一次下单可以代取多件：小件 2 件 + 中件 1 件…，价格按件数叠加；楼层加价只收一次。
  MAX_SIZE_QTY: 9,
  MAX_TOTAL_ITEMS: 12,
  /** 空白件数表：{ small:0, medium:0, large:0, xlarge:0 } */
  emptySizeCounts() {
    const o = {};
    this.EXPRESS_SIZES.forEach(sz => { o[sz.key] = 0; });
    return o;
  },
  /**
   * 归一化件数（只留 >0 的合法档位并夹到上限）。
   * 形状与后端 normalizeSizeCounts 完全一致 —— 只保留有件数的档位，
   * 页面展示时用 `sizeCounts[key] || 0` 兜零，两边同一份语义就不会漂。
   */
  normalizeSizeCounts(raw) {
    const out = {};
    if (raw && typeof raw === 'object') {
      this.EXPRESS_SIZES.forEach(sz => {
        const n = Number(raw[sz.key]);
        if (Number.isFinite(n) && Math.floor(n) > 0) out[sz.key] = Math.min(Math.floor(n), this.MAX_SIZE_QTY);
      });
    }
    return out;
  },
  sizeCountsTotal(counts) {
    return this.EXPRESS_SIZES.reduce((sum, sz) => sum + (Number((counts || {})[sz.key]) || 0), 0);
  },
  /** 多件的商品价（分）= Σ 单价 × 件数 */
  sizeCountsCents(counts) {
    return this.EXPRESS_SIZES.reduce((sum, sz) => sum + (Number((counts || {})[sz.key]) || 0) * sz.cents, 0);
  },
  /** 多件里最大的档位（列表按小→大排列）；单件时代当 size 用 */
  largestSizeKey(counts) {
    let key = '';
    this.EXPRESS_SIZES.forEach(sz => { if (Number((counts || {})[sz.key]) > 0) key = sz.key; });
    return key;
  },
  /**
   * 卡片上的档位标签：多件只用「共 N 件」。
   * 原因：4 种档位都选 3 件时完整明细有 20 个字（小件×3 中件×3 大件×3 超大件×3），
   * 塞进卡片标题行会把标题挤到换行、整张卡片看起来很乱；完整明细放到下面单独一行。
   */
  cardSizeTag(o) {
    const total = Number((o || {}).size_items_total) || 0;
    if (total > 1) return '共 ' + total + ' 件';
    return (o && o.size_label) || (this.expressSize(o && o.size) || {}).label || '';
  },
  /** 卡片上的明细行：小件×3 中件×3 大件×3 超大件×3（只有 1 件时返回空串，不占位置） */
  cardSizeItemsText(o) {
    const total = Number((o || {}).size_items_total) || 0;
    if (total <= 1) return '';
    return '要取 ' + total + ' 件：' + ((o && o.size_label) || '');
  },
  /** 件数标签：1 件小件 → 「小件」；小件 2 件 → 「小件×2」；混合 → 「小件×2 中件×1」 */
  sizeCountsLabel(counts) {
    const parts = this.EXPRESS_SIZES
      .filter(sz => Number((counts || {})[sz.key]) > 0)
      .map(sz => ({ label: sz.label, qty: Number(counts[sz.key]) }));
    if (!parts.length) return '';
    if (parts.length === 1 && parts[0].qty === 1) return parts[0].label;
    return parts.map(p => p.label + '×' + p.qty).join(' ');
  },

  // 宿舍楼栋（与后端 BUILDINGS 一致）：地址表单用选择器、接单大厅用第三级筛选
  BUILDINGS: {
    '文缘': ['D01', 'D02', 'D03', 'D04', 'D05', 'D06'],
    '文星': ['A01', 'A02', 'A03', 'A04', 'A05'],
    '文萃': ['C01', 'C02', 'C03', 'C04', 'C05', 'C06', 'C07', 'C08', 'C09', 'C10'],
    '文荟': ['B01', 'B02', 'B03', 'B04', 'B05', 'B06', 'B07', 'B08', 'B09', 'B10'],
    '芭菲': ['芭菲'],   // 芭菲没有楼栋号，只有一项（与后端 BUILDINGS 一致）
  },
  // 注意：不传宿舍区时返回空数组（大厅据此隐藏楼栋筛选行）；
  // 后端另有 ALL_BUILDINGS（楼栋白名单的整体），两者用途不同，别混用
  buildingsOf(area) { return this.BUILDINGS[String(area || '').trim()] || []; },

  // 各楼栋层数（与后端 BUILDING_FLOORS 一致）：
  //  · 文缘 D01–D06、文萃 C01–C10、文荟 B01–B10 每栋都是 23 层
  //  · 文星 A05 是 20 层（2026-10 实地确认），其余楼栋默认 6 层（FLOOR_MAX）
  BUILDING_FLOORS: {
    芭菲: 6,   // 与后端一致：芭菲暂按 6 层
    D01: 23, D02: 23, D03: 23, D04: 23, D05: 23, D06: 23,
    C01: 23, C02: 23, C03: 23, C04: 23, C05: 23, C06: 23, C07: 23, C08: 23, C09: 23, C10: 23,
    B01: 23, B02: 23, B03: 23, B04: 23, B05: 23, B06: 23, B07: 23, B08: 23, B09: 23, B10: 23,
    A05: 20,
  },
  FLOOR_MAX: 6,
  // 有电梯、不按楼层加价的楼栋（与后端一致）
  NO_FLOOR_SURCHARGE_BUILDINGS: ['A05'],
  noFloorSurcharge(building) {
    return this.NO_FLOOR_SURCHARGE_BUILDINGS.indexOf(String(building || '').trim().toUpperCase()) >= 0;
  },
  /** 从地址文案里认楼栋（如「A05 901」→ A05） */
  buildingFromAddress(text) {
    const t = String(text || '').toUpperCase();
    const all = Object.values(this.BUILDINGS).reduce((a, b) => a.concat(b), []);
    for (let i = 0; i < all.length; i++) {
      if (new RegExp('(^|[^A-Z0-9])' + all[i] + '([^0-9]|$)').test(t)) return all[i];
    }
    return '';
  },
  maxFloorOf(building) {
    const b = String(building || '').trim().toUpperCase();
    if (b && this.BUILDING_FLOORS[b]) return this.BUILDING_FLOORS[b];
    if (b) return this.FLOOR_MAX;
    // 不知道楼栋时取所有楼栋里的最大值（与后端 maxFloorOf 一致，避免误拒合法楼层）
    return Math.max(this.FLOOR_MAX, ...Object.values(this.BUILDING_FLOORS));
  },
  /** 某楼栋的楼层数组，如 A05 → [1..9]；没选楼栋时给最大范围 */
  floorsOf(building) {
    const max = building ? this.maxFloorOf(building) : Math.max(this.FLOOR_MAX, ...Object.values(this.BUILDING_FLOORS));
    const out = [];
    for (let i = 1; i <= max; i++) out.push(i);
    return out;
  },

  priceCents(area, floor, type, size, building, counts) {
    const a = String(area == null ? '' : area).trim();
    const f = Number(floor) || 0;
    const b = String(building == null ? '' : building).trim().toUpperCase();
    const sz = this.needsSize(type) ? this.expressSize(size) : null;
    // 多件：以件数表为准（与后端 computePrice 的 counts 分支同口径）
    const items = this.needsSize(type) ? this.normalizeSizeCounts(counts || {}) : this.emptySizeCounts();
    const itemsTotal = this.sizeCountsTotal(items);
    const multi = itemsTotal > 0;
    const mainKey = multi ? this.largestSizeKey(items) : (sz ? sz.key : '');
    const base = multi ? this.sizeCountsCents(items) : (sz ? sz.cents : (this.PRICE_TYPE_BASE_CENTS[String(type || '')] || this.PRICE_BASE_CENTS));
    // A05 有电梯：不加楼层费（与后端 computePrice 保持一致）；多件时楼层费也只收一次
    const high = !this.noFloorSurcharge(b) && this.PRICE_HIGH_FLOOR_AREAS.indexOf(a) >= 0 && f >= this.PRICE_HIGH_FLOOR_MIN;
    return {
      area: a, floor: f, building: b, high_floor: high, size: mainKey,
      size_items: multi ? items : this.emptySizeCounts(),
      size_items_total: itemsTotal,
      size_label: multi ? this.sizeCountsLabel(items) : (sz ? sz.label : ''),
      base_cents: base,
      total_cents: base + (high ? this.PRICE_HIGH_FLOOR_SURCHARGE_CENTS : 0),
    };
  },
  priceYuan(area, floor, type, size, building, counts) { return (this.priceCents(area, floor, type, size, building, counts).total_cents / 100).toFixed(2); },
  priceNote(area, floor, type, size, building, counts) {
    const p = this.priceCents(area, floor, type, size, building, counts);
    const sz = this.needsSize(type) ? this.expressSize(size) : null;
    const parts = [];
    if (p.size_items_total > 0) parts.push('快递' + p.size_label + '（共 ' + p.size_items_total + ' 件）');
    else if (sz) parts.push('快递' + sz.label + '（' + sz.hint + '）');
    if (this.noFloorSurcharge(p.building) && p.floor) parts.push(p.area + ' ' + p.building + ' ' + p.floor + ' 楼（有电梯，免楼层加价）');
    else if (p.high_floor) parts.push(p.area + ' ' + p.floor + ' 楼及以上 +1 元');
    else if (p.floor) parts.push(p.area + ' ' + p.floor + ' 楼');
    return parts.join(' · ');
  },

  STATUS_LABEL,
  TYPE_LABEL,
  TYPE_ICON,
  getToken() { return wx.getStorageSync('token') || ''; },
  // 是否有登录态
  isLogin() { return !!wx.getStorageSync('token'); },
  // 访客操作需登录：无 token 时弹「去登录」引导，返回 false；有 token 返回 true
  requireLogin() {
    if (this.getToken()) return true;
    wx.showModal({
      title: '请先登录',
      content: '登录后即可下单/接单/查看，浏览时不会打扰你。',
      confirmText: '去登录',
      cancelText: '稍后',
      success: (r) => { if (r.confirm) wx.navigateTo({ url: '/pages/login/login' }); },
    });
    return false;
  },
  getUser() {
    const u = wx.getStorageSync('user');
    return u || null;
  },
  /** 服务端 pay_offline 开关的本地缓存（微信支付被限制时置 true） */
  setPayOffline(v) {
    try { wx.setStorageSync('pay_offline', v ? 1 : 0); } catch (_) {}
  },
  payOffline() {
    try { return wx.getStorageSync('pay_offline') === 1; } catch (_) { return false; }
  },
  setAuth(token, user) {
    wx.setStorageSync('token', token);
    wx.setStorageSync('user', user);
  },
  clearAuth() {
    wx.removeStorageSync('token');
    wx.removeStorageSync('user');
  },
  /**
   * 选图统一入口（相册 / 拍照）——所有需要用户选图的地方都走这里。
   *
   * 为什么需要统一：
   *   · 选相册里的照片**不需要**额外授权（微信自己的选图界面就是授权动作）
   *   · 但「拍照」会弹系统相机权限，用户拒绝后 chooseMedia 会走 fail
   *   · 如果公众平台没配置《用户隐私保护指引》，真机上 chooseMedia 也会直接 fail
   *   以前 5 处调用都没有 fail 处理 → 用户点了没反应，以为小程序坏了。
   *   现在失败时给出可操作的引导（去设置 / 说明原因），取消则安静返回。
   *
   * @param {object} options wx.chooseMedia 参数（count/mediaType/sourceType 等）
   * @param {(files: Array) => void} onFiles 选中后的回调，参数是 tempFiles
   */
  pickImage(options, onFiles) {
    const opts = Object.assign(
      { count: 1, mediaType: ['image'], sizeType: ['compressed'], sourceType: ['album', 'camera'] },
      options || {},
    );
    const handle = (res) => {
      const files = (res && res.tempFiles) || [];
      if (files.length && typeof onFiles === 'function') onFiles(files);
    };
    const retry = () => this.pickImage(opts, onFiles);
    try {
      wx.chooseMedia(Object.assign({}, opts, {
        success: handle,
        fail: (err) => {
          const msg = String((err && err.errMsg) || '');
          if (/cancel/i.test(msg)) return;                     // 用户自己取消：不打扰
          if (/privacy/i.test(msg)) {
            // 公众平台未配置隐私指引 / 用户未同意隐私协议
            wx.showModal({
              title: '需要先同意隐私协议',
              content: '微信要求先同意《用户隐私保护指引》才能使用相册或相机。请退出小程序重新进入，在弹出的提示里点「同意」后再试。',
              showCancel: false,
              confirmText: '知道了',
            });
            return;
          }
          if (/auth|authorize|permission|deny/i.test(msg)) {
            wx.showModal({
              title: '需要相册 / 相机权限',
              content: '你刚才拒绝了授权。可以在设置里允许后再回来试试。',
              confirmText: '去设置',
              cancelText: '取消',
              success: (r) => {
                if (!r.confirm) return;
                wx.openSetting({
                  success: (s) => {
                    const ok = s && s.authSetting && (s.authSetting['scope.camera'] || s.authSetting['scope.writePhotosAlbum']);
                    if (ok) retry();
                  },
                  fail: () => {},
                });
              },
            });
            return;
          }
          wx.showToast({ title: '打开相册失败，请重试', icon: 'none' });
        },
      }));
    } catch (_) {
      wx.showToast({ title: '当前微信版本不支持选图，请更新微信', icon: 'none' });
    }
  },

  /**
   * 保存图片到相册（需要 scope.writePhotosAlbum 授权）。
   * 被拒时引导去设置，而不是只弹一句「保存失败」。
   */
  saveImageToAlbum(filePath, { successText = '已保存到相册' } = {}) {
    const save = () => {
      wx.saveImageToPhotosAlbum({
        filePath,
        success: () => wx.showToast({ title: successText, icon: 'none' }),
        fail: (err) => {
          const msg = String((err && err.errMsg) || '');
          if (/cancel/i.test(msg)) return;
          wx.showModal({
            title: '无法保存到相册',
            content: '需要你允许「保存到相册」权限。可以在设置里打开后再试。',
            confirmText: '去设置',
            cancelText: '取消',
            success: (r) => {
              if (!r.confirm) return;
              wx.openSetting({
                success: (s) => { if (s && s.authSetting && s.authSetting['scope.writePhotosAlbum']) save(); },
                fail: () => {},
              });
            },
          });
        },
      });
    };
    save();
  },

  /** 打开本小程序的设置页（含「通知管理」）。必须在用户点击回调里同步调用 */
  openSubscribeSetting() {
    try { wx.openSetting({ withSubscriptions: true, fail: () => {} }); } catch (_) {}
  },

  money(cents) { return (cents / 100).toFixed(2); },
  statusLabel(s) { return STATUS_LABEL[s] || s; },
  // 未付款的单：服务端到 pay_deadline_ms 还没收到钱就自动取消（server/src/expiry.js），这里只写成人话
  unpaidLeftText(o, now) {
    const at = Number(o && o.pay_deadline_ms) || 0;
    if (!at) return '';
    const left = at - (now || Date.now());
    if (left <= 0) return '即将自动取消…';
    const min = Math.ceil(left / 60000);
    return min <= 1 ? '不到 1 分钟后自动取消' : min + ' 分钟内不付款将自动取消';
  },
  typeLabel(t) { return TYPE_LABEL[t] || t; },
  typeIcon(t) { return TYPE_ICON[t] || ''; },
  // ---- 等级徽章 ----
  LEVEL_CLS: { 1: 'lv-bronze', 2: 'lv-silver', 3: 'lv-gold', 4: 'lv-platinum', 5: 'lv-diamond' },
  levelName(lv) { return (lv && lv.name) ? lv.name : ''; },
  levelCls(lv) { return (this.LEVEL_CLS[(lv && lv.level)] || 'lv-bronze'); },
  // 手机号：11 位，1 开头，第二位 3-9（中国大陆手机号）
  isPhone(v) { return /^1[3-9]\d{9}$/.test(String(v || '').trim()); },
  // 头像：统一用「昵称首字」+ 蓝色底（不再使用 emoji）；seed 传昵称即可
  avatarEmoji(seed) {
    const s = String(seed ?? '').trim();
    return s ? s.slice(0, 1) : '?';
  },
  avatarBg() {
    return '#0a6cff';
  },
  // 若用户有真实头像（微信头像上传后的 URL），返回完整可显示地址；否则返回 ''（用首字兜底）
  avatarSrc(u) {
    const a = u && u.avatar;
    if (!a) return '';
    return /^https?:/.test(a) ? a : config.baseUrl + a;   // 绝对地址不再拼前缀
  },
  _hash(s) { let h = 0; const str = String(s ?? ''); for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0; return h; },
};
