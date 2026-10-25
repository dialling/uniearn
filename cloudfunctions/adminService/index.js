'use strict';
const cloud = require('wx-server-sdk');
cloud.init({env: cloud.DYNAMIC_CURRENT_ENV});
const {createService} = require('./core');
const {createRepository} = require('./repository');
const service = createService({repo: createRepository(cloud.database()), env: process.env});
const allowedOrigins = () => String(process.env.ADMIN_ALLOWED_ORIGINS || '').split(',').map(x => x.trim()).filter(Boolean);
exports.main = async event => {
  const headers = Object.fromEntries(Object.entries(event.headers || {}).map(([k, v]) => [k.toLowerCase(), v]));
  const origin = String(headers.origin || '');
  const cors = origin && allowedOrigins().includes(origin) ? {'Access-Control-Allow-Origin': origin, 'Vary': 'Origin'} : {};
  const base = {...cors, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff', 'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'};
  const reply = (statusCode, body) => ({statusCode, headers: base, body: JSON.stringify(body)});
  if (origin && !allowedOrigins().includes(origin)) return reply(403, {ok: false, code: 'ORIGIN_DENIED', error: 'This admin site origin is not allowed.'});
  if (event.httpMethod === 'OPTIONS') return reply(204, {});
  if (event.httpMethod !== 'POST') return reply(405, {ok: false, error: 'Use POST.'});
  try {
    const raw = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString('utf8') : event.body || '{}';
    if (Buffer.byteLength(raw) > 16000) return reply(413, {ok: false, error: 'Request too large.'});
    let input; try { input = JSON.parse(raw); } catch (_) { return reply(400, {ok: false, error: 'Invalid JSON.'}); }
    if (!input || typeof input !== 'object' || Array.isArray(input)) return reply(400, {ok: false, error: 'Invalid request.'});
    const token = String(headers.authorization || '').replace(/^Bearer\s+/i, '');
    return reply(200, await service.run(input, token, event.requestContext?.sourceIp || ''));
  } catch (e) {
    if (!e.code) console.error('adminService failed', e.code || e.errCode || 'UNKNOWN');
    return reply(e.status || 500, {ok: false, code: e.code || 'SERVICE_UNAVAILABLE',
      error: e.code ? e.message : 'The admin service is unavailable. Check the cloud function logs.'});
  }
};
