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
- screening domain lives in `src/server/domain/volunteer-screening.ts`
- Prisma client is generated into `src/prisma/generated/client`
- public apply flow lives under `src/app/apply/[orgSlug]`
- Volunteer applications may be linked to users via `submittedByUserId` (see `screener.myApplications`).
- User-facing application status routes live at `src/app/(app)/app/my-applications` and `src/app/(app)/app/my-applications/[id]`.
- Email-based status lookup lives under `src/app/apply/status`.
- No Prisma calls in tRPC routers. Routers call services. Services call repositories. Period.
- All DB writes go through services (so audit logging is automatic).
- Every table gets createdAt, updatedAt, and if relevant deletedAt. Soft delete now saves you.
- Zod schemas live next to domain models and get imported on both sides. No duplicating.

## Docs Index

### Architecture & Design (read these first)

- `docs/AI_CONTEXT.md` — full project orientation (tech stack, patterns, conventions)
- `docs/AGENT_RULES.md` — strict rules for AI agents (layer boundaries, multi-tenancy, etc.)
- `docs/ARCHITECTURE.md` — architectural principles and layered design
- `docs/DOMAIN.md` — canonical domain model definitions
- `docs/REQUEST_FLOW.md` — how data flows through the system
- `docs/SYSTEM_DIAGRAM.md` — Mermaid diagrams of system architecture
- `docs/ROADMAP.md` — phased development plan
- `docs/TODOS.md` - todos for the current project

## gstack

gstack is checked into this repo at `.claude/skills/gstack`. No global install needed — teammates get it automatically.

Use the `/browse` skill from gstack for all web browsing. **Never use `mcp__claude-in-chrome__*` tools.**

Available gstack skills:
- `/plan-ceo-review` — CEO-level plan review
- `/plan-eng-review` — Engineering-level plan review
- `/review` — Code review
- `/ship` — Ship a feature
- `/browse` — Web browsing (use this instead of Chrome MCP tools)
- `/qa` — QA testing
- `/setup-browser-cookies` — Set up browser cookies
- `/retro` — Retrospective
- `/gstack-upgrade` — Upgrade gstack to the latest version

If gstack skills aren't working, run:
```bash
cd .claude/skills/gstack && ./setup
```
This builds the binary and registers the skills.

## LLMs documentation

- Prisma 7.2.0: <https://www.prisma.io/llms.txt>
- Next.js 16.1.3: <https://nextjs.org/docs/llms-full.txt>
- React 19.2.3: <https://react.dev/reference/react>
- Shadcn UI: <https://ui.shadcn.com/llms.txt>
