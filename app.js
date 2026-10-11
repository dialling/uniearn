const {ensureCloud}=require('./utils/cloud');
App({onLaunch(){require('./utils/store').get();try{ensureCloud();}catch(e){console.error(e);}},onShow(){require('./utils/account').call('status').catch(()=>{});require('./utils/orders').start();},onHide(){require('./utils/orders').stop();}});
