# Release Runbook

## Scope

This runbook covers production release steps for the Pop Quiz app API and static frontend.

## Preconditions

1. Main branch is green in CI.
2. Latest migrations are committed.
3. Required environment variables are configured.
4. DB backup command succeeds before deploy.

## Required Environment Variables

- `DATABASE_URL`
- `AUTH_JWT_SECRET`
- `AUTH_SALT_ROUNDS`
- `PORT`
- `NODE_ENV=production`

## Backup Plan (Before Migration)

1. Set backup output folder:
   - `export BACKUP_DIR=./backups`
2. Ensure folder exists:
   - `mkdir -p "$BACKUP_DIR"`
3. Run full backup:
   - `pg_dump "$DATABASE_URL" > "$BACKUP_DIR/pop_quiz_$(date +%Y%m%d_%H%M%S).sql"`
4. Verify file is non-empty:
   - `ls -lh "$BACKUP_DIR" | tail -n 1`

## Deploy Steps

1. Pull latest main.
2. Install dependencies:
   - `npm ci`
3. Run preflight checks:
   - `npm run release:preflight`
4. Run migrations:
   - `npm run db:migrate:deploy`
5. Restart API process.
6. Smoke-check endpoints:
   - `GET /health`
   - Admin login
   - Student login
   - Student quiz list

## Rollback Plan

1. If migration introduces issue:
   - Stop API process.
   - Restore DB backup:
     - `psql "$DATABASE_URL" < <backup_file.sql>`
2. Checkout previous known-good release commit/tag.
3. Reinstall and restart API process.
4. Re-run smoke checks.

## Post-Release Validation

1. Create a draft quiz.
2. Publish quiz.
3. Submit a student attempt.
4. Publish results.
5. Confirm student sees released score.

## On-Call Notes

- Keep at least 7 daily backups.
- Record release SHA, timestamp, and operator in deployment log.
