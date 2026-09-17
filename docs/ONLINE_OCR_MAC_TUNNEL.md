# Public Vercel OCR through a presentation Mac

This temporary presentation setup keeps PaddleOCR and PP-OCRv6 Medium on the
Mac. Vercel accepts the browser upload on the existing same-origin endpoint and
forwards the bounded image over HTTPS to a token-protected Cloudflare Quick
Tunnel. Images remain in memory and are not saved by either application.
Uploads are limited to 4 MB so they stay below Vercel's 4.5 MB Function payload
limit.

This is not an always-on deployment. The Mac must remain powered, awake,
connected to the internet, and running both the OCR origin and `cloudflared`.
Quick Tunnel URLs change whenever `cloudflared` restarts and have no uptime SLA.

## One-time preparation

Install Cloudflare's tunnel client:

```bash
brew install cloudflared
```

If an older Homebrew installation cannot install the formula on Apple Silicon,
use Cloudflare's signed release binary without changing system directories:

```bash
mkdir -p .local/bin
curl --fail --location \
  --output .local/cloudflared-darwin-arm64.tgz \
  https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-arm64.tgz
tar -xzf .local/cloudflared-darwin-arm64.tgz -C .local/bin
chmod 755 .local/bin/cloudflared
```

The launcher automatically checks both `PATH` and `.local/bin/cloudflared`.

The local OCR environment and models must already match the setup in
`docs/LOCAL_OCR_DEMO.md`. Generate a private shared secret once:

```bash
openssl rand -hex 32
```

Save the resulting value in a password manager. Do not put it in Git, a
documentation file, a screenshot, or a chat message.

## Start the Mac origin and tunnel

In a terminal at the repository root:

```bash
export SIPAWARE_OCR_SHARED_SECRET='paste-the-generated-value-here'
caffeinate -i bash scripts/run-ocr-tunnel.sh
```

The command prints a temporary URL similar to:

```text
https://random-words.trycloudflare.com
```

Keep this terminal open. The script exposes a minimal FastAPI application with
only `/health` and the OCR route; the OCR route rejects requests without the
shared secret. Stopping the script immediately takes the public OCR origin
offline. `caffeinate` prevents idle sleep while the command runs, but closing
the MacBook lid can still suspend it. Logs are written under `.local/ocr-tunnel/`
and ignored by Git.

## Configure Vercel

In the Vercel project, open **Settings > Environment Variables** and set these
for **Production**:

```text
SIPAWARE_OCR_UPSTREAM_URL=https://random-words.trycloudflare.com
SIPAWARE_OCR_SHARED_SECRET=the-same-generated-value
```

Do not add a trailing `/api/...` path to `SIPAWARE_OCR_UPSTREAM_URL`. Do not set
`SIPAWARE_OCR_ENABLED` on Vercel; Vercel is the lightweight proxy, not the model
host. Redeploy the latest `main` deployment after changing either variable,
because environment changes apply only to a new deployment.

Each time Quick Tunnel produces a different URL, update
`SIPAWARE_OCR_UPSTREAM_URL` and redeploy again. The shared secret can stay the
same unless it may have been exposed.

## Verify before presenting

In a second terminal, set the same secret and test the protected origin directly:

```bash
export SIPAWARE_OCR_SHARED_SECRET='paste-the-same-generated-value-here'
OCR_DEMO_URL=http://127.0.0.1:8010/api/ocr/drink-label \
  backend/.venv/bin/python scripts/test_ocr_demo.py
```

Then open <https://sipaware.app/iteration2/record> from a phone or private
browser window, choose **Record Manually**, and scan the generated fixture or a
real label. The first inference loads the CPU model and may be noticeably slower.

If the site says the OCR computer is offline, check that the Mac is awake, the
tunnel terminal is still running, the URL matches Vercel exactly, the Vercel
deployment was recreated after the environment update, and both sides use the
same secret.
