Component({
 properties:{active:String,language:{type:String,value:""}},
 data:{showCreateSheet:false,zh:true,dark:false},observers:{language(){this.localize();}},lifetimes:{attached(){this.localize();}},pageLifetimes:{show(){this.localize();}},
 methods:{localize(){const s=require("../../utils/store").get();this.setData({zh:s.language!=="en",dark:s.meAppearance==='dark'});},
  go(e){const key=e.currentTarget.dataset.key;if(key==='create'){this.setData({showCreateSheet:true});return;}wx.reLaunch({url:'/pages/'+key+'/index'});},
  closeCreateSheet(){this.setData({showCreateSheet:false});},
  stopSheetTap(){},
  create(e){const {mode,category}=e.currentTarget.dataset;this.setData({showCreateSheet:false});require('../../utils/nav').navigateTo({url:mode==='trip'?'/pages/trip-start/index?category=takeout':'/pages/takeaway/index'});},
  comingSoon(){wx.showToast({title:'Coming soon',icon:'none'});}
 }
});
