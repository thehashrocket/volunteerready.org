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
- `docker compose up -d db`: start the local Postgres 16 container (`docker-compose.yml`, port 5432, credentials match `DATABASE_URL` in `.env.local`). First run: `pnpm prisma migrate deploy && pnpm seed:dev`. `docker compose down -v` deletes the volume. Port 5432 is deliberate — do not remap it
- `pnpm dev`: start local development server. It rewrites two tracked generated files — `next-env.d.ts` and the `<!-- BEGIN:nextjs-agent-rules -->` block in `AGENTS.md` — and **both belong in the commit** (details: `docs/conventions/commands.md`)
- `pnpm build`: build for production
- `pnpm start`: run production server
- `pnpm lint`: run Biome checks
- `pnpm format`: run Biome formatting
- `pnpm typecheck`: `tsc --noEmit` over application code. Not a substitute for `next build` (see CI below)
- `pnpm typecheck:tests`: the same compile over test files (`tsconfig.tests.json`); `pnpm typecheck` excludes them. CI gates on both — they check disjoint file sets
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
- `pnpm check:email-collisions`: **read-only** pre-check for email canonicalization (case-only `User` email collisions, with blast radius). Exit 1 on collisions. Safe against production
- `pnpm fixture:email-collisions`: **dev-only** (refuses non-local `DATABASE_URL`); inserts collision groups to rehearse the pre-check, `--clean` removes them. Deliberately NOT part of `seed:dev`
- `pnpm import:roster --org <slug-or-id> --file <path.csv> [--dry-run] [--yes] [--actor <email>] [--no-notify] [--notify-only]`: concierge roster import through `addVolunteer()`. Always `--dry-run` first; writes need `--yes`; unknown/duplicated flags are refused; any non-dry-run pass against a non-local DB (incl. `--notify-only`) requires typing the resolved slug at a TTY prompt. Idempotent. `--notify-only` is the recovery mode for a killed run (driven by `AuditLog` rows with `metadata.via = 'CONCIERGE_IMPORT'`). Read `docs/conventions/commands.md` before touching the importer or any `sendEmail` caller
- `pnpm credentials:reset-notice --org <slug-or-id> [--since <ISO>] [--yes]` / `--audit-run <auditLogId> [--yes]`: undo credential-expiry notice stamps. Same rails as `import:roster`; `--dry-run` + `--yes` together are refused
- `pnpm test:scripts`: run unit tests for files under `scripts/` (uses `vitest.scripts.config.ts`, excluded from the main Vitest suite)
- `pnpm e2e`: run Playwright specs in `e2e/` (boots `pnpm dev`; `PLAYWRIGHT_BASE_URL` targets a running server, authenticated specs skip non-localhost). The ~30-60s sequential route warmup in `e2e/global-setup.ts` is load-bearing — parallelising it causes manifest-race 500s on unrelated routes
- `pnpm screenshots`: regenerate marketing screenshots in `public/marketing/` (Playwright `capture` project, only registered when `CAPTURE=1`; scenarios at `e2e/capture-scenarios.ts`; needs `pnpm seed:dev` data; filter with `CAPTURE_ONLY=key1,key2`)

Note: the build script (`pnpm build`) runs `pnpm db:seed` automatically on every deploy,
which includes the production seed (platform org, skill catalog, and default screener
question backfill). After a fresh production database setup, also run
`pnpm seed:production` manually to create the platform org and skill catalog.

## Test Accounts (dev/staging)

`pnpm seed:dev` creates dedicated test accounts for local development and QA:
- `orgadmin@volunteermatch.local` — Org OWNER (Helping Hands)
- `companyadmin@volunteermatch.local` — Company OWNER (Acme Corp)
- `volunteer@volunteermatch.local` — Volunteer
- `admin@volunteermatch.local` — Org OWNER (devOrg, display name "Riverside Animal Shelter") — the only seeded account scoped to a single org (no org-switcher); used as the `shelterAdmin` marketing-screenshot capture actor (`e2e/capture-scenarios.ts`)

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
- **The main suite runs in `TZ=America/Los_Angeles`, deliberately not UTC** — do not "normalise" it to make a date test green
- **Vitest 5 with `clearMocks: false` pinned in all three configs** — do not flip it without auditing mock call-count assertions (P3 in `docs/TODOS.md`)
- New router access tests use `createMockTrpcContext()` (`src/server/trpc/__tests__/trpc-context-helpers.ts`), not a hand-built context literal
- Integration tests excluded from `pnpm test`: `src/**/*.integration.test.ts`
- Scripts tests (separate suite): `scripts/**/*.test.ts` — run with `pnpm test:scripts`; config at `vitest.scripts.config.ts`
- E2E tests: Playwright specs in `e2e/` (`pnpm e2e`). Authenticated specs seed a NextAuth DB session via `e2e/utils/db.ts` (refuses non-local `DATABASE_URL` unless `E2E_ALLOW_REMOTE_DB=1`). Bundler-sensitive fixes get e2e coverage — only the dev server reproduces Turbopack-dev bugs
- **E2E cleanup under `fullyParallel`**: `afterAll` deletes only the IDs its own `beforeAll` created — never an unscoped prefix sweep. Prefix sweeps only in `beforeAll`, and only age-gated. See `e2e/esg-dashboard.spec.ts`
- E2E route warmup list is **derived** from `PUBLIC_PAGES` + `LOCATIONS`, never retyped; authenticated routes are deliberately absent
- E2E layout assertions (`e2e/utils/layout.ts`): document overflow, internal scroll and ellipsis are three different properties — assert all that apply, measure the widest descendant against the container, use fixture strings with no line-break opportunities (underscores, not spaces/hyphens). The 768-1023px band is the load-bearing viewport
- NextAuth callback chain: `mintMagicLinkUrl()` (e2e, insert via Prisma not raw SQL) and `src/server/auth-account-linking.integration.test.ts` (oauth branch) are not interchangeable; never drive `/api/auth/signin/email` from a test (it sends real mail)

