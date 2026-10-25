const rewards=require('../../utils/rewards'),store=require('../../utils/store'),copy=require('../../utils/create-copy');
const day=t=>{const d=new Date(t+28800000);return d.getUTCFullYear()+'-'+String(d.getUTCMonth()+1).padStart(2,'0')+'-'+String(d.getUTCDate()).padStart(2,'0');};
Page({data:{zh:true,tab:'usable',usable:[],expired:[],selected:'',best:''},
 onLoad(o={}){this.amount=Number(o.amount)||0;this.fee=Number(o.fee)||0;this.channel=this.getOpenerEventChannel&&this.getOpenerEventChannel();this.setData({selected:o.selected||''});this.refresh();},
 refresh(){const zh=store.get().language!=='en',lang=zh?'zh':'en',now=Date.now(),q=rewards.quote(null,this.amount,this.fee),all=(store.get().rewards&&store.get().rewards.coupons)||[];
  const view=c=>({id:c.id,name:copy.coupon(c.short||c.title||'Coupon',lang),title:copy.coupon(c.title||c.short||'',lang),save:c.save||'0.00',max:Number(c.stored?c.balance:c.max||0).toFixed(2),until:(c.stored?(zh?'余额 ¥':'¥')+Number(c.balance||0).toFixed(2)+(zh?' · ':' left · '):'')+(c.expiresAt?(zh?'有效期 ':'Valid ')+(c.issuedAt?day(c.issuedAt)+(zh?' 至 ':' to '):(zh?'至 ':'until '))+day(c.expiresAt-1):(zh?'长期有效':'No expiry')),usable:!!c.usable&&c.save!=='0.00',note:c.usable?'':copy.coupon(c.unavailableLabel,lang)});
  const usable=q.coupons.map(view).sort((a,b)=>Number(b.usable)-Number(a.usable)||Number(b.save)-Number(a.save));
  const expired=all.filter(c=>!c.usedBy&&c.expiresAt&&c.expiresAt<=now).map(c=>({id:c.id,name:copy.coupon(c.short||c.title||'Coupon',lang),max:Number(c.stored?c.balance:c.max||0).toFixed(2),until:(zh?'已于 ':'Expired ')+day(c.expiresAt)+(zh?' 过期':'')}));
  this.setData({zh,usable,expired,best:q.couponId});if(wx.setNavigationBarTitle)wx.setNavigationBarTitle({title:zh?'选择优惠券':'Choose a coupon'});},
 switchTab(e){this.setData({tab:e.currentTarget.dataset.tab});},
 pick(e){const id=e.currentTarget.dataset.id,c=this.data.usable.find(x=>x.id===id);if(id&&c&&!c.usable){wx.showToast({title:c.note||(this.data.zh?'当前订单无法使用这张优惠券':'This coupon can’t be used for this order.'),icon:'none'});return;}this.setData({selected:id});if(this.channel&&this.channel.emit)this.channel.emit('couponPicked',id);setTimeout(()=>wx.navigateBack({delta:1}),160);}
});
