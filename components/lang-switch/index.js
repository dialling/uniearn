// Per-page hook. Applies the localized navigation-bar title and the light/dark
// navigation colours whenever a page is shown. It draws nothing on screen.
const title=require('../../utils/page-title');
Component({
  lifetimes:{attached(){title.apply(title.current());}},
  pageLifetimes:{show(){title.apply(title.current());require('../../utils/appearance').apply();}}
});