Full rationale for every bullet above: `docs/conventions/testing.md`.

## Commit & Pull Request Guidelines

Until a convention is established, use concise, imperative commit messages,
e.g., “Add API client” or “Fix build script”. Pull requests should include:

- Clear description of changes and rationale
- Linked issue or ticket (if applicable)
- Screenshots for UI changes
- Testing notes (commands run and results)

**Releases** (full rules: `docs/conventions/releases.md` — read it when bumping `VERSION`):

- Bumping `VERSION` means deciding `RELEASE_SEVERITY` (`src/server/domain/release.ts`) in the same commit; `scripts/release-severity-gate.test.ts` enforces the stamp. `silent` is the usual answer (`feat:` → propose `notice`). `/ship` tests before bumping, so a missed stamp fails only in CI — fix the stamp, don't loosen the guard.
- A `notice` release needs an entry in `src/server/domain/release-notes.ts`: one plain sentence, ≤120 chars, ending in a full stop, newest at the top, never a pasted CHANGELOG line. These notes are **world-readable** via `/api/version` — never describe a security fix by naming what was vulnerable.
- `RELEASE_NOTES` is server-only as a value (`import type` is fine).

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
- Raw SQL: never compose `Prisma.sql` fragments (via `Prisma.join`, conditional `Prisma.sql`/`Prisma.empty`) and interpolate them into `$queryRaw` templates. Turbopack dev duplicates the generated client's `Sql` class across module graphs, `instanceof` fails, and the fragment is sent to Postgres as one literal parameter ("invalid input syntax" 500s that only reproduce under `next dev`). Write one static template with NULL-checked optional filters instead — prefer the sargable form `col >= COALESCE(${x}::timestamp, '-infinity'::timestamp)` for range filters (index-friendly under generic plans), or `(${x}::type IS NULL OR col = ${x}::type)` for types without ±infinity (booleans etc.).
- No Prisma calls in tRPC routers. Routers call services. Services call repositories. Period.
- All DB writes go through services (so audit logging is automatic).
- Every table gets createdAt, updatedAt, and if relevant deletedAt. Soft delete now saves you.
- Zod schemas live next to domain models and get imported on both sides. No duplicating.
- screening domain lives in `src/server/domain/volunteer-screening.ts`
- Default screener questions: `DEFAULT_SCREENER_QUESTIONS` in `volunteer-screening.ts`, seeded on org creation via `seedDefaultQuestions()` in `screenerQuestionsRepo.ts`
- RBAC permissions: `src/server/domain/permissions.ts` (constants, `hasPermission()`, role maps)
- **The ADMIN tier is OWNER-granted only, via TWO doors** (invite + role change), both through `assertMayGrantRole()` in `memberService.ts`. Acting role is resolved from the DB, never a parameter. Any new role-assigning path must use it. `removeOrgMember` not re-checking the caller is an open P2, not precedent
- Platform admin: `src/server/domain/platform-admin.ts` (`isPlatformAdmin()` with DB + env-var fallback)
- Advisory permission middleware: `src/server/trpc/advisory-permission-middleware.ts` (global, never blocks, logs mismatches)
- Company-scoped access: `requireCompanyAccess()` (`companyAccessService.ts`) + the `companyScopedProcedure(opts?)` factory (`trpc/init.ts`). Always read `companyId` from tRPC input, never session state. Use it for every new company-scoped procedure
- **Org↔volunteer access: `requireOrgVolunteerRelationship(orgId, userId, opts?)`** (`orgVolunteerAccessService.ts`). Any staff procedure acting on an input-supplied `userId` must call it first. Throws `NOT_FOUND`, not `FORBIDDEN`. Accepted/excluded relationship kinds and the `acceptExistingCredential` exception are in `docs/conventions/access-control.md`
- **Impersonation: `resolveEffectiveUserId(realUserId, cookieValue)`** (`src/server/lib/impersonation-context.ts`) fails closed (`resolutionFailed: true`); mutation and read-then-write paths must refuse on it. Any Route Handler or Server Component scoping by `getServerSession()`'s `user.id` must resolve through this helper
- Multi-company impersonation picker and company-only onboarding redirect: see `docs/conventions/access-control.md`
- Qualification-match filter on `OpportunitiesListing.tsx`/`BrowseOpportunities.tsx` hides `NONE` matches (missing match = unqualified); known gaps in `docs/TODOS.md`, detail in `docs/conventions/ui-patterns.md`
- Background check adapters: `src/server/lib/adapters/background-check/` (Checkr + Sterling), registry at `registry.ts`
- Sterling webhook: `src/app/api/sterling/webhook/route.ts`
- Prisma client is generated into `src/prisma/generated/client`
- Scripts Prisma client: `scripts/prisma-client.ts` — shared helper that wires the `PrismaPg` adapter (required by Prisma 7.x); all maintenance scripts under `scripts/` import from here instead of calling `new PrismaClient()` directly
- **Prisma CLI datasource: `resolveCliDatabaseUrl()`** (`scripts/cli-database-url.ts`). Prisma 7 config has no `directUrl` — don't re-add it or cast `defineConfig`'s input. Never set `PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK`. Detail: `docs/conventions/ci-and-deploy.md`
- public apply flow lives under `src/app/apply/[orgSlug]`
- Org profile editing (name + apply slug): domain at `src/server/domain/org-profile.ts` (`RESERVED_ORG_SLUGS`, `orgSlugSchema`, `normalizeSlugInput()`), service `updateOrgProfile()` in `orgService.ts` (slug safety rails: reserved list, slug-history anti-squat checks, 3 renames per 24h rate limit, transactional), tRPC `org.updateOrgProfile` (adminProcedure), form at `src/components/app/org-profile-form.tsx`
- `OrgSlugHistory` model: past org slugs recorded on rename. `/apply/{oldSlug}`, `/opportunities/{oldSlug}`, and `/stories/{oldSlug}` 307-redirect to the current slug via `findCurrentSlugByHistory()` in `orgRepo.ts`; OG images and the referral page resolve old slugs in place (no redirect). History rows also block slug re-registration (anti-squat)
- Settings hub: `src/app/(app)/app/settings/page.tsx` (org profile form + access/setup links). Background checks page lives at `/app/settings/background-checks` (moved from `/app/credentials`; permanent redirect in `next.config.ts`)
- ESG dashboard route: `/app/company/[companyId]/esg` (renamed from `/team`; permanent redirect in `next.config.ts`)
- Sidebar nav: `getActiveHref()` in `src/components/app/app-sidebar.tsx` — segment-boundary, longest-match wins, so exactly one nav item highlights
- Volunteer applications may be linked to users via `submittedByUserId` (see `screener.myApplications`).
- **Application claiming**: an orphan application is **never** bound implicitly. Binding goes only through `claimApplicationForUser()`, (via `claimApplication()` in `my-applications.ts`), which enforces the email match **inside the Prisma `where`** — any new path must use it or repeat that `where` (detail: `docs/conventions/access-control.md`)
- **Never use Prisma's `mode: 'insensitive'` on an authorization predicate** — it compiles to an unescaped `ILIKE` (`_`/`%` are wildcards). Compare with plain equality against `normalizeEmail()`
- **`ctx.session.user.email` is NOT the effective user's address** under impersonation. Resolve from the id with `findEmailByUserId()`; don't add email parameters to identity-bound functions
- Claimable-application decline (`declineApplicationForUser()`) is terminal, enforced in both the listing and the claim `where`
- Unique-violation narrowing: `isUniqueViolationOn(err, constraint)` (`src/server/lib/prisma-errors.ts`) — Prisma 7 + PrismaPg doesn't populate `meta.target`. Fixture: `src/test/prisma-error-fixtures.ts`
- **Stripe plan tier is per customer, not per event**: every plan write and checkout runs under `lockStripeCustomerTx()` (`webhookRepo.ts`); paying orgs switch plans in the billing portal, never a second checkout. Detail: `docs/ARCHITECTURE.md` "Stripe (Billing)"
- Audit actor helpers: `effectiveUserId(ctx)` / `impersonatedBy(ctx)` (`src/server/trpc/audit-actor.ts`) — never stamp `ctx.realUserId` without comparing it to the effective user

