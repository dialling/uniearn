const routes=require('./saved-routes').forService('parcel'),campus=require('./campus'),store=require('./store'),ui=require('./ui');
const blank=()=>({id:'',destinationType:'dorm',owner:'',dormGender:'',recipientGender:'',phone:'',area:-1,building:-1,room:'',deliveryAddress:''});
// Add and edit have separate pages, sharing field handling and persistence.
module.exports=function addressForm(editing=false){return {
 data:{zh:true,editing,form:blank(),areaLabels:[],buildings:[],buildingLabels:[],saving:false},
 onLoad(o={}){
  this.channel=this.getOpenerEventChannel&&this.getOpenerEventChannel();const p=store.get().profile;
  if(editing){
   const x=routes.list().find(v=>v.id===o.id);if(!x){ui.toast(store.get().language==='en'?'This address is unavailable':'这个地址已不存在');wx.navigateBack({delta:1});return;}
   const area=campus.AREAS.findIndex(a=>a.buildings.includes(String(x.dorm).toUpperCase()));
   this.setData({form:{...blank(),id:x.id,destinationType:x.destinationType,owner:x.owner,dormGender:x.dormGender,recipientGender:x.recipientGender,phone:x.phone,area,room:x.room,deliveryAddress:x.deliveryAddress}});this.syncBuildings();this.setData({'form.building':this.data.buildings.indexOf(String(x.dorm).toUpperCase())});
  }else{const first=routes.list()[0];this.previousContact=first||null;this.contactAccountId=p.accountId||'local';this.setData({'form.destinationType':first?'place':'dorm','form.owner':first?'':p.name&&p.name!=='Student'?p.name:'','form.phone':first?'':p.phone||''});}
 },
 onReady(){
  const first=this.previousContact;if(editing||!first||this.contactPrompted)return;this.contactPrompted=true;
  const zh=store.get().language!=='en',gender=first.destinationType==='place'?first.recipientGender:first.dormGender,genderLabel=gender==='male'?(zh?'男':'Male'):gender==='female'?(zh?'女':'Female'):(zh?'未填写':'Not set');
  wx.showModal({title:zh?'使用之前的收件信息？':'Use previous contact details?',content:zh?'姓名：'+first.owner+'\n性别：'+genderLabel+'\n电话：'+routes.formatPhone(first.phone):'Name: '+first.owner+'\nGender: '+genderLabel+'\nPhone: '+routes.formatPhone(first.phone),confirmText:zh?'使用':'Use',cancelText:zh?'自行填写':'New',confirmColor:'#c2410c',success:result=>{
   if(!result.confirm||this.contactClosed||(store.get().profile.accountId||'local')!==this.contactAccountId||!routes.list().some(x=>x.id===first.id))return;
   this.setData({'form.owner':first.owner,'form.phone':first.phone,'form.dormGender':gender||'','form.recipientGender':gender||''});
  }});
 },
 onUnload(){this.contactClosed=true;},
 onShow(){const zh=store.get().language!=='en';this.setData({zh,areaLabels:campus.AREAS.map(a=>zh?a.zh:a.en)});if(wx.setNavigationBarTitle)wx.setNavigationBarTitle({title:editing?(zh?'编辑常用地址':'Edit address'):(zh?'新增常用地址':'New address')});this.syncBuildings();},
 syncBuildings(){const a=campus.AREAS[this.data.form.area],b=a?a.buildings:campus.buildings(),lang=this.data.zh?'zh':'en';this.setData({buildings:b,buildingLabels:a?b.slice():b.map(x=>campus.buildingLabel(x,lang))});},
 field(e){this.setData({['form.'+e.currentTarget.dataset.field]:e.detail.value});},
 chooseType(e){const value=e.currentTarget.dataset.value;if(this.data.saving||!['dorm','place'].includes(value)||value===this.data.form.destinationType)return;this.setData({'form.destinationType':value});},
 chooseGender(e){const value=e.currentTarget.dataset.value;if(['male','female'].includes(value))this.setData({[this.data.form.destinationType==='place'?'form.recipientGender':'form.dormGender']:value});},
 area(e){this.setData({'form.area':Number(e.detail.value),'form.building':-1});this.syncBuildings();},
 building(e){const code=this.data.buildings[Number(e.detail.value)],area=campus.AREAS.findIndex(a=>a.buildings.indexOf(code)>=0);if(area!==this.data.form.area){this.setData({'form.area':area});this.syncBuildings();}this.setData({'form.building':this.data.buildings.indexOf(code)});},
 async save(){if(this.data.saving)return;const f=this.data.form,zh=this.data.zh,place=f.destinationType==='place',dorm=this.data.buildings[f.building],location=String(f.deliveryAddress||'').trim();
  const err=!String(f.owner).trim()?(zh?'请填写姓名':'Add a name'):!routes.validPhone(f.phone)?(zh?'请输入以 1 开头的 11 位手机号':routes.phoneHint):place?(!location?(zh?'请填写具体地点':'Enter the exact location'):location.length>500?(zh?'具体地点请控制在 500 字以内':'Keep the location under 500 characters'):''):!dorm?(zh?'请选择宿舍区和楼栋':'Choose your area and building'):!String(f.room).trim()?(zh?'请填写房间号':'Add a room number'):'';
  if(err)return ui.toast(err);this.setData({saving:true});
  try{const old=f.id&&routes.list().find(x=>x.id===f.id);const r=routes.save({...(old||{}),id:f.id,name:old&&old.destinationType===f.destinationType?old.name:place?'Other':'My dorm',destinationType:f.destinationType,owner:String(f.owner).trim(),dormGender:place?'':f.dormGender,recipientGender:place?f.recipientGender:'',phone:f.phone,dorm:place?'':dorm,area:place?'':(campus.areaOfBuilding(dorm)||{}).id||'',floor:!place&&old&&old.dorm===dorm?old.floor:0,room:place?'':String(f.room).trim(),deliveryAddress:place?location:'',dropMode:place?'meet':old?old.dropMode:'door'});
   if(this.channel&&this.channel.emit)this.channel.emit('routeApplied',r);if(wx.vibrateShort)wx.vibrateShort({type:'light'});wx.navigateBack({delta:1});
  }catch(e){ui.toast(e);}finally{this.setData({saving:false});}},
};};
