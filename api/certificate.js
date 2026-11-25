'use strict';
const { unsign, rateLimit, ip, send, secret, seed } = require('./_lib/common');
const fs = require('fs');
const path = require('path');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return send(res, 405, { ok: false }, { Allow: 'GET' });
  if (!secret()) return send(res, 503, { ok: false, error: 'Unavailable' });
  if (!rateLimit('cert:' + ip(req), 20, 10 * 60 * 1000)) return send(res, 429, { ok: false, error: 'Too many requests' });
  const url = new URL(req.url, 'http://x');
  const data = unsign(url.searchParams.get('t'));
  if (!data || !/^[A-Za-z0-9-]{4,40}$/.test(data.f || '')) return send(res, 403, { ok: false, error: 'Link expired. Verify again to download.' });
  const rec = seed().find((r) => r.file === data.f);
  if (!rec || !Array.isArray(rec.pdf)) return send(res, 404, { ok: false, error: 'Not found' });
  const [off, len] = rec.pdf;
  const fd = fs.openSync(path.join(process.cwd(), 'api', '_data', 'certs.bin'), 'r');
  const buf = Buffer.alloc(len);
  fs.readSync(fd, buf, 0, len, off);
  fs.closeSync(fd);
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'inline; filename="' + data.f + '.pdf"');
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Robots-Tag', 'noindex');
  res.end(buf);
};
