#!/usr/bin/env bash
set -euo pipefail
HOST="${FACEID_HOST:-ali@192.168.68.109}"
REMOTE_DIR="${MARUF_REMOTE_DIR:-~/maruf}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

rsync -az --delete \
  --exclude node_modules \
  --exclude .git \
  --exclude __pycache__ \
  --exclude 'deploy/selfhost/.env' \
  --exclude '*.dump' \
  --exclude uploads \
  "$ROOT/" "$HOST:$REMOTE_DIR/"

# Compose sets name: maruf — never collides with faceid/mykadr.
ssh -t "$HOST" "cd $REMOTE_DIR/deploy/selfhost && \
  if [[ ! -f .env ]]; then echo 'Missing .env'; exit 1; fi && \
  docker compose --env-file .env up -d --build && \
  docker compose --env-file .env ps"

echo
echo "Maruf local: http://192.168.68.109:3011"
echo "Tunnel hostname: prorab.myturniket.uz → http://localhost:3011"
