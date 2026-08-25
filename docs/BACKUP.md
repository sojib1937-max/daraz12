# Backup & Recovery

## Database backups (PostgreSQL)

```bash
# One-off
pg_dump "$DATABASE_URL" | gzip > backups/db-$(date +%F-%H%M).sql.gz

# Cron — daily at 03:00 Dubai time, keep 14 days
0 3 * * * cd /opt/desertcart && ./scripts/backup.sh >> backups/backup.log 2>&1
```

`scripts/backup.sh` (included in the repo) does:

1. `pg_dump` of the configured `DATABASE_URL` → `backups/db-YYYY-MM-DD.sql.gz`
2. rsync/tar of `backend/uploads/` → `backups/uploads-YYYY-MM-DD.tar.gz`
3. Prunes backups older than 14 days
4. (Optional) uploads the archive to an S3-compatible bucket if `BACKUP_S3_URL` is set

## Restore

```bash
# Database
gunzip -c backups/db-2026-08-24.sql.gz | psql "$DATABASE_URL"

# Media
tar -xzf backups/uploads-2026-08-24.tar.gz -C /opt/desertcart/backend/
```

> Restore to an EMPTY database. With managed Postgres (Neon/Supabase/RDS) prefer
> their point-in-time recovery feature — it is safer than SQL restore.

## Environment variables to keep safe

The production environment is your recovery key — store a copy of `backend/.env`
(without real secrets: DATABASE_URL, SESSION_SECRET, SMTP/S3 keys) in your password
manager, because the deployed server may not be reproducible without it.

## Recovery drill (do this once a quarter)

1. Spin up a scratch PostgreSQL.
2. Restore the latest dump.
3. Run `npx prisma migrate deploy` (should be a no-op).
4. Start the backend with the scratch DB and verify `/api/health` + admin login.

## Media strategy note

In production, set `STORAGE_DRIVER=s3` and point it at an S3-compatible bucket
(Cloudflare R2, DO Spaces, AWS S3). Media then lives outside the server, survives
server replacement, and backups only need to cover the database.
