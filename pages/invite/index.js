const orders=require('../../utils/orders');
const store=require('../../utils/store');
const ui=require('../../utils/ui');

Page({
  data:{zh:true,inviteCode:'',registered:false,inviteInput:'',navTop:20,navHeight:32,redeeming:false},
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
      }).then(result=>{if(result){store.update(s=>{if(s.pendingInviteCode===String(this.data.inviteInput||'').trim())delete s.pendingInviteCode;});this.setData({inviteInput:''});wx.showToast({title:this.data.zh?'邀请绑定成功，双方各得 10 积分':'Invitation linked · 10 points each'});}}).catch(err=>{ui.toast(err);}).finally(()=>{this._autoBinding=false;this.setData({redeeming:false});});}
    }else if(store.get().profile.onboarded)orders.act('rewardsInit').catch(()=>{});
  },
  onHide(){orders.unbind(this);},
  onUnload(){orders.unbind(this);},
  refresh(){const s=store.get();this.setData({inviteCode:(s.rewards||{}).inviteCode||'',registered:!!s.profile.onboarded});},
  back(){if(getCurrentPages().length>1)wx.navigateBack();else wx.reLaunch({url:'/pages/rewards/index'});},
  register(){const code=String(this.data.inviteInput||'').trim();store.update(s=>{s.pendingInviteCode=code;});wx.reLaunch({url:'/pages/welcome/index'});},
  copy(){if(!this.data.inviteCode)return this.register();wx.setClipboardData({data:this.data.inviteCode});},
  input(e){this.setData({inviteInput:e.detail.value});},
  async redeem(){
    const code=String(this.data.inviteInput||'').trim(),zh=this.data.zh;
    if(!code){wx.showToast({title:zh?'请输入同学的邀请码':'Enter a classmate’s code',icon:'none'});return;}
    if(this.data.redeeming)return;
    this.setData({redeeming:true});
    try{await orders.act('invite',{code});store.update(s=>{if(s.pendingInviteCode===code)delete s.pendingInviteCode;});this.setData({inviteInput:''});wx.showToast({title:zh?'邀请已绑定':'Invitation linked'});}
    catch(err){ui.toast(err);}
    finally{this.setData({redeeming:false});}
  },
  onShareAppMessage(){return {title:this.data.zh?'加入 UniEarn，双方各得 10 积分':'Join UniEarn — 10 points for both of us',path:'/pages/invite/index?invite='+this.data.inviteCode};}
});
