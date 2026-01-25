# Deployment

## Environment variables

- `DATABASE_URL`: Postgres connection string
- `NEXTAUTH_URL`: base URL for NextAuth
- `NEXTAUTH_SECRET`: secret for signing sessions
- `GOOGLE_CLIENT_ID`: Google OAuth client ID
- `GOOGLE_CLIENT_SECRET`: Google OAuth client secret
- `RESEND_API_KEY`: Resend API key for email magic links
- `EMAIL_FROM`: from address for transactional emails
- `NEXTAUTH_URL` must match the deployed base URL for magic link callbacks

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
- Prisma uses the Postgres driver adapter (`@prisma/adapter-pg`) with `pg` for runtime connections.
