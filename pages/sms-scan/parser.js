const DAY = 86400000;
const codePattern = /(?:^|[^A-Za-z0-9])(\d{1,3}\s*-\s*\d{1,3}\s*-\s*\d{3,6})(?!\d)/g;
function clean(s) { return String(s || '').replace(/[—–－−]/g, '-').replace(/\s+/g, ' ').trim(); }
function dateOf(s, now) {
  const today = Math.floor((now + 8 * 3600000) / DAY);
  if (/^(?:today|今天)\b/i.test(s) || /^今天/.test(s)) return today;
  if (/^(?:yesterday|昨天)\b/i.test(s) || /^昨天/.test(s)) return today - 1;
  let m = s.match(/^(?:(\d{4})[年/.-])?(\d{1,2})[月/.-](\d{1,2})(?:日|号)?(?:\s|$)/);
  let year, month, day;
  if (m) { year = m[1] && +m[1]; month = +m[2]; day = +m[3]; }
  else {
    m = s.match(/^(?:(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*,?\s+)?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})(?:,?\s+(\d{4}))?(?:\s|$)/i);
    if (!m) return null;
    month = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].indexOf(m[1].toLowerCase()) + 1;
    day = +m[2]; year = m[3] && +m[3];
  }
  if (!month || month > 12 || !day || day > 31) return null;
  const currentYear = new Date(now + 8 * 3600000).getUTCFullYear();
  let value = Math.floor(Date.UTC(year || currentYear, month - 1, day) / DAY);
  if (!year && value > today + 1) value = Math.floor(Date.UTC(currentYear - 1, month - 1, day) / DAY);
  const check = new Date(value * DAY);
  return check.getUTCMonth() === month - 1 && check.getUTCDate() === day ? value : null;
}
const {extractPoint:pointOf}=require('../../utils/pickup-point');
function parseSms(detections, now = Date.now()) {
  let input = typeof detections === 'string' ? detections.split(/\n/) : (detections || []).slice();
  // Preserve reading order; merge OCR fragments on the same visual row.
  if (input.length && input.every(x => x && typeof x === 'object' && x.ItemPolygon)) {
    input.sort((a,b) => a.ItemPolygon.Y - b.ItemPolygon.Y || a.ItemPolygon.X - b.ItemPolygon.X);
    const rows = [];
    input.forEach(x => {
      const p = x.ItemPolygon, row = rows[rows.length-1];
      if (row && Math.abs(row.y - p.Y) <= Math.max(3, Math.min(row.h, p.Height) * 0.45)) row.items.push(x);
      else rows.push({ y:p.Y, h:p.Height, items:[x] });
    });
    input = rows.map(r => r.items.sort((a,b)=>a.ItemPolygon.X-b.ItemPolygon.X).map(x=>x.DetectedText).join(' '));
  }
  const groups = [];
  let current = {day:null, label:'Time unclear', lines:[]};
  const flush = () => { if (current.lines.length) groups.push(current); };
  input.map(x=>clean(typeof x === 'string' ? x : x.DetectedText)).filter(Boolean).forEach(line => {
    const date = dateOf(line, now);
    if (date !== null) { flush(); current = {day:date, label:line, lines:[]}; return; }
    if (/^[【\[][^】\]]+(?:驿站|快递)[^】\]]*[】\]]/.test(line) && current.lines.length) {
      flush(); current = {day:current.day, label:current.label, lines:[]};
    }
    current.lines.push(line);
  });
  flush();
  const messages = groups.map((g,i) => {
    const text = g.lines.join(' '), codes = [];
    const re = new RegExp(codePattern.source,'g'); let match;
    while ((match = re.exec(text))) codes.push(match[1].replace(/\s/g,''));
    return {...g, text, codes:[...new Set(codes)], point:pointOf(text), index:i};
  }).filter(g=>g.codes.length);
  if (!messages.length) return {candidates:[], note:'No pickup codes found. Try a clearer photo or paste the SMS.'};
  const latest = messages[messages.length-1];
  // Only include a previous calendar day when the latest dated message is at the bottom.
  const chosen = messages.filter(g => latest.day !== null ? g.day !== null && g.day <= latest.day && latest.day-g.day <= 1 : g === latest);
  const chosenIds = new Set(chosen.map(g=>g.index)), seen = new Set(), candidates = [];
  messages.slice().reverse().forEach(g => g.codes.forEach(code => {
    if (seen.has(code)) return; seen.add(code);
    candidates.push({id:String(candidates.length), code, label:g.label, point:g.point, selected:chosenIds.has(g.index), text:g.text});
  }));
  const note = latest.day === null ? 'Time unclear: selected the bottom message. Review all codes.' : 'Selected the latest day and previous day where available. Older messages remain below.';
  return {candidates, note};
}
module.exports = {parseSms, dateOf};
