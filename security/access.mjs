/** Shared classroom authentication at the request boundary, before either site.
 * Personal records and reference APIs remain owned by their existing modules.
 * Both deployment copies use identical server configuration; Path=/ makes one
 * host-only browser session cover stable root and the active iteration.
 */
import { createHmac, randomBytes, scrypt as derive, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { accessPage } from './accessPage.mjs';

const scrypt = promisify(derive);
const SESSION_SECONDS = 8 * 60 * 60;
const FORM_SECONDS = 10 * 60;
const BODY_LIMIT = 4096;
const PRIVATE = { 'Cache-Control': 'private, no-store', 'CDN-Cache-Control': 'no-store',
  'Vercel-CDN-Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin', 'X-Robots-Tag': 'noindex, nofollow' };
export const privateHeaders = PRIVATE;

function equal(a, b) {
  const aa = Buffer.from(a), bb = Buffer.from(b);
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}

/** Only explicit loopback development may use HTTP cookies. Hosted deployments
 * always require Secure cookies, a strong signing key and a configured WAF rule.
 * The rate-limit acknowledgement is checked against the provider before release;
 * this flag alone is not evidence that a distributed limit is installed.
 */
function configuration(env, url) {
  const local = !env.VERCEL && env.SIPAWARE_ACCESS_LOCAL === '1' &&
    ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
  const username = env.SIPAWARE_ACCESS_USER;
  const hash = env.SIPAWARE_ACCESS_HASH;
  const key = env.SIPAWARE_ACCESS_SIGNING_KEY;
  if (!username || username.length > 128 || !/^[a-f0-9]{32}:[a-f0-9]{64}$/.test(hash || '') ||
      !/^[a-f0-9]{64}$/.test(key || '') || (!local && env.SIPAWARE_ACCESS_WAF_READY !== '1')) return null;
  return { username, hash, key, local, sessionName: local ? 'sipaware_local_access' : '__Host-sipaware_access',
    formName: local ? 'sipaware_local_form' : '__Host-sipaware_form' };
}

function cookieValue(request, name) {
  const matches = (request.headers.get('cookie') || '').split(';').map(x => x.trim())
    .filter(x => x.startsWith(name + '='));
  // Ambiguous cookies are rejected rather than trusting a browser-dependent order.
  return matches.length === 1 ? matches[0].slice(name.length + 1) : '';
}

function cookie(name, value, age, cfg) {
  return `${name}=${value}; Path=/; Max-Age=${age}; HttpOnly; SameSite=Lax${cfg.local ? '' : '; Secure'}`;
}

function sign(payload, cfg) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return body + '.' + createHmac('sha256', cfg.key).update(body).digest('base64url');
}

function readToken(value, purpose, cfg, now) {
  if (!value || value.length > 1024) return null;
  const parts = value.split('.');
  if (parts.length !== 2 || !/^[A-Za-z0-9_-]+$/.test(parts[0]) || !/^[A-Za-z0-9_-]{43}$/.test(parts[1])) return null;
  const mac = createHmac('sha256', cfg.key).update(parts[0]).digest('base64url');
  if (!equal(parts[1], mac)) return null;
  try {
    const p = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    const ttl = purpose === 'session' ? SESSION_SECONDS : FORM_SECONDS;
    return p.purpose === purpose && Number.isInteger(p.iat) && Number.isInteger(p.exp) &&
      p.iat <= now && p.exp > now && p.exp - p.iat === ttl && p.user === cfg.username ? p : null;
  } catch { return null; }
}

/** Redirects must remain same-origin relative paths. Reject encoded separators,
 * controls and access endpoints so attacker-supplied destinations cannot escape
 * the site or cause login loops. The return value is also HTML-escaped in forms.
 */
export function safeReturn(value) {
  if (typeof value !== 'string' || value.length > 2048 || !value.startsWith('/') ||
      value.startsWith('//') || /[\\\x00-\x20\x7f]/.test(value) || /%(?:2f|5c|0[0-9a-f]|1[0-9a-f]|7f|25)/i.test(value)) return '/';
  try {
    const url = new URL(value, 'https://return.invalid');
    if (url.origin !== 'https://return.invalid' || /^\/access(?:\/|$)/.test(url.pathname)) return '/';
    return url.pathname + url.search + url.hash;
  } catch { return '/'; }
}

function reply(body, status = 200, extra = {}) {
  return new Response(body, { status, headers: { ...PRIVATE, ...extra } });
}

function redirect(path, headers = {}) { return reply(null, 303, { Location: path, ...headers }); }

