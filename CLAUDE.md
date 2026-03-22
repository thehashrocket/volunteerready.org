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
- `pnpm seed`: seed local dev database (reads from `.env.local`)
- `pnpm seed:production`: seed production database (run manually: `source .env.production && pnpm seed:production`)
- `pnpm seed:dev`: seed with full demo data
- `pnpm admin:grant <email>`: grant platform admin to a user
- `pnpm admin:revoke <email>`: revoke platform admin from a user
- `pnpm seed:platform-admins`: migrate `PLATFORM_ADMIN_IDS` env var to DB column (idempotent)
- `pnpm backfill:default-questions`: seed default screener questions for pre-existing orgs (idempotent, safe to re-run)

Note: the build script (`pnpm build`) runs `pnpm db:seed` automatically on every deploy,
which includes the production seed (platform org, skill catalog, and default screener
question backfill). After a fresh production database setup, also run
`pnpm seed:production` manually to create the platform org and skill catalog.

## Test Accounts (dev/staging)

`pnpm seed:dev` creates dedicated test accounts for local development and QA:
- `orgadmin@volunteermatch.local` — Org OWNER (Helping Hands)
- `companyadmin@volunteermatch.local` — Company Admin
- `volunteer@volunteermatch.local` — Volunteer

Use the magic link flow to sign in. Auth cookie name: `next-auth.session-token`.

## Coding Style & Naming Conventions

Prefer 2-space indentation for JavaScript/TypeScript and 4-space for Python.
Name files and directories using `kebab-case` and keep module names
descriptive (e.g., `user-profile.ts`, `email-service.py`). If you add a formatter
or linter (Prettier, ESLint, Black), document the exact commands and config.

## Testing Guidelines

- Test runner: Vitest (`pnpm test`)
- Unit tests: `src/**/*.test.ts` and `src/**/*.test.tsx` (colocated with source)
- Component tests: use `@testing-library/react` + jsdom; add `// @vitest-environment jsdom` to `.tsx` test files
- Test setup: `src/test-setup.ts` (jest-dom matchers + ResizeObserver polyfill)
- Integration tests excluded from `pnpm test`: `src/**/*.integration.test.ts`

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
- Default screener questions: `DEFAULT_SCREENER_QUESTIONS` in `volunteer-screening.ts`, seeded on org creation via `seedDefaultQuestions()` in `screenerQuestionsRepo.ts`
- RBAC permissions: `src/server/domain/permissions.ts` (constants, `hasPermission()`, role maps)
- Platform admin: `src/server/domain/platform-admin.ts` (`isPlatformAdmin()` with DB + env-var fallback)
- Advisory permission middleware: `src/server/trpc/advisory-permission-middleware.ts` (global, never blocks, logs mismatches)
- Background check adapters: `src/server/lib/adapters/background-check/` (Checkr + Sterling), registry at `registry.ts`
- Sterling webhook: `src/app/api/sterling/webhook/route.ts`
- Prisma client is generated into `src/prisma/generated/client`
- public apply flow lives under `src/app/apply/[orgSlug]`
- Volunteer applications may be linked to users via `submittedByUserId` (see `screener.myApplications`).
- User-facing application status routes live at `src/app/(app)/app/my-applications` and `src/app/(app)/app/my-applications/[id]`.
- Email-based status lookup lives under `src/app/apply/status`.
- QR check-in: token lib at `src/server/lib/checkin-token.ts`, scanner at `src/app/(app)/app/scan/`, QR display at `src/components/app/qr-checkin-code.tsx`
- Geo check-in: `src/components/app/geo-checkin.tsx` + `src/server/lib/geo.ts`
- SEO: dynamic sitemap at `src/app/sitemap.ts`, robots at `src/app/robots.ts` (served at `/sitemap.xml` and `/robots.txt`)
- SEO: OG image API at `src/app/api/og/[type]/[slug]/route.tsx` (branded Open Graph images for pages + org routes)
- SEO: JSON-LD components at `src/components/json-ld-breadcrumb.tsx` and `src/components/json-ld-faq.tsx`
- SEO: `BASE_URL` constant at `src/lib/constants.ts` — canonical production URL used by sitemap, robots, JSON-LD, OG images
- PWA: `public/manifest.webmanifest`, `public/sw.js`, `src/components/sw-register.tsx`, `src/components/ios-install-prompt.tsx`
- Org health score: domain at `src/server/domain/org-health.ts`, widget at `src/components/app/org-health-widget.tsx`
- Activity feed: `src/components/app/activity-feed.tsx` (uses `screener.getActivityFeed` tRPC query)
- Dashboard: `src/app/(app)/app/page.tsx` — role-conditional: volunteers see `VolunteerDashboard` (upcoming shifts, pending apps, expiring creds, impact stats, recommendations); staff see greeting banner + OrgHealthWidget + OnboardingChecklist + ReferralPrompt + stat cards + ActivityFeed (Getting Started Checklist removed in v0.14.0)
- Volunteer dashboard: service at `src/server/services/volunteerDashboardService.ts`, component at `src/components/app/volunteer-dashboard.tsx`, tRPC router at `src/server/trpc/routers/volunteer.ts` (`volunteer.getDashboard`)
- Onboarding funnel analytics (platform admin): service at `src/server/services/onboardingAnalyticsService.ts`, page at `src/app/(app)/app/admin/onboarding/page.tsx`, tRPC procedure at `admin.onboardingFunnel`
- Screening landing page: `src/app/(public)/screening/page.tsx` with `SwitchCostCalculator` at `src/components/switch-cost-calculator.tsx`
- Onboarding checklist: `src/components/app/onboarding-checklist.tsx` (4-milestone widget, dismissible via `screener.dismissOnboardingChecklist`)
- Referral prompt: `src/components/app/referral-prompt.tsx` (shows after first background check, localStorage dismissal)
- Referral landing page: `src/app/apply/refer/page.tsx` — `/apply/refer?from=[orgSlug]` with referrer badge
- Org feedback survey: `src/app/(public)/screening/feedback/` (public form, day-7 and day-30 questions)
- Org feedback cron: `src/app/api/cron/org-feedback/route.ts` (daily 10:00 UTC), service at `src/server/services/org-feedback-service.ts`
- Impact report: `src/app/(app)/app/impact-report/page.tsx` (baseline vs platform usage metrics)
- Onboarding baseline: `src/app/(app)/app/settings/onboarding/page.tsx` (volunteer count, hours/week, current process)
- Reference data boot guard: domain at `src/server/domain/reference-data.ts` (`SKILL_CATALOG`, `CATALOG_VERSION`, `PLATFORM_ORG_SLUG`), service at `src/server/services/referenceDataService.ts` (`ensureReferenceData()` with promise dedup and `_seeded` module flag), repo at `src/server/repositories/referenceDataRepo.ts`. Call `ensureReferenceData()` in any service that depends on the skill catalog or platform org. Boot guard also runs at Next.js startup via `src/instrumentation.ts`.
- Content Flywheel: domain at `src/server/domain/case-study.ts`, service at `src/server/services/caseStudyService.ts`, token lib at `src/server/lib/case-study-token.ts`, tRPC router at `src/server/trpc/routers/case-study.ts`
- Case study admin: `src/app/(app)/app/admin/case-studies/page.tsx` (consent toggle, approval email, PDF download, markdown copy)
- Public stories: `src/app/(public)/stories/[orgSlug]/page.tsx`, consent pages at `stories/consent-confirmed` and `stories/consent-expired`
- Case study API: consent flow at `src/app/api/case-study/consent/route.ts` (GET confirmation + POST mutation), PDF at `src/app/api/case-study/pdf/route.ts`
- Testimonials: `src/components/testimonial-section.tsx` + `src/components/testimonial-block.tsx` (screening landing page)
- No Prisma calls in tRPC routers. Routers call services. Services call repositories. Period.
- All DB writes go through services (so audit logging is automatic).
- Every table gets createdAt, updatedAt, and if relevant deletedAt. Soft delete now saves you.
- Zod schemas live next to domain models and get imported on both sides. No duplicating.

