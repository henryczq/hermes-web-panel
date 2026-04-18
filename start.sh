#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_PYTHON="$ROOT_DIR/.venv/bin/python"
HOST="${HERMES_WEB_PANEL_HOST:-${HERMES_ADMIN_HOST:-0.0.0.0}}"
PORT="${HERMES_WEB_PANEL_PORT:-${HERMES_ADMIN_PORT:-1226}}"
RELOAD="${HERMES_WEB_PANEL_RELOAD:-${HERMES_ADMIN_RELOAD:-1}}"
AUTO_REPLACE="${HERMES_WEB_PANEL_AUTO_REPLACE:-${HERMES_ADMIN_AUTO_REPLACE:-1}}"

if [[ -x "$VENV_PYTHON" ]]; then
  PYTHON_BIN="$VENV_PYTHON"
else
  PYTHON_BIN="${PYTHON:-python3}"
fi

export PYTHONPATH="$ROOT_DIR/apps/server/src:$ROOT_DIR/packages${PYTHONPATH:+:$PYTHONPATH}"

cd "$ROOT_DIR"

find_port_pids() {
  if command -v lsof >/dev/null 2>&1; then
    lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true
    return
  fi

  if command -v ss >/dev/null 2>&1; then
    ss -ltnp "sport = :$PORT" 2>/dev/null | awk -F 'pid=' 'NF > 1 {split($2, a, ","); print a[1]}' | sort -u
    return
  fi
}

PORT_PIDS="$(find_port_pids)"
if [[ -n "${PORT_PIDS:-}" ]]; then
  if [[ "$AUTO_REPLACE" == "1" ]]; then
    SAFE_TO_KILL=1
    while read -r pid; do
      [[ -z "$pid" ]] && continue
      CMDLINE="$(ps -p "$pid" -o args= 2>/dev/null || true)"
      if [[ "$CMDLINE" != *"hermes_admin_server.main:app"* ]]; then
        SAFE_TO_KILL=0
        break
      fi
    done <<< "$PORT_PIDS"

    if [[ "$SAFE_TO_KILL" == "1" ]]; then
      echo "Port $PORT is already used by an existing Hermes Web Panel process. Restarting it..."
      while read -r pid; do
        [[ -z "$pid" ]] && continue
        kill "$pid" 2>/dev/null || true
      done <<< "$PORT_PIDS"
      sleep 1
    else
      echo "Port $PORT is already in use by another process."
      echo "Set HERMES_WEB_PANEL_PORT to another port, or stop the existing process first."
      exit 1
    fi
  else
    echo "Port $PORT is already in use."
    echo "Stop the existing process first, or rerun with HERMES_WEB_PANEL_AUTO_REPLACE=1."
    exit 1
  fi
fi

UVICORN_ARGS=(
  hermes_admin_server.main:app
  --host "$HOST"
  --port "$PORT"
)

if [[ "$RELOAD" == "1" ]]; then
  UVICORN_ARGS+=(
    --reload
    --reload-dir "$ROOT_DIR/apps/server/src"
    --reload-dir "$ROOT_DIR/packages"
  )
fi

exec "$PYTHON_BIN" -m uvicorn "${UVICORN_ARGS[@]}"
