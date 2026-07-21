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
- `pnpm test:scripts`: run unit tests for files under `scripts/` (uses `vitest.scripts.config.ts`, excluded from the main Vitest suite)
- `pnpm e2e`: run Playwright e2e specs in `e2e/` (boots `pnpm dev` via `playwright.config.ts`; set `PLAYWRIGHT_BASE_URL` to target a running server instead — authenticated specs skip non-localhost targets)
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
- Integration tests excluded from `pnpm test`: `src/**/*.integration.test.ts`
- Scripts tests (separate suite): `scripts/**/*.test.ts` — run with `pnpm test:scripts`; config at `vitest.scripts.config.ts`
- E2E tests: Playwright specs in `e2e/` (`pnpm e2e`). Authenticated specs seed a NextAuth database session via `e2e/utils/db.ts` (refuses non-local `DATABASE_URL` unless `E2E_ALLOW_REMOTE_DB=1`); the dev server is the only environment that reproduces Turbopack-dev-only bugs, so bundler-sensitive fixes get e2e coverage.
- E2E cleanup + `fullyParallel`: `playwright.config.ts` sets `fullyParallel: true` (`workers: 1` in CI only), so a spec file's `beforeAll`/`afterAll` run per-worker in separate processes. A spec's `afterAll` must delete only the row IDs its own `beforeAll` created — never an unscoped sweep matching a shared literal prefix (e.g. `startsWith: PREFIX`), which can delete a sibling worker's still-in-use rows mid-test. Prefix sweeps are safe only in `beforeAll`, and only when age-gated (e.g. `createdAt < now - 30min`) so they can't catch a live sibling's fresh rows. See `e2e/esg-dashboard.spec.ts` (`cleanupIds()` vs `cleanupByPrefix()`) and the resolved P0 in `docs/TODOS.md` for the incident this pattern fixes.

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
- Company-scoped access: `requireCompanyAccess()` in `src/server/services/companyAccessService.ts` + the `companyScopedProcedure(opts?)` factory in `src/server/trpc/init.ts` (replaced the session-scoped `companyProcedure`/`companyAdminProcedure`/`companyPlanTierProcedure`, v0.29.2.0). Always reads `companyId` from tRPC input, never from session state — the session's "active" company can differ from the company named in the URL for a multi-company user, and authorizing off the session serves/mutates the wrong tenant. Use this factory for any new company-scoped procedure instead of reading `ctx.companyId`.
- Impersonation resolution: `resolveEffectiveUserId(realUserId, cookieValue)` in `src/server/lib/impersonation-context.ts` (v0.29.3.0) — pure function, no `getServerSession()`/`cookies()` inside it, so it resolves identically from tRPC's `createTRPCContext`, raw Route Handlers, and Server Component layout/page guards. Fails **closed**: returns `effectiveUserId: null` + `resolutionFailed: true` if a cookie was present but resolution threw — mutation paths and read-then-write SSR pages must check `resolutionFailed` and refuse rather than fall back to the real admin's identity (read-only nav/banner rendering via `getImpersonationContext()` may ignore it). Any new raw Route Handler or Server Component that reads `getServerSession()`'s `user.id` directly to scope a query/mutation must resolve through this helper instead, or it silently ignores impersonation like the bug this fixed.
- Multi-company impersonation picker (v0.30.0.0): an impersonated target with no session token can't persist a "current company" choice, so `company/page.tsx` and `app/(app)/app/layout.tsx` call `listCompaniesForUser()` (`src/server/repositories/companyRepo.ts`) and, for 2+ memberships, `company/page.tsx` renders an explicit `LinkRowList` picker instead of guessing the oldest membership — closes the P2 gap noted in `docs/TODOS.md`. `layout.tsx` leaves `companyId` null in the ambiguous case, so `app-sidebar.tsx`'s `getCompanyNav()` falls back to a single "Company" link pointing at the bare `/app/company` picker route rather than guessing a company itself. Company-scoped mutations taken while impersonating (`company.switchCompany`, `linkNonprofit`, `unlinkNonprofit`, `invite` in `src/server/trpc/routers/company.ts` / `companyService.ts`) now stamp `impersonatedBy: ctx.realUserId` onto the audit log metadata so the real admin, not just the impersonated user, is attributable. The equivalent Checkr OAuth org-selection heuristic (`src/app/api/checkr/oauth/callback/route.ts`) is unfixed — tracked as a separate P2 TODO.
- Background check adapters: `src/server/lib/adapters/background-check/` (Checkr + Sterling), registry at `registry.ts`
- Sterling webhook: `src/app/api/sterling/webhook/route.ts`
- Prisma client is generated into `src/prisma/generated/client`
- Scripts Prisma client: `scripts/prisma-client.ts` — shared helper that wires the `PrismaPg` adapter (required by Prisma 7.x); all maintenance scripts under `scripts/` import from here instead of calling `new PrismaClient()` directly
- public apply flow lives under `src/app/apply/[orgSlug]`
- Org profile editing (name + apply slug): domain at `src/server/domain/org-profile.ts` (`RESERVED_ORG_SLUGS`, `orgSlugSchema`, `normalizeSlugInput()`), service `updateOrgProfile()` in `orgService.ts` (slug safety rails: reserved list, slug-history anti-squat checks, 3 renames per 24h rate limit, transactional), tRPC `org.updateOrgProfile` (adminProcedure), form at `src/components/app/org-profile-form.tsx`
- `OrgSlugHistory` model: past org slugs recorded on rename. `/apply/{oldSlug}`, `/opportunities/{oldSlug}`, and `/stories/{oldSlug}` 307-redirect to the current slug via `findCurrentSlugByHistory()` in `orgRepo.ts`; OG images and the referral page resolve old slugs in place (no redirect). History rows also block slug re-registration (anti-squat)
- Settings hub: `src/app/(app)/app/settings/page.tsx` (org profile form + access/setup links). Background checks page lives at `/app/settings/background-checks` (moved from `/app/credentials`; permanent redirect in `next.config.ts`)
- ESG dashboard route: `/app/company/[companyId]/esg` (renamed from `/team`; permanent redirect in `next.config.ts`)
- Sidebar nav: `getActiveHref()` in `src/components/app/app-sidebar.tsx` — segment-boundary, longest-match wins, so exactly one nav item highlights
- Volunteer applications may be linked to users via `submittedByUserId` (see `screener.myApplications`).
- User-facing application status routes live at `src/app/(app)/app/my-applications` and `src/app/(app)/app/my-applications/[id]`.
- Email-based status lookup lives under `src/app/apply/status`.
- QR check-in: token lib at `src/server/lib/checkin-token.ts`, scanner at `src/app/(app)/app/scan/`, QR display at `src/components/app/qr-checkin-code.tsx`
- Geo check-in: `src/components/app/geo-checkin.tsx` + `src/server/lib/geo.ts`
- Geo landing pages: location data at `src/lib/locations.ts` (6 Central Valley locations), pages at `src/app/(public)/locations/`, components at `src/components/location-hero.tsx`, `comparison-table.tsx`, `local-proof-section.tsx`, `lead-capture-form.tsx`
- Lead capture: domain at `src/server/domain/lead-capture.ts`, service at `src/server/services/leadCaptureService.ts`, repo at `src/server/repositories/leadCaptureRepo.ts`, tRPC router at `src/server/trpc/routers/leads.ts`
- Lead capture admin: `src/app/(app)/app/admin/leads/page.tsx` (platform admin lead triage with location filtering)
- Analytics events: `src/lib/analytics.ts` (consent-aware `trackEvent()` utility, checks `cookie-consent` localStorage)
- SEO: public page registry at `src/lib/public-pages.ts` — single source of truth for nav links, footer sections, sitemap entries, and OG image config. All consumers (header, footer, sitemap, OG route) import from here.
- SEO: dynamic sitemap at `src/app/sitemap.ts`, robots at `src/app/robots.ts` (served at `/sitemap.xml` and `/robots.txt`)
- SEO: OG image API at `src/app/api/og/[type]/[slug]/route.tsx` (branded Open Graph images for pages + org routes)
- SEO: JSON-LD components at `src/components/json-ld-breadcrumb.tsx` and `src/components/json-ld-faq.tsx`
- SEO: `BASE_URL` constant at `src/lib/constants.ts` — canonical production URL used by sitemap, robots, JSON-LD, OG images
- Marketing: `FOUNDER_BOOKING_URL` constant at `src/lib/constants.ts` — Google Calendar booking link used by all marketing CTAs
- Marketing: shared components at `src/components/faq-section.tsx` (FAQ accordion + JSON-LD), `src/components/platform-stats-bar.tsx` (async stats bar), `src/components/screenshot-section.tsx` (product screenshot with error handling), `src/components/editorial-list.tsx` (static heading/body row list — DESIGN.md-compliant replacement for card grids; see `docs/designs/banned-grid-patterns.md`), `src/components/eyebrow.tsx` (uppercase kicker label above headings — cva-based, `as` prop for p/h2/dt, `tone` prop for primary/muted; used directly across public pages, the apply flow, and the footer, plus inherited by every page rendering `public-hero.tsx` or `location-hero.tsx`; issue #129), `src/components/link-row-list.tsx` (`LinkRowList` — clickable navigation row list: divide-y rows, alternating stripe, hover state, trailing arrow; shared by the `/for` and `/locations` index pages, extracted from duplicated inline JSX; issue #140)
- Marketing screenshots: asset manifest at `src/lib/marketing-screenshots.ts` (single source of truth — pages import entries, never hardcode `/marketing/*.png`; each `MarketingScreenshot` entry has a `src` and an optional `darkSrc` dark-mode variant); annotated imagery via `src/components/annotated-screenshot.tsx` (numbered % -positioned markers + HTML legend, composed by homepage pillar rows, `/how-it-works`, `/screening`, `/for/animal-shelters`, and by `ScreenshotSection`'s optional `annotations` prop; `darkSrc` prop renders both light and dark variants and toggles them via Tailwind `dark:hidden`/`hidden dark:block` — never a `useTheme()` hook, since `next-themes` sets the `.dark` class pre-paint — the priority-gated pre-hydration broken-image check only applies to `priority` images, not CSS-hidden dark variants); capture pipeline at `e2e/capture.spec.ts` + `e2e/capture-scenarios.ts` (typed scenarios: actor/path/clickTabs/waitForText/`variants` — a `('light'|'dark')[]` array, defaulting to light-only, that captures each declared color scheme via `page.emulateMedia({ colorScheme })` and writes to the manifest entry's `src`/`darkSrc`; fixed 1280×720 viewport; sessions minted via `e2e/utils/db.ts` local-DB guard); CI guards at `src/lib/marketing-screenshots.test.ts` (asset existence + scenario integrity) and scrolled naturalWidth e2e assertions in `e2e/public-pages.spec.ts`, including a dark-mode counterpart suite (issue #139)
- Analytics: `src/components/consented-analytics.tsx` (Google Analytics gtag.js + Vercel Analytics, consent-gated via cookie banner, `ga-disable-*` flag on revoke)
- In-app feedback: domain at `src/server/domain/user-feedback.ts`, service at `src/server/services/feedbackService.ts`, repo at `src/server/repositories/feedbackRepo.ts`, tRPC router at `src/server/trpc/routers/feedback.ts`
- Feedback widget: `src/components/app/feedback-widget.tsx` (floating pill + Dialog/Drawer, mood selector, mounted in app layout)
- Feedback UI config: `src/lib/feedback-config.ts` (mood icons, labels, confirmation messages — UI layer, not domain)
- Feedback admin triage: `src/app/(app)/app/admin/feedback/page.tsx` (list/detail split, status change, reply)
- Feedback admin notice: `src/components/app/feedback-admin-notice.tsx` (dashboard "N new" banner for platform admins)
- My Feedback page: `src/app/(app)/app/my-feedback/page.tsx` (user-facing feedback history with volunteer-friendly status labels)
- Cookie banner sets `--cookie-banner-height` CSS variable on `:root` for feedback pill positioning
- PWA: `public/manifest.webmanifest`, `public/sw.js`, `src/components/sw-register.tsx`, `src/components/ios-install-prompt.tsx`
- Org health score: domain at `src/server/domain/org-health.ts`, widget at `src/components/app/org-health-widget.tsx`
- Activity feed: `src/components/app/activity-feed.tsx` (uses `screener.getActivityFeed` tRPC query)
- Query error state: `src/components/app/query-error-card.tsx` — shared `QueryErrorCard` (alert card + retry button) and `safeErrorMessage()` (allowlists client-safe tRPC error codes, falls back to generic copy for internal errors) for tRPC queries with `isLoading`/`isError` handling; extracted from the ESG dashboard, also used by `/app/company/[companyId]`
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
- Duplicate application prevention: partial unique index on `(submittedByUserId, opportunityId)` WHERE status NOT IN (REJECTED). P2002 race-condition handler in `volunteer-screening.ts`. Applied-status badges on opportunity listings. Apply form interception for already-applied users.
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
- Admin signup notifications: `sendNewUserAlert`, `sendNewOrgAlert`, `sendNewCompanyAlert` in `src/server/lib/admin-alerts.ts` — fire-and-forget emails sent on new user signup (NextAuth `createUser` event), org creation, and company creation. All use the shared `getAdminEmails()` helper.
- Admin recipient resolver: `src/server/lib/admin-recipients.ts` — `getAdminEmails()` resolves recipients from `PLATFORM_ADMIN_ALERT_EMAIL` env var (override, checked first) or DB `isPlatformAdmin` flag + `PLATFORM_ADMIN_IDS` fallback. Results cached 5 minutes. Used by all admin alerts (signup, security/impersonation, feedback).
- `PLATFORM_ADMIN_ALERT_EMAIL`: single env var override for all admin notification emails (signup alerts, security alerts, feedback notifications). Supersedes per-feature env vars. Set in Vercel to a shared ops alias for production; `FEEDBACK_NOTIFY_EMAIL` still works but is deprecated.
- Raw SQL: never compose `Prisma.sql` fragments (via `Prisma.join`, conditional `Prisma.sql`/`Prisma.empty`) and interpolate them into `$queryRaw` templates. Turbopack dev duplicates the generated client's `Sql` class across module graphs, `instanceof` fails, and the fragment is sent to Postgres as one literal parameter ("invalid input syntax" 500s that only reproduce under `next dev`). Write one static template with NULL-checked optional filters instead — prefer the sargable form `col >= COALESCE(${x}::timestamp, '-infinity'::timestamp)` for range filters (index-friendly under generic plans), or `(${x}::type IS NULL OR col = ${x}::type)` for types without ±infinity (booleans etc.).
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
- `docs/designs/dedupe-volunteer-apply.md` — Duplicate application prevention design doc (partial unique index, applied badges, status emails)
- `docs/designs/banned-grid-patterns.md` — Banned grid patterns design doc (homepage `pillars`/`differentiators` → `EditorialList`, `/for` audience index → `/locations`-style link rows)
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
