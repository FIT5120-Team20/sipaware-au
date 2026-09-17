# Local OCR presentation

PaddleOCR performs CPU inference on the Mac using official PP-OCRv6 Medium
detection and recognition models. No training or product database is involved.
The existing Scan Label button uploads an image to the local FastAPI backend,
which returns text and editable field suggestions. Images are processed in
memory and are not saved by the API. Low-confidence or conflicting values are
not guessed; name selection is a heuristic, not a product identification result.

## Start

From the repository root, install the optional local environment once:

```bash
python3 -m venv backend/.venv
backend/.venv/bin/python -m pip install -r backend/requirements-ocr.txt
npm --prefix frontend ci
```

Python 3.11 is verified on this Mac; Python 3.12 is also an appropriate runtime.
Linux/CUDA wheels from the earlier offline bundle cannot be used on macOS.
Keep the two extracted inference directories under
`~/Downloads/sipaware-ocr-offline/`:

```text
PP-OCRv6_medium_det_infer/{inference.json,inference.pdiparams,inference.yml}
PP-OCRv6_medium_rec_infer/{inference.json,inference.pdiparams,inference.yml}
```

Then run:

```bash
bash scripts/run-ocr-demo.sh
```

For a different model location set `SIPAWARE_OCR_MODEL_ROOT` first. Open
<http://127.0.0.1:5173/iteration2/record>, choose **Record Manually**, then
**Scan Label**. Choose a JPEG, PNG or WebP image under 8 MB and 20 megapixels.
The first request loads the model; subsequent scans reuse it. Both processes
listen on loopback. Ctrl-C stops the two processes started by the script.
Logs are under `.local/ocr-demo/` (ignored by Git).

OCR fills empty name, drink type, custom volume and ABV fields only. Existing
values, servings consumed, date and time are kept. Container capacity is not
necessarily the serving size; review it before recording. Nothing is saved
until the user explicitly submits the form. If no type is found, choose it
manually to expose the serving-volume controls. The existing form's validation
still applies (including its rule requiring ABV greater than zero).

Public reference data still uses the existing database when configured; manual
entry and OCR work with fallback categories when that database is unavailable.
No database configuration is needed for this demonstration.

## Verification

With the services running:

```bash
backend/.venv/bin/python scripts/test_ocr_demo.py
```

This generates `.local/ocr-demo/sample-label.png` with fictional text and calls
the real CPU model through HTTP. It verifies 375 mL, 4.5% ABV, beer and PALE ALE.
Upload that same PNG through the UI to exercise frontend prefill. This synthetic
label verifies integration only; it does not measure accuracy on real bottles.

Unit checks:

```bash
cd backend
.venv/bin/python -m pytest ../tests/epic3/backend/test_ocr.py
cd ../frontend
npm test -- ../tests/epic3/frontend/labelOcr.test.tsx
npm run build
```

## API and optional deployment

`POST /api/ocr/drink-label` (also `/iteration2/api/ocr/drink-label`) accepts the
binary image as the request body, with `Content-Type: image/jpeg`, `image/png`
or `image/webp`. It returns `fields`, `lines`, `warnings`, and `elapsedMs`.
Only individual OCR lines have model scores; field rules do not invent calibrated
confidence scores. API limits are enforced before inference, and concurrent
inference is serialized with a busy response rather than queuing many models.

OCR is disabled unless `SIPAWARE_OCR_ENABLED=1`. The launcher enables it locally.
Heavy dependencies live in `backend/requirements-ocr.txt`; existing hosting
installs from `backend/requirements.txt` still start without importing Paddle.
The Vite dev proxy forwards both API prefixes to localhost:8000. No hosted
deployment or Git push is needed.
