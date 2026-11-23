Page({data:{...require('../../utils/motion').data(),zh:true},onLoad(){this.setData({zh:require("../../utils/store").get().language!=="en"});wx.redirectTo({url:'/pages/jobs/index?guide=1'});},onShareAppMessage(){const q=this.topic||(this.data&&this.data.topic)||'';return{title:'Uniearn',path:'/pages/info/index'+(q?'?topic='+encodeURIComponent(q):'')}}
});
