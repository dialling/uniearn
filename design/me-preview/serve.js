'use strict';
// Static server for the Me page design preview.
// Serves this folder plus the app's /assets so the mock-up uses the real Yuni art and nav icons.
const http = require('node:http'), fs = require('node:fs'), path = require('node:path');
const repo = path.resolve(__dirname, '..', '..');
const allowed = [path.join(repo, 'design', 'me-preview') + path.sep, path.join(repo, 'assets') + path.sep];
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.mp4': 'video/mp4' };
const port = Number(process.env.PORT) || 4191;
http.createServer((req, res) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); } catch (_) { res.writeHead(400); res.end(); return; }
  if (pathname === '/') { res.writeHead(302, { Location: '/design/me-preview/index.html' }); res.end(); return; }
  const file = path.resolve(repo, '.' + pathname);
  if (!allowed.some(dir => file.startsWith(dir))) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (error, bytes) => {
    if (error) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(bytes);
  });
}).listen(port, '127.0.0.1', () => console.log('Design preview: http://127.0.0.1:' + port));
