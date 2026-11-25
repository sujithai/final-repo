'use strict';
const { norm, normRef, sign, rateLimit, ip, send, readJson, allRecords, secret } = require('./_lib/common');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'Method not allowed' }, { Allow: 'POST' });
  if (!secret()) return send(res, 503, { ok: false, error: 'Verification is temporarily unavailable.' });
  if (!rateLimit('verify:' + ip(req), 12, 10 * 60 * 1000)) return send(res, 429, { ok: false, error: 'Too many attempts. Please wait a few minutes and try again.' });
  let body; try { body = await readJson(req); } catch (e) { return send(res, 400, { ok: false, error: 'Invalid request.' }); }
  const ref = normRef(body.ref), name = norm(body.name);
  if (!/^[A-Z0-9-]{4,30}$/.test(ref) || name.length < 2 || name.length > 80) return send(res, 400, { ok: false, error: 'Enter the Reference ID and the full name exactly as printed on the certificate.' });
  const hit = (await allRecords()).find((r) => normRef(r.ref) === ref && norm(r.name) === name);
  await new Promise((r) => setTimeout(r, 350)); // uniform delay
  if (!hit) return send(res, 404, { ok: false, error: 'No certificate matches these details. Check the Reference ID and name, or contact SCIENWAVE.' });
  if (hit.status === 'revoked') return send(res, 200, { ok: true, status: 'revoked', ref: hit.ref, message: 'This certificate has been revoked by SCIENWAVE TECHNOLOGIES.' });
  const hasPdf = !!hit.hasPdf && !!hit.file;
  const out = { ok: true, status: 'valid', ref: hit.ref, name: hit.name, program: hit.program, role: hit.role, period: hit.period, issued: hit.issued, hasPdf };
  if (hasPdf) out.token = sign({ f: hit.file }, 600);
  return send(res, 200, out);
};
