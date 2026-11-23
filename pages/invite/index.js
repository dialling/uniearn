const orders=require('../../utils/orders');
const store=require('../../utils/store');
const ui=require('../../utils/ui');

Page({
  data:{promoInput:'',promoBusy:false,promoMsg:'',...require('../../utils/motion').data(),zh:true,inviteCode:'',registered:false,inviteInput:'',navTop:20,navHeight:32,redeeming:false},
  onLoad(o={}){
    let top=20,height=32;
    try{const m=wx.getMenuButtonBoundingClientRect();if(m&&m.top){top=m.top;height=m.height;}}catch(e){}
    this.setData({navTop:top,navHeight:height,inviteInput:o.invite||store.get().pendingInviteCode||''});
  },
  onShow(){
    this.setData({zh:store.get().language!=='en'});
    // Keep custom navigation and the page window on the invitation palette.
    if(wx.setNavigationBarColor)wx.setNavigationBarColor({frontColor:'#000000',backgroundColor:'#f3ecd9',animation:{duration:0}});
    if(wx.setBackgroundColor)wx.setBackgroundColor({backgroundColorTop:'#f3ecd9',backgroundColorBottom:'#f3ecd9'});
    orders.bind(this);
    if(store.get().profile.onboarded&&this.data.inviteInput){
      if(!this._autoBinding){this._autoBinding=true;this.setData({redeeming:true});orders.sync().then(()=>{
        if(store.get().rewards?.hasInvitedBy){store.update(s=>{if(s.pendingInviteCode===String(this.data.inviteInput||'').trim())delete s.pendingInviteCode;});this.setData({inviteInput:''});return null;}
        return orders.act('invite',{code:String(this.data.inviteInput||'').trim()});
      }).then(result=>{if(result){store.update(s=>{if(s.pendingInviteCode===String(this.data.inviteInput||'').trim())delete s.pendingInviteCode;});this.setData({inviteInput:''});wx.showToast({title:this.data.zh?'邀请绑定成功，双方各得 20 积分':'Invitation linked · 20 points each'});}}).catch(err=>{ui.toast(err);}).finally(()=>{this._autoBinding=false;this.setData({redeeming:false});});}
    }else if(store.get().profile.onboarded)orders.act('rewardsInit').catch(()=>{});
  },
  onHide(){orders.unbind(this);},
  onUnload(){orders.unbind(this);},
  refresh(){const s=store.get();this.setData({inviteCode:(s.rewards||{}).inviteCode||'',registered:!!s.profile.onboarded});},
  back(){if(getCurrentPages().length>1)wx.navigateBack();else wx.reLaunch({url:'/pages/rewards/index'});},
  register(){const code=String(this.data.inviteInput||'').trim();store.update(s=>{s.pendingInviteCode=code;});wx.reLaunch({url:'/pages/welcome/index'});},
  copy(){if(!this.data.inviteCode)return this.register();
  const link='https://pararouter.cn/uni?invite='+encodeURIComponent(this.data.inviteCode);
  require('../../utils/clipboard').copy(link,{zh:this.data.zh});},
  input(e){this.setData({inviteInput:e.detail.value});},
  promoInputChange(e){this.setData({promoInput:e.detail.value,promoMsg:''});},
  async redeemPromo(){
    const code=String(this.data.promoInput||'').trim(),zh=this.data.zh;
    if(!code){const msg=zh?'请输入兑换码':'Enter a code';this.setData({promoMsg:msg});ui.toast(msg);return;}
    if(this.data.promoBusy)return;
    this.setData({promoBusy:true,promoMsg:''});
    try{
      if(require('../../utils/merge-mode').enabled){
        const res=await require('../../utils/api').post('/api/coupons/redeem',{code});
        await require('../../utils/xp-rewards').load();
        const msg=(res&&res.message)||(zh?'兑换成功，优惠券已放入券包':'Coupon redeemed');
        this.setData({promoInput:'',promoMsg:msg});
        wx.showToast({title:msg,icon:'none'});
      }else{
        await orders.act('redeemPromo',{code});
        const msg=zh?'兑换成功，优惠券已放入券包':'Coupon redeemed';
        this.setData({promoInput:'',promoMsg:msg});
        wx.showToast({title:msg,icon:'none'});
      }
    }catch(err){
      const msg=(err&&err.message)||(zh?'兑换失败，请检查兑换码':'Could not redeem this code');
      this.setData({promoMsg:msg});
      ui.toast(err);
    }finally{
      this.setData({promoBusy:false});
    }
  },
  async redeem(){
    const code=String(this.data.inviteInput||'').trim(),zh=this.data.zh;
    if(!code){wx.showToast({title:zh?'请输入同学的邀请码':'Enter a classmateʼs code',icon:'none'});return;}
    if(this.data.redeeming)return;
    this.setData({redeeming:true});
    try{await orders.act('invite',{code});store.update(s=>{if(s.pendingInviteCode===code)delete s.pendingInviteCode;});this.setData({inviteInput:''});wx.showToast({title:zh?'邀请绑定成功，双方各得 20 积分':'Invitation linked · 20 points each'});}
    catch(err){ui.toast(err);}
    finally{this.setData({redeeming:false});}
  },
  onShareAppMessage(){return {title:this.data.zh?'加入 Uniearn，双方各得 20 积分':'Join Uniearn — 20 points for both of us',path:'/pages/invite/index?invite='+this.data.inviteCode};}
});
