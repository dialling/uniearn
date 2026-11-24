// Reporting uses a strict projection: operational personal data never enters this response.
const DAY=86400000,VERSION='2026.10.22-a1';
const STATIONS={'North gate':'北门','South gate':'南门','East gate':'东门','Parcel station':'快递站','Wenyuan Cainiao station':'文缘菜鸟驿站','Wenyuan takeaway locker':'文缘外卖柜','Hanlin Mama station':'翰林妈妈驿站','North gate Cainiao station':'北门菜鸟驿站','East gate JD point':'东门京东快递点',Task:'其他任务'};
const stationCode=v=>'p-'+require('crypto').createHash('sha256').update(String(v||'')).digest('hex').slice(0,10);
const NAMES=['app_open','page_view','form_start','submit_attempt','action_result','upload_result','ocr_result','ocr_edit','campaign_view','news_view'];
const ACTIONS=['create','accept','acceptBoxes','startTrip','pickup','deliver','confirm','cancel','runnerCancel','taskDone','collectCoupon','sessionLogin','saveProfile','apply','selectCampus','agreeRules'];
const PAGES=['welcome','campus','jobs','requests','create','takeaway','task-post','student-check','sms-scan','rewards','profile','request','trip','task','job','public-job','join','coupon-pick','guide','help','support-chat','info','terms','other'];
const safeError=m=>Object.assign(new Error(m),{safe:true});
const slug=v=>typeof v==='string'&&/^[a-zA-Z0-9_.-]{1,64}$/.test(v)?v:'';
function sanitize(raw,now){
 if(!raw||!NAMES.includes(raw.name)||!slug(raw.id)||!slug(raw.session))return null;
 const p=raw.props||{},out={id:raw.id,session:raw.session,name:raw.name,at:now};
 if(['action_result','submit_attempt'].includes(raw.name)&&!ACTIONS.includes(p.action))return null;
 // Only bounded times are accepted; untrusted device clocks cannot create historic cohorts.
 if(Number.isFinite(raw.at)&&Math.abs(raw.at-now)<600000)out.at=raw.at;
 if(PAGES.includes(p.page))out.page=p.page;
 if(ACTIONS.includes(p.action))out.action=p.action;
 if(['ok','business','network','unknown'].includes(p.result))out.result=p.result;
 if(['parcel','takeout','task'].includes(p.category))out.category=p.category;
 if(['direct','share','invite','qr','other'].includes(p.source))out.source=p.source;
 if(['develop','trial','release'].includes(p.environment))out.environment=p.environment;
 if(p.version===VERSION)out.version=VERSION;
 if(['campaign_view','news_view'].includes(raw.name)&&slug(p.contentId))out.contentId=p.contentId;
 if(Number.isFinite(p.duration)&&p.duration>=0&&p.duration<=300000)out.duration=Math.round(p.duration);
 if(raw.name==='ocr_result'&&typeof p.needsReview==='boolean')out.needsReview=p.needsReview;
 return out;
}
const klass=a=>['live','test'].includes(a?.analyticsClass)?a.analyticsClass:'unclassified';
const inRange=(t,s,e)=>Number.isFinite(t)&&t>=s&&t<e;
const unique=list=>new Set(list.filter(Boolean)).size;
function duration(rows,a,b){const values=rows.filter(r=>r[a]&&r[b]&&r[b]>=r[a]).map(r=>(r[b]-r[a])/60000).sort((a,b)=>a-b);return {n:values.length,median:values.length?values[Math.floor((values.length-1)*.5)]:null,p90:values.length?values[Math.ceil(values.length*.9)-1]:null};}
function range(input,now){
 const end=input.end?Date.parse(input.end+'T00:00:00+08:00')+DAY:Math.floor((now+28800000)/DAY)*DAY-28800000+DAY;
 const start=input.start?Date.parse(input.start+'T00:00:00+08:00'):end-(Number(input.days)===7?7:30)*DAY;
 if(!Number.isFinite(start)||!Number.isFinite(end)||start>=end||end-start>90*DAY||end>now+DAY)throw safeError('请选择有效日期，单次最多 90 天。');
 return {start,end,previousStart:start-(end-start),now};
}
function report({orders=[],accounts=[],days=[],state={},partial={},input={},now=Date.now()}){
 const period=range(input,now),{start,end,previousStart}=period,am=new Map(accounts.map(a=>[a._id,a]));
 orders=orders.map(r=>({...r,analytics:{...r.analytics,stationCode:r.analytics?.stationCode||stationCode(r.station)}}));
 const scope=['live','test','unclassified','all'].includes(input.scope)?input.scope:'live';
 const accountClass=id=>klass(am.get(id));
 const dataClass=(id,runner)=>accountClass(id)==='test'||runner&&accountClass(runner)==='test'?'test':accountClass(id);
 const classMatch=(id,runner)=>scope==='all'||dataClass(id,runner)===scope;
 const dedup=new Map();for(const r of orders){const key=r.id+'-'+r.createdAt;if(!dedup.has(key))dedup.set(key,r);}
 const rows=[...dedup.values()].filter(r=>classMatch(r.ownerId,r.analyticsRunnerId)&&(!input.category||r.category===input.category)&&(!input.station||r.analytics?.stationCode===input.station)&&(!input.campus||r.campusId===input.campus)&&(!input.version||r.analytics?.version===input.version)&&(!input.source||(r.analytics?.source||'other')===input.source));
 const events=days.flatMap(d=>(d.events||[]).map(e=>({...e,actor:d.actor,campus:d.campus}))).filter(e=>classMatch(e.actor)&&(!input.campus||e.campus===input.campus)&&(!input.version||e.version===input.version)&&(!input.source||e.source===input.source));
 // An order category/station cannot be inferred for unrelated page views. Show unavailable instead.
 const behaviorScoped=!input.category&&!input.station;
 const current=rows.filter(r=>inRange(r.createdAt,start,end)),previous=rows.filter(r=>inRange(r.createdAt,previousStart,start));
 const ev=events.filter(e=>inRange(e.at,start,end)),pe=events.filter(e=>inRange(e.at,previousStart,start));
 const summary=(list,es)=>({orders:list.length,completed:list.filter(r=>r.status==='confirmed').length,cancelled:list.filter(r=>['cancelled','refunded'].includes(r.status)).length,completionRate:list.length?list.filter(r=>r.status==='confirmed').length/list.length:null,activeUsers:behaviorScoped&&es.length?unique(es.map(e=>e.actor)):null});
 const versions=[...new Set(current.map(r=>r.analytics?.version||'未记录'))].map(version=>{const list=current.filter(r=>(r.analytics?.version||'未记录')===version);return {version,...summary(list,ev.filter(e=>e.version===version)),wait:duration(list.filter(r=>!r.cancellation),'createdAt','takenAt')};});
 const submitted=new Map();for(const e of ev)if(e.name==='action_result'&&e.action==='apply'&&e.result==='ok')submitted.set(e.actor,Math.min(submitted.get(e.actor)||Infinity,e.at));
 const approved=[...submitted].filter(([id,at])=>am.get(id)?.verification?.status==='verified'&&am.get(id).verification.checkedAt>=at);
 const certificationOutcomes=behaviorScoped&&ev.length?{submitted:submitted.size,approved:approved.length,runnerReady:approved.filter(([id,at])=>am.get(id)?.runnerRulesAcceptedAt>=at).length}:null;
 const sessions=new Map();for(const e of ev){const key=e.actor+':'+e.session;if(!sessions.has(key))sessions.set(key,[]);sessions.get(key).push(e);}for(const a of sessions.values())a.sort((a,b)=>a.at-b.at);
 function funnel(steps){if(!behaviorScoped||!ev.length)return {steps:steps.map(([key,label])=>({key,label,count:null})),sample:0};let base=[...sessions.values()];const values=[];for(const [key,label,predicate]of steps){base=base.filter(es=>{const i=es.findIndex(predicate);if(i<0)return false;es._cursor=i;return true;}).map(es=>es.slice(es._cursor));values.push({key,label,count:base.length});}return {steps:values,sample:sessions.size};}
 const funnels={posting:funnel([['view','打开发单页',e=>e.name==='page_view'&&['create','takeaway','task-post'].includes(e.page)],['fill','开始填写',e=>e.name==='form_start'],['submit','点击提交',e=>e.name==='submit_attempt'&&e.action==='create'],['ok','客户端收到成功',e=>e.name==='action_result'&&e.action==='create'&&e.result==='ok']]),registration:funnel([['view','打开登录页',e=>e.name==='page_view'&&e.page==='welcome'],['ok','完成登录',e=>e.name==='action_result'&&e.action==='sessionLogin'&&e.result==='ok']]),certification:funnel([['view','打开认证页',e=>e.name==='page_view'&&e.page==='student-check'],['submit','提交申请成功',e=>e.name==='action_result'&&e.action==='apply'&&e.result==='ok']])};
 const errors=new Map();for(const e of ev.filter(e=>['action_result','upload_result','ocr_result'].includes(e.name))){const key=e.name+':'+(e.action||e.page||'other'),v=errors.get(key)||{key,action:e.action||e.name,attempts:0,failed:0,actors:new Set(),durations:[]};v.attempts++;if(e.result!=='ok'){v.failed++;v.actors.add(e.actor);}if(e.duration!=null)v.durations.push(e.duration);errors.set(key,v);}
 const errorRows=[...errors.values()].map(({actors,durations,...v})=>({...v,affectedUsers:actors.size,failureRate:v.attempts?v.failed/v.attempts:null,meanMs:durations.length?Math.round(durations.reduce((a,b)=>a+b,0)/durations.length):null}));
 function retention(role,window){
  const acts=rows.flatMap(r=>role==='customer'?(r.status==='confirmed'?[{id:r.ownerId,at:r.confirmedAt}]:[]):(r.analyticsRunnerId&&r.deliveredAt?[{id:r.analyticsRunnerId,at:r.deliveredAt}]:[]));
  const groups=new Map();for(const a of acts)if(a.id&&Number.isFinite(a.at)){if(!groups.has(a.id))groups.set(a.id,[]);groups.get(a.id).push(a.at);}
  let eligible=0,repeated=0;for(const times of groups.values()){times.sort((a,b)=>a-b);const first=times[0];if(!inRange(first,start,end)||first+(window+1)*DAY>now)continue;eligible++;if(times.some(t=>t>=first+DAY&&t<first+(window+1)*DAY))repeated++;}
  return {role,window,eligible,repeated,rate:eligible?repeated/eligible:null};
 }
 const activityRetention=[7,30].map(window=>{const first=new Map(),seen=new Map();for(const e of events){if(!['app_open','page_view'].includes(e.name))continue;first.set(e.actor,Math.min(first.get(e.actor)||Infinity,e.at));if(!seen.has(e.actor))seen.set(e.actor,[]);seen.get(e.actor).push(e.at);}let eligible=0,returned=0;for(const[id,at]of first){if(!inRange(at,start,end)||at+(window+1)*DAY>now)continue;eligible++;if(seen.get(id).some(t=>t>=at+window*DAY&&t<at+(window+1)*DAY))returned++;}return {window,eligible,returned,rate:eligible?returned/eligible:null};});
 const campaignMap=new Map();const camp=id=>{if(!campaignMap.has(id))campaignMap.set(id,{id,viewers:new Set(),claimants:new Set(),usedOrders:0,completed:0,repeatUsers:0});return campaignMap.get(id);};
 for(const e of ev)if(e.name==='campaign_view'&&e.contentId)camp(e.contentId).viewers.add(e.actor);
 for(const [id,m]of Object.entries(state.members||{}))if(classMatch(id))for(const c of m.coupons||[])if(inRange(c.issuedAt,start,end)&&c.campaignId)camp(c.campaignId).claimants.add(id);
 for(const r of current)if(r.couponCampaignId){const c=camp(r.couponCampaignId);c.usedOrders++;if(r.status==='confirmed')c.completed++;}
 for(const c of campaignMap.values()){const customers=new Set(current.filter(r=>r.couponCampaignId===c.id&&r.status==='confirmed').map(r=>r.ownerId));for(const id of customers)if(current.filter(r=>r.ownerId===id&&r.status==='confirmed').length>=2)c.repeatUsers++;}
 const campaigns=[...campaignMap.values()].map(c=>({...c,viewers:behaviorScoped&&ev.length?c.viewers.size:null,claimants:(!input.category&&!input.station&&!input.version&&!input.source&&!input.campus)?c.claimants.size:null}));
 const news=[...new Set(ev.filter(e=>e.name==='news_view').map(e=>e.contentId))].map(id=>({id,viewers:unique(ev.filter(e=>e.name==='news_view'&&e.contentId===id).map(e=>e.actor))}));
 const feedback=Object.entries(state.members||{}).flatMap(([id,m])=>classMatch(id)?(m.supportTickets||[]).filter(t=>inRange(t.createdAt,start,end)&&(!input.version||t.tracking?.version===input.version)&&(!input.campus||am.get(id)?.profile?.campusId===input.campus)).map(t=>({id:t.id,category:t.tracking?.category||t.topic||'other',status:t.status,owner:t.tracking?.owner||'',version:t.tracking?.version||'',orderId:t.tracking?.orderId||'',hasRootCause:!!t.tracking?.rootCause,resolvedAt:t.tracking?.resolvedAt||null,verification:t.tracking?.verification||'pending'})):[]);
 const reasons={};for(const r of current){const reason=r.cancellation?.reason||(r.status==='refunded'&&r.closesAt&&r.refundedAt>=r.closesAt?'no_runner_timeout':['cancelled','refunded'].includes(r.status)?'other_or_unrecorded':'');if(reason)reasons[reason]=(reasons[reason]||0)+1;}
 const segments=[...new Set(current.map(r=>r.category))].map(category=>{const a=current.filter(r=>r.category===category);return {category,...summary(a,[]),wait:duration(a.filter(r=>!r.cancellation),'createdAt','takenAt')};});
 const hourly=Array.from({length:24},(_,hour)=>({hour,orders:current.filter(r=>new Date(r.createdAt+28800000).getUTCHours()===hour).length}));
 const timeline=Array.from({length:Math.round((end-start)/DAY)},(_,i)=>{const t=start+i*DAY;const rs=current.filter(r=>inRange(r.createdAt,t,t+DAY));return {day:new Date(t+28800000).toISOString().slice(0,10),orders:rs.length,completed:rs.filter(r=>r.status==='confirmed').length};});
 const detail=current.map(r=>({id:r.id,category:r.category,status:r.status,stationCode:slug(r.analytics?.stationCode)||'unmapped',createdAt:r.createdAt,takenAt:r.takenAt||null,deliveredAt:r.deliveredAt||null,confirmedAt:r.confirmedAt||null,class:dataClass(r.ownerId,r.analyticsRunnerId),campus:slug(r.campusId),version:r.analytics?.version||'未记录',source:r.analytics?.source||'未记录',autoConfirmed:!!r.autoConfirmed,waitMinutes:r.takenAt>=r.createdAt&&!r.cancellation?(r.takenAt-r.createdAt)/60000:null,campaign:slug(r.couponCampaignId)||''}));
 return {ok:true,period,scope,current:summary(current,ev),previous:summary(previous,pe),versions,certificationOutcomes,funnels,fulfillment:{wait:duration(current.filter(r=>!r.cancellation),'createdAt','takenAt'),delivery:duration(current,'takenAt','deliveredAt'),confirmation:duration(current,'deliveredAt','confirmedAt'),total:duration(current,'createdAt','confirmedAt'),reasons,segments,hourly,autoConfirmed:current.filter(r=>r.autoConfirmed).length},errors:behaviorScoped?errorRows:[],ocr:{results:ev.filter(e=>e.name==='ocr_result').length,reviewNeeded:ev.filter(e=>e.name==='ocr_result'&&e.needsReview).length,edits:ev.filter(e=>e.name==='ocr_edit').length},retention:{activity:behaviorScoped?activityRetention:[],repeat:['customer','runner'].flatMap(role=>[7,30].map(w=>retention(role,w)))},campaigns,news,feedback:!input.category&&!input.station&&!input.source?feedback:[],timeline,detail,coverage:{events:ev.length,eventDays:days.length,firstEvent:ev.length?Math.min(...ev.map(e=>e.at)):null,behaviorScoped,partial,unclassified:orders.filter(r=>accountClass(r.ownerId)==='unclassified').length,tests:orders.filter(r=>accountClass(r.ownerId)==='test'||accountClass(r.analyticsRunnerId)==='test').length,ordersRead:orders.length,accountsRead:accounts.length,cappedDays:days.filter(d=>d.capped).length,historyComplete:false},options:{versions:[...new Set(rows.map(r=>r.analytics?.version).concat(events.map(e=>e.version)).filter(Boolean))],stations:[...new Set(orders.map(r=>r.analytics?.stationCode).filter(Boolean))]},definitions:{cohort:'订单按创建日期入组，完成率随履约更新；环比为紧邻的等长周期。本期含今天时尚未结束，与完整上期比较仅供参考。',retention:'回访按采集窗口内首次观察活跃起算；复用按窗口内首次观察完成/送达起算，非终身首次。',privacy:'分析不含姓名、手机号、学号、取件码、精确地址、聊天或截图。',payment:'未连接真实支付，订单标价不计入收入。'}};
}
module.exports={VERSION,NAMES,ACTIONS,PAGES,sanitize,range,report,klass,DAY,STATIONS,stationCode};