**Roster** (full rules: `docs/conventions/roster.md` — read before touching any roster, shift-assignment or leave path):

- `ensureAppliedRosterRow()` inserts via `createOrgVolunteerIfAbsent()` (`ON CONFLICT DO NOTHING`) — never catch P2002 inside a `$transaction` (it poisons the transaction). The approval callsite gates on the status **transition**
- `assignVolunteerToShift()` takes an `OrgVolunteer.id`, never a `User.id`; reassignment revives CANCELLED/WAITLISTED rows; `allowOverCapacity` is an option on `validateSignup`; the candidate list is computed server-side
- Roster flag: `rosterProcedure` (`roster-flag-middleware.ts`) and `resolveVolunteerRosterFlag()`; no client flag-read path. `profile.listMyOrgMemberships`/`profile.leaveOrgRoster` are **deliberately ungated**. When retiring the flag, grep `isRosterEnabledForOrg` (its docstring lists every caller). The concierge importer checks no flag (P3)
- Leaving writes an `OrgVolunteerBlock`; the block suppresses every relationship kind except `ORG_MEMBER` and `EXISTING_CREDENTIAL`. Lifting is volunteer-initiated only (`liftOrgVolunteerBlock()`; never from an anonymous `screener.submit`, and before `ensureAppliedRosterRow` in claim). Every path that **creates or acts on** a roster row must refuse while a block stands — bulk paths go through `addVolunteer()` rather than repeating the guard
- Leaving is keyed on `orgId` (`listMyOrgRelationships()` covers roster, application and signup edges); `hasLeavableOrgRelationship()` is a required precondition. `userId` stays in every `WHERE`
- Concierge import/export/metrics, `findOrgByIdOrSlug` (id first, two `findUnique`s), `requireOrgAccess()` (every `/api/org/[orgId]/**` Route Handler must use it), and CLI flags rejecting values: see the roster doc
- CSV: one parser/writer in `src/server/domain/csv.ts` (RFC 4180, formula-injection guard incl. `\r` and leading whitespace). Never `split(',')`
- Onboarding checklist (`onboarding-checklist.tsx`) derives its denominator per org and omits the roster step when the flag is off; it's a second implementation of `computeOnboardingStatus()` (P3)

