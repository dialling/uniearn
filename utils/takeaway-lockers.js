const campus=require('./campus');

const shared=[
 {id:'fengshihui-kfc',value:'丰食汇KFC外卖柜',en:'Fengshihui KFC takeaway locker'},
 {id:'wenyuan-night-market',value:'文缘夜市门口外卖柜',en:'Locker at the Wenyuan night market entrance'},
 {id:'wenxing-southeast',value:'文星东南门口外卖点（翰林妈妈驿站对面）',en:'Wenxing southeast gate, opposite Hanlin Mama station'},
 {id:'wenxing-fruit-shop',value:'文星水果店门口外卖点',en:'Pickup point outside the Wenxing fruit shop'}
];
const wencui=[
 {id:'wencui-north',value:'文萃北门外卖柜',en:'Wencui north gate takeaway locker'},
 {id:'wencui-west',value:'文萃西门两个外卖柜',en:'The two takeaway lockers at Wencui west gate'}
];

function options(address,language='zh'){
 const building=campus.areaOfBuilding(address.dorm);
 const area=address.destinationType==='place'?'':building?building.id:address.area;
 const common=area==='wenyuan'||area==='wenxing';
 const group=common?'wenyuan-wenxing':area==='wencui'?'wencui':area==='wenhui'?'wenhui':'manual';
 const presets=common?shared:area==='wencui'?wencui:[];
 const items=presets.map(x=>({...x,label:language==='en'?x.en:x.value}));
 if(common)items.push({id:'other',value:'',label:language==='en'?'Other (type it yourself)':'其他（自行填写）'});
 return {group,manual:!presets.length,items};
}

function label(value,language='zh'){
 const preset=shared.concat(wencui).find(x=>x.value===value);
 return preset&&language==='en'?preset.en:String(value||'');
}

// Keep the most recent valid selection per account, campus and locker area.
function memoryScope(){const p=require('./store').get().profile;return (p.accountId||'local')+':'+(p.campusId||'sip');}
function selection(config,choice,custom){
 const item=config.items.find(x=>x.id===choice),manual=config.manual||choice==='other';
 if(config.manual?choice!=='other':!item)return null;
 const text=String(custom||'').trim(),point=manual?text:item.value;
 return point&&point.length<=200?{choice,custom:manual?text:''}:null;
}
function recall(address){
 const state=require('./store').get(),config=options(address),saved=(state.takeawayLockerMemory||{})[memoryScope()]?.[config.group];
 return saved?selection(config,saved.choice,saved.custom):null;
}
function remember(address,choice,custom){
 const config=options(address),saved=selection(config,choice,custom);if(!saved)return;
 const scope=memoryScope();require('./store').update(s=>{s.takeawayLockerMemory=s.takeawayLockerMemory||{};s.takeawayLockerMemory[scope]={...(s.takeawayLockerMemory[scope]||{}),[config.group]:saved};});
}
module.exports={options,label,memoryScope,recall,remember};
