/** Server-rendered access UI. It loads no application bundle, personal data or
 * external resources before login. SipAware colors/serif heading are retained;
 * system fonts avoid exposing protected font assets or contacting third parties.
 */
function escape(value) {
  return String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

export function accessPage({ csrfTicket, destination, signedIn, message }) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${signedIn ? 'Site access' : 'Sign in'} | SipAware</title>
<style>*{box-sizing:border-box}body{margin:0;color:#17283e;background:#f7f9fc;font:18px/1.6 Arial,sans-serif}main{width:min(100% - 32px,480px);margin:8vh auto;padding:32px;background:white;border:1px solid #dddfe5;border-radius:20px;box-shadow:0 8px 28px #17283e0a}.brand{color:#195bd2;font-weight:700;letter-spacing:.03em;margin:0 0 20px}h1{font:38px/1.2 Georgia,serif;color:#111;margin:0 0 16px}p{margin:0 0 24px}label{display:block;font-weight:600;margin:18px 0 6px}input{display:block;width:100%;font:inherit;padding:12px;border:1px solid #8c98aa;border-radius:10px;min-height:52px}button,.button{display:block;width:100%;border:0;border-radius:10px;padding:13px 16px;background:#195bd2;color:white;font:600 18px/1.5 Arial,sans-serif;text-align:center;text-decoration:none;cursor:pointer;margin-top:24px;min-height:52px}.secondary{color:#195bd2;background:#edf3ff}a{color:#195bd2}input:focus-visible,button:focus-visible,a:focus-visible{outline:3px solid #b85d00;outline-offset:3px}.message{background:#fff2f2;color:#a11919;border-left:4px solid #a11919;padding:12px;margin:16px 0}.note{font-size:16px;color:#43556f;margin:24px 0 0}@media(max-width:480px){main{margin:24px auto;padding:24px}h1{font-size:32px}}</style></head><body><main><p class="brand">SipAware</p><h1>${signedIn ? 'You’re signed in' : 'Welcome to SipAware'}</h1>
<p>${signedIn ? 'You can browse the website and the current development version.' : 'Enter the shared username and password provided by the project team.'}</p>
${message ? `<p class="message" role="alert">${escape(message)}</p>` : ''}
<form method="post" action="/access"><input type="hidden" name="csrf" value="${escape(csrfTicket)}"><input type="hidden" name="returnTo" value="${escape(destination)}"><input type="hidden" name="action" value="${signedIn ? 'logout' : 'login'}">
${signedIn ? `<a class="button" href="${escape(destination)}">Continue browsing</a><a class="button secondary" href="/iteration2">Open development version</a><button class="secondary" type="submit">Sign out</button>` : '<label for="username">Username</label><input id="username" name="username" autocomplete="username" maxlength="128" required autofocus><label for="password">Password</label><input id="password" name="password" type="password" autocomplete="current-password" maxlength="256" required><button type="submit">Sign in</button>'}
</form><p class="note">${signedIn ? 'Sign-in lasts up to 8 hours. Signing out does not delete records saved on this device.' : 'Need access? Contact the project team.'}</p></main></body></html>`;
}
