/** Security-boundary regression tests, using synthetic credentials only.
 * Test the actual gate, not a UI mock: no request can reach content without a
 * valid session, and the same session intentionally authorizes both site paths.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scryptSync } from 'node:crypto';
import { accessGate, safeReturn } from '../../security/access.mjs';
import { accessPage } from '../../security/accessPage.mjs';

const salt = 'ab'.repeat(16), testPhrase = 'synthetic-test-password';
const env = { SIPAWARE_ACCESS_USER: 'test-reviewer', SIPAWARE_ACCESS_SIGNING_KEY: 'cd'.repeat(32),
  SIPAWARE_ACCESS_HASH: salt + ':' + scryptSync(testPhrase, Buffer.from(salt, 'hex'), 32,
    { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }).toString('hex'), SIPAWARE_ACCESS_WAF_READY: '1', VERCEL: '1' };
const base = 'https://sipaware.test', now = 1800000000;
const get = (path, headers = {}) => new Request(base + path, { headers });
async function form() {
  const response = await accessGate(get('/access'), env, now);
  const html = await response.text();
  return { cookie: response.headers.get('set-cookie').split(';')[0], csrf: html.match(/name="csrf" value="([^"]+)"/)[1] };
}
async function login(options = {}) {
  const f = options.form || await form();
  const body = new URLSearchParams({ action: 'login', csrf: f.csrf, username: env.SIPAWARE_ACCESS_USER,
    ['password']: testPhrase, returnTo: '/iteration2/record', ...options.fields });
  const request = new Request(base + '/access', { method: 'POST', body,
    headers: { origin: base, cookie: f.cookie, ...options.headers } });
  return accessGate(request, options.env || env, options.now || now);
}
function sessionCookie(response) {
  return response.headers.getSetCookie().find(v => v.startsWith('__Host-sipaware_access=')).split(';')[0];
}

test('anonymous pages redirect; API/assets/methods cannot reach content on either path', async () => {
  for (const path of ['/', '/record', '/iteration2', '/iteration2/trends', '/assets/site.js', '/api/health', '/iteration2/api/catalog', '/docs', '/openapi.json']) {
    const response = await accessGate(get(path), env, now);
    assert.equal(response.status, 401, path);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
  }
  const response = await accessGate(get('/iteration2/record?a=1', { accept: 'text/html' }), env, now);
  assert.equal(response.status, 303);
  assert.equal(response.headers.get('location'), '/access?returnTo=%2Fiteration2%2Frecord%3Fa%3D1');
});
test('successful login issues a secure host-only shared cookie and preserves destination', async () => {
  const response = await login();
  assert.equal(response.status, 303);
  assert.equal(response.headers.get('location'), '/iteration2/record');
  const cookie = response.headers.getSetCookie()[0];
  for (const text of ['Path=/', 'HttpOnly', 'SameSite=Lax', 'Secure', 'Max-Age=28800']) assert.ok(cookie.includes(text));
  assert.ok(!cookie.includes('Domain='));
  for (const path of ['/', '/iteration2', '/api/health', '/iteration2/api/catalog', '/assets/site.js'])
    assert.equal(await accessGate(get(path, { cookie: sessionCookie(response) }), env, now + 1), null);
});
test('wrong username/password have the same generic response and issue no session', async () => {
  for (const fields of [{ username: 'not-valid' }, { ['password']: 'not-valid' }]) {
    const response = await login({ fields });
    assert.equal(response.status, 401);
    const html = await response.text();
    assert.match(html, /username or password is incorrect/);
    assert.match(html, /name="returnTo" value="\/iteration2\/record"/);
    assert.ok(!response.headers.get('set-cookie').includes('__Host-sipaware_access='));
  }
});
test('tampered, duplicate, expired and rotated sessions are denied', async () => {
  const good = sessionCookie(await login());
  for (const cookie of [good + 'x', good.replace(/=./, '=x'), good + '; ' + good, '__Host-sipaware_access=null'])
    assert.equal((await accessGate(get('/', { cookie }), env, now)).status, 401);
  assert.equal((await accessGate(get('/', { cookie: good }), env, now + 28800)).status, 401);
  assert.equal((await accessGate(get('/', { cookie: good }), { ...env, SIPAWARE_ACCESS_SIGNING_KEY: 'ef'.repeat(32) }, now)).status, 401);
});
test('cross-origin, missing, forged and expired CSRF requests are denied', async () => {
  for (const headers of [{ origin: 'https://attacker.test' }, { origin: '' }, { cookie: '' }, { 'sec-fetch-site': 'cross-site' }])
    assert.equal((await login({ headers })).status, 403);
  assert.equal((await login({ fields: { csrf: 'forged' } })).status, 403);
  assert.equal((await login({ now: now + 600 })).status, 403);
});
test('logout expires the same cookie for both site paths, without clearing personal storage', async () => {
  const f = await form();
  const response = await login({ form: f, fields: { action: 'logout' }, headers: { cookie: f.cookie + '; ' + sessionCookie(await login()) } });
  assert.equal(response.status, 303);
  assert.match(response.headers.get('set-cookie'), /__Host-sipaware_access=; Path=\/; Max-Age=0/);
  assert.equal(response.headers.get('clear-site-data'), null);
});
test('missing configuration and absent hosted WAF acknowledgement fail closed', async () => {
  for (const key of ['SIPAWARE_ACCESS_USER', 'SIPAWARE_ACCESS_HASH', 'SIPAWARE_ACCESS_SIGNING_KEY', 'SIPAWARE_ACCESS_WAF_READY'])
    assert.equal((await accessGate(get('/'), { ...env, [key]: '' }, now)).status, 503);
  assert.equal((await accessGate(get('/'), { ...env, SIPAWARE_ACCESS_LOCAL: '1', SIPAWARE_ACCESS_WAF_READY: '' }, now)).status, 503);
});
test('loopback development cannot relax hosted cookies or bypass configuration', async () => {
  const local = { ...env, VERCEL: '', SIPAWARE_ACCESS_LOCAL: '1', SIPAWARE_ACCESS_WAF_READY: '' };
  assert.equal((await accessGate(get('/access'), local, now)).status, 503);
  const response = await accessGate(new Request('http://127.0.0.1:5178/access'), local, now);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('set-cookie'), /^sipaware_local_form=/);
});
test('alternate origin has no hostname bypass and a copied authenticated session is checked there too', async () => {
  const url = 'https://sipaware-retained.test/api/health';
  assert.equal((await accessGate(new Request(url), env, now)).status, 401);
  assert.equal(await accessGate(new Request(url, { headers: { cookie: sessionCookie(await login()) } }), env, now), null);
});
test('safe redirects reject external, encoded, control-character and access-loop targets', async () => {
  for (const value of ['https://evil.test', '//evil.test', '/\\evil.test', '/%2fexample', '/%255cevil', '/a\nLocation:x', '/access', '/a/../access', '/access/logout']) assert.equal(safeReturn(value), '/');
  assert.equal(safeReturn('/iteration2/trends?tab=history'), '/iteration2/trends?tab=history');
  assert.equal((await login({ fields: { returnTo: '//evil.test' } })).headers.get('location'), '/');
});
test('untrusted messages and return paths are HTML-escaped', () => {
  const html = accessPage({ csrfTicket: 'test', destination: '/?x=" onfocus="alert(1)', signedIn: true, message: '<script>bad</script>' });
  assert.ok(!html.includes('<script>'));
  assert.ok(!html.includes('href="/?x=" onfocus='));
});
test('oversized body, duplicate fields, wrong content type and unsupported method are rejected', async () => {
  const f = await form();
  const headers = { origin: base, cookie: f.cookie, 'content-type': 'application/x-www-form-urlencoded' };
  for (const body of ['a='.padEnd(5000, 'x'), `csrf=${f.csrf}&action=login&action=logout`])
    assert.equal((await accessGate(new Request(base + '/access', { method: 'POST', headers, body }), env, now)).status, 400);
  assert.equal((await accessGate(new Request(base + '/access', { method: 'PUT' }), env, now)).status, 405);
});
test('login HTML has no third-party resources, executable scripts or cached credentials', async () => {
  const response = await accessGate(get('/access'), env, now), html = await response.text();
  assert.match(response.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  assert.equal(response.headers.get('referrer-policy'), 'same-origin');
  assert.ok(!html.includes(testPhrase));
  assert.ok(!html.includes('<script'));
  assert.ok(!html.includes('src="http'));
});
