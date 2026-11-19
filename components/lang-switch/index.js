// Per-page hook. Applies the light/dark
// navigation colours and the page's dark class whenever a page is shown.
// It draws nothing on screen.
const title=require('../../utils/page-title');
function sync(){const page=title.current();require('../../utils/appearance').apply(page);}
Component({
  methods:{
  // 2026-11-18: the check-in popup is gone; go to the Me page, where Yuni eats today's dried fish.
  openYuniFeed(){if(!require('../../utils/checkin').dailyFishWaiting())return false;const pages=typeof getCurrentPages==='function'?getCurrentPages():[],top=pages[pages.length-1];if(top&&top.route==='pages/profile/index'&&top.feedDailyNow){top.feedDailyNow();return true;}require('../../utils/nav').reLaunch({url:'/pages/profile/index?feed=1'});return true;}},
  lifetimes:{attached(){sync();}},
  pageLifetimes:{show(){sync();}}
});
