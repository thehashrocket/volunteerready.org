#!/bin/sh
# Vercel build script.
# Runs prisma migrate deploy only on production to prevent advisory lock
# race conditions when preview and production deployments run concurrently.
set -e

if [ "$VERCEL_ENV" = "production" ]; then
  # Preflight BEFORE migrate deploy.
  #
  # 20260726225900_canonicalize_user_email refuses to run if any two User rows
  # differ only by case, because its backfill would violate User_email_key.
  # Without this check the first anyone hears about it is a RAISE mid-migration
  # against the production database — and because Prisma records that migration
  # as failed, every subsequent deploy then aborts with P3009 until an operator
  # runs `prisma migrate resolve`. Read-only, exits non-zero on collisions, so
  # a dirty database fails the BUILD instead of wedging the pipeline.
  echo "Production build: pre-checking for email collisions..."
  pnpm check:email-collisions

  echo "Production build: running prisma migrate deploy..."
  pnpm prisma migrate deploy
else
  echo "Preview/development build: skipping prisma migrate deploy (schema already applied)"
fi

pnpm prisma generate
pnpm seed
pnpm next build
