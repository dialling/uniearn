const store=require('../../utils/store'),copy=require('../../utils/create-copy');
const orders=require('../../utils/orders');
const dateLabel=value=>{if(!value)return '';const p=require('../../utils/china-time').parts(Number(value));return p.month+'月'+p.day+'日';};
Page({
 data:{language:'zh',tab:'available',items:[],showUseFor:'',couponName:'',loading:false},
 onShow(){require('../../utils/appearance').apply(this);orders.bind(this,'refresh');},
 onHide(){orders.unbind(this);},
 onUnload(){orders.unbind(this);},
 refresh(){
  const language=store.get().language==='en'?'en':'zh',zh=language==='zh',rewards=store.get().rewards||{},history=Array.isArray(rewards.couponHistory)?rewards.couponHistory:null,now=Date.now();
  const rows=(history||rewards.coupons||[]).map(c=>{
   const status=c.status||(c.usedBy?'used':c.expiresAt&&c.expiresAt<=now?'expired':'available');
   const rawName=c.titleZh||c.title||c.short||'Coupon',name=zh?copy.coupon(rawName,language):rawName;
   const value=c.stored?Number(c.balance||0):Number(c.max||0);
   const kind=zh?(c.kind==='delivery'?'配送费':'订单金额'):(c.kind==='delivery'?'Delivery fee':'Order total');
   const description=c.descriptionZh||(zh?copy.coupon(c.description||'',language):c.description)||'';
   return {...c,status,displayName:name,descriptionDisplay:description,displayAmount:value.toFixed(2),kindLabel:kind,expiryLabel:c.expiresAt?(zh?'有效期至 ':'Valid until ')+dateLabel(c.expiresAt):zh?'长期有效':'No expiry',statusLabel:status==='used'?(zh?'已使用':'Used'):status==='expired'?(zh?'已过期':'Expired'):(c.usable===false?(zh?'暂不可用':'Unavailable'):zh?'可使用':'Available')};
  });
  const items=rows.filter(c=>c.status===this.data.tab);
  this.setData({language,items,loading:false});
  if(wx.setNavigationBarTitle)wx.setNavigationBarTitle({title:zh?'优惠券':'Coupons'});
 },
 switchTab(e){const tab=e.currentTarget.dataset.tab;if(!['available','used','expired'].includes(tab))return;this.setData({tab,showUseFor:''});this.refresh();},
 noop(){},
 openUse(e){const item=this.data.items.find(c=>c.id===e.currentTarget.dataset.id);if(!item||item.usable===false){wx.showToast({title:this.data.language==='zh'?'这张券暂时不可用':'This coupon is not available right now',icon:'none'});return;}this.setData({showUseFor:item.id,couponName:item.displayName});},
 closeUse(){this.setData({showUseFor:''});},
 goUse(e){const {id,channel}=e.currentTarget.dataset;if(!id)return;this.setData({showUseFor:''});const encoded=encodeURIComponent(id);let url='';if(channel==='takeout')url='/pages/takeaway/index?coupon='+encoded;else if(channel==='night')url='/pages/takeaway/index?night=1&coupon='+encoded;else if(channel==='parcel')url='/pages/create/index?mode=request&category=parcel&coupon='+encoded;else return;require('../../utils/nav').navigateTo({url});}
});
