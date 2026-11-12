Component({
 properties:{active:String,language:{type:String,value:""}},
 data:{showCreateSheet:false,zh:true,dark:false},observers:{language(){this.localize();}},lifetimes:{attached(){this.localize();}},pageLifetimes:{show(){this.localize();}},
 methods:{localize(){const s=require("../../utils/store").get();this.setData({zh:s.language!=="en",dark:s.meAppearance==='dark'});},
  go(e){const key=e.currentTarget.dataset.key;if(key==='create'){this.setData({showCreateSheet:true});return;}if(!['jobs','requests','rewards','profile'].includes(key)||key===(this.properties&&this.properties.active||this.data.active))return;require('../../utils/nav').reLaunch({url:'/pages/'+key+'/index',fail:()=>wx.showToast({title:this.data.zh?'页面切换失败，请重试':'Could not switch pages. Try again.',icon:'none'})});},
  closeCreateSheet(){this.setData({showCreateSheet:false});},
  stopSheetTap(){},
  create(e){const {mode}=e.currentTarget.dataset;this.setData({showCreateSheet:false});require('../../utils/nav').navigateTo({url:mode==='trip'?'/pages/trip-start/index?category=takeout':mode==='task'?'/pages/task-post/index':'/pages/takeaway/index'});},
  comingSoon(){wx.showToast({title:'Coming soon',icon:'none'});}
 }
});
