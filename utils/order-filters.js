// Area/building/type data comes from 订单筛选系统-复用包/data/config.json.
// Adapt its filters to both the package's orders and this app's cloud order fields.
const config=require('./order-filter-config');
const areaNames={'文缘':'Wenyuan','文星':'Wenxing','文萃':'Wencui','文荟':'Wenhui','芭菲':'Bafei'};
const areaIds={wenyuan:'文缘',wenxing:'文星',wencui:'文萃',wenhui:'文荟',bafei:'芭菲'};
const typeNames={food:'Takeaway',express:'Parcels',night:'Night market',other:'Any task'};
const buildings=config.areas.reduce((all,area)=>all.concat(config.buildings[area]),[]);
const types=[...new Set(config.types.map(x=>x.key).concat('other'))];
const text=value=>String(value||'').trim();

function normalize(value={}){
 const gender=['male','female'].includes(value.genderFilter)?value.genderFilter:'';
 const area=config.areas.includes(value.areaFilter)?value.areaFilter:'';
 const type=types.includes(value.typeFilter)?value.typeFilter:'';
 const building=text(value.buildingFilter).toUpperCase(),allowed=area?config.buildings[area]:buildings;
 return {genderFilter:gender,areaFilter:area,typeFilter:type,buildingFilter:allowed.includes(building)?building:''};
}

function location(order){
 if(order.destinationType==='place')return {area:'',building:''};
 const addresses=[order.building,order.dorm,order.delivery_location,order.deliveryLocation,order.deliveryAddress].map(value=>text(value).toUpperCase());
 let building='';
 // Structured destination fields take precedence over legacy address text.
 for(const address of addresses){building=buildings.find(b=>b==='芭菲'?address.includes(b):new RegExp('(^|[^A-Z0-9])'+b+'([^A-Z0-9]|$)').test(address))||'';if(building)break;}
 const address=addresses.join(' ');
 const area=building?config.areas.find(a=>config.buildings[a].includes(building)):
  areaIds[order.area]||(config.areas.includes(order.area)?order.area:config.areas.find(a=>address.includes(a)))||'';
 return {area,building};
}

function typeOf(order){
 if(types.includes(order.type))return order.type;
 if(order.category==='takeout')return order.night?'night':'food';
 return {parcel:'express',task:'other',buy:'buy',shopping:'buy'}[order.category]||'';
}

function matches(order,value){
 const selected=normalize(value);
 if(selected.genderFilter&&(order.destinationType==='place'||order.dormGender!==selected.genderFilter))return false;
 if(selected.typeFilter&&typeOf(order)!==selected.typeFilter)return false;
 if(!selected.areaFilter&&!selected.buildingFilter)return true;
 const destination=location(order);
 return (!selected.areaFilter||destination.area===selected.areaFilter)&&(!selected.buildingFilter||destination.building===selected.buildingFilter);
}

function tabs(value={},language='zh'){
 const selected=normalize(value),en=language==='en',all={key:'',label:en?'All':'全部'};
 return {
  genderTabs:[all,{key:'male',label:en?'Men’s dorms':'男寝'},{key:'female',label:en?'Women’s dorms':'女寝'}],
  areaTabs:[all,...config.areas.map(area=>({key:area,label:en?areaNames[area]:area}))],
  typeTabs:[all,...config.types.map(type=>({key:type.key,label:en?typeNames[type.key]:type.label}))],
  buildingTabs:selected.areaFilter?[all,...config.buildings[selected.areaFilter].map(building=>({key:building,label:building==='芭菲'&&en?'Bafei':building}))]:[]
 };
}

module.exports={normalize,location,typeOf,matches,tabs};
