// UniEarn runs on one campus in China. Show every time in China time (UTC+8)
// even when a student's phone uses another time zone.
const OFFSET=8*3600000,DAY=86400000;
const pad=n=>String(n).padStart(2,'0');
function parts(ts){const d=new Date(Number(ts)+OFFSET);return {year:d.getUTCFullYear(),month:d.getUTCMonth()+1,day:d.getUTCDate(),hour:d.getUTCHours(),minute:d.getUTCMinutes(),weekday:d.getUTCDay()};}
function valid(ts){return ts!==null&&ts!==undefined&&ts!==''&&Number.isFinite(Number(ts))&&Number(ts)>0;}
function dayKey(ts){const p=parts(ts);return p.year+'-'+pad(p.month)+'-'+pad(p.day);}
function date(ts){if(!valid(ts))return '';const p=parts(ts);return p.year+'/'+p.month+'/'+p.day;}
function time(ts){if(!valid(ts))return '';const p=parts(ts);return pad(p.hour)+':'+pad(p.minute);}
function dateTime(ts){if(!valid(ts))return '';return date(ts)+' '+time(ts);}
function short(ts){if(!valid(ts))return '';const p=parts(ts);return p.month+'/'+p.day+' '+time(ts);}
module.exports={DAY,parts,dayKey,date,time,dateTime,short};
