#!/usr/bin/env bash
set -euo pipefail
HOST="${FACEID_HOST:-ali@192.168.68.109}"
REMOTE_DIR="${MARUF_REMOTE_DIR:-~/maruf}"
PROJECT_ID="${RAILWAY_PROJECT_ID:-88f42880-12b2-4420-8449-c9bb353593f1}"
WORKDIR="${TMPDIR:-/tmp}/maruf-railway-migrate-$$"
mkdir -p "$WORKDIR"
trap 'rm -rf "$WORKDIR"' EXIT

echo "==> Reading Railway Postgres URL..."
DATABASE_PUBLIC_URL="$(
  railway variables \
    --project "$PROJECT_ID" \
    --service Postgres \
    --environment production \
    --json \
    | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("DATABASE_PUBLIC_URL") or d.get("DATABASE_URL") or "")'
)"
[[ -n "$DATABASE_PUBLIC_URL" ]] || { echo "No DATABASE_PUBLIC_URL"; exit 1; }

echo "==> Dumping (postgres:18)..."
docker run --rm -v "$WORKDIR:/out" postgres:18 \
  pg_dump --no-owner --no-acl --format=custom \
  -f /out/maruf.dump "$DATABASE_PUBLIC_URL"
ls -lh "$WORKDIR/maruf.dump"

echo "==> Copy + restore..."
scp "$WORKDIR/maruf.dump" "$HOST:/tmp/maruf.dump"
ssh -t "$HOST" "cd $REMOTE_DIR/deploy/selfhost && \
  DB_CID=\$(docker compose --env-file .env ps -q db) && \
  docker cp /tmp/maruf.dump \$DB_CID:/tmp/maruf.dump && \
  docker compose --env-file .env exec -T db \
    pg_restore --clean --if-exists --no-owner --no-acl -U postgres -d maruf /tmp/maruf.dump && \
  docker compose --env-file .env exec -T db rm -f /tmp/maruf.dump && \
  rm -f /tmp/maruf.dump && \
  docker compose --env-file .env restart app && \
  echo RESTORE_FINISHED"

echo "Done."
