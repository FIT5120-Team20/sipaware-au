# Baidu OCR drink-label setup

SipAware sends label photos from the browser to the existing same-origin
FastAPI endpoint. The backend exchanges the configured Baidu API Key and Secret
Key for an access token, calls Baidu's general high-accuracy OCR endpoint, and
returns the existing editable drink-name, type, volume and ABV suggestions.

The browser never receives either Baidu credential or the access token. Images
are held in memory and are not written to the repository or application disk.
The existing frontend limits the API upload to 4 MiB.

## Vercel configuration

In the Vercel project, open **Settings > Environment Variables** and add these
values to the environment being deployed (normally **Production** and, when
needed, **Preview**):

```text
BAIDU_OCR_API_KEY=<Baidu API Key>
BAIDU_OCR_SECRET_KEY=<Baidu Secret Key>
```

Do not prefix either name with `VITE_`, paste the values into source files, or
send them to the browser. Redeploy after adding or changing the variables.

The retired Mac-hosted OCR variables are no longer used and can be removed from
Vercel after the Baidu deployment is verified:

```text
SIPAWARE_OCR_ENABLED
SIPAWARE_OCR_MODEL_ROOT
SIPAWARE_OCR_REQUIRE_TOKEN
SIPAWARE_OCR_SHARED_SECRET
SIPAWARE_OCR_UPSTREAM_URL
```

## Local configuration

Copy `backend/.env.example` to the ignored `backend/.env`, then fill the two
Baidu values. Never commit `backend/.env`.

Start the normal FastAPI and Vite development processes; PaddleOCR, model
weights, `cloudflared`, and the former OCR-specific Python requirements are not
needed.

```bash
cd backend
python -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python -m uvicorn app.main:app --reload
```

In another terminal:

```bash
cd frontend
npm install
npm run dev
```

Open the active iteration's Record page and use the unchanged **Scan Label**
control. A successful scan returns suggestions only; the user still reviews and
saves the drinking record manually.

## Provider behavior

The backend requests Baidu's `accurate_basic` endpoint with Chinese/English
recognition, direction detection and per-line probability enabled. Access tokens
are cached in a warm backend process and refreshed before expiry; invalid or
expired tokens are refreshed once automatically.