**Product copy and disclosure** (full rules: `docs/conventions/copy-and-disclosure.md`):

- `PLAN_FEATURES` in `server/domain/billing.ts` is the single source for all pricing surfaces. A field in `PlanLimits` means a service refuses on it. `planTierProcedure` reads `Organization.planTier`; `companyScopedProcedure({ minPlanTier })` reads `CompanyAccount.planTier` — two ladders. Guarded by `plan-features.guard.test.ts`
- Legal/consent surfaces derive from the code's definition (a `Record` over the enum, or a test iterating it) — never a hand-maintained copy

**CI** (full rules: `docs/conventions/ci-and-deploy.md` — read before editing `.github/workflows/*`, `biome.json`, `next.config.ts`, `.nvmrc`/`engines`, or any `scripts/*-gate.test.ts`):

- `ci.yml` runs lint, both typechecks, docs build, unit/scripts/integration tests against Postgres, a `build` job (production seed + `next build`), an `e2e` job, and `Security advisories`. Always `prisma migrate deploy`, never `db push`
- The config guards (`ci-build-gate`, `e2e-ci-gate`, `lint-gate`, `node-version-gate`, `advisories-gate`, `docs-nav-links`) pin properties CI's exit code can't see. Don't delete them as redundant; strip comments before matching in any new guard
- `pnpm lint` is `biome check . --error-on-warnings`; `files.includes` must cover `scripts/**`. Never `--write --unsafe`. The pre-commit hook refuses rather than re-staging
- `experimental.useTypeScriptCli: true` stays while on TypeScript 7; `tsconfig.json` must include both `.next/types` and `.next/dev/types`; `next-env.d.ts` flipping between them is expected
- The `build` job seed step needs `NODE_ENV: production` on the **step**, never the job; e2e uses `pnpm seed:dev`
- Integration setup refuses a non-local `DATABASE_URL` (`INTEGRATION_ALLOW_REMOTE_DB=1` to override)
- Docs site: one `DESIGN.md` (root) and one `TODOS.md` (`docs/`). `pnpm docs:build` does not validate nav/sidebar links — `scripts/docs-nav-links.test.ts` does

**Feature locations:**

