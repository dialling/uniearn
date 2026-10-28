// Keep these base-settlement fixtures outside the lunch-rush bonus window.
const fixtureClock=Date.parse('2030-01-02T18:00:00+08:00');Date.now=()=>fixtureClock;
const assert=require('node:assert/strict');
const {harness}=require('./helpers/order-cloud');
const h=harness();let def,navigation='',notices=[],failAfterCommit=false;
global.Page=x=>def=x;
global.wx={getStorageSync:()=>null,setStorageSync:()=>{},showToast:x=>notices.push(x.title),showModal:x=>x.success&&x.success({confirm:true}),navigateTo:x=>navigation=x.url,redirectTo:x=>navigation=x.url,reLaunch:x=>navigation=x.url,saveFile:x=>x.success({savedFilePath:'saved-proof'}),chooseMedia:x=>x.success({tempFiles:[{tempFilePath:'temporary-proof'}]}),cloud:{init(){},
 async callFunction({name,data}){if(name==='studentAccount'&&data.action==='saveDorm'){const id=h.engine.idFor(h.user),a=h.accounts[id];a.profile={...a.profile,dorm:data.dorm,room:data.room,pickup:data.pickup};return{result:{ok:true,account:{id,profile:a.profile,verification:a.verification}}};}assert.equal(name,'orderService');const result=await h.client(data);if(failAfterCommit&&data.action==='create'){failAfterCommit=false;throw Error('network lost after commit');}return{result};},
 async uploadFile({cloudPath}){return{fileID:'cloud://test/'+cloudPath};}
}};
const store=require('../utils/store'),account=require('../utils/account'),orders=require('../utils/orders');account.requireRunner=async()=>true;
function load(n,args={}){delete require.cache[require.resolve('../pages/'+n+'/index')];require('../pages/'+n+'/index');const p={...def,data:structuredClone(def.data)};p.setData=x=>Object.assign(p.data,x);if(p.onLoad)p.onLoad(args);return p;}
const e=data=>({currentTarget:{dataset:data}});
async function login(name){h.user=name;orders.invalidate();store.reset();const a=h.accounts[h.engine.idFor(name)];store.update(s=>{s.language='en';s.profile={...s.profile,...a.profile,onboarded:true,studentVerified:true,accountId:h.engine.idFor(name)};});await orders.sync();}
(async()=>{
 await login('customer');assert.equal(store.get().requests.length,0,'no demo orders uploaded');
 const night=load('takeaway',{night:'1'});night.couponManual=true;night.setData({couponId:'',shop:'Night stall'});night.totals();assert.equal(night.data.total,'4.00');night.changePrice(e({delta:1}));assert.equal(night.data.reward,'5.00');assert.equal(night.data.total,'5.00');night.priceInput({detail:{value:'9'}});assert.equal(night.data.total,'9.00');night.priceInput({detail:{value:'3'}});assert.equal(night.data.price,9);night.changePrice(e({delta:-20}));assert.equal(night.data.total,'4.00');night.priceInput({detail:{value:'7'}});assert.equal(night.data.total,'7.00');
 const p=load('takeaway');p.customLocker({detail:{value:'Takeaway locker by Dorm 7'}});p.setData({arrived:true,agreed:true,bags:2});p.totals();assert.equal(p.data.total,'6.00');assert.equal(p.data.addressReady,true,'posting does not require selecting a gate');p.autoSaveDorm();assert.equal(store.get().routes.length,1);
 const events=require('../utils/yuni-events'),postEvents=[];events.reset();const stopPostEvents=events.subscribe(event=>postEvents.push(event));
 failAfterCommit=true;await p.post();assert.equal(postEvents.length,0,'successful posting must not queue a second status popup beside the video');stopPostEvents();assert.equal(h.state.requests.length,1,'lost response retry does not duplicate post');
 const rid=h.state.requests[0].id;assert.match(navigation,/posted\/index\?celebrate=1&id=/);
 const mine=load('requests');mine.refresh();assert.equal(mine.data.active.length,1);
 const request=load('request',{id:rid});request.refresh();await request.raise(e({amount:1.88}));assert.equal(h.state.requests[0].reward,7.88);
 const ownBoard=load('jobs');ownBoard.refresh();assert.equal(ownBoard.data.cards.length,1,'own order appears as Your post');assert.equal(ownBoard.data.cards[0].mine,true);await ownBoard.take(e({ids:[rid]}));assert.equal(h.state.trips.length,0,'own order cannot be accepted');assert.match(notices.at(-1),/own post/);
 await login('runner');const jobs=load('jobs');jobs.refresh();assert.equal(jobs.data.cards.length,1);assert.ok(!JSON.stringify(jobs.data.cards).includes('13801026092'));
 await jobs.take(e({ids:[rid]}));const tid=h.state.trips[0].id;assert.match(navigation,/trip\/index/);
 const trip=load('trip',{id:tid});trip.refresh();trip.onUnload();assert.equal(h.state.requests[0].status,'taken');
 await trip.collect(e({id:rid}));await trip.photo(e({id:rid}));await trip.sendDelivery();assert.equal(h.state.requests[0].status,'delivered');assert.match(h.state.requests[0].photo,/^cloud:\/\//);
 await login('customer');request.refresh();assert.match(request.data.request.photo,/https:\/\/private.example/,'customer image uses authorized URL');await request.confirm();assert.equal(h.state.requests[0].status,'confirmed');assert.equal(store.get().profile.paid,0);
 await login('runner');const earnings=load('earnings');earnings.refresh();assert.equal(earnings.data.paid,'7.88');assert.equal(earnings.data.waiting,'0.00');
 const setup=load('trip-start');setup.setData({category:'takeout',station:'North gate',dorm:'Dorm 7',capacity:1,duration:10});await setup.start();const second=h.state.trips[0];
 await login('customer');const join=load('join',{id:second.id,origin:'different-phone'});join.refresh();assert.equal(join.data.open,true,'share opens on a different phone');join.join();assert.match(navigation,/takeaway\/index\?tripId=/);
 const joining=load('takeaway',{tripId:second.id});joining.customLocker({detail:{value:'Takeaway locker by Dorm 7'}});joining.setData({arrived:true,agreed:true,bags:2});const count=h.state.requests.length;await joining.post();assert.equal(h.state.requests.length,count);assert.match(notices.at(-1),/Too many/);
 joining.setData({bags:1});await joining.post();assert.equal(h.state.requests.length,count+1);assert.equal(h.state.requests[0].runnerId,second.id);
 console.log('Cloud page integration: lost-response retry, post, customer list, raise, two identities, pickup, cloud photo, confirm, runner-only earnings, cross-device share and join rollback passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
