// Chinese display names for English values stored on orders and trips. The stored values stay English because the cloud validates and keeps them.
const pairs={"Takeaway pickup":"外卖取件","Wenyuan Cainiao station":"文缘菜鸟驿站","Wenyuan takeaway locker":"文缘外卖柜","Hanlin Mama station":"翰林妈妈驿站","North gate Cainiao station":"北门菜鸟驿站","East gate JD point":"东门京东快递点","North gate":"北门","South gate":"南门","East gate":"东门","Station A":"快递站 A","Station B":"快递站 B","Station C":"快递站 C","Takeaway counter A":"外卖柜 A","Takeaway counter B":"外卖柜 B","Dorm 7 side":"靠近 7 号宿舍","food street":"美食街","library side":"图书馆一侧","Parcel pickup":"快递取件点","At your door":"放在门口","At my door":"放在门口","At the front desk":"放在前台","Downstairs":"放在楼下","At the stated location":"放在指定地点","Meet at the stated location":"在指定地点碰面","Lobby · I’ll come down":"大堂 · 我会下楼取","Not received":"未收到","Wrong bag":"拿错了","Spilled or damaged":"洒漏或损坏","Something else":"其他问题","Late cancellation":"临时取消","Choose a valid time":"请选择有效时间","Choose a capacity between 1 and 12":"请选择 1 到 12 之间的容量","Choose a pickup point and destination":"请选择取件点和目的地","Choose 5, 10 or 15 minutes":"请选择 5、10 或 15 分钟","Choose a departure more than 10 minutes from now":"请选择 10 分钟以后的出发时间"};
function zh(language){return language!=='en';}
function names(language){return zh(language)?pairs:{};}
function name(value,language){return zh(language)&&pairs[value]||value;}
function unit(value,language){return zh(language)?({bags:'袋',boxes:'件',task:'个任务'}[value]||value):value;}
const days={en:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],zh:['周日','周一','周二','周三','周四','周五','周六']};
function day(label,language){if(!zh(language))return label;if(label==='Today')return '今天';const i=days.en.indexOf(label);return i<0?label:days.zh[i];}
module.exports={zh,names,name,unit,day};
