// Chinese labels for order text produced by utils/workflow.js and by the cloud
// order history. English stays the source text so the cloud data does not change.
const pairs={
 'Finding another runner':'正在重新匹配跑手','Waiting for a runner':'等待跑手接单','Runner accepted':'跑手已接单','On the way':'配送中','Delivered · please check':'已送达 · 请确认','Confirmed':'已确认','Cancelled · demo refund':'已取消 · 模拟退款','No runner · demo refund':'无人接单 · 模拟退款','Issue reported · under review':'已反馈问题 · 审核中',
 'Posted':'已发布','Picked up':'已取件','Delivered · photo':'已送达 · 附照片','Automatically confirmed':'已自动确认','Closed · no runner · demo refund':'已关闭 · 无人接单 · 模拟退款','Issue reported · settlement paused':'已反馈问题 · 暂停结算','Collecting it myself':'我自己去取','Photo and note sent':'已提交照片和说明','Review resolved · confirmed':'审核完成 · 已确认','Review resolved · simulated refund':'审核完成 · 模拟退款','Seal already broken at pickup':'取餐时封签已破损',
 'Food is there now':'外卖已到','Small':'小件','Medium':'中件','Large':'大件','Extra large':'超大件','Takeaway':'外卖','Task':'任务','Room':'房间'
};
const prefixes=[['Offer raised by ¥','加价 ¥'],['Runner cancelled: ','跑手已取消：'],['Arrival moved to ','送达时间改为 '],['Arrives ','预计到达 ']];
const reasons={missing:'外卖未到',quantity:'数量不符',personal:'个人原因',mismatch:'信息不符'};
function translate(value,language){
 if(language==='en'||typeof value!=='string')return value;
 if(pairs[value])return pairs[value];
 for(const [en,zh] of prefixes)if(value.startsWith(en)){const rest=value.slice(en.length);return zh+(reasons[rest]||rest);}
 if(value.includes(' × ')||value.includes(' · '))return value.split(' · ').map(part=>part.split(' × ').map(x=>pairs[x]||x).join(' × ')).join(' · ');
 return value;
}
module.exports={translate};
