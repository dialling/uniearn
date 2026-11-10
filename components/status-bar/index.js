Component({
  data:{height:20},
  attached(){
    let h=20;
    try{
      const info=wx.getWindowInfo?wx.getWindowInfo():wx.getSystemInfoSync();
      if(info&&info.statusBarHeight)h=info.statusBarHeight;
    }catch(e){}
    if(h!==this.data.height)this.setData({height:h});
  }
});
