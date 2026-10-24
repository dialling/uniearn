const assert=require('node:assert/strict');
const {harness}=require('./helpers/order-cloud'),h=harness();
let definition,navigation,toast;
global.Page=p=>definition=p;
global.wx={getStorageSync:()=>null,setStorageSync(){},showToast:opts=>toast=opts.title,navigateTo:opts=>navigation=opts,redirectTo(){}};
const store=require('../utils/store'),orders=require('../utils/orders');
function page(name){delete require.cache[require.resolve('../pages/'+name+'/index')];require('../pages/'+name+'/index');const p={...definition,data:structuredClone(definition.data),setData(v){Object.assign(this.data,v);}};return p;}
const event=(i,value)=>({currentTarget:{dataset:{i}},detail:{value}});
(async()=>{
 store.reset();const owner=h.engine.idFor('customer');store.update(s=>{s.language='zh';s.profile={...s.profile,...h.accounts[owner].profile,accountId:owner,onboarded:true};});
 const route=require('../utils/saved-routes').forService('parcel').save({destinationType:'dorm',dorm:'D01',room:'101',owner:'customer',phone:'13801026092',default:true});
 const p=page('create');p.onLoad({mode:'request',category:'parcel'});p.sizeCount({currentTarget:{dataset:{size:'small',delta:1}}});p.sizeCount({currentTarget:{dataset:{size:'medium',delta:1}}});
 p.pickStation(event(0,0));p.pickStation(event(1,2));assert.equal(p.data.parcelStations[0].point,'翰林妈妈驿站');assert.equal(p.data.parcelStations[1].point,'文缘菜鸟驿站');
 p.pickStation(event(1,4));p.otherStation(event(1,'图书馆驿站'));assert.equal(p.data.parcelStations[0].point,'翰林妈妈驿站');assert.equal(p.data.parcelStations[1].point,'图书馆驿站');
 p.otherStation(event(1,''));await p.post();assert.match(toast,/包裹 2/,'each parcel needs its own station');
 p.otherStation(event(1,'图书馆驿站'));p.setData({codes:['M-1234','L-5678']});p.totals();
 orders.upload=async path=>path;orders.act=async(action,args)=>{const result=await h.call('customer',action,args);assert.ok(result.ok,result.error);return result.data;};
 await p.post();assert.equal(h.state.requests.length,1);const order=h.state.requests[0];assert.deepEqual(order.parcelItems.map(x=>x.pickupPoint),['翰林妈妈驿站','图书馆驿站']);assert.equal(order.station,'翰林妈妈驿站、图书馆驿站');
 const publicView=await h.call('other','sync');assert.ok(publicView.snapshot.requests[0].parcelItems.every(x=>!x.code&&!x.pickupPoint),'private parcel fields do not leak to the hall');
 const accepted=await h.call('runner','acceptBoxes',{refs:[{requestId:order.id,index:1}]});assert.ok(accepted.ok,accepted.error);const taken=h.state.requests.find(x=>x.id===order.id),left=h.state.requests.find(x=>x.splitParentId===order.id);assert.equal(taken.station,'图书馆驿站');assert.equal(left.station,'翰林妈妈驿站');assert.equal(accepted.snapshot.trips[0].station,'图书馆驿站');assert.equal(accepted.snapshot.requests.find(x=>x.id===order.id).parcelItems[0].code,'L-5678');
 for(const domain of [require('../utils/domain'),require('../cloudfunctions/orderService/domain')]){const s=domain.initial(),r=domain.createRequest(s,{category:'parcel',station:'A、B',dorm:'D01',room:'101',phone:'13801026092',parcelItems:[{size:'small',code:'1',pickupPoint:'A'},{size:'medium',code:'2',pickupPoint:'B'}]});const trip=domain.acceptBoxes(s,[{requestId:r.id,index:1}]);assert.equal(trip.station,'B');assert.ok(domain.abandonUncollectedTrip(s,trip.id));assert.equal(r.station,'A、B');assert.deepEqual(r.parcelItems.map(x=>x.pickupPoint),['A','B']);}
 p.openParcelScreenshot();assert.equal(navigation.url,'/pages/sms-scan/index?mode=sms&auto=1');navigation.events.smsSelected({codes:['1','2'],pickupPoints:['A',''],pickupPoint:'A',preview:''});assert.equal(p.data.parcelStations[0].point,'A');assert.equal(p.data.parcelStations[1].point,'','an unrecognized station must remain blank rather than inherit another parcel’s station');
 navigation.events.smsSelected({codes:Array.from({length:12},(_,i)=>String(i)),pickupPoint:'A',preview:''});assert.equal(p.data.parcelCount,12);assert.ok(p.data.sizeOptions.every(x=>x.count<=9),'scanning twelve parcels respects the nine-per-size cap');
 const dozen=await h.call('customer','create',{data:{category:'parcel',station:'A',dorm:'D01',room:'101',phone:'13801026092',parcelItems:Array.from({length:12},(_,i)=>({size:i<9?'small':'medium',code:String(i),pickupPoint:'A'}))}});assert.ok(dozen.ok,dozen.error);
 const scan=page('sms-scan');scan.onLoad({auto:'1'});let opens=0;scan.capture=()=>opens++;scan.onReady();scan.onReady();assert.equal(opens,1,'upload opens the album automatically once');
 require('../utils/saved-routes').remove(route.id);
 console.log('Per-parcel station selection, manual stations, missing-station guard, cloud persistence/privacy, split routes, cancellation restore, screenshot mapping and automatic album opening passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