- User-facing application status routes live at `src/app/(app)/app/my-applications` and `src/app/(app)/app/my-applications/[id]`.
- Email-based status lookup lives under `src/app/apply/status`.
- QR check-in: token lib at `src/server/lib/checkin-token.ts`, scanner at `src/app/(app)/app/scan/`, QR display at `src/components/app/qr-checkin-code.tsx`
- Geo check-in: `src/components/app/geo-checkin.tsx` + `src/server/lib/geo.ts`
- Geo landing pages: data at `src/lib/locations.ts`, pages at `src/app/(public)/locations/`, components `location-hero.tsx`, `comparison-table.tsx`, `local-proof-section.tsx`, `lead-capture-form.tsx`. `LocationHero`'s screenshot is an LCP image: source it from `MARKETING_SCREENSHOTS`/`CAPTURE_FRAME`, never wrap it in `FadeInOnScroll`, keep an explicit `sizes`
- Lead capture: domain at `src/server/domain/lead-capture.ts`, service at `src/server/services/leadCaptureService.ts`, repo at `src/server/repositories/leadCaptureRepo.ts`, tRPC router at `src/server/trpc/routers/leads.ts`
- Lead capture admin: `src/app/(app)/app/admin/leads/page.tsx` (platform admin lead triage with location filtering)
- Analytics events: `src/lib/analytics.ts` (consent-aware `trackEvent()` utility, checks `cookie-consent` localStorage)
- SEO: public page registry at `src/lib/public-pages.ts` — single source of truth for nav links, footer sections, sitemap entries, and OG image config. All consumers (header, footer, sitemap, OG route) import from here.
- SEO: dynamic sitemap at `src/app/sitemap.ts`, robots at `src/app/robots.ts` (served at `/sitemap.xml` and `/robots.txt`)
- SEO: OG image API at `src/app/api/og/[type]/[slug]/route.tsx` (branded Open Graph images for pages + org routes)
- SEO: JSON-LD components at `src/components/json-ld-breadcrumb.tsx` and `src/components/json-ld-faq.tsx`
- SEO: `BASE_URL` constant at `src/lib/constants.ts` — canonical production URL used by sitemap, robots, JSON-LD, OG images
- Marketing: `FOUNDER_BOOKING_URL` constant at `src/lib/constants.ts` — Google Calendar booking link used by all marketing CTAs
- Marketing shared components: `faq-section.tsx`, `platform-stats-bar.tsx`, `screenshot-section.tsx`, `editorial-list.tsx` (replacement for card grids — see `docs/designs/banned-grid-patterns.md`), `eyebrow.tsx`, `link-row-list.tsx` (all in `src/components/`)
- Marketing screenshots: manifest at `src/lib/marketing-screenshots.ts` (never hardcode `/marketing/*.png`; `darkSrc` toggled via Tailwind `dark:` classes, never `useTheme()`); `AnnotatedScreenshot`; capture pipeline `e2e/capture.spec.ts` + `e2e/capture-scenarios.ts`. A scenario's `waitForText` is its **framing anchor** — changing it invalidates every annotation coordinate on that key
- Analytics: `src/components/consented-analytics.tsx` (Google Analytics gtag.js + Vercel Analytics, consent-gated via cookie banner, `ga-disable-*` flag on revoke)
- In-app feedback: domain at `src/server/domain/user-feedback.ts`, service at `src/server/services/feedbackService.ts`, repo at `src/server/repositories/feedbackRepo.ts`, tRPC router at `src/server/trpc/routers/feedback.ts`
- Feedback widget: `src/components/app/feedback-widget.tsx` (floating pill + Dialog/Drawer, mood selector, mounted in app layout)
- Feedback UI config: `src/lib/feedback-config.ts` (mood icons, labels, confirmation messages — UI layer, not domain)
- Feedback admin triage: `src/app/(app)/app/admin/feedback/page.tsx` (list/detail split, status change, reply)
- Feedback admin notice: `src/components/app/feedback-admin-notice.tsx` (dashboard "N new" banner for platform admins)
- My Feedback page: `src/app/(app)/app/my-feedback/page.tsx` (user-facing feedback history with volunteer-friendly status labels)
- Cookie banner sets `--cookie-banner-height` CSS variable on `:root` for feedback pill positioning
- PWA: `public/manifest.webmanifest`, `public/sw.js`, `src/components/sw-register.tsx`, `src/components/ios-install-prompt.tsx`
- **The service worker caches build output only, via an ALLOWLIST** (`STATIC_PREFIXES` in `public/sw.js`). Cache name varies per build via `?v=` from `sw-register.tsx`; no `skipWaiting()`; `clients.claim()` stays; never re-add a network-first HTML branch. Asserted by `e2e/service-worker.spec.ts`. Read `docs/conventions/ui-patterns.md` before touching it
- **Sentry URL scrubbing is a denylist** (`SECRET_PATHS`/`SECRET_QUERY_KEYS` in `src/lib/sentry-url-scrub.ts`): a new route with a secret in its path or query must be added there, with a case in `sentry-url-scrub.test.ts`
- **Credential expiry notices**: `src/server/domain/credential-expiry.ts`, `credential-expiry-notice-service.ts`, `credential-expiry-repo.ts`, run from the `expire-credentials` cron. Idempotency is per expiry cycle; stamp only when nobody failed; `allSettled`, never `Promise.all`; cap by org. Read `docs/conventions/background-checks-and-credentials.md` first
- Org health score: domain at `src/server/domain/org-health.ts`, widget at `src/components/app/org-health-widget.tsx`
- Activity feed: `src/components/app/activity-feed.tsx` (uses `screener.getActivityFeed` tRPC query)
- Query error state: `QueryErrorCard` / `safeErrorMessage()` in `src/components/app/query-error-card.tsx`. **Never render a tRPC `error.message` raw.** Branch order loading → error → empty; a missing error branch falls through to a false empty state
- **Error disclosure is enforced on the SERVER** (`src/server/domain/error-disclosure.ts` + `errorFormatter` in `server/trpc/init.ts` + `error-reporting.ts`). A message a user must read needs an allowlisted `TRPCError` code, not `throw new Error(...)` — assert the **code** in tests. Never put both `message:` and `cause:` on a `TRPCError`. Use `safeCaughtErrorMessage()` in `mutateAsync` catch blocks. `error-disclosure.guard.test.ts` enforces this for `src/app` + `src/components` (Route Handlers are audited by hand). Read `docs/conventions/errors-and-email.md` first
- **Background checks are disclosed to their subject** by email — recipient from `findEmailByUserId`, never `pii.email`; sent via `waitUntil` with `.catch` inside; `sendEmail` returns `false` rather than throwing, so read the boolean. FCRA attestation is refused in the service, not Zod. Not `suppressUnclaimed`; `consentAttestedBy` has no FK and is never backfilled
- **Guard 1.5**: the submitted PII email must equal the account email (after `requireOrgVolunteerRelationship`); the account address is what reaches the provider; a name mismatch only warns. It's a mistake detector, not identity verification — don't describe it as such. Full rules: `docs/conventions/background-checks-and-credentials.md`
- Dashboard: `src/app/(app)/app/page.tsx` — role-conditional: volunteers see `VolunteerDashboard` (upcoming shifts, pending apps, expiring creds, impact stats, recommendations); staff see greeting banner + OrgHealthWidget + OnboardingChecklist + ReferralPrompt + stat cards + ActivityFeed (Getting Started Checklist removed in v0.14.0)
- Volunteer dashboard: service at `src/server/services/volunteerDashboardService.ts`, component at `src/components/app/volunteer-dashboard.tsx`, tRPC router at `src/server/trpc/routers/volunteer.ts` (`volunteer.getDashboard`)
- Onboarding funnel analytics (platform admin): service at `src/server/services/onboardingAnalyticsService.ts`, page at `src/app/(app)/app/admin/onboarding/page.tsx`, tRPC procedure at `admin.onboardingFunnel`
- Screening landing page: `src/app/(public)/screening/page.tsx` with `SwitchCostCalculator` at `src/components/switch-cost-calculator.tsx`
- Referral prompt: `src/components/app/referral-prompt.tsx` (shows after first background check, localStorage dismissal)
- Referral landing page: `src/app/apply/refer/page.tsx` — `/apply/refer?from=[orgSlug]` with referrer badge
- Org feedback survey: `src/app/(public)/screening/feedback/` (public form, day-7 and day-30 questions). Questions, limits and cookie name in `src/server/domain/org-feedback.ts`; link check + save in `findSurveyOrg`/`submitOrgFeedback` (`org-feedback-service.ts`). The emailed link goes to `/screening/feedback/start`, which moves its HMAC token (`src/server/lib/org-feedback-token.ts`, org + type) into an httpOnly cookie and redirects to the token-free URL
- Org feedback cron: `src/app/api/cron/org-feedback/route.ts` (daily 10:00 UTC), service at `src/server/services/org-feedback-service.ts`
- Impact report: `src/app/(app)/app/impact-report/page.tsx` (baseline vs platform usage metrics)
- Onboarding baseline: `src/app/(app)/app/settings/onboarding/page.tsx` (volunteer count, hours/week, current process)
- Reference data boot guard: domain at `src/server/domain/reference-data.ts` (`SKILL_CATALOG`, `CATALOG_VERSION`, `PLATFORM_ORG_SLUG`), service at `src/server/services/referenceDataService.ts` (`ensureReferenceData()` with promise dedup and `_seeded` module flag), repo at `src/server/repositories/referenceDataRepo.ts`. Call `ensureReferenceData()` in any service that depends on the skill catalog or platform org. Boot guard also runs at Next.js startup via `src/instrumentation.ts`.
- Content Flywheel: domain at `src/server/domain/case-study.ts`, service at `src/server/services/caseStudyService.ts`, token lib at `src/server/lib/case-study-token.ts`, tRPC router at `src/server/trpc/routers/case-study.ts`
- Case study admin: `src/app/(app)/app/admin/case-studies/page.tsx` (consent toggle, approval email, PDF download, markdown copy)
- Public stories: `src/app/(public)/stories/[orgSlug]/page.tsx`, consent pages at `stories/consent-confirmed` and `stories/consent-expired`
- Case study API: consent flow at `src/app/api/case-study/consent/route.ts` (GET confirmation + POST mutation), PDF at `src/app/api/case-study/pdf/route.ts`
- Testimonials: `src/components/testimonial-section.tsx` + `src/components/testimonial-block.tsx` (screening landing page)
- Duplicate application prevention: partial unique index on `(submittedByUserId, opportunityId)` WHERE `submittedByUserId IS NOT NULL` AND status NOT IN (REJECTED, WITHDRAWN) — withdrawn is excluded alongside rejected so a volunteer who withdraws can re-apply. P2002 race-condition handler in `volunteer-screening.ts`. Applied-status badges on opportunity listings. Apply form interception for already-applied users.
- Status notification emails: branded emails sent on application status change (REVIEW/APPROVED/REJECTED) via `sendApplicationStatusEmail()` in `volunteer-screening.ts`
- Public route auth providers: `src/app/opportunities/providers.tsx` wraps `SessionProvider` + `TRPCProvider` for public route groups that need auth-aware UI (e.g., applied-status badges)
- Volunteer marketplace: public pages at `src/app/(public)/opportunities/` (browse) and `src/app/(public)/organizations/` (org discovery); tRPC router at `src/server/trpc/routers/marketplace.ts`; repository at `src/server/repositories/publicOpportunityRepo.ts`
- Marketplace settings: org staff enable marketplace listing from `/app/settings/team` (description, location, cause-area tags)
- Org activation banner: `src/app/(app)/app/page.tsx` — dismissible nudge for staff whose org hasn't enabled the marketplace
- `ApplicationSource` enum on `VolunteerApplication`: `DIRECT`, `MARKETPLACE`, `REFERRAL`, `WIDGET` — tracks where each application originated
- `OpportunityInterest` model: logged-in volunteers heart-toggle interest in marketplace opportunities; unique per (userId, opportunityId), cascades on delete
- `UserMarketplacePreference` model: per-user marketplace UI preferences (stored for future use)
- Marketplace fields on `Organization`: `marketplaceVisible` (default false), `description`, `location`, `causeAreaTags`, `verified`
- `VolunteerOpportunity.searchVector`: trigger-maintained tsvector column (title + description + tags) with GIN index for full-text search across the marketplace. Trigger `trg_opportunity_search_vector` fires on VolunteerOpportunity INSERT/UPDATE and OpportunityTag INSERT/UPDATE/DELETE. GIN index created CONCURRENTLY in a separate migration for zero-downtime deploys.
- Org marketplace settings: extracted into `src/server/services/orgMarketplaceService.ts` (`updateMarketplaceSettings`); org tRPC router delegates to this service.
- Suspended org guard: all marketplace queries (`listAllPublishedOpportunities`, `listForMap`, `browseMarketplace`, `searchWithTsvector`, `getThisWeekendOpportunities`, `getMyInterests`, `toggleInterest`) filter `organization: { suspendedAt: null }` to prevent surfacing opportunities from suspended orgs.
- Opportunity digest emails: service at `src/server/services/opportunityDigestService.ts` (weekly, up to 5 fresh opps per user based on hearted interests), cron at `src/app/api/cron/opportunity-digest/route.ts` (runs Mondays)
- Digest unsubscribe: token lib at `src/server/lib/digest-unsubscribe-token.ts` (HMAC-SHA256, timing-safe), endpoint at `src/app/api/unsubscribe/digest/route.ts` — GET renders a branded confirmation page (RFC 8058: prevents link-prefetcher unsubscribes), POST performs the actual `DigestFrequency.OFF` mutation.
- Marketplace interest → digest enrollment: `toggleInterest` in `marketplaceService.ts` auto-upserts `UserMarketplacePreference` with `digestFrequency: WEEKLY` on first heart; the interest create + preference upsert are wrapped in `prisma.$transaction` so they succeed or roll back atomically. P2002 (concurrent duplicate) is caught inside the transaction, not outside.
- Admin alerts: `src/server/lib/admin-alerts.ts` — every send goes through `sendToRecipients()`, which reads `sendEmail`'s boolean. **When one `sendEmail` caller is fixed, grep every other caller**
- Admin recipient resolver: `src/server/lib/admin-recipients.ts` — `getAdminEmails()` resolves recipients from `PLATFORM_ADMIN_ALERT_EMAIL` env var (override, checked first) or DB `isPlatformAdmin` flag + `PLATFORM_ADMIN_IDS` fallback. Results cached 5 minutes. Used by all admin alerts (signup, security/impersonation, feedback, unknown Stripe price).
- `PLATFORM_ADMIN_ALERT_EMAIL`: single env var override for all admin notification emails (signup alerts, security alerts, feedback notifications). Supersedes per-feature env vars. Set in Vercel to a shared ops alias for production; `FEEDBACK_NOTIFY_EMAIL` still works but is deprecated.

