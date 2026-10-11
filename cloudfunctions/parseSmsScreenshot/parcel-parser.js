function clean(s){return String(s||'').replace(/[—–－−]/g,'-').replace(/\s+/g,' ').trim();}
const {normalizePoint:cleanPoint}=require('./pickup-point');
function parseText(detections){
 const input=(detections||[]).slice();
 if(input.length&&input.every(x=>typeof x==='object'&&x.ItemPolygon))input.sort((a,b)=>a.ItemPolygon.Y-b.ItemPolygon.Y||a.ItemPolygon.X-b.ItemPolygon.X);
 const lines=input.map(x=>clean(typeof x==='string'?x:x.DetectedText)).filter(Boolean);
 const codeRx=/(?:^|[^A-Z0-9-])(\d{1,3}\s*-\s*\d{1,3}\s*-\s*\d{3,6})(?![\d-])/gi;
 const contextRx=/取件码|取货码|提货码|pick\s*-?\s*up\s*code|collection\s*code/i;
 const trackingRx=/物流单号|运单号|tracking|\b(?:YT|JD|SF|ZTO)\d{8,}/i;
 const pointRx=/菜鸟驿站|快递驿站|妈妈驿站|快递柜|丰巢|cainiao\s*station|parcel\s*station|store\s*(?:no\.?|#)\s*\d+|[\u4e00-\u9fff][\u4e00-\u9fff\d\s·（）()\-]{1,40}号店/i;
 const narrative=/^(?:already|your parcel|please|to be picked|out for delivery|in transit|您的|您有|已到|今日到)/i;
 const addressRx=/路|街|巷|广场|小区|校区|宿舍|栋|号|大道|\blane\b|\bstreet\b|\broad\b|\bavenue\b|\bplaza\b|\bsquare\b|\bbuilding\b|\bcampus\b/i;
 const headers=[];
 lines.forEach((line,i)=>{if(pointRx.test(line)&&!narrative.test(line)&&!contextRx.test(line))headers.push({i,point:cleanPoint(line)});});
 let pickupPoint=headers.length?headers[0].point:'';
 let pickupAddress='';
 if(headers.length){
  const h=headers[0];
  for(let i=h.i+1;i<Math.min(lines.length,h.i+5);i++){
   const line=lines[i];
   if(contextRx.test(line)||new RegExp(codeRx.source,'i').test(line))break;
   if(addressRx.test(line)&&!pointRx.test(line)&&!narrative.test(line)&&!trackingRx.test(line)){
    pickupAddress=line;
    if(i>h.i+1&&/^(?:B[I1]-?\d|No[., ]?\d)/i.test(lines[i-1]))pickupAddress=lines[i-1]+' '+line;
    const next=lines[i+1]||'';
    if(/^(?:avenue|road|street|lane|building|floor)\b/i.test(next)&&!contextRx.test(next))pickupAddress+=' '+next;
    break;
   }
  }
 }
 if(!pickupAddress)pickupAddress=lines.find(x=>addressRx.test(x)&&!pointRx.test(x)&&!new RegExp(codeRx.source,'i').test(x)&&!narrative.test(x)&&!trackingRx.test(x)&&!contextRx.test(x))||'';
 const candidates=[],seen=new Set();
 lines.forEach((line,i)=>{
  if(trackingRx.test(line)&&!contextRx.test(line))return;
  const re=new RegExp(codeRx.source,'gi');let match;
  while((match=re.exec(line))){
   const code=match[1].replace(/\s/g,'');
   const explicit=contextRx.test(line)||contextRx.test(lines[i-1]||'')||contextRx.test(lines[i+1]||'');
   const standalone=line.replace(match[0],'').replace(/复制|copy|[,:：，\s]/gi,'')==='';
   if(!explicit&&!standalone)continue;
   if(seen.has(code))continue;seen.add(code);
   const header=headers.filter(h=>h.i<i).slice(-1)[0]||headers[0];
   candidates.push({id:String(candidates.length),code,point:header?header.point:pickupPoint,address:headers.length<=1?pickupAddress:'',selected:true,label:'Pickup code',text:''});
  }
 });
 const pickupCodes=candidates.map(x=>x.code);
 if(new Set(candidates.map(x=>x.point)).size>1){pickupPoint='';pickupAddress='';}
 return{pickupCode:pickupCodes[0]||'',pickupCodes,pickupPoint,pickupAddress,candidates,needsReview:[...(!pickupCodes.length?['pickupCode']:[]),...(!pickupPoint?['pickupPoint']:[])]};
}
module.exports={parseText};
