#!/usr/bin/env bash
# Expose only the token-protected OCR origin through a temporary HTTPS tunnel.
set -euo pipefail

OCR_PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$OCR_PROJECT_ROOT"

export SIPAWARE_OCR_ENABLED=1
export SIPAWARE_OCR_REQUIRE_TOKEN=1
export SIPAWARE_OCR_MODEL_ROOT="${SIPAWARE_OCR_MODEL_ROOT:-$HOME/Downloads/sipaware-ocr-offline}"
export PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK=True
OCR_TUNNEL_PORT="${SIPAWARE_OCR_TUNNEL_PORT:-8010}"
OCR_SHARED_SECRET="${SIPAWARE_OCR_SHARED_SECRET:-}"
OCR_CLOUDFLARED_BIN="${SIPAWARE_CLOUDFLARED_BIN:-}"
unset SIPAWARE_OCR_UPSTREAM_URL

if [ ! -x backend/.venv/bin/python ]; then
  printf '%s\n' 'Missing backend/.venv. Install backend/requirements-ocr.txt first.'
  exit 1
fi
if [ -z "$OCR_CLOUDFLARED_BIN" ]; then
  if command -v cloudflared >/dev/null 2>&1; then
    OCR_CLOUDFLARED_BIN="$(command -v cloudflared)"
  elif [ -x .local/bin/cloudflared ]; then
    OCR_CLOUDFLARED_BIN="$OCR_PROJECT_ROOT/.local/bin/cloudflared"
  else
    printf '%s\n' 'Missing cloudflared. Install it with Homebrew or place it at .local/bin/cloudflared.'
    exit 1
  fi
fi
if [ "${#OCR_SHARED_SECRET}" -lt 32 ]; then
  printf '%s\n' 'Set SIPAWARE_OCR_SHARED_SECRET to at least 32 random characters.' \
    'Generate one with: openssl rand -hex 32'
  exit 1
fi
for kind in det rec; do
  for file in inference.json inference.pdiparams inference.yml; do
    if [ ! -f "$SIPAWARE_OCR_MODEL_ROOT/PP-OCRv6_medium_${kind}_infer/$file" ]; then
      printf 'Missing model file: %s\n' "$SIPAWARE_OCR_MODEL_ROOT/PP-OCRv6_medium_${kind}_infer/$file"
      exit 1
    fi
  done
done

backend/.venv/bin/python - "$OCR_TUNNEL_PORT" <<'PY'
import socket
import sys
with socket.socket() as probe:
    probe.bind(("127.0.0.1", int(sys.argv[1])))
PY

mkdir -p .local/ocr-tunnel
OCR_ORIGIN_PID=''
cleanup() {
  trap - EXIT INT TERM
  if [ -n "$OCR_ORIGIN_PID" ]; then kill "$OCR_ORIGIN_PID" 2>/dev/null || true; fi
  wait 2>/dev/null || true
}
trap cleanup EXIT
trap 'exit 130' INT TERM

backend/.venv/bin/python -m uvicorn app.ocr_origin:app --app-dir backend \
  --host 127.0.0.1 --port "$OCR_TUNNEL_PORT" \
  > .local/ocr-tunnel/origin.log 2>&1 &
OCR_ORIGIN_PID=$!

for attempt in 1 2 3 4 5 6 7 8 9 10; do
  if curl --silent --fail "http://127.0.0.1:$OCR_TUNNEL_PORT/health" >/dev/null; then
    break
  fi
  if ! kill -0 "$OCR_ORIGIN_PID" 2>/dev/null; then
    printf '%s\n' 'OCR origin stopped. Check .local/ocr-tunnel/origin.log.'
    exit 1
  fi
  sleep 1
done
curl --silent --fail "http://127.0.0.1:$OCR_TUNNEL_PORT/health" >/dev/null || {
  printf '%s\n' 'OCR origin did not become ready. Check .local/ocr-tunnel/origin.log.'
  exit 1
}

printf '%s\n' \
  'The temporary public URL will appear below as https://...trycloudflare.com.' \
  'Keep this terminal, the Mac and the network awake for the entire presentation.' \
  'Copy that URL into Vercel as SIPAWARE_OCR_UPSTREAM_URL, then redeploy.' \
  'Use the same SIPAWARE_OCR_SHARED_SECRET value in Vercel. Ctrl-C stops the origin.'

"$OCR_CLOUDFLARED_BIN" tunnel --no-autoupdate --url "http://127.0.0.1:$OCR_TUNNEL_PORT" 2>&1 \
  | tee .local/ocr-tunnel/cloudflared.log
