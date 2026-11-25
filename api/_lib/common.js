'use strict';
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const norm = (s) => String(s || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const normRef = (s) => String(s || '').toUpperCase().replace(/\s+/g, '').trim();

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 24) return null;
  return s;
}
function sign(payload, ttlSeconds) {
  const sec = secret();
  if (!sec) throw new Error('SESSION_SECRET not configured');
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds })).toString('base64url');
  const mac = crypto.createHmac('sha256', sec).update(body).digest('base64url');
  return body + '.' + mac;
}
function unsign(token) {
  const sec = secret();
  if (!sec || typeof token !== 'string' || token.indexOf('.') < 0) return null;
  const [body, mac] = token.split('.');
  const good = crypto.createHmac('sha256', sec).update(body).digest('base64url');
  const a = Buffer.from(mac || ''), b = Buffer.from(good);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (!data.exp || data.exp < Math.floor(Date.now() / 1000)) return null;
    return data;
  } catch (e) { return null; }
}

// Best-effort in-memory rate limit (per warm serverless instance).
const buckets = new Map();
function rateLimit(key, max, windowMs) {
  const now = Date.now();
  const arr = (buckets.get(key) || []).filter((t) => now - t < windowMs);
  if (arr.length >= max) { buckets.set(key, arr); return false; }
  arr.push(now); buckets.set(key, arr);
  if (buckets.size > 5000) buckets.clear();
  return true;
}
function ip(req) {
  return String((req.headers['x-forwarded-for'] || '').split(',')[0] || req.socket?.remoteAddress || 'unknown').trim();
}
function send(res, code, obj, extra) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (extra) Object.entries(extra).forEach(([k, v]) => res.setHeader(k, v));
  res.end(JSON.stringify(obj));
}
async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  const chunks = []; let size = 0;
  for await (const c of req) { size += c.length; if (size > 20000) throw new Error('too large'); chunks.push(c); }
  try { return JSON.parse(Buffer.concat(chunks).toString() || '{}'); } catch (e) { return {}; }
}
function seed() {
  const p = path.join(process.cwd(), 'api', '_data', 'certificates.json');
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

// Optional persistent store (Upstash Redis REST). Admin-added and revoked records live here.
async function redis(cmd) {
  const url = process.env.UPSTASH_REDIS_REST_URL, tok = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !tok) return null;
  const r = await fetch(url, { method: 'POST', headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' }, body: JSON.stringify(cmd) });
  if (!r.ok) throw new Error('store error');
  return (await r.json()).result;
}
async function allRecords() {
  const base = seed().map(({ pdf, ...r }) => ({ ...r, hasPdf: !!pdf, source: 'seed' }));
  let extra = [], revoked = [];
  try {
    const h = await redis(['HGETALL', 'sw:certs']);
    if (Array.isArray(h)) for (let i = 1; i < h.length; i += 2) { try { extra.push({ ...JSON.parse(h[i]), source: 'admin' }); } catch (e) {} }
    revoked = (await redis(['SMEMBERS', 'sw:revoked'])) || [];
  } catch (e) { /* store unavailable: fall back to seed only */ }
  const all = base.concat(extra);
  const rv = new Set(revoked);
  return all.map((r) => ({ ...r, key: recKey(r), status: rv.has(recKey(r)) ? 'revoked' : (r.status || 'valid') }));
}
const recKey = (r) => normRef(r.ref) + '|' + norm(r.name);

module.exports = { seed, norm, normRef, sign, unsign, rateLimit, ip, send, readJson, allRecords, redis, recKey, secret };
