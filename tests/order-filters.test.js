const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');

// Mini program require loads registered JS modules; Node's JSON loader hides this failure.
function loadHallAsMiniProgram(){
 const cache=new Map();let page;
 const context=vm.createContext({Page:value=>page=value,wx:{getStorageSync:()=>null,setStorageSync(){}},console,setTimeout,clearTimeout,setInterval,clearInterval});
 function load(file){
  if(cache.has(file))return cache.get(file).exports;
  assert.ok(fs.existsSync(file),'Mini program JS module missing: '+file);
  const module={exports:{}};cache.set(file,module);
  const execute=vm.runInContext('(function(require,module,exports){'+fs.readFileSync(file,'utf8')+'\n})',context,{filename:file});
  execute(request=>{
   assert.ok(request.startsWith('.'),'Only bundled relative modules are available');
   return load(path.resolve(path.dirname(file),request.endsWith('.js')?request:request+'.js'));
  },module,module.exports);
  return module.exports;
 }
 load(path.resolve(__dirname,'../pages/jobs/index.js'));
 assert.ok(page,'Jobs page must register successfully');
 assert.equal(page.data.areaTabs.length,6);
}
loadHallAsMiniProgram();
const filters=require('../utils/order-filters');

assert.deepEqual(filters.tabs().areaTabs.map(x=>x.key),['','文缘','文星','文萃','文荟','芭菲']);
assert.deepEqual(filters.tabs().typeTabs.map(x=>x.key),['','food','express','night','other']);
assert.deepEqual(filters.tabs().genderTabs.map(x=>x.key),['','male','female']);
assert.equal(filters.matches({dorm:'D01',dormGender:'male'},{genderFilter:'male',areaFilter:'文缘'}),true);
assert.equal(filters.matches({dorm:'D01',dormGender:'female'},{genderFilter:'male'}),false);
assert.equal(filters.matches({dorm:'D01'},{genderFilter:'female'}),false,'unknown dorm genders are not guessed');
assert.equal(filters.matches({destinationType:'place',dormGender:'male'},{genderFilter:'male'}),false);
assert.deepEqual(filters.tabs().buildingTabs,[]);
assert.equal(filters.tabs({areaFilter:'文缘'}).buildingTabs.length,7);
assert.equal(filters.tabs({areaFilter:'文萃'}).buildingTabs.at(-1).key,'C10');
assert.equal(filters.tabs({areaFilter:'芭菲'}).buildingTabs[1].key,'芭菲');

// Existing cloud snapshots use dorm; the reuse package uses delivery_location.
for(const [order,area,building] of [
 [{dorm:'D02'},'文缘','D02'],
 [{dorm:'Wenxing A05'},'文星','A05'],
 [{delivery_location:'文萃 C10 5 楼'},'文萃','C10'],
 [{deliveryLocation:'文荟 B01'},'文荟','B01'],
 [{deliveryAddress:'芭菲'},'芭菲','芭菲'],
 [{area:'wenyuan'},'文缘',''],
 [{building:'c01',deliveryAddress:'文缘 D02'},'文萃','C01'],
 [{dorm:'B02',deliveryAddress:'文缘 D02'},'文荟','B02']
]){
 assert.deepEqual(filters.location(order),{area,building});
 assert.equal(filters.matches(order,{areaFilter:area,buildingFilter:building}),true);
}
for(const order of [
 {dorm:'D010'}, {dorm:'AD01'},
 {note:'文缘 D01',pickupPoint:'文缘 D01'},
 {destinationType:'place',dorm:'D01'}
])assert.deepEqual(filters.location(order),{area:'',building:''});
assert.deepEqual(filters.normalize({areaFilter:'unknown',typeFilter:'unknown',buildingFilter:'D010'}),{genderFilter:'',areaFilter:'',typeFilter:'',buildingFilter:''});
assert.deepEqual(filters.normalize({areaFilter:'文星',typeFilter:'night',buildingFilter:'D01'}),{genderFilter:'',areaFilter:'文星',typeFilter:'night',buildingFilter:''});
assert.equal(filters.matches({category:'takeout',night:true},{typeFilter:'food'}),false);
assert.equal(filters.matches({category:'takeout',night:true},{typeFilter:'night'}),true);
assert.equal(filters.matches({category:'parcel'},{typeFilter:'express'}),true);
assert.equal(filters.matches({type:'buy'},{}),true,'existing orders remain under All');
assert.equal(filters.matches({category:'task'},{}),true,'legacy tasks remain under All');
assert.equal(filters.matches({category:'takeout',dorm:'D02'},{areaFilter:'文缘',typeFilter:'food',buildingFilter:'D01'}),false);

