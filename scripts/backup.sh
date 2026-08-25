#!/usr/bin/env bash
# ============================================================
# DesertCart backup script — database + media
# Usage: ./scripts/backup.sh
# Requires: DATABASE_URL in backend/.env, pg_dump, tar
# ============================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$ROOT/backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"

# Load DATABASE_URL from backend/.env if not already set
if [[ -z "${DATABASE_URL:-}" && -f "$ROOT/backend/.env" ]]; then
  export DATABASE_URL="$(grep -E '^DATABASE_URL=' "$ROOT/backend/.env" | head -1 | cut -d= -f2- | tr -d '"' || true)"
fi
if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERROR: DATABASE_URL not found (set it or put it in backend/.env)" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
STAMP="$(date +%F-%H%M)"

echo "==> Dumping database…"
pg_dump "$DATABASE_URL" | gzip > "$BACKUP_DIR/db-$STAMP.sql.gz"

if [[ -d "$ROOT/backend/uploads" ]]; then
  echo "==> Archiving media…"
  tar -czf "$BACKUP_DIR/uploads-$STAMP.tar.gz" -C "$ROOT/backend" uploads
fi

echo "==> Pruning backups older than ${KEEP_DAYS} days…"
find "$BACKUP_DIR" -name 'db-*.sql.gz' -mtime "+$KEEP_DAYS" -delete
find "$BACKUP_DIR" -name 'uploads-*.tar.gz' -mtime "+$KEEP_DAYS" -delete

echo "==> Done:"
ls -lh "$BACKUP_DIR" | tail -6
