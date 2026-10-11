Component({
 properties:{active:String,language:{type:String,value:""}},
 data:{showCreateSheet:false,zh:true},observers:{language(){this.localize();}},lifetimes:{attached(){this.localize();}},pageLifetimes:{show(){this.localize();}},
 methods:{localize(){this.setData({zh:require("../../utils/store").get().language!=="en"});},
  go(e){const key=e.currentTarget.dataset.key;if(key==='create'){this.setData({showCreateSheet:true});return;}wx.reLaunch({url:'/pages/'+key+'/index'});},
  closeCreateSheet(){this.setData({showCreateSheet:false});},
  stopSheetTap(){},
  create(e){const {mode,category}=e.currentTarget.dataset;this.setData({showCreateSheet:false});wx.navigateTo({url:mode==='task'?'/pages/task-post/index':mode==='trip'?'/pages/trip-start/index?category=takeout':'/pages/takeaway/index'});},
  comingSoon(){wx.showToast({title:'Coming soon',icon:'none'});}
 }
});