let definition;
global.Page=value=>definition=value;
global.wx={getStorageSync:()=>null,setStorageSync(){}};
const store=require('../utils/store');
require('../pages/jobs/index');
const p={...definition,data:structuredClone(definition.data),setData(value){Object.assign(this.data,value);}};
const now=Date.now(),base={campusId:'sip',category:'takeout',station:'Pickup',dorm:'D01',status:'waiting',small:1,big:0,reward:3,arrivalAt:now+10*60000,closesAt:now+60*60000,createdAt:now};
store.reset();store.update(s=>{
 s.language='zh';s.profile.campusId='sip';s.requests=[];
 s.publicJobs=[
  {...base,id:'food'},
  {...base,id:'night',night:true},
  {...base,id:'parcel',category:'parcel',dorm:'D02'},
  {...base,id:'future',dorm:'A01',arrivalAt:now+45*60000},
  {...base,id:'done-food',status:'confirmed',deliveredAt:now},
  {...base,id:'done-parcel',category:'parcel',status:'confirmed',deliveredAt:now},
  {...base,id:'elsewhere',campusId:'other'}
 ];
});
const event=key=>({currentTarget:{dataset:{key}}});
const ids=()=>p.data.cards.flatMap(card=>card.ids).sort();
p.refresh();assert.equal(p.data.openCount,4);assert.equal(p.data.doneCount,2);
p.onGenderFilter(event('male'));assert.deepEqual(ids(),[]);assert.equal(p.data.filterCount,1);
p.clear();assert.equal(p.data.genderFilter,'');assert.equal(p.data.openCount,4);
p.onAreaFilter(event('文缘'));p.onTypeFilter(event('food'));p.onBuildingFilter(event('D01'));
assert.deepEqual(ids(),['food']);assert.equal(p.data.openCount,1);assert.equal(p.data.doneCount,1);
p.handleTab({currentTarget:{dataset:{value:'done'}}});assert.deepEqual(ids(),['done-food']);
p.handleTab({currentTarget:{dataset:{value:'open'}}});
let calls=0;const refresh=p.refresh;p.refresh=function(){calls++;return refresh.call(this);};
p.onAreaFilter(event('文缘'));p.onTypeFilter(event('food'));p.onBuildingFilter(event('D01'));
assert.equal(calls,0,'repeated chips do not reload');
p.onAreaFilter(event('文星'));
assert.equal(p.data.buildingFilter,'');assert.equal(p.data.buildingTabs[1].key,'A01');assert.deepEqual(ids(),['future']);
p.select({currentTarget:{dataset:{field:'time',value:'Next 30 min'}}});
assert.deepEqual(ids(),[]);assert.equal(p.data.emptyTitle,'没有符合条件的任务');assert.match(p.data.emptyText,/清除筛选/);
p.select({currentTarget:{dataset:{field:'time',value:'Next hour'}}});assert.deepEqual(ids(),['future']);
store.update(s=>s.language='en');p.refresh();
assert.equal(p.data.areaFilter,'文星');assert.equal(p.data.areaTabs[2].label,'Wenxing');assert.equal(p.data.buildingTabs[1].key,'A01');
p.clear();assert.equal(p.data.filterCount,0);assert.equal(p.data.time,'Any time');assert.equal(p.data.buildingTabs.length,0);assert.equal(p.data.openCount,4);
assert.equal(p.data.emptyTitle,'Be the first to post');assert.doesNotMatch(p.data.emptyText,/clearing your filters/);
console.log('Order filters: package options, cloud/legacy destinations, combined types/buildings, counts, area reset, time compatibility and bilingual state passed.');
