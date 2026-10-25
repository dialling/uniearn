const filters=require('./order-filters'),campus=require('./campus');
const areaEnglish={'文缘':'Wenyuan','文星':'Wenxing','文萃':'Wencui','文荟':'Wenhui','芭菲':'Bafei'};
const value=x=>String(x||'').trim();
function detail(order,language='zh'){
 const zh=language!=='en',place=order.destinationType==='place',location=filters.location(order),area=campus.areaOfBuilding(location.building||order.dorm);
 const areaLabel=area?(zh?area.zh:area.en):(zh?location.area:areaEnglish[location.area])||'';
 return {showDorm:order.category!=='task'&&!place,
  gender:order.dormGender==='male'?(zh?'男寝':'Men’s dorm'):order.dormGender==='female'?(zh?'女寝':'Women’s dorm'):'',
  area:areaLabel,building:location.building||value(order.dorm),room:!place?value(order.room):''};
}
function group(orders,language='zh'){
 const rows=orders.map(r=>detail(r,language)),join=key=>[...new Set(rows.map(r=>r[key]).filter(Boolean))].join(' / ');
 return {showDorm:rows.some(r=>r.showDorm),gender:join('gender'),area:join('area'),building:join('building'),room:join('room')};
}
function merge(summary,request){
 const result={...summary,...request};
 // Older request snapshots blanked hall fields; prefer the nonempty public value.
 for(const key of ['dormGender','room','pickupPoint'])if(!result[key]&&summary&&summary[key])result[key]=summary[key];
 return result;
}
module.exports={detail,group,merge};
