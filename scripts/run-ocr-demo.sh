#!/usr/bin/env bash
# Start only loopback services; Ctrl-C stops both processes owned by this script.
set -euo pipefail
OCR_PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$OCR_PROJECT_ROOT"
export SIPAWARE_OCR_ENABLED=1
export SIPAWARE_OCR_MODEL_ROOT="${SIPAWARE_OCR_MODEL_ROOT:-$HOME/Downloads/sipaware-ocr-offline}"
export PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK=True
export VITE_API_BASE_URL=http://127.0.0.1:8000
if [ ! -x backend/.venv/bin/python ] || [ ! -f frontend/node_modules/vite/bin/vite.js ]; then
  printf '%s\n' 'Install backend/requirements-ocr.txt in backend/.venv and run npm ci in frontend first.'
  exit 1
fi
backend/.venv/bin/python -c 'import socket; sockets = [socket.socket(), socket.socket()]; [sock.bind(("127.0.0.1", port)) for sock, port in zip(sockets, (8000, 5173))]'
for kind in det rec; do
  for file in inference.json inference.pdiparams inference.yml; do
    if [ ! -f "$SIPAWARE_OCR_MODEL_ROOT/PP-OCRv6_medium_${kind}_infer/$file" ]; then
      printf 'Missing model file: %s\n' "$SIPAWARE_OCR_MODEL_ROOT/PP-OCRv6_medium_${kind}_infer/$file"
      exit 1
    fi
  done
done
mkdir -p .local/ocr-demo
OCR_BACKEND_PID=''
OCR_FRONTEND_PID=''
cleanup() {
  trap - EXIT INT TERM
  if [ -n "$OCR_BACKEND_PID" ]; then kill "$OCR_BACKEND_PID" 2>/dev/null || true; fi
  if [ -n "$OCR_FRONTEND_PID" ]; then kill "$OCR_FRONTEND_PID" 2>/dev/null || true; fi
  wait 2>/dev/null || true
}
trap cleanup EXIT
trap 'exit 130' INT TERM
backend/.venv/bin/python -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000 \
  > .local/ocr-demo/backend.log 2>&1 &
OCR_BACKEND_PID=$!
(cd frontend && exec node node_modules/vite/bin/vite.js --host 127.0.0.1) \
  > .local/ocr-demo/frontend.log 2>&1 &
OCR_FRONTEND_PID=$!
printf '%s\n' 'OCR demo: http://127.0.0.1:5173/iteration2/record' \
  'Choose Record Manually, then Scan Label. First use loads the CPU model.' \
  'Logs: .local/ocr-demo/backend.log and frontend.log. Ctrl-C stops both services.'
while kill -0 "$OCR_BACKEND_PID" 2>/dev/null && kill -0 "$OCR_FRONTEND_PID" 2>/dev/null; do sleep 1; done
printf '%s\n' 'A service stopped. Check .local/ocr-demo/*.log.'
exit 1
