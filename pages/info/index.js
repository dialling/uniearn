const store=require('../../utils/store'),ruleData=require('../../utils/rules-data');
function labels(zh){return{title:zh?'平台规则':'Platform rules',version:zh?'版本 1.0':'Version 1.0',agreed:zh?'你已同意':'you agreed',read:zh?'请阅读':'please read',deletion:zh?'申请删除账户和数据':'Delete my account and data',fullTerms:zh?'查看完整隐私政策':'Full privacy policy'};}
const zhRules={students:{intro:'每位同学发布前需要同意的规则，尽量写得简短。',rules:[{n:'1',title:'通过 Uniearn 支付',text:'本次团队测试只记录模拟支付，确认后的订单在测试账本中结算。所有订单送达后进入待入账，用户确认后立即入账，未确认的在送达 2 小时后自动入账。未接入真实的微信支付扣款或转账。'},{n:'2',title:'跑手接单前可免费取消',text:'跑手接单后，请先给对方发消息，不要直接取消。'},{n:'3',title:'用自己的手机号下单',text:'在美团或饿了么下单时请使用同一个手机号。跑手会核对外卖袋上的手机尾号后 4 位，确保拿对。'},{n:'4',title:'10 分钟内回复跑手',text:'跑手接单后请留意消息。如果对方进不了你的楼，而你 10 分钟内没有回复，外卖会放在大堂，并视为已送达。'},{n:'5',title:'在订单中反馈问题并附照片',text:'所有订单均可在送达后 2 小时内在订单中反馈问题。洒漏或损坏请附照片。反馈后赏金冻结，由团队在 24 小时内处理；处理完成前赏金一直冻结。外卖变凉不属于可反馈的原因。'}]},runners:{intro:'每位跑手注册时需要同意的规则。违反一条会记一次警告。警告 2 周后失效，不扣钱；但同时有 3 次有效警告会降回新手，有 5 次会暂停接单 7 天。等级：新手（每趟最多 ¥10）；完成 10 单后升为可信（最多 ¥25）；完成 40 单且没有有效警告后升为顶级（不设上限）。每趟最多 5 袋。',rules:[{n:'1',title:'保护个人信息',text:'姓名、房间号、手机号和取件码只用于本单，切勿保存或分享。'},{n:'2',title:'核对每个外卖袋上的手机号',text:'如果拿错了外卖，需要从你的收益中赔付餐费和配送费。'},{n:'3',title:'检查封签',text:'取餐前发现封签破损请先反馈，并在送达照片中拍到封签。'},{n:'4',title:'其他任务：完成后提交说明（照片选填）',text:'任务完成后填写简短说明，可选附上一张照片，方便同学确认。'},{n:'5',title:'尽早取消，或说明原因',text:'在外卖送达前不到 15 分钟取消会记一次警告。找不到外卖或外卖袋信息不符时可取消，不记警告；找不到外卖无需等待即可反馈。'}]},privacy:{intro:'我们保存哪些信息，以及谁能看到。',rules:[{n:'1',title:'我们保存的信息',text:'你的账户名、手机号、订单，以及接单时的学生认证结果。申请跑手时可通过微信手机号快速验证获取号码，号码由微信提供，只用于 UniEarn 服务；手动填写的号码由管理员人工核对。保存的常用路线只存放在本设备上。'},{n:'2',title:'谁能看到你的房间号和手机号',text:'接单大厅显示宿舍区和楼栋，但不显示房间号；只有订单发布人和接单后的跑手能在订单详情中看到房间号、联系方式、取件码和照片。此版本使用直接拨打电话，双方可以看到真实手机号，暂未接入隐私号。'},{n:'3',title:'送达照片',text:'只有你、你的跑手和 Uniearn 管理团队可以查看。'},{n:'4',title:'公开接单大厅',text:'显示取件信息、寝室性别、外卖柜、宿舍区、楼栋、赏金和时间；不公开房间号、姓名、手机号或取件码。'}]}};
function tabs(zh){return[{id:'students',label:zh?'发布人':'Requesters'},{id:'runners',label:zh?'跑手':'Runners'},{id:'privacy',label:zh?'隐私':'Privacy'}];}
Page({data:{...require('../../utils/motion').data(),tab:'students',tabs:tabs(false),rules:ruleData.students,labels:labels(false),agreement:'',deleting:false},onLoad(o={}){if(o.topic==='support'){wx.redirectTo({url:'/pages/help/index'});return;}const tab=o.topic==='privacy'?'privacy':o.topic==='runnerRules'||o.topic==='runners'?'runners':'students';this.localize();this.showTab(tab);},onShow(){this.localize();this.showTab(this.data.tab);},localize(){const state=store.get(),zh=state.language!=='en',ui=labels(zh);this.zh=zh;this.setData({labels:ui,tabs:tabs(zh),agreement:state.profile.runnerRulesAccepted?ui.agreed:ui.read});},showTab(tab){if(!['students','runners','privacy'].includes(tab))return;this.setData({tab,rules:(this.zh?zhRules:ruleData)[tab]});},choose(e){this.showTab(e.currentTarget.dataset.tab);},fullTerms(){require('../../utils/nav').navigateTo({url:'/pages/terms/index?id=privacy'});},deletion(){this.deleteAccount();},
 async deleteAccount(){
  if(this.data.deleting)return;
  const orders=require('../../utils/orders'),ui=require('../../utils/ui');
  const zh=this.zh!==false,state=store.get();
  if(!state.profile.onboarded||state.profile.loggedOut)return ui.toast(new Error(zh?'请先登录，再删除账户':'Sign in before deleting your account'));
  if(!await ui.confirm(zh?'删除账户和数据？':'Delete your account and data?',zh?'删除后，姓名、手机号、房间号、取件码、照片、聊天记录和积分都会从服务器清除，无法恢复。':'Your name, phone, room, pickup codes, photos, chats and points are erased from the server. This cannot be undone.'))return;
  if(!await ui.confirm(zh?'最后确认':'Last confirmation',zh?'订单金额和状态会保留在对方的记录里，但所有能识别出你的信息都会被清空。确定继续？':'Order amounts and status stay in the other student’s history, but everything that identifies you is wiped. Continue?'))return;
  this.setData({deleting:true});
  try{
   await this.runDeletion(orders,ui,zh,false);
  }catch(e){
   const msg=String(e&&e.message||'');
   if(/Unknown action/i.test(msg))ui.toast(new Error(zh?'云端函数版本过旧：请重新部署 cloudfunctions/orderService 后再试':'The cloud function is outdated: redeploy cloudfunctions/orderService and try again'));
   else if(/进行中的订单|active orders/i.test(msg)){
    if(!await ui.confirm(zh?'还有进行中的订单':'Open orders remain',zh?'要先把这些订单全部关闭（含已接单、已取件的），然后再删除账户吗？':'Close them all first (including accepted or picked-up orders), then delete the account?'))return;
    try{await this.runDeletion(orders,ui,zh,true);}catch(e2){ui.toast(new Error(String(e2&&e2.message||e2)||(zh?'删除失败，请重试':'Deletion failed, please try again')));}
   }
   else ui.toast(new Error(msg||(zh?'删除失败，请重试':'Deletion failed, please try again')));
  }
  finally{this.setData({deleting:false});}
 },
 async runDeletion(orders,ui,zh,closeOrders){
  const result=await orders.act('deleteAccount',{confirm:'DELETE',closeOrders:closeOrders===true,lang:zh?'zh':'en'});
  const c=(result&&result.counts)||{};
  orders.invalidate();
  store.reset();
  if(result&&result.cleanupWarning)ui.toast(new Error(result.cleanupWarning));
  else ui.toast(new Error(zh?('账户已删除：'+((c.requests||0)+(c.trips||0))+' 条订单记录已匿名化'):('Account deleted: '+((c.requests||0)+(c.trips||0))+' order records anonymised')));
  wx.reLaunch({url:'/pages/welcome/index'});
 },
 async closeOrders(){
  if(this.data.deleting)return;
  const orders=require('../../utils/orders'),ui=require('../../utils/ui');
  const zh=this.zh!==false,state=store.get();
  if(!state.profile.onboarded||state.profile.loggedOut)return ui.toast(new Error(zh?'请先登录':'Sign in first'));
  if(!await ui.confirm(zh?'关闭所有进行中的订单？':'Close every open order?',zh?'已接单、已取件的订单也会被关闭，并按原赏金模拟退款。关闭后不可恢复。':'Orders a runner already took are closed too, with a demo refund at the original offer. This cannot be undone.'))return;
  this.setData({deleting:true});
  try{
   const r=await orders.act('closeMyOrders',{lang:zh?'zh':'en'});
   const n=(r&&r.counts&&r.counts.orders)||0;
   orders.sync().catch(()=>{});
   ui.toast(new Error(zh?('已关闭 '+n+' 个订单'):('Closed '+n+' orders')));
  }catch(e){ui.toast(new Error(String(e&&e.message||e)||(zh?'关闭失败，请重试':'Could not close the orders, please try again')));}
  finally{this.setData({deleting:false});}
 }});
