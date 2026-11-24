const account=require('../../utils/account'),store=require('../../utils/store'),onboarding=require('../../utils/onboarding');
Page({
  onShareAppMessage() {return require('../../utils/share-card').shareInfo(this.data.language!=='en');},
  onShareTimeline() {return require('../../utils/share-card').shareTimeline(this.data.language!=='en');},
data:{...require('../../utils/motion').data(),busy:false,error:'',errorDetail:'',agreed:false,language:'zh',copy:{},copyLabel:'',skipping:false},onLoad(){const s=store.get(),p=s.profile||{};if(p.onboarded&&!p.loggedOut&&s.agreements&&s.agreements.terms){this.setData({skipping:true});wx.reLaunch({url:onboarding.nextPage(p)});}},onShow(){if(this.data.skipping)return;const language=onboarding.language();this.setData({language,copy:onboarding.text(language),copyLabel:language==='en'?'Copy details':'复制详情',error:''});},terms(){require('../../utils/nav').navigateTo({url:"/pages/terms/index?id=terms"});},privacy(){require('../../utils/nav').navigateTo({url:"/pages/terms/index?id=privacy"});},agree(){this.setData({agreed:!this.data.agreed,error:''});},toggleLanguage(){const language=onboarding.toggle();this.setData({language,copy:onboarding.text(language),copyLabel:language==='en'?'Copy details':'复制详情',error:''});},copyDetail(){if(this.data.errorDetail)wx.setClipboardData({data:this.data.errorDetail});},// 审核要求：未浏览功能前不得强制授权手机号/头像/昵称。
  // 允许以游客身份进入，需要发布/接单时再登录。
  browse(){store.update(s=>{s.profile={...s.profile,onboarded:true,loggedOut:true,campusId:s.profile.campusId||'sip'};s.agreements={...(s.agreements||{}),pickup:true,terms:true};s.language=s.language||'zh';});require('../../utils/orders').invalidate();wx.reLaunch({url:'/pages/jobs/index'});},
  async enter(){if(this.data.busy)return;if(!this.data.agreed){this.setData({error:this.data.copy.mustAgree});return;}this.setData({busy:true,error:'',errorDetail:''});try{await account.call('sessionLogin');store.update(s=>{s.agreements=s.agreements||{};s.agreements.pickup=true;s.agreements.terms=true;});require('../../utils/orders').invalidate();wx.reLaunch({url:'/pages/campus/index'});}catch(e){
   const msg=String((e&&(e.errMsg||e.message))||e);
   // 微信审核：登录弹窗取消/拒绝后必须能继续，不能卡在授权页
   if(/cancel|deny|拒绝|取消/i.test(msg)){this.setData({busy:false});this.browse();return;}
   this.setData({error:require('../../utils/cloud-errors').loginMessage(e,this.data.language,this.data.copy.retry),errorDetail:(this.data.language==='en'?'Details: ':'详情：')+msg.slice(0,160)});console.error('Session login',e);
  }finally{this.setData({busy:false});}},
 // 登录页的返回：有上一页就退回，没有就以游客进入大厅
 backOrBrowse(){const pages=getCurrentPages?getCurrentPages():[];if(pages.length>1)wx.navigateBack();else this.browse();}});
