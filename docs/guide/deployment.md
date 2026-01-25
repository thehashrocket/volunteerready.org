# Deployment

## Environment variables

- `DATABASE_URL`: Postgres connection string
- `NEXTAUTH_URL`: base URL for NextAuth
- `NEXTAUTH_SECRET`: secret for signing sessions

## Build

- Install: `pnpm install`
- Build app: `pnpm build`
- Build docs: `pnpm docs:build`

## Runtime

- Start app: `pnpm start`
- Serve docs from `docs/.vitepress/dist` (static)

## Notes

- Prisma migrations must be applied before starting the app.
- Run seed data with `pnpm prisma db seed` in non-prod environments.
