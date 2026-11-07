const assert=require('node:assert/strict');
const {session}=require('../scripts/group-test-service');
const db=session();
let definition,route;
global.Page=page=>{definition=page;};
global.wx={
  getStorageSync(){},setStorageSync(){},getSystemInfoSync:()=>({platform:'devtools'}),
  navigateTo:({url})=>{route=url;},showToast(){},
  async request({data,success}){
    const result=data.token?await db.call(data.role,data.event.action,data.event):{token:'test-session'};
    success({statusCode:200,data:result});
  }
};
function page(name){
  require('../pages/'+name+'/index');
  return {...definition,data:structuredClone(definition.data),setData(v){Object.assign(this.data,v);}};
}
const store=require('../utils/store'),orders=require('../utils/orders');
async function run(){
  const hall=page('jobs');
  hall.onLoad({groupTest:'1'});
  await orders.sync();
  hall.refresh();
  const card=hall.data.cards.find(c=>c.requests===3);
  const ids=card.ids.slice(0,2);
  for(const id of ids)hall.pickGroupOrder({currentTarget:{dataset:{id}}});
  await hall.take({currentTarget:{dataset:{ids}}});
  assert.match(route,/^\/pages\/trip\/index\?id=/);
  const trip=page('trip');
  trip.onLoad({id:route.split('=')[1]});
  trip.refresh();
  assert.equal(trip.data.requests.length,2);
  for(const id of ids)await trip.collectAndDeliver({currentTarget:{dataset:{id}}});
  assert.equal(trip.data.trip.phase,'deliver');
  for(const id of ids){
    trip.setData({deliveryId:id,deliveryPhoto:'/assets/yuni-wave.png',deliverySubmitted:false});
    await trip.sendDelivery();
    assert.equal(trip.data.deliverySubmitted,true,trip.data.deliveryError);
    trip.refresh();
  }
  assert.equal(trip.data.trip.phase,'done');
  await hall.switchTestRole();
  assert.equal(route,'/pages/requests/index');
  const detail=page('request');
  for(const id of ids){
    detail.id=id;
    detail.refresh();
    assert.equal(detail.data.request.status,'delivered');
    assert.equal(detail.data.request.photo,'/assets/yuni-wave.png');
    await detail.confirm();
    assert.equal(detail.data.request.status,'confirmed');
  }
  await hall.switchTestRole();
  trip.refresh();
  assert.equal(trip.data.paid,'9.00');
  assert.equal(store.get().walletSummary.balance_cents,900);
  console.log('Actual hall, trip and publisher page handlers: picked both, submitted photos, confirmed both, paid ¥9.');
}
run().catch(e=>{console.error(e);process.exitCode=1;});
