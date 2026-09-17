# Shared classroom access

This access boundary protects the stable teacher site and the active iteration
with the same shared account. It is not a personal account system: drink records
remain in this browser's IndexedDB and are not shared by signing in.

`middleware.js` must run before **every** request, including HTML, API and static
resources. `/access` is the sign-in and sign-out page. Successful login returns
to the original safe local path. The host-only `__Host-sipaware_access` cookie has
Path=/, Secure, HttpOnly, SameSite=Lax and an eight-hour lifetime. Signing out
expires this browser's cookie; copied tokens remain valid until expiry. Rotate
the signing key to revoke every session, including when changing the password.

## Server configuration

Set the same values on the active deployment and the retained stable copy:

- `SIPAWARE_ACCESS_USER`: shared username.
- `SIPAWARE_ACCESS_HASH`: 16-byte random salt in hex, a colon, and a 32-byte scrypt
  hash in hex (N=32768, r=8, p=1; maxmem=64 MiB).
- `SIPAWARE_ACCESS_SIGNING_KEY`: independent cryptographically random 32-byte key
  encoded in hex. Never reuse the password as the signing key.
- `SIPAWARE_ACCESS_WAF_READY=1`: set only after verifying the live rate-limit rule.

Use a strong unique password. Enter live configuration through private server
settings; do not put it in frontend variables, Git, examples or screenshots.
Missing/invalid configuration returns 503 rather than exposing the website.

## Publication prerequisites (not performed by this change)

1. Build a retained copy from the exact currently selected stable source with
   only this access boundary added. Do not replace its content with main.
2. Both builds must include middleware.js, security modules, root package and
   lockfile, with identical server configuration. Their vercel.json must explicitly
   register proxy.entrypoint=middleware.js and proxy.matcher=/:path* for Services. Verify Vercel Services actually
   compiles and invokes the Node middleware on the deployed previews.
3. Configure a Vercel WAF rate limit for POST `/access`, initially 10 requests per
   minute per IP, with 429 blocking. Verify effective enforcement on every host
   that serves login, including the retained alias. This is a per-region limit;
   it is not a guarantee against distributed attacks. Verify plan allowance first.
4. On the actual deployed preview, prove all API/HTML/assets paths are denied
   without a cookie even after an authenticated cache hit. Verify root rewrites
   preserve the session cookie to the protected retained copy. Do not assume
   local gateway testing proves provider rewrite/cache behavior.
5. Inventory direct deployment URLs, retained aliases and previous public access
   exceptions. Remove the previous public retained-origin exposure only as part
   of the reviewed coordinated release. Keep unrelated previews/frozen projects
   unchanged. If a historical public origin remains reachable, report that gap;
   never claim the access boundary is complete.
6. After human review of both exact source packages and the provider change list,
   publish, verify the common session on root and `/iteration2`, both API targets,
   logout, mobile access, invalid passwords and anonymous direct-origin denial.

The existing rewrite rules continue choosing each version. The only vercel.json
change registers the login proxy before those routes. Neon schema, personal
storage, frozen iterations and the paid plan remain unchanged.

## Local review

Use `scripts/access-preview.mjs` in front of separate local previews. Set
`SIPAWARE_ACCESS_LOCAL=1`, the three synthetic access configuration variables,
`SIPAWARE_PREVIEW_STABLE` and `SIPAWARE_PREVIEW_ACTIVE` to loopback HTTP origins.
The gateway binds only 127.0.0.1 (default port 5178). Vercel deployments cannot
enable this local cookie mode. No default or hardcoded live password exists.

The local limiter is in-memory, for demonstration only; it cannot replace the
provider WAF in a serverless deployment. Auth tests run with
`node --test tests/access/access.test.mjs`. Tests use synthetic credentials only.
