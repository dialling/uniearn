const store=require('../../utils/store'),account=require('../../utils/account'),meCopy=require('../../utils/me-copy');
function displayDate(value,language){if(!value||!Number.isFinite(Number(value)))return '';const p=require('../../utils/china-time').parts(value);return language==='en'?p.day+' '+['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][p.month-1]:p.month+'月'+p.day+'日';}
function dormSummary(s){
 const p=s.profile||{},routes=(s.routes||[]).filter(r=>(!r.accountId||r.accountId===p.accountId)&&r.destinationType!=='place'&&r.dorm&&r.room),address=routes.find(r=>r.default)||routes[0];
 const dorm=code=>require('../../utils/campus').buildingLabel(code,s.language==='en'?'en':'zh');
 return address?dorm(address.dorm)+' · '+address.room:p.dorm&&p.room?dorm(p.dorm)+' · '+p.room:'';
}
const AVATAR_NAMES=['star','helper','pro','ace','captain'];
function tierAvatar(level){return '/assets/yuni-adventure-'+AVATAR_NAMES[level-1]+'.png';}
function postTier(n){return n>=30?'gold':n>=10?'silver':'bronze';}
// 2026-11-15 (design/me-preview): level card with all five Yuni levels on one track, and the next gear Yuni earns.
function levelCard(tier,language){
 const en=language==='en',levels=require('../../utils/yuni-level').levels,catalog=require('../../utils/yuni-catalog'),n=tier.level,next=levels[n]||null;
 const gear=next?catalog.ITEMS.find(i=>i.level===next.level):null,name=l=>en?l.en.replace(/^Yuni /,''):l.zh.replace(/^Yuni /,'');
 return {
  levelTitle:en?tier.nameEn+', level '+n:tier.nameZh+' · 等级 '+n,
  levelSub:next?(en?(tier.remaining||0)+' more pts to reach '+name(next):'再得 '+(tier.remaining||0)+' 积分升到'+name(next)):(en?'Top level reached':'已达到最高等级'),
  levelStops:levels.map(l=>({n:l.level,name:name(l),state:l.level<n?'done':l.level===n?'now':''})),
  trackFill:Math.min(100,((n-1)+(next?(tier.progress||0)/100:0))*25),
  gearText:gear?(en?'Next gear at '+name(next)+': '+gear.en.toLowerCase():'升到'+name(next)+'可得：'+gear.zh):(en?'Yuni wears every piece of gear':'Yuni 已集齐全部装备')
 };
}
Page({
  onShareAppMessage() {return require('../../utils/share-card').shareInfo(this.data.language!=='en');},
  onShareTimeline() {return require('../../utils/share-card').shareTimeline(this.data.language!=='en');},

 data:{...require('../../utils/motion').data(),ui:meCopy('zh'),language:'zh',initial:'?',tierLevel:1,tierAvatar:tierAvatar(1),postedCount:0,deliveredCount:0,couponCount:0,unlockedCount:0,profile:{},loading:false,loggingOut:false,error:'',level:'Yuni 新星',limit:10,remaining:15,levelOpen:false,stickersOpen:false,settingsOpen:false,postedBadge:'bronze',jobsBadge:'bronze',tierName:'Yuni 新星',rankName:'Yuni 新星',nextJobsText:''},
 onLoad(o={}){this.pendingInviteCode=String(o.invite||'').trim();this.autoFeed=o.feed==='1';},
 async onShow(){if(this.pendingInviteCode){store.update(s=>{s.pendingInviteCode=this.pendingInviteCode;});this.pendingInviteCode='';return wx.reLaunch({url:'/pages/welcome/index'});}if(this.autoFeed){this.autoFeed=false;setTimeout(()=>this.feedDailyNow(),700);}this.setData({loading:true,error:''});try{this.refresh();this.refreshTier();this.ygMaybeStart();await account.call('status');await require('../../utils/orders').sync();this.refresh();this.refreshTier();/* 2026-11-21: order fish arrive with this refresh; let Yuni recount them, or Feed shows none while Me holds their points back */const stage=this.selectComponent('#yuni-stage');if(stage&&stage.sync)stage.sync();}catch(e){this.setData({error:e.message});}finally{this.setData({loading:false});}},

 refresh(){const state=store.get(),p=state.profile,language=state.language==='en'?'en':'zh',rank=require('../../utils/runner-level').level(p),yuni=require('../../utils/yuni-level').view(state.progression||{}),earn=require('../../utils/earnings').summary(state);const ui=meCopy(language),isRunner=!!p.studentVerified&&!!p.runnerRulesAccepted,stickers=require('../../utils/yuni').stickers().map(x=>({...x,name:ui[{hello:'hello',post:'firstPost',run:'onWay',chat:'sayHi',thanks:'thanks',paid:'paid'}[x.id]]})),checkedAt=Number((p.verification||{}).checkedAt),verifiedDate=displayDate(checkedAt,language),postedCount=state.requests.filter(r=>r.isMine).length,tierName=language==='en'?yuni.nameEn:yuni.nameZh,nextTier=yuni.next?(language==='en'?yuni.next.nameEn:yuni.next.nameZh):tierName;this.setData({...earn,ui,isRunner,soundOn:state.yuniSounds!==false,badgeText:isRunner?'✓ '+ui.verified+(verifiedDate?' '+verifiedDate:''):ui.check,tierLevel:yuni.level,tierAvatar:tierAvatar(yuni.level),version:'0.9.20',verifiedDate,publicName:(p.name||'').trim().split(/\s+/).map((n,i)=>i?n.slice(0,1).toUpperCase():n).join(' '),unlockedCount:stickers.filter(x=>x.unlocked).length,stickerHint:(()=>{const chosen=stickers.find(x=>x.id===this.data.selectedStickerId);if(!chosen)return ui.tapSticker;const how={hello:language==='en'?'Sign in to Uniearn.':'登录 Uniearn。',post:language==='en'?'Post your first order or task.':'发布你的第一个订单或任务。',run:language==='en'?'Take your first job as a runner.':'以跑手身份接取第一单。',chat:language==='en'?'Send a message to your runner or requester.':'给跑手或发布人发送消息。',thanks:language==='en'?'Confirm an order is done.':'确认一笔订单已完成。',paid:language==='en'?'Complete a job and have it confirmed.':'完成一单并获得确认。'};return(chosen.unlocked?(language==='en'?'Unlocked. ':'已解锁。'):(language==='en'?'Locked. ':'尚未解锁。'))+how[chosen.id];})(),deliveredCount:state.requests.filter(r=>r.isMine&&['delivered','confirmed'].includes(r.status)).length,postedCount,levelSteps:[{name:ui.tierNew,description:ui.newLimit,progress:Math.min(100,(p.jobsDone||0)/10*100),active:rank.name==='New'},{name:ui.tierTrusted,description:ui.trustedLimit,progress:rank.name==='New'?0:Math.min(100,Math.max(0,((p.jobsDone||0)-10)/30*100)),active:rank.name==='Trusted'},{name:ui.tierTop,description:ui.topLimit,progress:rank.name==='Top'?100:0,active:rank.name==='Top'}],levelMessage:rank.name==='Top'?ui.levelDone:(language==='en'?rank.remaining+' more jobs. ':'还需 '+rank.remaining+' 单。')+ui.levelNext,markDetails:rank.marks.map((m,i)=>({key:String(i),reason:m.reason||'Mark',expires:displayDate(m.at+14*86400000,language)})),language,languageIndex:language==='en'?1:0,languageOptions:['中文','English'],deliverySummary:dormSummary(state),couponCount:((state.rewards||{}).coupons||[]).filter(c=>!c.usedBy&&(!c.expiresAt||c.expiresAt>Date.now())&&c.usable!==false).length,initial:(p.name||'?').slice(0,1).toUpperCase(),progress:yuni.progress,preferences:state.preferences||{},tips:state.yuniTips!==false,postedBadge:postTier(postedCount),jobsBadge:yuni.level===1?'bronze':yuni.level===2?'silver':yuni.level===3?'gold':yuni.level===4?'platinum':'diamond',tierName,rankName:tierName,nextJobsText:language==='en'?'Complete one more order to level up':'再完成一单升级',stickers,profile:p,limit:rank.limit===Infinity?'No limit':rank.limit,remaining:rank.remaining,level:tierName,activeMarks:rank.marks.length});},
 // 2026-11-15 (design/me-preview): Yuni sounds switch.
 // Yuni's points changed (fed a fish, bought an item, test points): redraw the level card and points pill.
 yuniChanged(){this.refresh();this.refreshTier();},
 // ── Yuni guide: shown once per account the first time, and again from Me › Yuni › Yuni guide ──
 ygMaybeStart(){
  const s=store.get(),p=s.profile||{},id=p.accountId||'local';
  if(this.data.yg>=0||!p.onboarded||p.loggedOut)return;
  const replay=s.yuniGuideReplay,seen=(s.yuniGuideDoneFor||[]).includes(id),appGuideDone=(s.guideDoneFor||[]).includes(id);
  if(!replay){
   // Optional: Yuni mentions the tour once, the first time, instead of starting it.
   if(!seen&&appGuideDone){store.update(x=>{x.yuniGuideDoneFor=(x.yuniGuideDoneFor||[]).filter(v=>v!==id).concat(id).slice(-20);});const stage=this.selectComponent('#yuni-stage');if(stage&&stage.say)setTimeout(()=>stage.say(this.data.language==='en'?'Hi! My quick tour is in Settings › Yuni.':'嗨！我的新手引导在「设置 › Yuni」里。',3200),1200);}
   return;
  }
  store.update(x=>{x.yuniGuideReplay=false;});
  clearTimeout(this.ygTimer);this.ygTimer=setTimeout(()=>{if(require('../../utils/checkin').pending()&&!replay){this.ygTimer=setTimeout(()=>this.ygMaybeStart(),4000);return;}this.ygStart();},900);
 },
 ygStart(){if(wx.pageScrollTo)wx.pageScrollTo({scrollTop:0,duration:0});const n=require('../../utils/yuni-guide').count;this.setData({yg:0,ygDir:'next',ygFocus:null,ygLast:n-1,ygDots:Array.from({length:n},(_,i)=>i)});this.ygShow(0);},
 ygNext(){const step=this.data.yg+1;if(step>this.data.ygLast)return this.ygFinish();this.setData({yg:step,ygDir:'next'});this.ygShow(step);},
 ygBack(){const step=Math.max(0,this.data.yg-1);this.setData({yg:step,ygDir:'back'});this.ygShow(step);},
 ygFinish(){clearTimeout(this.ygTimer);store.update(x=>{const id=x.profile.accountId||'local';x.yuniGuideDoneFor=(x.yuniGuideDoneFor||[]).filter(v=>v!==id).concat(id).slice(-20);});this.setData({yg:-1,ygFocus:null});},
 ygShow(step){
  const item=require('../../utils/yuni-guide').steps(this.data.language)[step];if(!item)return;
  this.setData({ygItem:item});
  if(!item.target)return this.setData({ygFocus:null,ygBottom:false});
  const split=item.target.split(' >>> '),comp=split.length>1?this.selectComponent(split[0]):null,q=comp?comp.createSelectorQuery():wx.createSelectorQuery();
  q.select(comp?split[1]:item.target).boundingClientRect(rect=>{
   if(this.data.yg!==step)return;if(!rect)return this.setData({ygFocus:null});
   const pad=6,w=rect.width+pad*2,h=rect.height+pad*2,round=/ysYuni/.test(item.target);
   // the card moves to the top when the highlighted item sits low on the screen, so it never covers it
   const vh=(wx.getSystemInfoSync&&wx.getSystemInfoSync().windowHeight)||700;
   this.setData({ygBottom:rect.top+rect.height/2>vh*.42,ygFocus:{top:rect.top-pad,left:rect.left-pad,width:w,height:h,radius:round?Math.max(w,h)/2:18}});
  }).exec();
 },
 // 2026-11-18: arriving with ?feed=1 (Levels page Feed Yuni): scroll to Yuni and feed today's dried fish there.
 feedDailyNow(){if(typeof wx!=='undefined'&&wx.pageScrollTo)wx.pageScrollTo({scrollTop:0,duration:200});const stage=this.selectComponent('#yuni-stage');if(stage&&stage.data.dailyFish)setTimeout(()=>stage.feed(),450);},
 soundToggle(e){const on=!!e.detail.value;store.update(s=>{s.yuniSounds=on;});this.setData({soundOn:on});if(on)require('../../utils/yuni-sound').coin();},
 refreshTier(){
  const state=store.get(),language=state.language==='en'?'en':'zh',tier=require('../../utils/yuni-level').view(require('../../utils/order-fish').shownProgression(state)),name=x=>x?(language==='en'?x.nameEn:x.nameZh):'';
  const start=name(tier),end=name(tier.next);
  const message=language==='en'?'Complete one more order to level up':'再完成一单升级';
  this.setData({tierLevel:tier.level,tierAvatar:tierAvatar(tier.level),level:name(tier),tierName:name(tier),rankName:name(tier),points:tier.points,progress:tier.progress,remaining:tier.remaining,levelStartName:start,levelEndName:end,levelMessage:message,nextJobsText:message,...levelCard(tier,language)});
  this.setData({walletBalance:(Number((store.get().walletSummary||{}).balance_cents||0)/100).toFixed(2)});
  // 右上角的数字改成「可用积分」= 累计 − 已花（买鱼竿/装备），等级页仍看累计。
  const progPts=Number((store.get().progression||{}).points)||0;
  const spent=Number((store.get().yuniPlay||{}).spent)||0;
  this.setData({availablePoints:Math.max(0,progPts-spent)});
  // 合并模式：钱包数据在服务端，walletSummary 不会自己出现，进页面时拉一次
  if(require('../../utils/merge-mode').enabled&&(()=>{try{return !!require('../../utils/util').getToken();}catch(_){return false;}})()&&store.get().profile.accountId&&!store.get().profile.loggedOut){
    require('../../utils/wallet').overview().then(v=>{
      store.update(s=>{s.walletSummary={balance_cents:v.balance_cents||0,pending_cents:v.pending_cents||0};});
      this.setData({walletBalance:(Number(v.balance_cents||0)/100).toFixed(2),earnWaitingNum:Number(v.pending_cents||0),earnWaiting:(Number(v.pending_cents||0)/100).toFixed(2)});
    }).catch(()=>{});
  }
 },
 firstStat(){this.data.isRunner?this.ranJobs():this.past();},ranJobs(){require('../../utils/nav').navigateTo({url:'/pages/requests/index?tab=running'});},runnerRules(){require('../../utils/nav').navigateTo({url:'/pages/info/index?topic=runnerRules'});},askYuni(){const assistant=this.selectComponent('#me-yuni');if(assistant)assistant.openHelp();},
 changeLanguage(e){const language=Number(e.detail.value)===1?'en':'zh';store.update(s=>{s.language=language;});this.refresh();this.refreshTier();require('../../utils/page-title').apply(this);},coupons(){require('../../utils/nav').navigateTo({url:'/pages/coupons/index'});},inviteFriends(){require('../../utils/nav').navigateTo({url:'/pages/invite/index'});},notifyGuide(){require('../../utils/nav').navigateTo({url:'/pages/notify-guide/index'});},campus(){require('../../utils/nav').navigateTo({url:'/pages/campus/index'});},yuni(){require('../../utils/nav').navigateTo({url:'/pages/yuni/index'});},guide(){wx.reLaunch({url:'/pages/jobs/index?guide=1'});},rewards(){require('../../utils/nav').navigateTo({url:'/pages/rewards/index'});},tipToggle(e){store.update(s=>{s.yuniTips=e.detail.value;});this.refresh();this.refreshTier();},sticker(e){const item=this.data.stickers.find(x=>x.id===e.currentTarget.dataset.id);if(item){this.setData({selectedStickerId:item.id});this.refresh();this.refreshTier();}},login(){wx.reLaunch({url:'/pages/welcome/index'});},
 toggleLevel(){this.setData({levelOpen:!this.data.levelOpen});},toggleStickers(){this.setData({stickersOpen:!this.data.stickersOpen});},toggleSettings(){this.setData({settingsOpen:!this.data.settingsOpen});},myOrders(){require('../../utils/nav').navigateTo({url:'/pages/requests/index?tab=requested&filter=all'});},
 earnings(){require('../../utils/nav').navigateTo({url:'/pages/earnings/index'});},levels(){require('../../utils/nav').navigateTo({url:'/pages/levels/index'});},routes(){require('../../utils/nav').navigateTo({url:'/pages/routes/index'});},past(){require('../../utils/nav').navigateTo({url:'/pages/requests/index'});},info(e){const t=e.currentTarget.dataset.topic,url=t==='support'?'/pages/help/index':t==='privacy'?'/pages/terms/index?id=privacy':'/pages/info/index?topic='+t;require('../../utils/nav').navigateTo({url});},async preference(e){try{await require('../../utils/orders').act('preferences',{values:{[e.currentTarget.dataset.key]:e.detail.value}});this.refresh();this.refreshTier();}catch(e){wx.showToast({title:e.message,icon:'none'});}},async interest(){try{await require('../../utils/orders').act('preferences',{values:{skillsInterested:true}});this.refresh();this.refreshTier();}catch(e){wx.showToast({title:e.message,icon:'none'});}},dormDetails(){require('../../utils/nav').navigateTo({url:'/pages/address/index'});},
 wallet(){require('../../utils/nav').navigateTo({url:'/pages/wallet/index'});},
 async logout(){
  if(this.data.loggingOut||this.data.loading)return;
  this.setData({loggingOut:true,error:''});
  try{
   const confirmed=await new Promise((resolve,reject)=>wx.showModal({
    title:'Log out?',content:'Are you sure you want to log out? You can sign in again with WeChat or student verification.',
    confirmText:'Log out',cancelText:'Cancel',success:r=>resolve(!!r.confirm),fail:reject
   }));
   if(!confirmed)return;
   await account.call('logout');this.refresh();
  }catch(e){this.setData({error:e.message||'Could not log out. Please try again.'});}
  finally{this.setData({loggingOut:false});}
 },
 profileEntry(){if(this.data.isRunner)this.editUsername();else this.studentCheck();},
 editUsername(){
  const profile=store.get().profile;
  if(profile.onboarded&&!profile.loggedOut)require('../../utils/nav').navigateTo({url:'/pages/profile-name/index'});
 },
 noop(){},
 studentCheck(){require('../../utils/nav').navigateTo({url:'/pages/student-check/index'});},admin(){require('../../utils/nav').navigateTo({url:'/pages/admin/index'});},
 reset(){wx.showModal({title:'Clear this device cache?',content:'Cloud orders and your profile stay saved. Check My requests first if a previous action had a network error.',success:r=>{if(r.confirm){const profile=store.get().profile;store.reset();store.update(s=>{s.profile=profile;});this.refresh();require('../../utils/orders').sync().catch(()=>{});}}});}
});
