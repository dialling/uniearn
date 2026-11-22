'use strict';
// Screenshot reading for the browser preview. In WeChat the scan cloud functions send the picture to
// Tencent Cloud OCR, whose keys exist only in the real cloud. Here the same cloud functions run in the
// browser, and their Tencent OCR client is replaced by Tesseract.js (loaded from the CDN on the first
// scan), which returns its lines in Tencent's TextDetections shape. The parsing code is the real one.
(function () {
  const SCRIPT = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
  // Pictures are shrunk before the simulated upload; keep the full-size file so the text stays readable.
  const originals = new Map();
  let worker = null;

  function loadScript() {
    if (window.Tesseract) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = SCRIPT; s.onload = resolve;
      s.onerror = () => reject(Error('Could not load the preview text reader (needs internet).'));
      document.head.appendChild(s);
    });
  }
  function getWorker() {
    if (!worker) worker = loadScript().then(() => window.Tesseract.createWorker(['chi_sim', 'eng'])).catch(e => { worker = null; throw e; });
    return worker;
  }
  const keyOf = dataUrl => String(dataUrl || '').replace(/^data:[^,]*,/, '');
  function image(src) {
    return new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = () => reject(Error('Could not open the screenshot.')); i.src = src; });
  }
  // Tesseract writes Chinese with a space between characters; WeChat's OCR does not.
  const tidy = s => String(s || '').replace(/\s+/g, ' ').replace(/([　-〿一-鿿＀-￯]) (?=[　-〿一-鿿＀-￯])/g, '$1').trim();

  window.PreviewOCR = {
    keep(shrunkUrl, file) {
      originals.set(keyOf(shrunkUrl), file);
      while (originals.size > 12) originals.delete(originals.keys().next().value);
    },
    // base64 of the uploaded picture -> [{DetectedText, ItemPolygon:{X,Y,Width,Height}}]
    async read(base64) {
      const file = originals.get(base64);
      const src = file ? URL.createObjectURL(file) : 'data:image/jpeg;base64,' + base64;
      try {
        const img = await image(src);
        // Scale so a phone screenshot is about 1400px wide: big enough for small Chinese text.
        const k = Math.max(0.5, Math.min(3, 1400 / img.naturalWidth)), c = document.createElement('canvas');
        c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
        const g = c.getContext('2d'); g.filter = 'grayscale(1) contrast(1.2)'; g.drawImage(img, 0, 0, c.width, c.height);
        const { data } = await (await getWorker()).recognize(c);
        // Tencent returns each separate piece of text on its own. Tesseract runs a row together, icons and parcel
        // photos included (read as junk with very low confidence), so drop those words and split at wide gaps.
        const out = [];
        for (const l of data.lines || []) {
          const h = l.bbox.y1 - l.bbox.y0; let seg = null;
          for (const w of l.words || []) {
            // A code stays even when a speck from the photo beside it lowers its confidence (".9-4-4447").
            const keep = w.confidence >= 30 || /\d+-\d+-\d+|\d{6,}/.test(w.text);
            if (!keep || !w.text.trim()) { seg = null; continue; }
            const b = w.bbox;
            if (!seg || b.x0 - seg.x1 > 0.8 * h) { seg = { text: [], x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1 }; out.push(seg); }
            seg.text.push(w.text); seg.x1 = Math.max(seg.x1, b.x1); seg.y0 = Math.min(seg.y0, b.y0); seg.y1 = Math.max(seg.y1, b.y1);
          }
        }
        return out.map(s => ({
          DetectedText: tidy(s.text.join(' ')),
          ItemPolygon: { X: Math.round(s.x0 / k), Y: Math.round(s.y0 / k), Width: Math.round((s.x1 - s.x0) / k), Height: Math.round((s.y1 - s.y0) / k) }
        })).filter(x => x.DetectedText);
      } finally { if (file) URL.revokeObjectURL(src); }
    }
  };
})();
