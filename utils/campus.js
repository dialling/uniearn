// Real XJTLU dorm data, synced from mini program 1 (xjtlu-run-no-run/utils/util.js).
// Building codes are language-neutral; area names and pickup points are bilingual.
const AREAS=[
  {id:'wenyuan',zh:'文缘',en:'Wenyuan',floors:23,buildings:['D01','D02','D03','D04','D05','D06']},
  {id:'wenxing',zh:'文星',en:'Wenxing',floors:6,buildings:['A01','A02','A03','A04','A05']},
  {id:'wencui',zh:'文萃',en:'Wencui',floors:23,buildings:['C01','C02','C03','C04','C05','C06','C07','C08','C09','C10']},
  {id:'wenhui',zh:'文荟',en:'Wenhui',floors:23,buildings:['B01','B02','B03','B04','B05','B06','B07','B08','B09','B10']}
];
// 文缘 D01–D06、文萃 C01–C10、文荟 B01–B10 每栋 23 层；文星 A05 20 层，其余默认 6 层。
const FLOORS={D01:23,D02:23,D03:23,D04:23,D05:23,D06:23,C01:23,C02:23,C03:23,C04:23,C05:23,C06:23,C07:23,C08:23,C09:23,C10:23,B01:23,B02:23,B03:23,B04:23,B05:23,B06:23,B07:23,B08:23,B09:23,B10:23,A05:20};
const FLOOR_MAX=6;
const NO_FLOOR_SURCHARGE=['A05'];
const HIGH_FLOOR_AREA='wenxing',HIGH_FLOOR_MIN=3,HIGH_FLOOR_CENTS=100;
// Pickup points seen in mini program 1. English stays the stored value; zh is display only.
const STATIONS=[
  {value:'North gate',zh:'北门',en:'North gate'},
  {value:'South gate',zh:'南门',en:'South gate'},
  {value:'East gate',zh:'东门',en:'East gate'},
  {value:'Parcel station',zh:'快递站',en:'Parcel station'},
  {value:'Wenyuan Cainiao station',zh:'文缘菜鸟驿站',en:'Wenyuan Cainiao station'},
  {value:'Wenyuan takeaway locker',zh:'文缘外卖柜',en:'Wenyuan takeaway locker'},
  {value:'Hanlin Mama station',zh:'翰林妈妈驿站',en:'Hanlin Mama station'},
  {value:'North gate Cainiao station',zh:'北门菜鸟驿站',en:'North gate Cainiao station'},
  {value:'East gate JD point',zh:'东门京东快递点',en:'East gate JD point'}
];
function buildings(){return AREAS.reduce((a,x)=>a.concat(x.buildings),[]);}
function buildingsOf(areaId){const a=AREAS.find(x=>x.id===areaId);return a?a.buildings.slice():[];}
function areaOfBuilding(code){const b=String(code||'').trim().toUpperCase();return AREAS.find(a=>a.buildings.indexOf(b)>=0)||null;}
function isBuilding(code){return !!areaOfBuilding(code);}
function areaLabel(areaId,lang){const a=AREAS.find(x=>x.id===areaId);return a?(lang==='en'?a.en:a.zh):'';}
function buildingLabel(code,lang){const raw=String(code||'');if(!raw.trim()||raw==='Choose building')return lang==='en'?'Choose building':'选择楼栋';return raw;}
function maxFloorOf(code){const b=String(code||'').trim().toUpperCase();if(b&&FLOORS[b])return FLOORS[b];return b?FLOOR_MAX:Math.max(FLOOR_MAX,...Object.values(FLOORS));}
function floorsOf(code){const out=[];for(let i=1;i<=maxFloorOf(code);i++)out.push(i);return out;}
// Room numbers like 1201 sit on floor 12; 401 on 4. Unknown formats return 0.
function floorOfRoom(room){const m=String(room||'').trim().match(/^(\d{3,4})$/);if(!m)return 0;const n=Number(m[1]);const f=Math.floor(n/100);return f>=1?f:0;}
function highFloor(areaId,floor,code){const b=String(code||'').trim().toUpperCase();return areaId===HIGH_FLOOR_AREA&&Number(floor)>=HIGH_FLOOR_MIN&&NO_FLOOR_SURCHARGE.indexOf(b)<0;}
function stationLabel(value,lang){const s=STATIONS.find(x=>x.value===value);return s?(lang==='en'?s.en:s.zh):String(value||'');}
function stationValues(){return STATIONS.map(x=>x.value);}
module.exports={AREAS,FLOORS,FLOOR_MAX,NO_FLOOR_SURCHARGE,HIGH_FLOOR_AREA,HIGH_FLOOR_MIN,HIGH_FLOOR_CENTS,STATIONS,buildings,buildingsOf,areaOfBuilding,isBuilding,areaLabel,buildingLabel,maxFloorOf,floorsOf,floorOfRoom,highFloor,stationLabel,stationValues,areas:AREAS};
