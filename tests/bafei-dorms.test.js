// 2026-11-21: 芭菲 is a fifth dorm area with four buildings named after the nearby areas.
const assert=require('node:assert/strict');
global.wx={getStorageSync:()=>null,setStorageSync(){}};
const campus=require('../utils/campus'),cloud=require('../cloudfunctions/orderService/campus');
const names=['文缘芭菲','文萃芭菲','文星芭菲','文荟芭菲'],en=['Wenyuan Bafei','Wencui Bafei','Wenxing Bafei','Wenhui Bafei'];
for(const c of [campus,cloud]){
 assert.deepEqual(c.AREAS.map(a=>a.zh),['文缘','文星','文萃','文荟','芭菲']);
 assert.deepEqual(c.buildingsOf('bafei'),names);
 names.forEach((n,i)=>{assert.equal(c.areaOfBuilding(n).id,'bafei');assert.equal(c.buildingLabel(n,'zh'),n);assert.equal(c.buildingLabel(n,'en'),en[i]);});
 assert.equal(c.maxFloorOf('文缘芭菲'),6);
 assert.equal(c.highFloor('bafei',5,'文星芭菲'),false,'no stair surcharge in 芭菲');
}
assert.equal(campus.buildingLabel('D01','en'),'D01');
const filters=require('../utils/order-filters');
assert.deepEqual(filters.tabs({areaFilter:'芭菲'},'en').buildingTabs.slice(1).map(x=>x.label),en);
assert.deepEqual(filters.location({delivery_location:'芭菲 3 楼 文缘芭菲 301'}),{area:'芭菲',building:'文缘芭菲'});
assert.equal(filters.matches({dorm:'文荟芭菲'},{areaFilter:'芭菲',buildingFilter:'文荟芭菲'}),true);
assert.equal(filters.matches({dorm:'文荟芭菲'},{areaFilter:'文荟'}),false,'文荟芭菲 is not in 文荟');
const route=require('../utils/route-label');
assert.equal(route.destination({dorm:'文萃芭菲'},'zh'),'文萃芭菲');
assert.equal(route.destination({dorm:'文萃芭菲'},'en'),'Wencui Bafei');
const routes=require('../utils/saved-routes');
assert.doesNotThrow(()=>routes.validate({station:'North gate',destinationType:'dorm',dorm:'文星芭菲',room:'402',floor:4,owner:'Tim',phone:'13800138000'}));
assert.throws(()=>routes.validate({station:'North gate',destinationType:'dorm',dorm:'文星芭菲',room:'702',floor:7,owner:'Tim',phone:'13800138000'}),/floor/);
console.log('芭菲: four buildings, English labels, hall filters and saved addresses');
