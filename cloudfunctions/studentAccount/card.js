// Text recognition is NOT proof of enrolment or card authenticity.
function readCard(detections,expectedName='') {
  const ordered=(detections||[]).slice();
  if(ordered.length&&ordered.every(x=>x.ItemPolygon))ordered.sort((a,b)=>a.ItemPolygon.Y-b.ItemPolygon.Y||a.ItemPolygon.X-b.ItemPolygon.X);
  const lines=ordered.map(x=>({text:String(x.DetectedText||'').trim(),confidence:Number(x.Confidence)||0}));
  const text=lines.map(x=>x.text).join('\n');
  const school=lines.some(x=>x.confidence>=80&&/XJTLU|西交利物浦|XI.?AN\s+JIAOTONG.?LIVERPOOL/i.test(x.text));
  const student=lines.some(x=>x.confidence>=80&&/STUDENT|学生|学号/i.test(x.text));
  const candidates=[];
  lines.forEach((x,i)=>{
    const contextual=/student\s*(?:id|number|no)|学号/i.test(x.text+' '+(lines[i-1]||{}).text);
    if(!contextual)return;
    const m=x.text.match(/(?:^|\D)(\d{7,10})(?!\d)/);
    if(m&&x.confidence>=85)candidates.push(m[1]);
  });
  if(!candidates.length&&school&&student){
    lines.forEach(x=>{if(x.confidence>=85&&/^\d{7,10}$/.test(x.text))candidates.push(x.text);});
  }
  const numbers=[...new Set(candidates)];
  if(!school||!student||numbers.length!==1)return {readable:false,reason:!school?'school_not_found':numbers.length!==1?'number_unclear':'student_label_missing'};

  const names=[];
  const validName=value=>/^[\u4e00-\u9fff·]{2,20}$/.test(value)||/^[A-Za-z][A-Za-z .'-]{1,59}$/.test(value);
  lines.forEach((x,i)=>{
    if(x.confidence<85)return;
    const label=x.text.match(/^(?:姓名|学生姓名|name|student\s*name)\s*[:：]?\s*(.*)$/i);
    if(!label)return;
    let value=label[1].trim();
    if(!value&&lines[i+1]&&lines[i+1].confidence>=85)value=lines[i+1].text;
    if(validName(value)&&!/student|university|number|school|xjtlu|姓名|学号|大学/i.test(value))names.push(value);
  });
  const normal=value=>String(value||'').replace(/[\s·.'’-]/g,'').toLowerCase();
  if(!names.length&&validName(expectedName)){
    const match=lines.find(x=>x.confidence>=85&&normal(x.text)===normal(expectedName));
    if(match)names.push(match.text);
  }

  // XJTLU vertical card: unlabelled English name, Chinese name, then student number.
  if(!names.length){
    const numberIndex=lines.findIndex(x=>x.confidence>=85&&x.text===numbers[0]);
    if(numberIndex>=0){
      const nearby=lines.slice(Math.max(0,numberIndex-2),numberIndex).filter(x=>x.confidence>=85);
      const chinese=nearby.filter(x=>/^[\u4e00-\u9fff·]{2,6}$/.test(x.text)&&!/(大学|学生|学号|姓名|西交|利物浦)/.test(x.text));
      const english=nearby.filter(x=>/^[A-Za-z][A-Za-z.'’-]*(?:\s+[A-Za-z][A-Za-z.'’-]*){1,4}$/.test(x.text)&&!/(student|university|school|jiaotong|liverpool|number|name)/i.test(x.text));
      if(chinese.length===1)names.push(chinese[0].text);
      else if(!chinese.length&&english.length===1)names.push(english[0].text);
    }
  }
  const unique=[...new Set(names)];
  if(unique.length!==1)return {readable:false,reason:'name_unclear'};
  return {readable:true,studentNumber:numbers[0],studentName:unique[0],school:'XJTLU'};

}
module.exports={readCard};