**Staff tables and dialogs** (full rules: `docs/conventions/ui-patterns.md` — read before building a staff list, a list-opened dialog or a Dialog/Drawer modal):

- `/app/volunteers` is the reference. Table↔card switch is pure CSS (`hidden lg:block` / `lg:hidden`), never `useMediaQuery` for layout
- Modals switching Dialog/Drawer use `useFrozenDesktopShell(open, query?)` — never call `useMediaQuery` directly in a new modal. `admin/feedback/page.tsx` still violates the layout rule
- Use `CardList` (`src/components/app/card-list.tsx`) for divided card lists; put visibility classes on a wrapper `div`, never the `Card`. `ShiftsClient` deliberately uses neither (it already sits inside a `Card`)
- Per-row pending state via `usePendingIds()` (`src/lib/hooks/use-pending-ids.ts`) — never bare `isPending` or `mutation.variables`. `/app/applications` deliberately has none (no row mutations)
- Only make the whole row the tap target when the detail view has all the row's actions
- `AddVolunteerDialog` is a single page-owned instance that stays open across adds; `VolunteerDetailDialog` is page-owned with no `DialogTrigger`, restores focus in `onCloseAutoFocus`, fetches its own data and owns no mutation. Its shift history is org-scoped via `attendedShiftWhere()` — `getAttendedShiftsForUser` is cross-org and must never back a staff surface
- Staff surfaces use staff-voiced copy (`ORG_VOLUNTEER_SOURCE_COPY_STAFF`); share enums, never pronoun-bearing prose

