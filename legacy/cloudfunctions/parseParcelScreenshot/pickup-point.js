// Extract the name actually present in this notice. Never default to a campus.
function normalizePoint(value) {
  return String(value || '').replace(/[—–－−]/g, '-').replace(/\s+/g, ' ')
    .replace(/\s*[>›].*$/, '').replace(/\s*(?:畅通|联系)\s*$/, '')
    .replace(/[,，]\s*$/, '').trim()
    // Confirmed OCR icon artefact; preserve legitimate 公 elsewhere.
    .replace(/^公\s*(?=太仓青草巷广场二十一号店)/, '');
}
// Text the courier apps put on their own screens, e.g. the Cainiao search box "到驿站的所有包裹都可查"
// and "欢迎使用菜鸟驿站". It contains 到…驿站 but is never a station name.
const APP_TEXT = /所有包裹|都可查|可查询|欢迎|使用|搜索/;
function extractPoint(value) {
  const original = String(value || '');
  const text = original.replace(/\s+/g, ' ').trim();
  const compact = text.replace(/\s/g, '');
  for (const match of compact.matchAll(/(?:到(?!站)|在|位于|暂存于|请前往)([\u4e00-\u9fffA-Za-z0-9（）()·-]{2,65}?(?:号店|驿站|快递柜|自提点|服务站|营业点))/g)) {
    const name = match[1].replace(/^.*(?:凭\d[\d-]*到)/, '');
    if (!APP_TEXT.test(name)) return normalizePoint(name);
  }
  const english = text.match(/(?:at|to)\s+((?:Cainiao\s+Station[,]?\s*)?Store\s*(?:No\.?|#)\s*\d+[^。;]*?)(?=\.\s*(?:Please|Your)|[,，]\s*(?:pickup|collection)\s*code|$)/i);
  if (english) return normalizePoint(english[1]);
  const stationLine = original.split(/[\n。；;]/).find(line => line.trim().length <= 80 &&
    /驿站|快递柜|自提点|服务站|号店|parcel station|cainiao station|store\s*(?:no\.?|#)\s*\d+/i.test(line) &&
    !/包裹|取件码|取货码|您的|您有|已到|凭\d|please|your parcel|pickup code/i.test(line) && !APP_TEXT.test(line));
  return stationLine ? normalizePoint(stationLine) : '';
}
module.exports = {normalizePoint, extractPoint, APP_TEXT};
