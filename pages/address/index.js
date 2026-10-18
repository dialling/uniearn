const routes=require('../../utils/saved-routes').forService('parcel'),campus=require('../../utils/campus'),store=require('../../utils/store'),ui=require('../../utils/ui');
const blank=()=>({id:'',owner:'',phone:'',area:-1,building:-1,room:''});
Page({data:{zh:true,form:blank(),areaLabels:[],buildings:[],buildingLabels:[],list:[],editing:false,saving:false,flash:'',pick:false,selectedId:''},
 onLoad(o={}){this.pick=o.pick==='1';this.channel=this.getOpenerEventChannel&&this.getOpenerEventChannel();const p=store.get().profile;this.setData({pick:this.pick,selectedId:o.selected||'','form.owner':p.name&&p.name!=='Student'?p.name:'','form.phone':p.phone||''});},
 onShow(){const zh=store.get().language!=='en';this.setData({zh,areaLabels:campus.AREAS.map(a=>zh?a.zh:a.en)});if(wx.setNavigationBarTitle)wx.setNavigationBarTitle({title:zh?'常用配送地址':'Saved addresses'});this.syncBuildings();this.refresh();},
 refresh(){const zh=this.data.zh;this.setData({list:routes.list().sort((a,b)=>b.default-a.default).map(x=>({...x,place:x.destinationType==='place'?x.deliveryAddress:campus.buildingLabel(x.dorm,zh?'zh':'en')+(x.room?' '+x.room:''),phoneText:routes.formatPhone(x.phone)}))});},
 syncBuildings(){const a=campus.AREAS[this.data.form.area],b=a?a.buildings:campus.buildings(),lang=this.data.zh?'zh':'en';this.setData({buildings:b,buildingLabels:a?b.slice():b.map(x=>campus.buildingLabel(x,lang))});},
 field(e){this.setData({['form.'+e.currentTarget.dataset.field]:e.detail.value});},
 area(e){this.setData({'form.area':Number(e.detail.value),'form.building':-1});this.syncBuildings();},
 building(e){const code=this.data.buildings[Number(e.detail.value)],area=campus.AREAS.findIndex(a=>a.buildings.indexOf(code)>=0);if(area!==this.data.form.area){this.setData({'form.area':area});this.syncBuildings();}this.setData({'form.building':this.data.buildings.indexOf(code)});},
 edit(e){const x=routes.list().find(v=>v.id===e.currentTarget.dataset.id);if(!x)return;if(x.destinationType==='place')return this.openPlace(x.id);const area=campus.AREAS.findIndex(a=>a.buildings.indexOf(String(x.dorm).toUpperCase())>=0);this.setData({editing:true,form:{id:x.id,owner:x.owner,phone:x.phone,area,building:-1,room:x.room}});this.syncBuildings();this.setData({'form.building':this.data.buildings.indexOf(String(x.dorm).toUpperCase())});if(wx.pageScrollTo)wx.pageScrollTo({scrollTop:0,duration:280});},
 openPlace(id=''){const editId=typeof id==='string'?id:'';require('../../utils/nav').navigateTo({url:'/pages/route-edit/index?service=parcel&'+(editId?'id='+encodeURIComponent(editId):'type=place'),events:{routeApplied:()=>this.refresh()}});},
 cancelEdit(){const f=blank();this.setData({editing:false,form:f});this.syncBuildings();},
 async save(){if(this.data.saving)return;const f=this.data.form,zh=this.data.zh,dorm=this.data.buildings[f.building];
  const err=!String(f.owner).trim()?(zh?'请填写姓名':'Add a name'):!routes.validPhone(f.phone)?(zh?'请输入以 1 开头的 11 位手机号':routes.phoneHint):!dorm?(zh?'请选择宿舍区和楼栋':'Choose your area and building'):!String(f.room).trim()?(zh?'请填写房间号':'Add a room number'):'';
  if(err)return ui.toast(err);this.setData({saving:true});
  try{const old=f.id&&routes.list().find(x=>x.id===f.id);const r=routes.save({...(old||{}),id:f.id,name:old?old.name:'My dorm',destinationType:'dorm',owner:String(f.owner).trim(),phone:f.phone,dorm,room:String(f.room).trim(),dropMode:old?old.dropMode:'door'});
   this.setData({flash:r.id,editing:false,form:{...blank(),owner:r.owner,phone:r.phone}});this.syncBuildings();this.refresh();if(wx.vibrateShort)wx.vibrateShort({type:'light'});setTimeout(()=>this.setData({flash:''}),900);
   if(this.pick&&!f.id)this.choose({currentTarget:{dataset:{id:r.id}}});
  }catch(e){ui.toast(e);}finally{this.setData({saving:false});}},
 setDefault(e){routes.setDefault(e.currentTarget.dataset.id);this.refresh();},
 async remove(e){const zh=this.data.zh;if(!await ui.confirm(zh?'删除这个常用地址？':'Delete this address?',zh?'删除后下单时将不再显示。':'It will no longer appear when you order.'))return;routes.remove(e.currentTarget.dataset.id);this.refresh();},
 choose(e){if(!this.pick)return;const r=routes.list().find(x=>x.id===e.currentTarget.dataset.id);if(!r)return;this.setData({selectedId:r.id});if(this.channel&&this.channel.emit)this.channel.emit('routeApplied',r);setTimeout(()=>wx.navigateBack({delta:1}),180);}
});
