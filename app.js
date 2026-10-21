const {ensureCloud}=require('./utils/cloud');
// Storage writes are synchronous and block the first frame, so only persist when the sweep changed something.
function sweep(){try{const store=require('./utils/store'),d=require('./utils/domain');if(d.sweepExpired(store.get()))store.update(()=>{});}catch(e){console.error(e);}}
App({onLaunch(){try{ensureCloud();}catch(e){console.error(e);}},onShow(){sweep();require('./utils/account').call('status').catch(()=>{});require('./utils/orders').start();},onHide(){require('./utils/orders').stop();}});
