# Repository Guidelines

## Project Structure & Module Organization

This repository uses a Next.js + VitePress layout. Keep docs under `docs/`
and application code under `src/`.

- `src/`: application source code
- `tests/`: automated tests (unit/integration)
- `public/` or `assets/`: static files (images, fonts, etc.)
- `docs/`: architectural notes and user-facing docs

If you introduce a framework with a prescribed layout, follow that framework’s
conventions and document any deviations here.

## Build, Test, and Development Commands

Current commands:

- `pnpm install`: install dependencies
- `pnpm dev`: start local development server
- `pnpm build`: build for production
- `pnpm start`: run production server
- `pnpm lint`: run Biome checks
- `pnpm format`: run Biome formatting
- `pnpm docs:dev`: run VitePress docs locally
- `pnpm docs:build`: build docs site
- `pnpm docs:preview`: preview built docs site

## Coding Style & Naming Conventions

Prefer 2-space indentation for JavaScript/TypeScript and 4-space for Python.
Name files and directories using `kebab-case` and keep module names
descriptive (e.g., `user-profile.ts`, `email-service.py`). If you add a formatter
or linter (Prettier, ESLint, Black), document the exact commands and config.

## Testing Guidelines

Place tests under `tests/` or alongside source (e.g., `src/foo.test.ts`).
Use a single test runner per language and document the convention for test file
names (`*.test.*` or `*_test.*`). State any coverage targets once tooling exists.

## Commit & Pull Request Guidelines

Until a convention is established, use concise, imperative commit messages,
e.g., “Add API client” or “Fix build script”. Pull requests should include:

- Clear description of changes and rationale
- Linked issue or ticket (if applicable)
- Screenshots for UI changes
- Testing notes (commands run and results)

## Configuration & Secrets

Store environment-specific values in `.env` files and keep secrets out of Git.
Provide a `.env.example` with safe defaults and required keys.

## Foundation decisions (locked-in defaults)

- App Router (Next.js 16), React 19
- Auth: NextAuth (Auth.js) + Prisma Adapter
- DB: Postgres, Prisma
- API: tRPC v11 (App Router compatible)
- Validation: Zod (shared between client/server)
- UI: Tailwind + shadcn/ui + lucide-react
- Formatting/Lint: Biome (no ESLint/Prettier)
- SOLID: enforce via folder boundaries + service layer + repository layer + pure domain types + “no Prisma in UI/components”

## Repo layout

```text
src/
  app/
    (public)/
    (auth)/
    (app)/
  server/
    trpc/
    services/
    repositories/
    domain/
  components/
  lib/
  styles/
prisma/
docs/
```

## Rules

- app/** = routing + page composition only
- server/services/** = business logic (SOLID home base)
- server/repositories/** = Prisma access only
- server/domain/** = types + invariants + pure functions
- server/trpc/** = routers + procedures only (thin)