## Design System

Always read `DESIGN.md` before making any visual or UI decisions.
All font choices, colors, spacing, and aesthetic direction are defined there.
Do not deviate without explicit user approval.
In QA mode, flag any code that doesn't match DESIGN.md.

## Docs Index

### Architecture & Design (read these first)

- `docs/AI_CONTEXT.md` — full project orientation (tech stack, patterns, conventions)
- `docs/AGENT_RULES.md` — strict rules for AI agents (layer boundaries, multi-tenancy, etc.)
- `docs/ARCHITECTURE.md` — architectural principles and layered design
- `docs/DOMAIN.md` — canonical domain model definitions
- `docs/REQUEST_FLOW.md` — how data flows through the system
- `docs/SYSTEM_DIAGRAM.md` — Mermaid diagrams of system architecture
- `docs/ROADMAP.md` — phased development plan
- `docs/designs/phase-9-production-ready.md` — Phase 9 plan (production-ready + activation)
- `docs/designs/phase-10-scale-enterprise.md` — Phase 10 plan (scale & enterprise readiness)
- `docs/designs/phase-11-marketplace-api.md` — Phase 11 plan (volunteer marketplace & API platform)
- `docs/designs/concierge-activation-engine.md` — Phase 12 plan (concierge activation engine)
- `docs/designs/rbac-foundation.md` — RBAC foundation design doc (permissions, advisory middleware, platform admin)
- `docs/designs/reference-data-boot-guard.md` — Reference Data Boot Guard design doc (self-healing skill catalog + platform org)
- `docs/TODOS.md` - todos for the current project

## gstack

Use the `/browse` skill from gstack for all web browsing. Never use `mcp__claude-in-chrome__*` tools.

Available gstack skills:
- `/office-hours` — brainstorm and validate ideas
- `/plan-ceo-review` — CEO/founder-mode plan review
- `/plan-eng-review` — engineering architecture review
- `/plan-design-review` — designer's eye plan review
- `/design-consultation` — create a design system / DESIGN.md
- `/review` — pre-landing PR code review
- `/ship` — ship workflow (test, review, PR)
- `/land-and-deploy` — merge PR and verify production
- `/canary` — post-deploy canary monitoring
- `/benchmark` — performance regression detection
- `/browse` — headless browser for QA and testing
- `/qa` — systematically QA test and fix bugs
- `/qa-only` — QA report without fixes
- `/design-review` — visual design audit and fixes
- `/setup-browser-cookies` — import cookies for authenticated testing
- `/setup-deploy` — configure deployment settings
- `/retro` — weekly engineering retrospective
- `/investigate` — systematic debugging with root cause analysis
- `/document-release` — post-ship documentation update
- `/codex` — second opinion via OpenAI Codex CLI
- `/careful` — safety guardrails for destructive commands
- `/freeze` — restrict edits to a specific directory
- `/guard` — full safety mode (careful + freeze)
- `/unfreeze` — remove edit restrictions
- `/gstack-upgrade` — upgrade gstack to latest version

## LLMs documentation

- Prisma 7.2.0: <https://www.prisma.io/llms.txt>
- Next.js 16.1.3: <https://nextjs.org/docs/llms-full.txt>
- React 19.2.3: <https://react.dev/reference/react>
- Shadcn UI: <https://ui.shadcn.com/llms.txt>
