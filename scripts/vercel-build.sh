#!/bin/sh
# Vercel build script.
# Runs prisma migrate deploy only on production to prevent advisory lock
# race conditions when preview and production deployments run concurrently.
set -e

if [ "$VERCEL_ENV" = "production" ]; then
  echo "Production build: running prisma migrate deploy..."
  pnpm prisma migrate deploy
fi

pnpm prisma generate
pnpm seed
pnpm next build
