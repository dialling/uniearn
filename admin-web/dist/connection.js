'use strict';
// This bridge is intentionally separate from the supplied design.
// Tokens stay in memory. Refreshing the page requires another administrator login.
const adminConnection = {mode: 'locked', token: '', endpoint: '', user: null, busy: false, data: null};
document.body.setAttribute('data-admin-locked', '');
const access = document.createElement('section'); access.id = 'admin-access';
access.innerHTML = `<form class="access-panel" id="admin-login"><span class="pill good">UNIEARN · OPERATIONS</span><h1>UniEarn 管理后台</h1><p>独立的校园运营工作台。请使用管理员账号和密码登录。</p><label for="admin-username">管理员账号</label><input id="admin-username" autocomplete="username" required maxlength="80"><label for="admin-password">密码</label><input id="admin-password" type="password" autocomplete="current-password" required maxlength="300"><p id="access-error" role="alert"></p><button class="primary" type="submit" id="admin-submit">登录后台</button></form>`;
document.body.prepend(access);
const statusbar = document.createElement('div'); statusbar.id = 'admin-status'; statusbar.hidden = true;
document.body.prepend(statusbar);
adminConnection.endpoint = window.UNIEARN_ADMIN_ENDPOINT || '';
function endpointURL(value) {
  const url = new URL(value);
  if (url.username || url.password || url.hash || url.search || !(/^https:$/.test(url.protocol) || url.protocol === 'http:' && ['localhost','127.0.0.1'].includes(url.hostname))) throw Error('请填写 HTTPS 后台接口地址。');
  return url.href;
}
async function adminRequest(action, extra = {}) {
  const response = await fetch(adminConnection.endpoint, {method: 'POST', cache: 'no-store', credentials: 'omit',
    headers: {'Content-Type': 'application/json', ...(adminConnection.token ? {Authorization: 'Bearer ' + adminConnection.token} : {})},
    body: JSON.stringify({action, ...extra}), signal: AbortSignal.timeout(30000)});
  const result = await response.json().catch(() => {throw Error('接口没有返回 JSON，请检查云函数部署和 HTTP 访问路径。');});
  if (!response.ok || !result.ok) {
    if (result.code === 'AUTH_REQUIRED' && action !== 'login') lockAdmin();
    throw Error(result.error || '请求失败，请稍后重试。');
  }
  return result;
}
function lockAdmin() {
  adminConnection.token = ''; adminConnection.mode = 'locked'; adminConnection.user = null;
  document.body.setAttribute('data-admin-locked', ''); document.body.removeAttribute('data-admin-open');
  access.hidden = false; statusbar.hidden = true; document.getElementById('admin-password').value = '';
  drawer = null; document.getElementById('drawer-root').innerHTML = '';
}
function openAdmin() {
  access.hidden = true; statusbar.hidden = false;
  document.body.removeAttribute('data-admin-locked'); document.body.setAttribute('data-admin-open', '');
  const preview = adminConnection.mode === 'preview';
  statusbar.innerHTML = `<span>${preview ? '界面预览 · 演示数据，不连接小程序' : '已连接云开发 · ' + esc(adminConnection.user.username)} <span class="status-ledger"> · 测试账本，无真实支付/提现</span></span><span>${!preview ? '<button id="admin-refresh">刷新数据</button> ' : ''}<button id="admin-signout">${preview ? '返回登录' : '退出登录'}</button></span>`;
  statusbar.querySelector('#admin-signout').onclick = async () => {
    try {if (!preview) await adminRequest('logout');} catch (_) {} finally {location.reload();}
  };
  if (!preview) statusbar.querySelector('#admin-refresh').onclick = () => refreshAdmin().catch(e => toast(e.message));
  render();
}
if(new URLSearchParams(location.search).get('preview')==='1'){adminConnection.mode='preview';openAdmin();}
access.querySelector('form').onsubmit = async event => {
  event.preventDefault();
  const button = document.getElementById('admin-submit'), error = document.getElementById('access-error');
  button.disabled = true; button.textContent = '正在连接…'; error.textContent = '';
  try {
    if(!adminConnection.endpoint)throw Error('后台服务正在配置中，请稍后登录。');
    adminConnection.endpoint = endpointURL(adminConnection.endpoint);
    const result = await adminRequest('login', {username: document.getElementById('admin-username').value.trim(), password: document.getElementById('admin-password').value});
    adminConnection.token = result.token; adminConnection.user = result.user; adminConnection.mode = 'live';
    document.getElementById('admin-password').value = '';
    await refreshAdmin(); openAdmin();
  } catch (e) {error.textContent = e.message === 'Failed to fetch' ? '无法连接云开发接口。请检查接口地址、跨域白名单和云函数是否已部署。' : e.message; adminConnection.token = ''; adminConnection.mode = 'locked';}
  finally {button.disabled = false; button.textContent = '登录后台';}
};
function replaceMap(target, list) {Object.keys(target).forEach(k => delete target[k]); for (const value of list) target[value.id] = value;}
const validId = value => /^[A-Za-z0-9_-]{1,100}$/.test(String(value || ''));
function hydrateAdmin(data) {
  adminConnection.data = data; NOW = Date.now(); TODAY0 = dayStart(NOW);
  for (const list of [USERS, ORDERS, APPS, TICKETS, MARKS, ADDRS, COUPONS, WITHDRAWALS, BUILDINGS, PICKUPS, activeRunners, realUsers]) list.splice(0);
  for (const map of [UMAP, OMAP, AMAP, BLD, PU, CMAP, PAUSED]) Object.keys(map).forEach(k => delete map[k]);
  if (!AREA.unknown) {const area = {id: 'unknown', en: 'Other / not set', zh: '其他 / 未设置'}; AREAS.push(area); AREA.unknown = area;}
  const annotations = data.meta.annotations || {}, blds = new Map(), pickups = new Map();
  function building(name) {
    name = String(name || '未设置 / Not set'); if (blds.has(name)) return blds.get(name);
    const area = /文缘|文源|wen\s*yuan/i.test(name) ? 'WY' : /文星|wen\s*xing/i.test(name) ? 'WX' : /文萃|wen\s*cui/i.test(name) ? 'WC' : /文汇|wen\s*hui/i.test(name) ? 'WH' : 'unknown';
    const b = {id: 'B' + blds.size, area, name, code: name, gender: 'Unknown', lockerLoc: ''}; blds.set(name, b.id); BUILDINGS.push(b); BLD[b.id] = b; return b.id;
  }
  function pickup(name) {
    name = String(name || '未设置 / Not set'); if (pickups.has(name)) return pickups.get(name);
    const p = {id: 'P' + pickups.size, name, kind: 'Pickup point', active: true}; pickups.set(name, p.id); PICKUPS.push(p); PU[p.id] = p; return p.id;
  }
  function addUser(account) {
    const p = account.profile || {}, v = account.verification || {}, meta = annotations['member:' + account.id] || {};
    const u = {id: account.id, nick: p.name || account.id.slice(0,8), isTest: !!meta.isTest,
      area: BLD[building(p.dorm)].area, bld: building(p.dorm), room: p.room || '', contact: v.realName || p.name || '',
      phone: v.phone || p.phone || '', sid: String(v.studentId || '').replace(/\D/g, ''),
      joined: account.createdAt || account.updatedAt || NOW, lastActive: account.updatedAt || NOW,
      certified: v.status === 'verified', certAt: v.checkedAt || null, source: 'Mini program', consent: false,
      dropPref: 'door', tags: new Set(meta.tags || []), notes: meta.notes || [], goodwill: [], lastNews: null, pointsAdj: 0,
      sexChosen: v.gender === 'male' ? 'Male' : v.gender === 'female' ? 'Female' : null, phoneVerified: !!v.phoneVerified, verification: v};
    USERS.push(u); UMAP[u.id] = u;
    if (p.dorm || p.room) ADDRS.push({id: account.id, user: account.id, contact: u.contact, bld: u.bld,
      room: p.room || '', drop: 'door', createdAt: u.joined, lastUsed: account.updatedAt || null});
    if (v.status && v.status !== 'unverified') APPS.push({id: account.id, user: account.id,
      appliedAt: v.submittedAt || v.checkedAt || NOW, status: v.status === 'verified' ? 'approved' : v.status,
      checkedAt: v.checkedAt || null, checkedBy: v.reviewerId ? 'Cloud admin' : '', reason: v.reason || '', proof: true, grad: '—'});
    return u;
  }
  for (const a of data.accounts) if (validId(a.id)) addUser(a);
  function ensureUser(id) {
    if (!id || !validId(id)) return null;
    return UMAP[id] || addUser({id, profile: {name: '用户 ' + id.slice(0,8)}, createdAt: NOW});
  }
  const trips = new Map(data.trips.map(t => [t.id, t]));
  const statuses = {waiting:'posted', taken:'taken', collected:'picked', delivered:'delivered', confirmed:'confirmed', cancelled:'cancelled', refunded:'refunded', disputed:'disputed'};
  for (const r of data.requests) {
    if (!validId(r.id) || !ensureUser(r.ownerId)) continue;
    const trip = trips.get(r.runnerId), runner = trip?.runnerAccountId; if (runner) ensureUser(runner);
    const meta = annotations['order:' + r.id] || {}, cust = UMAP[r.ownerId], bld = building(r.dorm || BLD[cust.bld].name);
    ORDERS.push({id: r.id, campus:'SIP', type:r.category === 'takeout' ? r.night ? 'nightMarket' : 'takeaway' : r.category === 'parcel' ? 'parcel' : 'purchase',
      customer:r.ownerId, runner:runner || null, status:statuses[r.status] || 'cancelled', postedAt:r.createdAt || NOW,
      paidAt:r.createdAt || NOW, takenAt:r.takenAt || null, pickedAt:r.collectedAt || null, deliveredAt:r.deliveredAt || null,
      confirmedAt:r.confirmedAt || null, cancelledAt:r.cancelledAt || r.refundedAt || null,
      confirmedBy:r.autoConfirmed ? 'auto' : 'student', cancelReason:r.cancelReason || r.refundReason || 'Other',
      cancelledBy:r.cancelledBy || (r.status === 'cancelled' ? 'student' : null), cancelStage:r.takenAt ? 'taken' : 'posted',
      fee:Math.round((Number(r.reward)||0)*100), svc:Math.round((Number(r.serviceFee)||0)*100), offerRaised:0,
      coupon:r.discount ? {id:r.couponId,fen:Math.round(r.discount*100)} : null,
      refunds:r.status === 'refunded' ? [{fen:Math.round((Number(r.refundAmount)||0)*100),reason:r.refundReason || '',at:r.refundedAt || NOW,by:'Cloud admin'}] : [],
      bld,area:BLD[bld].area,pickup:pickup(r.station),bags:(r.small||0)+(r.big||0)||1,
      dueAt:r.arrivalAt || r.dueAt || r.createdAt,groupId:r.runnerId || null,isTest:!!(r.isTest || meta.isTest),
      rating:r.rating || null,notes:meta.notes || [],seq:ORDERS.length,
      dispute:r.dispute ? {type:String(r.dispute.reason || 'Order issue'),reportedAt:r.dispute.at || r.dispute.createdAt || r.deliveredAt || NOW,
        status:r.status === 'disputed' ? 'open' : r.status === 'refunded' ? 'upheld' : 'rejected',note:r.refundReason || ''} : null});
  }
  for (const t of data.tickets) {
    if (!validId(t.id) || !ensureUser(t.accountId)) continue;
    const thread = (t.messages || []).map(m => ({from:m.mine ? 'user' : 'staff',text:String(m.text || ''),at:m.at,by:m.mine ? '' : 'UniEarn'}));
    if (!thread.length) thread.push({from:'user',text:String(t.topic || 'Support request'),at:t.createdAt || NOW});
    const first = thread.find(m => m.from === 'staff');
    TICKETS.push({id:t.id,user:t.accountId,topic:t.topic || 'Support',role:UMAP[t.accountId].certified ? 'runner' : 'student',
      status:t.status,createdAt:t.createdAt || NOW,firstReplyAt:first?.at || null,thread,order:null});
  }
  for (const m of data.marks) if (ensureUser(m.accountId)) MARKS.push({id:m.id || String(m.index),runner:m.accountId,rule:String(m.reason || ''),givenAt:m.at,expiresAt:m.at+14*DAY,by:m.by || 'System'});
  activeRunners.push(...USERS.filter(u => u.certified)); realUsers.push(...USERS.filter(u => !u.isTest));
  replaceMap(OMAP,ORDERS); replaceMap(AMAP,ADDRS);
  ST.newsLog=[]; ST.exportLog=[]; ST.accessLog=[]; ST.changeLog=(data.audit || []).map(a=>({at:a.at,by:a.username,what:a.action+' · '+a.target}));
  ST.opsBalance=0; ST.role=adminConnection.user.role; ST.me=adminConnection.user.username;
  ST.qr={uploadedAt:null,img:null}; ST.serviceFeeOn=false;
  ST.support.sel=TICKETS.some(t=>t.id===ST.support.sel)?ST.support.sel:null;
  refreshMembers();
}
async function refreshAdmin() {
  const result = await adminRequest('snapshot'); adminConnection.user=result.user; hydrateAdmin(result.data); render();
}
const suppliedRender = render, suppliedDrawer = renderDrawer;
function annotateLiveView() {
  if (adminConnection.mode !== 'live') return;
  const view=document.getElementById('view');
  if (!view.querySelector('.live-notice')) {
    const notice=document.createElement('div');notice.className='live-notice';
    notice.textContent='云开发真实数据 · 团队测试账本。已接入：订单/用户查询、跑腿申请审核、客服文字回复、争议结算、违规记录和后台备注。会员积分、营销配置、地点编辑及支付/提现尚未接入，保持只读。'+(adminConnection.data?.truncated?' 当前超过 5,000 条的列表已截断，请使用云端导出。':'');
    view.prepend(notice);
  }
  for (const id of ['role','me']) {const el=document.getElementById(id);if(el){el.innerHTML=`<option>${esc(id==='me'?adminConnection.user.username:roleName[adminConnection.user.role])}</option>`;el.disabled=true;}}
  for (const el of document.querySelectorAll('[id^="cfg"],[id^="mem-"],[id^="goal-"],[id^="pu-"],[id^="pua-"],[id^="lk-"],[id^="bg-"],#feat-tasks,#ops-bal,#qr-file,#s-file')) {el.disabled=true;el.title='此项尚未接入小程序，当前只读';}
}
render = function(){suppliedRender();annotateLiveView();};
renderDrawer = function(){suppliedDrawer();annotateLiveView();};
// The supplied prototype invents order chats and automatic identity checks. Replace
// those surfaces with factual records in connected mode.
const suppliedChat=chatHTML,suppliedApp=dApp,suppliedSex=sexOf;
chatHTML=function(o){return adminConnection.mode==='live'?'<p class="muted">订单内聊天和照片暂未开放到网页后台，请在云开发中按权限查询。</p>':suppliedChat(o);};
sexOf=function(u){return adminConnection.mode==='live'?{g:u.sexChosen||'Unknown',src:'chosen'}:suppliedSex(u);};
const suppliedSexL=sexL;
sexL=(g,pl)=>g==='Unknown'?(LANG==='zh'?'未设置':'Not set'):suppliedSexL(g,pl);
dApp=function(a){
  if(adminConnection.mode!=='live')return suppliedApp(a);
  const u=UMAP[a.user],v=u.verification;
  return `<div class="drawer-head"><div><h3>跑腿员申请审核</h3><p>${esc(u.nick)} · ${fDT(a.appliedAt)}</p></div><button class="x" data-act="close" aria-label="Close">${IC.x}</button></div><div class="drawer-body"><dl class="dl"><dt>姓名</dt><dd>${esc(u.contact)}</dd><dt>性别</dt><dd>${u.sexChosen==='Male'?'男':u.sexChosen==='Female'?'女':'未填写'}</dd><dt>手机号</dt><dd>${esc(u.phone||'—')}</dd><dt>学号</dt><dd>${esc(u.sid||'—')}</dd><dt>宿舍</dt><dd>${esc(BLD[u.bld].name)}</dd><dt>状态</dt><dd>${esc(a.status)}</dd></dl><p class="muted">核对实际提交的信息后再审核。姓名、性别、手机号和学号均由管理员人工审核。</p>${a.status==='pending'?`<textarea id="admin-review-note" placeholder="审核备注；拒绝时必填" maxlength="300"></textarea><div class="row"><button class="btn primary" data-act="approve:${a.id}"${dis('approve')}>通过申请</button><button class="btn danger" data-act="reject:${a.id}"${dis('approve')}>拒绝申请</button></div>`:''}</div>`;
};
const navigationActions=new Set(['view','go','range','order','member','runner','utab','back','app','ticket','sbox','ssel','quick','attDel','zoom','msex','ruleF','dispute','address','atab','close','page','creason','cback','cbld','corders','rwtab','ftab','coupon','lang','liveAll','clear','kgo','seg','mtab','rtab','appst','stab','chk','askRefund','reveal']);
const valueOf=id=>document.getElementById(id)?.value || '';
async function performAdminAction(action,arg,parts) {
  let name,payload={};
  if(['approve','approveAny','reject'].includes(action)) {
    const application=APPS.find(a=>a.id===arg);name='review';payload={accountId:application.user,submittedAt:application.appliedAt,decision:action==='reject'?'reject':'approve',note:valueOf('admin-review-note')};
  } else if(['send','sendResolve','reply'].includes(action)) {
    const ticket=TICKETS.find(t=>t.id===arg);name='supportReply';payload={accountId:ticket.user,ticketId:ticket.id,text:valueOf(action==='reply'?'reply-text':'s-reply')};
    if(!payload.text.trim())throw Error('请输入回复内容。');
  } else if(['resolve','reopen'].includes(action)) {
    const ticket=TICKETS.find(t=>t.id===arg);name='supportStatus';payload={accountId:ticket.user,ticketId:ticket.id,status:action==='resolve'?'resolved':'open'};
  } else if(['uphold','rejectDsp'].includes(action)) {
    const order=OMAP[arg],note=valueOf('dsp-reason').trim();
    if(note.length<10)throw Error('请填写至少 10 字的处理说明。');
    if(action==='uphold'&&Math.round(Number(valueOf('dsp-amt'))*100)!==order.fee)throw Error('当前云端只支持全额测试退款，请填写完整配送金额。');
    name='resolveDispute';payload={id:arg,decision:action==='uphold'?'refund':'release',deduction:0,note};
  } else if(action==='note') {name='note';payload={kind:parts[0],id:parts[1],text:valueOf('note-text')};}
  else if(action==='tag') {name='tag';payload={kind:'member',id:parts[0],tag:parts.slice(1).join(':')};}
  else if(action==='markTest') {name='markTest';payload={kind:'order',id:arg,value:true};}
  else if(action==='addMark') {name='addMark';payload={accountId:arg,reason:valueOf('mark-rule')};}
  else if(action==='rmMark') {const mark=MARKS.find(m=>m.id===arg);name='removeMark';payload={accountId:mark.runner,markId:mark.id};}
  else if(action==='export') {await exportAdmin(arg);return;}
  else throw Error('该功能尚未接入小程序，当前不会修改任何云端数据。');
  await adminRequest(name,{...payload,operationId:crypto.randomUUID()});
  if(action==='sendResolve') {const ticket=TICKETS.find(t=>t.id===arg);await adminRequest('supportStatus',{accountId:ticket.user,ticketId:ticket.id,status:'resolved',operationId:crypto.randomUUID()});}
  ST.support.draft=''; drawer=null; dstack=[]; await refreshAdmin(); toast('已保存到云开发。');
}
document.addEventListener('click',event=>{
  if(adminConnection.mode!=='live')return;
  const target=event.target.closest('[data-act]');if(!target||target.disabled)return;
  const [action,...parts]=target.dataset.act.split(':'),arg=parts.join(':');
  if(navigationActions.has(action))return;
  event.preventDefault();event.stopImmediatePropagation();
  if(adminConnection.busy)return;
  adminConnection.busy=true;target.disabled=true;
  performAdminAction(action,arg,parts).catch(e=>toast(e.message)).finally(()=>{adminConnection.busy=false;target.disabled=false;});
},true);
document.addEventListener('change',event=>{
  if(adminConnection.mode!=='live')return;
  const id=event.target.id;
  if(['role','me','ops-bal','qr-file','s-file','s-link','feat-tasks'].includes(id)||/^(cfg|mem-|goal-|pu-|pua-|lk-|bg-)/.test(id)){
    event.preventDefault();event.stopImmediatePropagation();toast('此项当前只读，未修改小程序数据。');
  }
},true);
async function exportAdmin(kind) {
  const list=kind==='orders'?orderFiltered().map(o=>[o.id,TYPES[o.type],STATUS[o.status][0],Y(o.fee),fDT(o.postedAt)]):kind==='addresses'?ADDRS.map(a=>[a.id,BLD[a.bld].name,maskRoom(a.room)]):USERS.map(u=>[u.id,u.nick,maskPhone(u.phone),u.certified?'verified':'']);
  const head=kind==='orders'?['ID','Type','Status','Fee','Posted']:kind==='addresses'?['ID','Building','Room (masked)']:['ID','Name','Phone (masked)','Runner'];
  await adminRequest('export',{kind,operationId:crypto.randomUUID()});
  const cell=v=>{let s=String(v??'');if(/^[=+@\t\r-]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};
  const blob=new Blob(['\uFEFF'+[head,...list].map(row=>row.map(cell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='uniearn-'+kind+'-'+new Date().toISOString().slice(0,10)+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('已导出，联系方式已脱敏。');
}
document.documentElement.lang=LANG==='zh'?'zh-CN':'en';
