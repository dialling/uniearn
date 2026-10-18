// Chinese display text for the order, chat and saved-route pages.
// English is the source text; values saved locally or sent to the cloud stay in English.
const pairs={'No runner in 1 hour · cancelled':'1 小时无人接单，已自动取消','Malicious order':'恶意下单','Runner unreachable':'接单后失联','Harassment':'言语骚扰','Damaged or lost':'物品损坏或丢失','Fake proof':'虚假凭证','Not received':'未收到货',
 'Not received':'没有收到','Wrong bag':'拿错了','Spilled or damaged':'洒漏或损坏','Something else':'其他问题',
 'At your door':'放在门口','At the front desk':'放在前台','Downstairs':'放在楼下','At the stated location':'送到指定地点',
 'At my door':'送到门口','Lobby · I’ll come down':'大堂 · 我下楼取','Meet at the stated location':'在指定地点见面',
 'Study spot':'自习地点','Classroom':'教室','Roommate':'室友','Other':'其他','My dorm':'我的宿舍','Choose building':'选择楼栋',
 'bags':'袋','boxes':'件','task':'项',
 'I’m on my way':'我在路上了','I’m downstairs':'我到楼下了','Thank you!':'谢谢！',
 'Enter an 11-digit mobile number that starts with 1.':'请输入以 1 开头的 11 位手机号。',
 'Choose where to collect.':'请选择取件点。','Describe exactly where to deliver.':'请写清楚送达地点。','Keep the delivery address under 500 characters.':'送达地址请控制在 500 字以内。','Choose your building and add a room.':'请选择楼栋并填写房间号。','Add the name on the order.':'请填写订单上的姓名。','This saved route is unavailable.':'这条常用路线已不可用。'
};
function translate(value,language){return language==='en'||typeof value!=='string'?value:(pairs[value]||value);}
function error(e,language){const message=e&&e.message||String(e);return language==='en'?e:{message:pairs[message]||message};}
module.exports={translate,error};
