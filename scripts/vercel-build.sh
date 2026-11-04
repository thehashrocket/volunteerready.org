#!/bin/sh
# Vercel build script.
# Runs prisma migrate deploy only on production to prevent advisory lock
# race conditions when preview and production deployments run concurrently.
set -e

# Generate the Prisma client FIRST, before anything that imports it.
#
# `postinstall` also runs `prisma generate`, but only when the install step
# actually installs. When Vercel restores node_modules from its build cache and
# the lockfile is unchanged, pnpm reports "Already up to date", skips lifecycle
# scripts, and the client (generated into src/prisma/generated, which the cache
# does not hold) never exists. The production preflight below imports it, so
# every production deploy without a dependency change failed with
# "Cannot find module '../src/prisma/generated/client'" (2026-11-03, #279 and
# #280). Dependency-bump deploys passed only because they reinstalled.
# Pinned by scripts/vercel-build-order.test.ts.
pnpm prisma generate

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

  # Two production builds can overlap (two merges a few seconds apart), and
  # Prisma waits only 10s for the other build's migration lock before failing
  # with P1002. `migrate deploy` is idempotent, so retry THAT failure only, a
  # bounded number of times. Never disable the lock instead
  # (PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK): two unlocked deploys can both apply
  # the same migration. The lock is only released reliably because the CLI now
  # connects directly rather than through the pooler (scripts/cli-database-url.ts).
  echo "Production build: running prisma migrate deploy..."
  attempt=1
  until migrate_out=$(pnpm prisma migrate deploy 2>&1); do
    printf '%s\n' "$migrate_out"
    if [ "$attempt" -ge 3 ] || ! printf '%s' "$migrate_out" | grep -q '^Error: P1002'; then
      exit 1
    fi
    attempt=$((attempt + 1))
    echo "Production build: migration lock busy (P1002), retrying in 20s (attempt $attempt of 3)..."
    sleep 20
  done
  printf '%s\n' "$migrate_out"
else
  echo "Preview/development build: skipping prisma migrate deploy (schema already applied)"
fi

pnpm seed
pnpm next build
