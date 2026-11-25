'use strict';
const crypto = require('crypto');
const { rateLimit, ip, send, readJson, redis } = require('./_lib/common');

const clean = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, n);
const pick = (f, keys) => { for (const k of keys) if (f[k]) return f[k]; return ''; };

// Saves a copy of each website form submission in the admin inbox.
// Email delivery (Formsubmit) is separate, so a failure here never blocks the visitor.
module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { ok: false }, { Allow: 'POST' });
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return send(res, 202, { ok: true, stored: false });
  if (!rateLimit('inq:' + ip(req), 6, 10 * 60 * 1000)) return send(res, 429, { ok: false, error: 'Too many submissions.' });
  let body; try { body = await readJson(req); } catch (e) { return send(res, 400, { ok: false }); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return send(res, 400, { ok: false });
  const fields = {};
  let n = 0;
  for (const [k, v] of Object.entries(body)) {
    if (k.startsWith('_') || typeof v !== 'string' || n >= 30) continue;
    const key = clean(k, 60), val = clean(v, 3000);
    if (key && val) { fields[key] = val; n++; }
  }
  if (!Object.keys(fields).length) return send(res, 400, { ok: false });
  const rec = {
    id: Date.now().toString(36) + crypto.randomBytes(3).toString('hex'),
    t: Date.now(),
    form: clean(body._form, 80) || 'Website inquiry',
    page: clean(body._page, 120),
    name: pick(fields, ['Full Name', 'Name', 'Your Name']),
    phone: pick(fields, ['Phone Number', 'Phone', 'Mobile']),
    email: pick(fields, ['Email', 'Email Address']),
    message: pick(fields, ['Message', 'Tell us about your interest', 'Details']),
    fields, status: 'new', note: ''
  };
  try { await redis(['HSET', 'sw:inq', rec.id, JSON.stringify(rec)]); } catch (e) { return send(res, 500, { ok: false }); }
  return send(res, 200, { ok: true, stored: true });
};
