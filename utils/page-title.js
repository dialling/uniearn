// Localized navigation-bar titles + the global language toggle.
// Every page gets a bilingual title here so the top bar never stays English in
// Chinese mode (and never stays Chinese in English mode).
const store=require('./store');
const MAP={
  welcome:['欢迎','Welcome'],
  campus:['选择校区','Choose campus'],
  guide:['新手引导','Guide'],
  jobs:['接单大厅','Jobs'],
  job:['选择快递','Choose parcels'],
  requests:['我的订单','My orders'],
  request:['订单详情','Order details'],
  posted:['已发布','Posted'],
  'public-job':['任务详情','Job details'],
  create:['发布代取','Post a pick-up'],
  takeaway:['发布外卖代取','Post a pick-up'],
  'task-post':['发布任务','Post a task'],
  task:['任务详情','Task'],
  'trip-start':['发起行程','Start a trip'],
  trip:['取件与送达','Pick up & deliver'],
  join:['加入行程','Join a trip'],
  'sms-scan':['读取取件短信','Read pickup SMS'],
  'student-check':['跑手申请','Runner application'],
  admin:['管理后台','Admin'],
  earnings:['收益','Earnings'],
  rewards:['动态','News'],
  routes:['常用路线','Saved routes'],
  'route-edit':['路线详情','Route details'],
  'address':['常用配送地址','Saved addresses'],
  chat:['聊天','Chat'],
  info:['平台规则','Platform rules'],
  help:['帮助与支持','Help & support'],
  profile:['我的','Me']
};
function lang(){return store.get().language==='en'?'en':'zh';}
function keyOf(page){const route=(page&&page.route)||'';return route.split('/')[1]||'';}
function titleOf(page){
  const key=keyOf(page),entry=MAP[key];
  if(!entry)return '';
  // The saved-routes page has two modes; keep its own wording.
  if(key==='routes'&&page&&page.data&&page.data.parcel)return lang()==='en'?'Saved parcel addresses':'常用快递地址';
  // Screenshot scanning has three modes, each with its own heading.
  if(key==='sms-scan'){
    const mode=(page.data&&page.data.mode)||'';
    if(lang()==='en')return mode==='sms'?'Read pickup SMS':mode==='list'?'Read pending pickup list':'Read parcel details';
    return mode==='sms'?'读取取件短信':mode==='list'?'读取待取件列表':'读取包裹详情';
  }
  return lang()==='en'?entry[1]:entry[0];
}
function current(){return typeof getCurrentPages==='function'?(getCurrentPages().slice(-1)[0]||null):null;}
function apply(page){
  const title=titleOf(page);
  if(title&&typeof wx!=='undefined'&&wx.setNavigationBarTitle)wx.setNavigationBarTitle({title});
  return title;
}
// Re-run the page's own localization, in preference order.
function relocalize(page){
  if(!page)return false;
  for(const name of ['localize','refresh','onShow']){
    if(typeof page[name]==='function'){try{page[name]();}catch(e){console.error('relocalize',name,e);}return true;}
  }
  return false;
}
function toggle(page){require('./onboarding').toggle();apply(page);relocalize(page);}
module.exports={MAP,lang,titleOf,apply,relocalize,toggle,current};
