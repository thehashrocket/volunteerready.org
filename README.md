# VolunteerMatch

Next.js App Router scaffold with Tailwind, shadcn/ui, tRPC, Prisma, and NextAuth.

## Commands

- `pnpm dev`: start local development server
- `pnpm build`: build for production
- `pnpm start`: run production server
- `pnpm lint`: run Biome checks
- `pnpm format`: run Biome formatting
- `pnpm docs:dev`: run VitePress docs locally
- `pnpm docs:build`: build docs site
- `pnpm docs:preview`: preview built docs site

## Notes

- Env vars live in `.env` with a safe `.env.example` template.
- Prisma schema is in `prisma/schema.prisma`.
- Documentation lives in `docs/`.
- Key docs: `docs/guide/auth-flows.md`, `docs/guide/org-model.md`, `docs/guide/deployment.md`.
- App routes: `/login` and `/app`.
- Screening domain logic lives in `src/server/domain/volunteer-screening.ts`.
