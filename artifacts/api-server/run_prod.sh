#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/../.."
exec python -m uvicorn app.main:app --host 0.0.0.0 --port "$PORT" --app-dir artifacts/api-server
