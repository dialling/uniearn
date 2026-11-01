// Per-page hook. Applies the light/dark
// navigation colours and the page's dark class whenever a page is shown.
// It draws nothing on screen.
const title=require('../../utils/page-title');
function sync(){const page=title.current();require('../../utils/appearance').apply(page);}
Component({
  lifetimes:{attached(){sync();}},
  pageLifetimes:{show(){sync();}}
});
