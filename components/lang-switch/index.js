const title=require('../../utils/page-title');
Component({
  data:{zh:true},
  lifetimes:{attached(){this.sync();}},
  pageLifetimes:{show(){this.sync();title.apply(title.current());require('../../utils/appearance').apply();}},
  methods:{
    sync(){this.setData({zh:title.lang()!=='en'});},
    toggle(){const page=title.current();title.toggle(page);this.sync();}
  }
});
