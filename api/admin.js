'use strict';
const crypto = require('crypto');
const { sign, unsign, rateLimit, ip, send, readJson, allRecords, redis, recKey, norm, normRef, secret } = require('./_lib/common');

const COOKIE = 'sw_admin';
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest();

function getCookie(req, name) {
  const m = (req.headers.cookie || '').split(';').map((s) => s.trim()).find((s) => s.startsWith(name + '='));
  return m ? decodeURIComponent(m.slice(name.length + 1)) : '';
}
function authed(req) {
  const d = unsign(getCookie(req, COOKIE));
  return !!(d && d.role === 'admin');
}
const clean = (s, n) => String(s || '').replace(/[<>\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { ok: false }, { Allow: 'POST' });
  if (req.headers['x-requested-with'] !== 'sw-admin') return send(res, 403, { ok: false, error: 'Forbidden' });
  if (!secret() || !process.env.ADMIN_PASSWORD) return send(res, 503, { ok: false, error: 'Admin portal is not configured. Set ADMIN_PASSWORD and SESSION_SECRET.' });
  let b; try { b = await readJson(req); } catch (e) { return send(res, 400, { ok: false, error: 'Bad request' }); }
  const action = b.action;

  if (action === 'login') {
    if (!rateLimit('login:' + ip(req), 5, 15 * 60 * 1000)) return send(res, 429, { ok: false, error: 'Too many attempts. Try again in 15 minutes.' });
    await new Promise((r) => setTimeout(r, 500));
    const ok = crypto.timingSafeEqual(sha(b.password || ''), sha(process.env.ADMIN_PASSWORD));
    if (!ok) return send(res, 401, { ok: false, error: 'Incorrect password.' });
    const token = sign({ role: 'admin' }, 12 * 3600);
    return send(res, 200, { ok: true }, { 'Set-Cookie': `${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${12 * 3600}` });
  }
  if (action === 'logout') return send(res, 200, { ok: true }, { 'Set-Cookie': `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0` });
  if (!authed(req)) return send(res, 401, { ok: false, error: 'Please sign in.' });

  const storeOn = !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
  try {
    if (action === 'list') {
      const rows = (await allRecords()).map(({ key, file, ...r }) => ({ key, hasPdf: !!file, ...r }));
      return send(res, 200, { ok: true, storeOn, rows });
    }
    if (action === 'inq_list') {
      if (!storeOn) return send(res, 200, { ok: true, storeOn, rows: [] });
      const h = (await redis(['HGETALL', 'sw:inq'])) || [];
      const rows = [];
      for (let i = 1; i < h.length; i += 2) { try { rows.push(JSON.parse(h[i])); } catch (e) {} }
      rows.sort((a, b) => b.t - a.t);
      return send(res, 200, { ok: true, storeOn, rows });
    }
    if (!storeOn) return send(res, 503, { ok: false, error: 'Add UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN to enable saving changes.' });
    if (action === 'add') {
      const rec = { ref: normRef(b.ref), name: clean(b.name, 80).toUpperCase(), program: clean(b.program, 120), role: clean(b.role, 60) || 'Participant', period: clean(b.period, 60), issued: clean(b.issued, 40), status: 'valid' };
      if (!/^[A-Z0-9-]{4,30}$/.test(rec.ref) || norm(rec.name).length < 2 || !rec.program) return send(res, 400, { ok: false, error: 'Reference ID, name and program are required.' });
      const key = recKey(rec);
      if ((await allRecords()).some((r) => r.key === key)) return send(res, 409, { ok: false, error: 'A certificate with this ID and name already exists.' });
      await redis(['HSET', 'sw:certs', key, JSON.stringify(rec)]);
      return send(res, 200, { ok: true });
    }
    if (action === 'inq_set' || action === 'inq_delete') {
      const id = clean(b.id, 40);
      if (!/^[a-z0-9]{6,30}$/.test(id)) return send(res, 400, { ok: false, error: 'Bad id' });
      if (action === 'inq_delete') { await redis(['HDEL', 'sw:inq', id]); return send(res, 200, { ok: true }); }
      const raw = await redis(['HGET', 'sw:inq', id]);
      if (!raw) return send(res, 404, { ok: false, error: 'Not found' });
      const rec = JSON.parse(raw);
      if (b.status !== undefined) { if (!['new', 'contacted', 'closed'].includes(b.status)) return send(res, 400, { ok: false, error: 'Bad status' }); rec.status = b.status; }
      if (b.note !== undefined) rec.note = clean(b.note, 500);
      await redis(['HSET', 'sw:inq', id, JSON.stringify(rec)]);
      return send(res, 200, { ok: true });
    }
    if (action === 'edit') {
      const oldKey = clean(b.key, 140);
      const raw = await redis(['HGET', 'sw:certs', oldKey]);
      if (!raw) return send(res, 404, { ok: false, error: 'Only records added in the portal can be edited.' });
      const rec = { ref: normRef(b.ref), name: clean(b.name, 80).toUpperCase(), program: clean(b.program, 120), role: clean(b.role, 60) || 'Participant', period: clean(b.period, 60), issued: clean(b.issued, 40), status: 'valid' };
      if (!/^[A-Z0-9-]{4,30}$/.test(rec.ref) || norm(rec.name).length < 2 || !rec.program) return send(res, 400, { ok: false, error: 'Reference ID, name and program are required.' });
      const newKey = recKey(rec);
      if (newKey !== oldKey) {
        if ((await allRecords()).some((r) => r.key === newKey)) return send(res, 409, { ok: false, error: 'Another certificate already has this ID and name.' });
        await redis(['HDEL', 'sw:certs', oldKey]);
        const wasRevoked = ((await redis(['SMEMBERS', 'sw:revoked'])) || []).includes(oldKey);
        if (wasRevoked) { await redis(['SREM', 'sw:revoked', oldKey]); await redis(['SADD', 'sw:revoked', newKey]); }
      }
      await redis(['HSET', 'sw:certs', newKey, JSON.stringify(rec)]);
      return send(res, 200, { ok: true });
    }
    if (action === 'bulk') {
      const rows = Array.isArray(b.rows) ? b.rows.slice(0, 500) : [];
      if (!rows.length) return send(res, 400, { ok: false, error: 'No rows found.' });
      const existing = new Set((await allRecords()).map((r) => r.key));
      const args = ['HSET', 'sw:certs'], skipped = []; let added = 0;
      rows.forEach((r, i) => {
        const rec = { ref: normRef(r.ref), name: clean(r.name, 80).toUpperCase(), program: clean(r.program, 120), role: clean(r.role, 60) || 'Participant', period: clean(r.period, 60), issued: clean(r.issued, 40), status: 'valid' };
        if (!/^[A-Z0-9-]{4,30}$/.test(rec.ref) || norm(rec.name).length < 2 || !rec.program) { skipped.push({ row: i + 1, reason: 'Missing or invalid ID, name or program' }); return; }
        const key = recKey(rec);
        if (existing.has(key)) { skipped.push({ row: i + 1, reason: 'Already exists' }); return; }
        existing.add(key); args.push(key, JSON.stringify(rec)); added++;
      });
      if (added) await redis(args);
      return send(res, 200, { ok: true, added, skipped });
    }
    if (action === 'revoke' || action === 'restore') {
      const key = clean(b.key, 140);
      if (!key.includes('|')) return send(res, 400, { ok: false, error: 'Bad key' });
      await redis([action === 'revoke' ? 'SADD' : 'SREM', 'sw:revoked', key]);
      return send(res, 200, { ok: true });
    }
    if (action === 'delete') {
      const key = clean(b.key, 140);
      await redis(['HDEL', 'sw:certs', key]);
      return send(res, 200, { ok: true });
    }
  } catch (e) { return send(res, 500, { ok: false, error: 'Server error. Try again.' }); }
  return send(res, 400, { ok: false, error: 'Unknown action' });
};
