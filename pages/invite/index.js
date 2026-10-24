const orders=require('../../utils/orders');
const store=require('../../utils/store');
const ui=require('../../utils/ui');

Page({
  data:{zh:true,inviteCode:'',registered:false,inviteInput:'',navTop:20,navHeight:32,redeeming:false},
  onLoad(o={}){
    let top=20,height=32;
    try{const m=wx.getMenuButtonBoundingClientRect();if(m&&m.top){top=m.top;height=m.height;}}catch(e){}
    this.setData({navTop:top,navHeight:height,inviteInput:o.invite||''});
  },
  onShow(){
    this.setData({zh:store.get().language!=='en'});
    // Custom navigation: keep the status bar icons white on the dark page.
    if(wx.setNavigationBarColor)wx.setNavigationBarColor({frontColor:'#ffffff',backgroundColor:'#070807',animation:{duration:0}});
    orders.bind(this);
    if(store.get().profile.onboarded)orders.act('rewardsInit').catch(()=>{});
  },
  onHide(){orders.unbind(this);},
  onUnload(){orders.unbind(this);},
  refresh(){const s=store.get();this.setData({inviteCode:(s.rewards||{}).inviteCode||'',registered:!!s.profile.onboarded});},
  back(){if(getCurrentPages().length>1)wx.navigateBack();else wx.reLaunch({url:'/pages/rewards/index'});},
  register(){wx.reLaunch({url:'/pages/profile/index'});},
  copy(){if(!this.data.inviteCode)return this.register();wx.setClipboardData({data:this.data.inviteCode});},
  input(e){this.setData({inviteInput:e.detail.value});},
  async redeem(){
    const code=String(this.data.inviteInput||'').trim(),zh=this.data.zh;
    if(!code){wx.showToast({title:zh?'请输入同学的邀请码':'Enter a classmate’s code',icon:'none'});return;}
    if(this.data.redeeming)return;
    this.setData({redeeming:true});
    try{await orders.act('invite',{code});this.setData({inviteInput:''});wx.showToast({title:zh?'邀请已绑定':'Invitation linked'});}
    catch(err){ui.toast(err);}
    finally{this.setData({redeeming:false});}
  },
  onShareAppMessage(){return {title:this.data.zh?'填写我的 UniEarn 邀请码，我们各得 ¥3.9 配送券':'Use my UniEarn invite code — we each get ¥3.9 delivery credit',path:'/pages/invite/index?invite='+this.data.inviteCode};}
});
