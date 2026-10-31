const filters=require('./order-filters'),campus=require('./campus');
const areaEnglish={'文缘':'Wenyuan','文星':'Wenxing','文萃':'Wencui','文荟':'Wenhui','芭菲':'Bafei'};
const value=x=>String(x||'').trim();
function canViewRoom(){return false;}
function detail(order,language='zh',showRoom=canViewRoom(order)){
 const zh=language!=='en',place=order.destinationType==='place',location=filters.location(order),area=campus.areaOfBuilding(location.building||order.dorm);
 const areaLabel=area?(zh?area.zh:area.en):(zh?location.area:areaEnglish[location.area])||'';
 return {genderKey:['male','female'].includes(order.dormGender)?order.dormGender:'',showDorm:order.category!=='task'&&!place,
  gender:order.dormGender==='male'?(zh?'男寝':'Men’s dorm'):order.dormGender==='female'?(zh?'女寝':'Women’s dorm'):'',
  area:areaLabel,building:location.building||value(order.dorm),room:showRoom&&!place?value(order.room):''};
}
function group(orders,language='zh',showRoom){
 const rows=orders.map(r=>detail(r,language,showRoom===undefined?canViewRoom(r):showRoom)),join=key=>[...new Set(rows.map(r=>r[key]).filter(Boolean))].join(' / ');
 const genders=rows.filter((r,i)=>r.genderKey&&rows.findIndex(x=>x.genderKey===r.genderKey)===i).map(r=>({key:r.genderKey,label:r.gender}));
 return {genders,showDorm:rows.some(r=>r.showDorm),gender:join('gender'),area:join('area'),building:join('building'),room:join('room')};
}
function merge(summary,request){
 const result={...summary,...request};
 // Older request snapshots blanked hall fields; prefer the nonempty public value.
 for(const key of ['dormGender','room','pickupPoint'])if(!result[key]&&summary&&summary[key])result[key]=summary[key];
 return result;
}
module.exports={detail,group,merge,canViewRoom};
