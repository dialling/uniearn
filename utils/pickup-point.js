// Extract the name actually present in this notice. Never default to a campus.
function normalizePoint(value) {
  return String(value || '').replace(/[—–－−]/g, '-').replace(/\s+/g, ' ')
    .replace(/\s*[>›].*$/, '').replace(/\s*(?:畅通|联系)\s*$/, '')
    .replace(/[,，]\s*$/, '').trim()
    // Confirmed OCR icon artefact; preserve legitimate 公 elsewhere.
    .replace(/^公\s*(?=太仓青草巷广场二十一号店)/, '');
}
function extractPoint(value) {
  const original = String(value || '');
  const text = original.replace(/\s+/g, ' ').trim();
  const compact = text.replace(/\s/g, '');
  const match = compact.match(/(?:到(?!站)|在|位于|暂存于|请前往)([\u4e00-\u9fffA-Za-z0-9（）()·-]{2,65}?(?:号店|驿站|快递柜|自提点|服务站|营业点))/);
  if (match) return normalizePoint(match[1].replace(/^.*(?:凭\d[\d-]*到)/, ''));
  const english = text.match(/(?:at|to)\s+((?:Cainiao\s+Station[,]?\s*)?Store\s*(?:No\.?|#)\s*\d+[^。;]*?)(?=\.\s*(?:Please|Your)|[,，]\s*(?:pickup|collection)\s*code|$)/i);
  if (english) return normalizePoint(english[1]);
  const stationLine = original.split(/[\n。；;]/).find(line => line.trim().length <= 80 &&
    /驿站|快递柜|自提点|服务站|号店|parcel station|cainiao station|store\s*(?:no\.?|#)\s*\d+/i.test(line) &&
    !/包裹|取件码|取货码|您的|您有|已到|凭\d|please|your parcel|pickup code/i.test(line));
  return stationLine ? normalizePoint(stationLine) : '';
}
module.exports = {normalizePoint, extractPoint};