## Design System

Always read `DESIGN.md` before making any visual or UI decisions.
All font choices, colors, spacing, and aesthetic direction are defined there.
Do not deviate without explicit user approval.
In QA mode, flag any code that doesn't match DESIGN.md.

## Docs Index

### Architecture & Design (read these first)

- `docs/conventions/` — **full rationale behind the short rules in this file**, moved out to keep it under Claude Code's size limit: `commands.md`, `testing.md`, `releases.md`, `access-control.md`, `roster.md`, `copy-and-disclosure.md`, `ci-and-deploy.md`, `errors-and-email.md`, `background-checks-and-credentials.md`, `ui-patterns.md`. When a rule here says "see", read the entry before changing that code. When adding a new lesson, put the one-line rule here and the story there
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
- `docs/designs/dedupe-volunteer-apply.md` — Duplicate application prevention design doc (partial unique index, applied badges, status emails)
- `docs/designs/banned-grid-patterns.md` — Banned grid patterns design doc (homepage `pillars`/`differentiators` → `EditorialList`, `/for` audience index → `/locations`-style link rows)
- `docs/designs/staff-created-volunteers.md` — Staff-created volunteer roster design doc (`OrgVolunteer` join table, shadow users + `AccountState`, email canonicalization, and the `requireOrgVolunteerRelationship()` org↔volunteer guard in section 5 / T7)
- `docs/designs/geo-landing-pages.md` — Geo landing pages design doc (`src/lib/locations.ts` schema, `LocationHero`, lead capture, per-location OG). Its motion spec item 1 is struck through: the hero screenshot must NOT be wrapped in `FadeInOnScroll`
- `docs/designs/privacy-terms-compliance.md` — Privacy/terms page design doc (required sections, third-party table, cookie banner). The live version history is the `versionHistory` array in `src/app/(public)/privacy/page.tsx`, not this doc
- `docs/TODOS.md` - todos for the current project
- `docs/post-deploy-checks.md` — claims that cannot be tested before they ship, and how to check each after a deploy. Add an entry when behaviour depends on production data volume, a third-party send, or Vercel routing/caching
- `docs/dependency-overrides.md` — why each `pnpm.overrides` pin exists and when it can be removed
- `docs/branch-protection.md` — required status checks on `main` (the exact workflow `name:` strings, matched against `ci.yml`), why `enforce_admins: true` is load-bearing in a solo-maintainer repo, and the `Security advisories` gate's known fail-open limitations (v0.43.0.0)

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

