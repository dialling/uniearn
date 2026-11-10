Page({data:{zh:true},onLoad(){this.setData({zh:require("../../utils/store").get().language!=="en"});wx.redirectTo({url:'/pages/jobs/index?guide=1'});}});
