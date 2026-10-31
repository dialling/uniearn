const routes=require('../../utils/saved-routes').forService('parcel'),campus=require('../../utils/campus'),store=require('../../utils/store'),ui=require('../../utils/ui');
Page({
 data:{zh:true,list:[],pick:false,selectedId:''},
 onLoad(o={}){this.pick=o.pick==='1';this.channel=this.getOpenerEventChannel&&this.getOpenerEventChannel();this.setData({pick:this.pick,selectedId:o.selected||''});},
 onShow(){this.setData({zh:store.get().language!=='en'});if(wx.setNavigationBarTitle)wx.setNavigationBarTitle({title:this.data.zh?'我的常用地址':'My addresses'});this.refresh();},
 refresh(){const zh=this.data.zh,list=routes.list().sort((a,b)=>b.default-a.default).map(x=>({...x,displayName:x.destinationType==='place'?(x.name||(zh?'其他地址':'Other address')):x.owner,place:x.destinationType==='place'?x.deliveryAddress:campus.buildingLabel(x.dorm,zh?'zh':'en')+(x.room?' '+x.room:''),phoneText:routes.formatPhone(x.phone)}));this.setData({list,selectedId:list.some(x=>x.id===this.data.selectedId)?this.data.selectedId:''});},
 add(){require('../../utils/nav').navigateTo({url:'/pages/address-add/index',events:{routeApplied:()=>this.refresh()}});},
 edit(e){const id=e.currentTarget.dataset.id;if(!routes.list().some(x=>x.id===id))return;require('../../utils/nav').navigateTo({url:'/pages/address-edit/index?id='+encodeURIComponent(id),events:{routeApplied:r=>{this.refresh();if(this.pick&&this.data.selectedId===r.id&&this.channel&&this.channel.emit)this.channel.emit('routeApplied',r);}}});},
 setDefault(e){routes.setDefault(e.currentTarget.dataset.id);this.refresh();},
 async remove(e){const zh=this.data.zh;if(!await ui.confirm(zh?'删除这个常用地址？':'Delete this address?',zh?'删除后下单时将不再显示。':'It will no longer appear when you order.'))return;routes.remove(e.currentTarget.dataset.id);this.refresh();},
 choose(e){if(!this.pick)return;const r=routes.list().find(x=>x.id===e.currentTarget.dataset.id);if(!r)return;this.setData({selectedId:r.id});if(this.channel&&this.channel.emit)this.channel.emit('routeApplied',r);wx.navigateBack({delta:1});}
});