- Prisma 7.10.0: <https://www.prisma.io/llms.txt>
- Next.js 16.3.8: <https://nextjs.org/docs/llms-full.txt> (version-matched copies also ship at `node_modules/next/dist/docs/`, which is what `AGENTS.md`'s generated block points agents at)
- React 19.3.0: <https://react.dev/reference/react>
- Shadcn UI: <https://ui.shadcn.com/llms.txt>

## Skill routing

When the user's request matches an available skill, ALWAYS invoke it using the Skill
tool as your FIRST action. Do NOT answer directly, do NOT use other tools first.
The skill has specialized workflows that produce better results than ad-hoc answers.

Key routing rules:
- Product ideas, "is this worth building", brainstorming → invoke office-hours
- Bugs, errors, "why is this broken", 500 errors → invoke investigate
- Ship, deploy, push, create PR → invoke ship
- QA, test the site, find bugs → invoke qa
- Code review, check my diff → invoke review
- Update docs after shipping → invoke document-release
- Weekly retro → invoke retro
- Design system, brand → invoke design-consultation
- Visual audit, design polish → invoke design-review
- Architecture review → invoke plan-eng-review

## Solopreneur OS for Claude
This folder runs Solopreneur OS for Claude. Before doing any work for the user,
read `solopreneur-profile.md` in this folder and apply its audience, offers,
content pillars, and voice rules to everything you write. If the file does not
exist, run the solopreneur-onboard skill first.
