'use strict';
// Lossless PNG optimizer (no dependencies): same pixels, smaller file.
// - drops metadata chunks (text, time, colour profiles) that the mini program does not use
// - stores the image as RGB when it has no transparency, or as a palette when it has 256 colours or fewer
// - picks the best row filter and recompresses at maximum zlib level
// Every result is decoded again and compared pixel by pixel; a file is only replaced when it is identical and smaller.
// Usage: node scripts/png-optimize.js [--dry] file.png [more.png ...]
const fs = require('fs'), zlib = require('zlib');

const SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const CRC_TABLE = (() => { const t = new Int32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; } return t; })();
const crc32 = buf => { let c = -1; for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };

function chunks(buf) {
  if (!buf.subarray(0, 8).equals(SIG)) throw Error('not a PNG');
  const out = []; let o = 8;
  while (o < buf.length) { const len = buf.readUInt32BE(o), type = buf.toString('latin1', o + 4, o + 8); out.push({ type, data: buf.subarray(o + 8, o + 8 + len) }); o += 12 + len; }
  return out;
}

// Decode to RGBA 8-bit. Supports bit depth 8 (colour types 0, 2, 3, 4, 6) and palettes of depth 1/2/4/8, non-interlaced.
function decode(buf) {
  const cs = chunks(buf), ih = cs.find(c => c.type === 'IHDR').data;
  const w = ih.readUInt32BE(0), h = ih.readUInt32BE(4), depth = ih[8], ct = ih[9], interlace = ih[12];
  if (interlace) throw Error('interlaced PNG not supported');
  const plte = cs.find(c => c.type === 'PLTE'), trns = cs.find(c => c.type === 'tRNS');
  if (ct !== 3 && depth !== 8) throw Error('bit depth ' + depth + ' not supported');
  const ch = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[ct], bpp = Math.max(1, (ch * depth) >> 3), stride = (w * ch * depth + 7) >> 3;
  const raw = zlib.inflateSync(Buffer.concat(cs.filter(c => c.type === 'IDAT').map(c => c.data)));
  const px = Buffer.alloc(stride * h); let prev = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)), cur = px.subarray(y * stride, (y + 1) * stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0; let v = line[i];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      cur[i] = v & 255;
    }
    prev = cur;
  }
  const rgba = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const o = (y * w + x) * 4, r = y * stride;
    if (ct === 6) px.copy(rgba, o, r + x * 4, r + x * 4 + 4);
    else if (ct === 2) { px.copy(rgba, o, r + x * 3, r + x * 3 + 3); rgba[o + 3] = 255; if (trns && px[r + x * 3] === trns.data[1] && px[r + x * 3 + 1] === trns.data[3] && px[r + x * 3 + 2] === trns.data[5]) rgba[o + 3] = 0; }
    else if (ct === 0) { const g = px[r + x]; rgba[o] = rgba[o + 1] = rgba[o + 2] = g; rgba[o + 3] = trns && g === trns.data[1] ? 0 : 255; }
    else if (ct === 4) { const g = px[r + x * 2]; rgba[o] = rgba[o + 1] = rgba[o + 2] = g; rgba[o + 3] = px[r + x * 2 + 1]; }
    else { // palette
      const bit = x * depth, byte = px[r + (bit >> 3)], idx = (byte >> (8 - depth - (bit & 7))) & ((1 << depth) - 1);
      rgba[o] = plte.data[idx * 3]; rgba[o + 1] = plte.data[idx * 3 + 1]; rgba[o + 2] = plte.data[idx * 3 + 2]; rgba[o + 3] = trns && idx < trns.data.length ? trns.data[idx] : 255;
    }
  }
  return { w, h, rgba };
}

function chunk(type, data) { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type, 'latin1'), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, crc]); }

