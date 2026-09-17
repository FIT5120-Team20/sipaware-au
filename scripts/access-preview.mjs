/** Loopback-only review gateway. Runs the SAME access handler as Vercel, then
 * proxies to existing stable/active local previews. Its in-memory login limiter
 * is only for local review; hosted protection requires a verified Vercel WAF rule.
 * Credentials are provided through environment variables and never logged.
 */
import { createServer } from 'node:http';
import { Readable } from 'node:stream';
import { accessGate, privateHeaders } from '../security/access.mjs';

const port = Number(process.env.SIPAWARE_PREVIEW_PORT || 5178);
function localTarget(value) {
  const url = new URL(value);
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(url.hostname) || url.username || url.password) throw new Error('Loopback preview target required');
  return url.origin;
}
const stable = localTarget(process.env.SIPAWARE_PREVIEW_STABLE || 'http://127.0.0.1:5175');
const active = localTarget(process.env.SIPAWARE_PREVIEW_ACTIVE || 'http://127.0.0.1:5176');
const limits = new Map();
if (process.env.VERCEL || process.env.SIPAWARE_ACCESS_LOCAL !== '1') throw new Error('Local review only');

createServer(async (req, res) => {
  try {
    // Ignore client Host/X-Forwarded-*: this preview has exactly one origin.
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    const request = new Request(url, { method: req.method, headers: req.headers,
      ...(!['GET', 'HEAD'].includes(req.method) ? { body: Readable.toWeb(req), duplex: 'half' } : {}) });
    let response;
    if (url.pathname === '/access' && req.method === 'POST') {
      const now = Date.now(), key = req.socket.remoteAddress;
      const previous = limits.get(key);
      const counter = previous && now < previous.end ? previous : { count: 0, end: now + 60000 };
      limits.set(key, counter);
      if (++counter.count > 10) response = new Response('Too many sign-in attempts. Please wait a minute.',
        { status: 429, headers: { ...privateHeaders, 'Retry-After': '60' } });
    }
    response ||= await accessGate(request);
    if (!response) {
      const origin = /^\/iteration2(?:\/|$)/.test(url.pathname) ? active : stable;
      const headers = new Headers(request.headers);
      for (const h of ['host', 'cookie', 'authorization', 'connection']) headers.delete(h);
      headers.set('accept-encoding', 'identity');
      response = await fetch(new URL(url.pathname + url.search, origin), { method: req.method, headers,
        redirect: 'manual', signal: AbortSignal.timeout(20000) });
    }
    res.statusCode = response.status;
    for (const [key, value] of response.headers) {
      if (!['set-cookie', 'content-length', 'content-encoding', 'transfer-encoding', 'connection'].includes(key)) res.setHeader(key, value);
    }
    const cookies = response.headers.getSetCookie();
    if (cookies.length) res.setHeader('set-cookie', cookies);
    for (const [key, value] of Object.entries(privateHeaders)) res.setHeader(key, value);
    res.end(req.method === 'HEAD' ? undefined : Buffer.from(await response.arrayBuffer()));
  } catch {
    res.writeHead(503, privateHeaders); res.end('Local preview unavailable. Check the local upstream servers.');
  }
}).listen(port, '127.0.0.1', () => console.log(`Access review: http://127.0.0.1:${port}/access`));