function render(cfg, now, destination, signedIn, message = '', status = 200) {
  const csrfTicket = sign({ purpose: 'form', user: cfg.username, iat: now, exp: now + FORM_SECONDS,
    nonce: randomBytes(24).toString('base64url') }, cfg);
  return reply(accessPage({ csrfTicket, destination, signedIn, message }), status, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
    'Set-Cookie': cookie(cfg.formName, csrfTicket, FORM_SECONDS, cfg),
  });
}

/** Read a small form incrementally; a missing/false Content-Length must not let
 * a large request allocate unbounded memory. Passwords are never logged/echoed.
 */
async function readForm(request) {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/x-www-form-urlencoded')) throw new Error('form');
  if (Number(request.headers.get('content-length') || 0) > BODY_LIMIT) throw new Error('size');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('body');
  const chunks = []; let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > BODY_LIMIT) { await reader.cancel(); throw new Error('size'); }
    chunks.push(Buffer.from(value));
  }
  const form = new URLSearchParams(Buffer.concat(chunks).toString('utf8'));
  for (const key of form.keys()) if (form.getAll(key).length !== 1) throw new Error('duplicate');
  return form;
}

/** Returns a Response when access must stop, null only after authentication.
 * Runtime adapter owns forwarding and rate limiting; unit tests inject clock and
 * configuration without any default credentials or production bypass switch.
 */
export async function accessGate(request, env = process.env, now = Math.floor(Date.now() / 1000)) {
  const url = new URL(request.url), cfg = configuration(env, url);
  if (!cfg) return reply('Site access is temporarily unavailable. Please contact the project team.', 503);
  const session = readToken(cookieValue(request, cfg.sessionName), 'session', cfg, now);
  if (url.pathname !== '/access') {
    if (session) return null;
    if ((request.headers.get('accept') || '').includes('text/html') && ['GET', 'HEAD'].includes(request.method)) {
      return redirect('/access?returnTo=' + encodeURIComponent(safeReturn(url.pathname + url.search)));
    }
    return reply(JSON.stringify({ error: 'authentication_required' }), 401, { 'Content-Type': 'application/json' });
  }
  const destination = safeReturn(url.searchParams.get('returnTo') || '/');
  if (request.method === 'GET' || request.method === 'HEAD') {
    const response = render(cfg, now, destination, !!session);
    return request.method === 'HEAD' ? new Response(null, { status: response.status, headers: response.headers }) : response;
  }
  if (request.method !== 'POST') return reply('Method not allowed.', 405, { Allow: 'GET, HEAD, POST' });
  // Require a same-origin browser form AND a signed, cookie-bound CSRF nonce.
  if (request.headers.get('origin') !== url.origin || request.headers.get('sec-fetch-site') === 'cross-site') return reply('Invalid request. Reload the sign-in page.', 403);
  let form;
  try { form = await readForm(request); } catch { return reply('Invalid request. Reload the sign-in page.', 400); }
  const csrf = form.get('csrf') || '';
  if (!equal(csrf, cookieValue(request, cfg.formName)) || !readToken(csrf, 'form', cfg, now)) return reply('Your sign-in form expired. Reload the page and try again.', 403);
  if (form.get('action') === 'logout') {
    return redirect('/access', { 'Set-Cookie': cookie(cfg.sessionName, '', 0, cfg) });
  }
  if (form.get('action') !== 'login') return reply('Invalid request.', 400);
  const submittedDestination = safeReturn(form.get('returnTo') || '/');
  const user = form.get('username') || '', passphrase = form.get('password') || '';
  if (user.length > 128 || !passphrase || passphrase.length > 256) return render(cfg, now, submittedDestination, false, 'The username or password is incorrect.', 401);
  const [salt, expected] = cfg.hash.split(':');
  // Always derive for both correct/incorrect usernames to avoid a username oracle.
  const actual = await scrypt(passphrase, Buffer.from(salt, 'hex'), 32, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  if (!equal(actual.toString('hex'), expected) || !equal(user, cfg.username)) return render(cfg, now, submittedDestination, false, 'The username or password is incorrect.', 401);
  const value = sign({ purpose: 'session', user: cfg.username, iat: now, exp: now + SESSION_SECONDS,
    nonce: randomBytes(24).toString('base64url') }, cfg);
  const response = redirect(safeReturn(form.get('returnTo') || '/'), { 'Set-Cookie': cookie(cfg.sessionName, value, SESSION_SECONDS, cfg) });
  response.headers.append('Set-Cookie', cookie(cfg.formName, '', 0, cfg));
  return response;
}