// Filter every row with the filter that gives the smallest sum of absolute values (standard heuristic), or one fixed filter.
function filterRows(rows, stride, bpp, mode) {
  const out = Buffer.alloc(rows.length * (stride + 1)); let prev = Buffer.alloc(stride);
  const tryF = (f, cur, dst) => { let sum = 0; for (let i = 0; i < stride; i++) { const a = i >= bpp ? cur[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0; let p; if (f === 0) p = cur[i]; else if (f === 1) p = cur[i] - a; else if (f === 2) p = cur[i] - b; else if (f === 3) p = cur[i] - ((a + b) >> 1); else { const q = a + b - c, pa = Math.abs(q - a), pb = Math.abs(q - b), pc = Math.abs(q - c); p = cur[i] - (pa <= pb && pa <= pc ? a : pb <= pc ? b : c); } p &= 255; if (dst) dst[i] = p; sum += p < 128 ? p : 256 - p; } return sum; };
  rows.forEach((cur, y) => {
    let best = mode;
    if (mode === 'auto') { let bs = Infinity; for (let f = 0; f < 5; f++) { const s = tryF(f, cur, null); if (s < bs) { bs = s; best = f; } } }
    out[y * (stride + 1)] = best; tryF(best, cur, out.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1))); prev = cur;
  });
  return out;
}

function encode({ w, h, rgba }) {
  let opaque = true; const colors = new Map();
  for (let i = 0; i < rgba.length; i += 4) { if (rgba[i + 3] !== 255) opaque = false; if (colors.size <= 256) { const k = rgba.readUInt32BE(i); if (!colors.has(k)) colors.set(k, colors.size); } }
  const variants = [];
  const make = (ct, rows, stride, bpp, extra) => {
    const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = ct; ihdr[10] = ihdr[11] = ihdr[12] = 0;
    for (const mode of ['auto', 0, 1, 2, 4]) for (const strategy of [zlib.constants.Z_DEFAULT_STRATEGY, zlib.constants.Z_FILTERED]) {
      const idat = zlib.deflateSync(filterRows(rows, stride, bpp, mode), { level: 9, memLevel: 9, strategy });
      variants.push(Buffer.concat([SIG, chunk('IHDR', ihdr), ...extra, chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]));
    }
  };
  if (colors.size <= 256) { // exact palette (lossless)
    const pal = [...colors.keys()], plte = Buffer.alloc(pal.length * 3), trns = Buffer.alloc(pal.length);
    pal.forEach((k, i) => { plte[i * 3] = k >>> 24; plte[i * 3 + 1] = (k >>> 16) & 255; plte[i * 3 + 2] = (k >>> 8) & 255; trns[i] = k & 255; });
    const rows = []; for (let y = 0; y < h; y++) { const r = Buffer.alloc(w); for (let x = 0; x < w; x++) r[x] = colors.get(rgba.readUInt32BE((y * w + x) * 4)); rows.push(r); }
    let last = trns.length; while (last > 0 && trns[last - 1] === 255) last--;
    make(3, rows, w, 1, [chunk('PLTE', plte), ...(last ? [chunk('tRNS', trns.subarray(0, last))] : [])]);
  }
  if (opaque) { const rows = []; for (let y = 0; y < h; y++) { const r = Buffer.alloc(w * 3); for (let x = 0; x < w; x++) rgba.copy(r, x * 3, (y * w + x) * 4, (y * w + x) * 4 + 3); rows.push(r); } make(2, rows, w * 3, 3, []); }
  else { const rows = []; for (let y = 0; y < h; y++) rows.push(rgba.subarray(y * w * 4, (y + 1) * w * 4)); make(6, rows, w * 4, 4, []); }
  return variants.sort((a, b) => a.length - b.length)[0];
}

const args = process.argv.slice(2), dry = args.includes('--dry'); let before = 0, after = 0;
for (const file of args.filter(a => a !== '--dry')) {
  const src = fs.readFileSync(file); before += src.length;
  try {
    const img = decode(src), out = encode(img), check = decode(out);
    if (check.w !== img.w || check.h !== img.h || !check.rgba.equals(img.rgba)) throw Error('pixel check failed');
    if (out.length < src.length) { if (!dry) fs.writeFileSync(file, out); after += out.length; console.log(file, src.length, '->', out.length, '(-' + Math.round((1 - out.length / src.length) * 100) + '%)'); }
    else { after += src.length; console.log(file, 'already optimal'); }
  } catch (e) { after += src.length; console.log(file, 'skipped:', e.message); }
}
console.log('total', before, '->', after, 'saved', before - after, 'bytes');
