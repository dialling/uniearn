const {ensureCloud}=require('./utils/cloud');
try{require('./utils/analytics').install();}catch(_){}
// Storage writes are synchronous and block the first frame, so only persist when the sweep changed something.
function sweep(){try{const store=require('./utils/store'),d=require('./utils/domain');if(d.sweepExpired(store.get()))store.update(()=>{});}catch(e){console.error(e);}}
App({onLaunch(){try{ensureCloud();}catch(e){console.error(e);}},onShow(options){try{require('./utils/analytics').open(options);}catch(_){}sweep();require('./utils/account').call('status').catch(()=>{});require('./utils/orders').start();},onHide(){try{require('./utils/analytics').flush();}catch(_){}require('./utils/orders').stop();}});
