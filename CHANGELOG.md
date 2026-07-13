# Changelog

All notable changes to this project will be documented in this file.

## [0.27.2.0] - 2026-07-13

### Changed
- **The small uppercase label above headings ("eyebrow" text like "Pricing", "Our story", "Customer stories") now looks the same everywhere on the public site.** (#129) It previously had 3+ competing treatments across public pages — some in a monospace font (reserved for data/tables per the design system), tracking values ranging from 0.15em to 0.25em or Tailwind's `tracking-widest`, and inconsistent colors. Every public page now shares one component and one look, with brand-green used for page-level kickers and a quieter gray for secondary in-page labels — including every page that renders through the shared hero components (homepage, about, pricing, screening, security, search, how-it-works, /for and its sub-pages, privacy, terms, and all six location pages), plus the direct sweep on stories, opportunities, marketplace, apply, the volunteer profile page, and the site footer.

## [0.27.1.0] - 2026-07-13

### Changed
- **The homepage and `/for` page no longer look like generic AI-generated SaaS templates.** (#128) The homepage's "What it does, day to day" section and the `/for` audience picker both used a 3/4-up icon-in-a-colored-circle card grid — a pattern DESIGN.md explicitly bans. The homepage now presents "What it does" and "Three things you won't find in the rest of the category" as matching editorial lists; `/for` now presents its four audiences (nonprofits, volunteers, employers, animal shelters) as a clickable row list matching the existing `/locations` page, with a clear hover state and arrow instead of a card grid.

## [0.27.0.0] - 2026-07-13

### Added
- **Organizations can now edit their name and public apply link.** (#127) The new Organization settings page (`/app/settings`) shows the live apply URL with a copy button and lets owners and admins rename the org or change its URL slug. Renaming the slug is a guarded flow: a confirmation dialog names both the old and new URL before anything changes, and every previously printed QR flyer or shared link keeps working — old slugs redirect to the new address across the apply page, public opportunity listings, impact stories, referral links, and social-share images. Slugs are validated as you type (lowercase, hyphens, 3–60 chars), platform routes like `status` and `refer` are reserved, freed slugs can't be claimed by other organizations (anti-squatting, with self-reclaim allowed), and slug changes are limited to 3 per day. Staff below admin see the profile read-only; volunteers are redirected. Editing is protected against losing work: unsaved changes prompt before any in-app navigation, org switching, or tab close.
- Settings hub "Access & setup" section links to Team, Onboarding, and Background checks from one place.

### Fixed
- **Sidebar navigation goes where it says it goes.** (#127) "ESG Report" now lives at `/esg` instead of a route confusingly named "team"; "Settings" points at the new settings hub instead of the background-check credentials page (now at `/app/settings/background-checks`, retitled to match); old URLs redirect. Exactly one sidebar item highlights at a time — previously "Company" and "ESG Report" lit up together, and near-miss URLs could false-match.
- **Multi-company users see the right company in the sidebar.** Company nav links now follow the company page you're actually viewing instead of always pointing at your default company.
- **Connecting Checkr no longer reports failure on success.** A pre-existing bug sent every successful Checkr OAuth connection to an error banner (the token was saved, the UI said it wasn't); successful connects now land on the success state.
- **In-app feedback from company pages is no longer misfiled under a nonprofit org**, and feedback from the ESG page is labeled "ESG Report" instead of a raw URL fragment in the admin triage view.
- Renaming an org under platform-admin impersonation now edits the impersonated org (not the admin's own) and audit-logs the real admin as the actor.

### Changed
- Org profile changes are audit-logged with before/after values; concurrent edits from two sessions are detected and rejected with a clear retry message instead of silently losing one edit.

## [0.26.4.0] - 2026-07-12

### Fixed
- **The ESG dashboard loads real numbers instead of failing on every visit.** (#126) The employer ESG report query 500'd under the dev server ("invalid input syntax for type boolean") because composed SQL fragments lose their class identity across Turbopack's module graphs and get sent to Postgres as literal text. Both ESG aggregate queries were rewritten as single parameterized statements (with index-friendly `COALESCE` range bounds); a production-build test confirmed deployed builds were never affected — the breakage was development-only. The same fragile pattern in marketplace remote-filter search was fixed before it could bite.
- **Employers see a real error instead of fabricated zeros.** When the report query failed, the page showed $0-everything stat cards and "No volunteer activity recorded yet" — fabricated data on a paid reporting feature — and a failed company lookup showed an "Upgrade to PRO" prompt to already-paying customers. Both failures now show a clear error card with a retry button (spinner while retrying), exports disable while errored, and raw internal error details are never rendered — only human-readable messages for expected error types.
- **Date filters include the full end day.** Picking "To: Jan 31" previously cut the report off at midnight, silently dropping every shift on the chosen end day from the dashboard, CSV, and PDF. Date-only end bounds now cover the entire day; an inverted range (From after To) shows an inline validation message instead of an empty-looking report, and the CSV/PDF endpoints reject inverted ranges instead of returning a legitimate-looking all-zeros file.
- **Company admins without a nonprofit role can reach their company pages.** Users who only administer a company (no nonprofit membership) were bounced to onboarding from every company page; company routes are now exempt from the no-org redirect (per-company membership is still enforced). A related lockout was fixed: being removed from your selected company no longer strands your session pointing at it — it self-heals to your remaining membership instead of redirect-looping.
- The `/for/employers` marketing screenshot now shows the ESG dashboard with real activity data (it previously shipped as an empty zero-state pending this fix).

### Added
- First authenticated end-to-end test suite (`pnpm e2e`): a Playwright harness signs in via a seeded database session and loads the ESG dashboard against the real dev server — the only environment that reproduces this bug class — plus a companion test proving non-members are still turned away. The harness refuses to run against non-local databases.

## [0.26.3.0] - 2026-07-12

### Fixed
- **Marketing pages now show the real product, not broken states.** All six product screenshots on the public site were misleading: `/screening` showed a half-loaded skeleton, `/for/employers` showed a locked "Upgrade to Pro" paywall, `/for/volunteers` showed an empty zero-stats profile, and `/for/nonprofits` referenced an image that didn't exist — so the page silently shipped with no product visual at all. Five of the six screenshots were recaptured from a fully loaded app with realistic demo data (the ESG screenshot ships as a clean zero-state pending an upstream query fix), and demo personas now use reserved example domains so no real person's email can appear next to a screening outcome.
- **Dark mode no longer breaks the savings calculator on `/screening`.** The result card kept a hardcoded white background while its text switched to light tones, making the "$X/year" figure unreadable. The card now follows the theme.
- **Screen-reader users get a proper `<main>` landmark on every public page.** Public layouts now wrap page content in a single `main` element (previously most public pages had none, and a few had their own).
- Fixed a visible grammar error in the Fresno FAQ ("are a export" → "are an export") that was also serialized into search-engine-facing structured data.

### Changed
- **About and Security pages now give visitors a next step.** Both heroes previously ended with a headline and no action; they now carry "Book a setup call" plus a secondary link, matching the homepage.
- Platform stats bar renders its impact numbers in the display typeface (Fraunces), per the design system.
- Removed a stray Playfair Display font load on public opportunity pages — Fraunces is the only display face now, which also drops an unnecessary Google Fonts request.
- Application form no longer repeats "Volunteer Application" twice at the top of the apply page.

## [0.26.2.6] - 2026-06-29

### Security
- **Resolved 20 of 21 open Dependabot alerts (all transitive dependencies).** Every alert traced to a transitive dependency — zero direct deps were affected, and the production blast radius was effectively nil (the highest-severity items, e.g. the hono CORS-wildcard advisory, descend from `@prisma/dev`, a dev-only server that never runs in production; the rest come from test/build tooling like `jsdom`→`vitest`, storybook, and vitepress). Fixed via `pnpm.overrides` (the pattern this repo already uses) pinned conservatively to the patched version within each package's current major, plus a `@sentry/nextjs` bump (`^10.49.0` → `^10.62.0`) to pull `@opentelemetry/core` ≥ 2.8.0. Cleared packages: `hono` (≥4.12.25), `@hono/node-server` (≥1.19.13), `form-data` (≥4.0.6), `postcss` (≥8.5.10), `@babel/core` (≥7.29.6), `vite` (≥7.3.5), `esbuild` (≥0.28.1), `@opentelemetry/core` (≥2.8.0). Lockfile-verified with a scan confirming no vulnerable versions remain. All 1201 tests, the Next.js build, and the Storybook build pass under the new versions.
- **Deferred:** the `uuid` alert (8.3.2, bounds-check in v3/v5/v6 when `buf` is provided) is consciously not fixed — it is not reachable on the only path that pulls it (`next-auth` v4, which uses uuid v4 random), and forcing the 8→11 major bump risks next-auth's CJS/ESM interop. Revisit at the Auth.js v5 migration.

## [0.26.2.5] - 2026-06-29

### Fixed
- **Google Analytics tag now actually detectable by Google's verification tool.** The previous fix (0.26.2.4) loaded the gtag script unconditionally but gated data collection with the `ga-disable-G-8EYQH68KXC` flag set to `true` by default. That flag suppresses *all* measurement hits, so Google's "Test Installation" bot — which looks for a real beacon to `google-analytics.com/g/collect`, not just the script download — still saw nothing fire and reported the tag as undetected (confirmed via headless browser: gtag.js loaded 200, but no `/g/collect` request). Replaced the `ga-disable` approach with **Google Consent Mode v2**: gtag now loads with `analytics_storage: 'denied'` (and ad storage denied) by default, which still sends a privacy-safe cookieless ping that Google's detector recognizes, without setting cookies or collecting analytics. When the user accepts the cookie banner, `gtag('consent', 'update', { analytics_storage: 'granted' })` upgrades to full measurement. This both fixes detection and aligns with Google's recommended EEA consent pattern.

## [0.26.2.4] - 2026-06-29

### Fixed
- **Google Analytics tag now detectable by Google's verification tool.** The `ConsentedAnalytics` component previously rendered nothing until the user granted cookie consent, which meant Google's "Test Installation" bot (which visits the page fresh, with no consent) could never find the tag. The gtag script now loads unconditionally on every page load, with the `ga-disable-*` flag set to `true` by default inside the inline init script. The flag is cleared only after consent is confirmed from localStorage. This makes the tag visible to Google's detection tool while preserving the existing GDPR-compliant behavior: no analytics data is collected or sent until the user explicitly accepts cookies.

## [0.26.2.3] - 2026-06-11

### Fixed
- **Login page attribution renders correctly.** An encoding pass that updated curly quotes in the login and verify-request pages accidentally double-encoded the em-dash in "— Mahatma Gandhi" and box-drawing characters in JSX comments, producing visible mojibake (â characters) in browsers. The correct Unicode codepoints are now restored.
- **Theme toggle no longer causes layout shift on load.** The SSR skeleton placeholder was 32px while the hydrated button is 44px, creating a 12px cumulative layout shift (CLS) on every page load containing the theme toggle. The skeleton now matches the 44px button size.
- **Marketplace empty state links to org discovery.** When no volunteer opportunities are published yet, the marketplace page now shows a "Browse organizations" action instead of a dead-end message.

### Changed
- **Typography system applied globally.** The Geist Sans body font is now applied in the CSS `@layer base` so all pages inherit it correctly instead of falling back to the system-ui stack.
- **Pricing page excluded-feature contrast improved.** Excluded feature rows now use full `text-muted-foreground` rather than a faded 60% opacity, making them easier to read at a glance.
- **Design tokens replace ad-hoc Tailwind colors throughout.** Hardcoded palette classes (`amber-700`, `blue-700`, `green-500`, `warm-50`, `orange-500`, etc.) have been replaced with semantic design tokens (`warning`, `info`, `success`, `muted`, etc.) across the marketplace listing, org browsing, apply flow, admin health page, and company team pages.
- **Touch targets meet 44px minimum.** The theme toggle and mobile hamburger buttons now meet the WCAG 2.5.5 recommended 44×44px touch target size on all screen sizes.
- **Display font (Fraunces) applied to apply-flow headings.** Page and section headings in the volunteer application flow now use the intended display typeface for visual consistency with the rest of the marketing site.
- **Admin feedback drawer animation wired up.** The `slideInLeft` keyframe animation referenced by the admin feedback drawer is now defined in `globals.css`, so the panel animates in on open instead of appearing instantly.
- **Curly quotes on login blockquote.** The Mahatma Gandhi quote on the login page now uses typographic curly quotes ("…") for polished rendering.

## [0.26.2.2] - 2026-06-08

### Fixed
- **Admin and maintenance scripts now connect to the database correctly.** Running `pnpm admin:grant`, `pnpm seed:platform-admins`, or other `scripts/` utilities against a real database (local or production) no longer throws `PrismaClientInitializationError`. Root cause: Prisma 7.x requires a `PrismaPg` adapter — bare `new PrismaClient()` fails without one. A shared `scripts/prisma-client.ts` helper now constructs the client correctly with the `pg` pool adapter, and all four affected scripts import from it.

### Changed
- Added `pnpm test:scripts` command and `vitest.scripts.config.ts` to run unit tests for files under `scripts/` (excluded from the main Vitest suite by design). Covers `scripts/prisma-client.ts` guard and adapter wiring.

## [0.26.2.1] - 2026-06-08

### Fixed
- **Vercel build advisory lock race condition.** Production deployments were failing with Prisma `P1002` (postgres advisory lock timeout) because `prisma migrate deploy` ran on every build — including preview builds that run concurrently with production. The fix wires `scripts/vercel-build.sh` (created in v0.26.1.0 for this exact purpose but never activated) as the Vercel `buildCommand`. Migrate now runs only on `VERCEL_ENV=production`; preview builds skip it. Updated `package.json` build script to match.

## [0.26.2.0] - 2026-06-08

### Added
- **Admin signup notifications.** Platform admins now receive an email whenever a new user signs up, a new nonprofit organization registers, or a new corporate partner account is created. Emails include the name, ID, and a deep-link to the relevant admin page. Set `PLATFORM_ADMIN_ALERT_EMAIL` in Vercel to activate.
- **Shared admin recipient resolver** (`admin-recipients.ts`). A single `getAdminEmails()` helper, used by all alert functions and feedback notifications, resolves recipients from `PLATFORM_ADMIN_ALERT_EMAIL` (env override) or the `isPlatformAdmin` DB flag with `PLATFORM_ADMIN_IDS` fallback. Results are cached for 5 minutes.

### Changed
- Feedback notifications now use the shared `getAdminEmails()` helper instead of a duplicate resolver. `PLATFORM_ADMIN_ALERT_EMAIL` now controls both feedback and signup alert recipients (replaces `FEEDBACK_NOTIFY_EMAIL`, which still works if set).

### Fixed
- Email subject lines in all admin alert emails now strip `\r\n` characters to prevent SMTP header injection.

## [0.26.1.1] - 2026-06-03

### Added
- **Tag-aware full-text search.** Opportunity tags are now included in the PostgreSQL `searchVector` column. Searching for "animals" or "environment" returns opportunities tagged with those cause areas, not just opportunities that mention the word in the title or description.
- **`orgMarketplaceService`** extracted from the tRPC router. Marketplace settings (visibility, description, location, cause-area tags) are now updated through a dedicated service layer instead of raw Prisma calls in the router.
- **Test coverage** for the unsubscribe endpoint (GET/POST paths), `orgMarketplaceService`, and `suspendedAt: null` guards across all marketplace queries.

### Changed
- Unsubscribe endpoint (`GET /api/unsubscribe/digest`) now shows a confirmation form instead of immediately mutating. `POST` performs the unsubscribe. This prevents email link prefetchers (Apple Mail, Gmail) from silently unsubscribing users who never clicked.
- `getMyInterests` now filters out opportunities from suspended organizations (same guard applied to all other marketplace queries in v0.26.0.0).
- Map page (`listForMap`) now excludes opportunities from suspended organizations.
- Interest toggle atomically wraps both the interest create and the digest preference upsert in a transaction. A P2002 error on the create no longer silently suppresses the preference upsert.
- GIN index creation for `searchVector` split into a separate migration that can be run with `CREATE INDEX CONCURRENTLY` to avoid locking the `VolunteerOpportunity` table during deploys.
- `searchVector` trigger now fires on all column updates (not just `title` and `description`), so publishing a DRAFT opportunity makes it immediately discoverable in full-text search.

### Fixed
- Newly published opportunities were invisible in marketplace search until a title or description edit. Fixed by broadening the trigger column list.
- A P2002 error during concurrent interest toggling could roll back both DB writes but still return `{ interested: true }` — leaving the user's digest preference un-enrolled silently.

## [0.26.1.0] - 2026-06-03

### Fixed
- **Vercel deployment no longer fails on TypeScript type errors.** The `source` prop on the apply form client was typed as `string` but tRPC expected `'DIRECT' | 'MARKETPLACE'`. Both the client component and the page now use the narrowed type.
- **Session non-null assertion in marketplace router.** The `protectedProcedure` middleware guarantees `ctx.session` is non-null; added `!` assertion to satisfy TypeScript's post-compilation type check (which Turbopack skips but `next build` does not).
- **Prisma advisory lock race condition on concurrent Vercel deployments.** `prisma migrate deploy` now runs only on production builds (`VERCEL_ENV=production`). Preview builds skip migration to prevent competing for the same Postgres advisory lock when both deployments target the same Neon database.
- **`DATABASE_URL_UNPOOLED` now takes precedence over legacy `DIRECT_DATABASE_URL`** in `prisma.config.ts`. Previously the legacy env var silently shadowed the new canonical name set by the Neon Vercel integration.

### Changed
- Build script extracted to `scripts/vercel-build.sh` and wired into `package.json`'s `build` command. Preview builds now log explicitly that migration is skipped.

## [0.26.0.0] - 2026-06-03

### Added
- **Weekly opportunity digest emails.** Volunteers who have hearted at least one marketplace opportunity now receive a branded email every Monday with up to 5 fresh opportunities tailored to their interests — excluding ones they've already applied to or hearted.
- **One-click unsubscribe for digest emails.** Each digest email includes an unsubscribe link secured with an HMAC-SHA256 token. Clicking it immediately sets digest frequency to OFF — no login required. Token validation uses timing-safe comparison to prevent attacks.
- **Application source tracking.** Applications now record where they originated (`DIRECT`, `MARKETPLACE`). Clicking Apply from the public marketplace automatically tags the application as `MARKETPLACE`, making attribution accurate in the admin dashboard.
- **New DB indexes** on `UserMarketplacePreference(digestFrequency, lastDigestSentAt)` and `VolunteerOpportunity(status, createdAt)` for efficient digest and marketplace queries.

### Changed
- `toggleInterest` moved to a dedicated `marketplaceService` (extracted from the tRPC router). Behavior is unchanged; the router is now a thin wrapper.
- Marketplace tRPC procedures and services now use typed Prisma enums (`OpportunityStatus.PUBLISHED`, `DigestFrequency.WEEKLY`) instead of raw string literals.
- Source input on the public apply form is now restricted to `DIRECT` and `MARKETPLACE` — other enum values can no longer be set via URL manipulation.

### Fixed
- Apply-from-marketplace links now correctly pass `?source=MARKETPLACE` (was `?source=marketplace` lowercase, which caused Zod validation to silently reject the application).
- Digest cron now processes all eligible users per run instead of stopping after the first 100 — resolves a pagination bug that would have caused most users to never receive a second email.
- Unsubscribe endpoint now returns a human-readable HTML confirmation page instead of raw JSON when opened in a browser from an email client.
- Unsubscribe URL now applies `encodeURIComponent` to userId and token parameters.

## [0.25.0.0] - 2026-06-03

### Added
- **Public volunteer marketplace at `/opportunities`.** Anyone can now browse and search published opportunities across all marketplace-visible organizations — no login required. Full-text search with 300ms debounce, remote/in-person filter, cursor-based "Load more" pagination, and a "This Weekend" strip for opportunities starting within 3 days.
- **Organization discovery page at `/organizations`.** Lists nonprofits participating in the marketplace with verified-only filter, location, cause-area tags, and opportunity/member counts. Each org card links to its public opportunity listing.
- **"I'm interested" heart toggle.** Authenticated volunteers can express interest in any marketplace opportunity. The heart button appears only for logged-in users and persists interest in a new `OpportunityInterest` table (unique per user/opportunity, cascades on delete).
- **Marketplace settings on team settings page.** Org staff can enable their org on the marketplace, set a description, location, and cause-area tags — all from `/app/settings/team`.
- **Org activation banner on the staff dashboard.** A dismissible banner nudges orgs that haven't enabled the marketplace to set up their listing.
- **`ApplicationSource` enum on `VolunteerApplication`.** New applications now track where they originated: `DIRECT`, `MARKETPLACE`, `REFERRAL`, or `WIDGET`. Marketplace apply links pass `?source=marketplace`.
- **Analytics events for marketplace interactions.** Page views, search queries, opportunity clicks, interest toggles, and org clicks are all tracked via the consent-aware `trackEvent()` utility.
- **Schema additions:** `Organization.marketplaceVisible`, `description`, `location`, `causeAreaTags`, `verified`; `VolunteerOpportunity.searchVector` (tsvector GIN-indexed for full-text search); `OpportunityInterest` model; `UserMarketplacePreference` model.
- **`/opportunities` and `/organizations` added to sitemap, footer, and OG image config.**

### Changed
- Marketplace tRPC procedures (`searchOpportunities`, `getThisWeekend`, `getOrganizations`) are rate-limited at 120 req/min per IP. Interest procedures (`getMyInterests`, `toggleInterest`) are rate-limited at 60 req/min per user.
- `toggleInterest` validates that the target opportunity is PUBLISHED and marketplace-visible before recording interest, and handles concurrent toggle races (P2002/P2025) idempotently.
- `getMyInterests` filters to only return interest records for currently PUBLISHED, marketplace-visible opportunities.

## [0.24.0.0] - 2026-05-19

### Added
- **Interactive volunteer map at `/map`.** Volunteers can now browse all geocoded opportunities on a Leaflet map. The page shows a filter toolbar (by tag), a "Use my location" button that sorts the sidebar list by distance, and popup cards linking to each org's opportunities page. The map re-centers imperatively via `useMap()` when the user grants location access.
- **Geocoding pipeline for opportunities.** When an opportunity is created or updated with a location, the address is geocoded via OpenCage in the background (fire-and-forget). Results (`lat`, `lng`, `geocodeStatus`) are stored on `VolunteerOpportunity`. Status can be `PENDING`, `SUCCESS`, `FAILED`, or `SKIPPED` (no key or blank address).
- **Mini location map on public opportunity cards.** If an opportunity has a geocoded location (`geocodeStatus: SUCCESS`), a compact Leaflet mini-map is rendered on its card in the `/opportunities/[orgSlug]` listing — no marker click required, just a visual pin on the address.
- **Geocode backfill script** (`scripts/geocode-backfill.ts`). Processes all published opportunities with `geocodeStatus: PENDING` in configurable batches with a per-request delay to respect API rate limits.
- **`/map` added to public nav, footer, and sitemap.** Change-frequency `daily`, priority `0.8`.

### Changed
- `createOpportunity` and `updateOpportunity` in the tRPC router now route through `opportunityService` (new service layer) instead of calling `opportunityRepo` directly, so geocoding fires automatically without router changes.

## [0.23.2.1] - 2026-04-21

### Fixed
- **Platform admin: audit log now shows both actor and subject rows.** The user detail page previously only showed rows where the user was the actor. It now uses a bidirectional `subjectId` filter returning rows where the user acted or was acted upon (e.g., had their admin status changed). New `@@index([actorId])` and `@@index([entityId])` indexes added to `AuditLog` for query performance.
- **Platform admin: impersonation session expiry no longer loops.** The countdown banner previously called `window.location.reload()` on expiry, which could loop if the cookie hadn't cleared yet. It now uses a one-shot `useRef` guard to navigate to `/app/admin/platform/users` exactly once.
- **Platform admin: impersonation context errors are handled gracefully.** Errors in `resolveImpersonation()` (called from both the tRPC context builder and server component helpers) are caught, reported to Sentry, and fail open — the request continues as if the user is not impersonating rather than returning a 500.
- **Platform admin: sensitive key detection in audit metadata now alerts via Sentry.** The `console.warn` call in `auditQueryService` is replaced with `Sentry.captureMessage` so sensitive-key detections surface in the monitoring dashboard rather than disappearing into server logs.
- **Platform admin: admins cannot revoke their own platform admin status.** `setPlatformAdmin` now throws `BAD_REQUEST` when the actor and target are the same user and `value` is `false`. The UI button is disabled with a tooltip in the same scenario.

## [0.23.2.0] - 2026-04-21

### Added
- **Volunteers can now withdraw their applications.** A "Withdraw application" button appears on `/app/my-applications/[id]` for applications in SUBMITTED or REVIEW status. Clicking it opens a confirmation dialog; on confirm, the application moves to WITHDRAWN status, the volunteer receives a confirmation email, and org admins receive an in-app notification.
- **WITHDRAWN application status.** New `WITHDRAWN` enum value added to `ApplicationStatus`. DB migration adds the value and recreates the dedup partial unique index to exclude both REJECTED and WITHDRAWN from the active-application constraint, so volunteers can re-apply after withdrawing.
- **Public customer stories index at `/stories`.** Lists all orgs that have consented to a case study with their logo, name, and application count. Includes JSON-LD breadcrumb and a CTA to be featured.
- **Withdrawal service and tRPC procedure.** `volunteerApplicationService.withdrawVolunteerApplication()` owns the withdrawal business logic (status guard, audit log, fire-and-forget email + in-app notification). Exposed via `screener.withdrawApplication` protected procedure.
- **17 new tests.** Service unit tests for all withdrawal paths (NOT_FOUND, FORBIDDEN, SUBMITTED success, REVIEW success, audit log); component tests for the withdrawal dialog (button visibility per status, dialog open/cancel/confirm/error/loading states); one new impersonation banner test for the error path.

### Fixed
- **Platform admin: impersonate error parsing now reads the response body.** The impersonation endpoint returns JSON (Zod issues) or plain text; the user-facing UI now surfaces the actual message instead of silently swallowing the failure.
- **Platform admin: impersonation banner shows an inline error instead of silently failing.** When "End session" fails (non-2xx), an error message appears below the banner and the button re-enables so admins can retry.
- **Platform admin: audit log page shows an error state.** Previously rendered an empty list on query failure; now shows a destructive card with the error message.
- **Platform admin: org detail page differentiates 404 from load errors.** `isError` shows "Failed to load organization. Please try again." in destructive styling; `!data` (not found) shows "Organization not found." in muted styling.

## [0.23.1.3] - 2026-04-20

### Changed
- **For Nonprofits page refreshed to the V2 editorial voice.** The `/for/nonprofits` page now matches the homepage rhythm: asymmetric 7/5 hero with an "Audit-ready by default" side note, mono-eyebrow pain band that names "The quiet crisis in volunteer management", divided feature list with bumped headings, outcomes trimmed to three pillars (Hours saved, Fewer no-shows, Grant-ready reports), 5/7 testimonial grid with italic emphasis on "actually training volunteers", and a refreshed CTA banner that asks "Ready to build your volunteer team?" with a secondary "See pricing" link.
- **Applications queue replaces the dashboard screenshot on /for/nonprofits.** The screenshot caption now reads "Your application queue — always current, always exportable." The image asset (`/marketing/applications-queue.png`) is a pre-merge follow-up; `ScreenshotSection` already hides the section via its `onError` fallback until the asset lands, so no visual breakage in the interim.

### Added
- **Smoke test coverage for /for/nonprofits.** `e2e/for-nonprofits.spec.ts` locks in the hero heading (with italic "from a spreadsheet." emphasis), both hero CTAs, the "Audit-ready by default" side-note label, and the bottom CTA's `/pricing` link.

## [0.23.1.2] - 2026-04-19

### Changed
- **Design tokens realigned to DESIGN.md hex spec** — every OKLCH color variable in `src/app/globals.css` is now a faithful conversion of the hex values canonicalized in `DESIGN.md`, with inline hex comments on each line so future drift is catchable in diff review. Most visible shifts: `--accent` is now the intended burnished gold `#C4A882` (previously ~2.5× over-saturated, rendering closer to mustard), `--success` now the darker forest `#2D7A4F` (previously too light), `--primary-hover` now matches the lighter hover green the spec calls for. Dark-mode tokens follow the DESIGN.md dark table (`#111110` bg, `#3D8B5F` primary, etc.). No component files touched; changes propagate via `var(--…)`.
- **Semantic `-foreground` tokens stay dark on muted backgrounds** — `--success-foreground`, `--warning-foreground`, and `--info-foreground` intentionally remain dark-in-light-mode / light-in-dark-mode so that the codebase's primary usage (`bg-{color}-muted text-{color}-foreground` in `src/components/ui/badge.tsx` and `bg-{color}/XX text-{color}-foreground` in inline status indicators) renders with adequate contrast. Added a comment block at the light-mode status tokens explaining this pairing rule.

## [0.23.1.1] - 2026-04-19

### Changed
- **V2 home editorial consolidation** — homepage rewritten to the post-review 7-section scope: hero (7/5 with content-bearing "What makes it work" side note), dashboard screenshot, platform stats bar, "What it does" 3-pillar grid (Background checks, Portable credentials, Funder-ready reports), "How we're different" 5/7 diff band, dark-primary CTA banner. Cut: editorial testimonial section and Volunteer Record / Dana Lindstrom mock card (deferred; testimonial returns once consented copy lands in DB).
- **Hero side label is content-bearing** — "What makes it work" replaces the prior "Built for X" pattern (DESIGN.md anti-pattern).
- **Pillar grid breakpoint** — `grid-cols-1 md:grid-cols-3` so tablets get the 3-up grid instead of stacking until `lg`.
- **External booking CTAs open in a new tab** — both "Book a setup call" buttons now carry `target="_blank" rel="noopener noreferrer"` since `FOUNDER_BOOKING_URL` points at Google Calendar.
- **Pillar/differentiator titles use `<h3>`** for proper a11y heading hierarchy under the section `<h2>`.

### Added
- **`PublicHero` regression test** — `src/components/public-hero.test.tsx` locks in the `isStructuredSide()` branching: undefined `side` → single-column, `{ label, note }` → mono label + accent-bordered note, arbitrary ReactNode → 7/5 right column with no border treatment.

## [0.23.1.0] - 2026-04-19

### Changed
- **V2 asymmetric 7/5 hero layout** — `PublicHero` now accepts an optional `side` prop (ReactNode or `{ label, note }`). When provided, the hero renders a 7/5 grid with left-aligned copy on the left and a context note on the right bordered in accent with a mono uppercase label; collapses to single column under `md:`. Default single-column variant is now left-aligned (no more centered hero text) to align with DESIGN.md.
- **`CTABanner` adopts the same 7/5 rhythm** — heading and description on the left (max-widths 560/520), actions bottom-right, with the accent radial-gradient overlay preserved on the dark-primary background. Collapses to single column on mobile.
- **`TestimonialSection` offsets content into the right 7 columns** of a 5/7 grid so the whitespace sits left, matching DESIGN.md's "no centered-everything" rule.
- **`FaqSection` heading left-aligned** — removed `text-center` from the section heading.

## [0.23.0.0] - 2026-04-19

### Added
- **Impersonation alerting (Tier 3)** — platform admins who start an impersonation session now trigger an email notification to `PLATFORM_ADMIN_ALERT_EMAIL`, creating an auditable out-of-band signal in addition to the `IMPERSONATION_STARTED` audit row. Centralized helper `src/server/lib/admin-alerts.ts` handles delivery; failures log and continue (alerting must never block admin workflows).
- **Org suspend / unsuspend (Tier 3)** — new `Organization.suspendedAt`, `suspendedReason`, and `suspendedById` columns, paired with suspend/unsuspend modals on `/app/admin/platform/orgs/[id]`. `orgProcedure` in `src/server/trpc/init.ts` now blocks suspended-org tRPC calls with a primary-key lookup, while still allowing platform admins through for unsuspend + triage. New `ORG_SUSPENDED` and `ORG_UNSUSPENDED` audit actions.
- **Per-org feature flags (Tier 3)** — `FEATURE_FLAG_REGISTRY` (`src/server/domain/feature-flags.ts`) defines the typed catalog; `featureFlagService.setFeatureFlag` updates `Organization.featureFlags` transactionally with an `FEATURE_FLAG_SET` audit row and required reason. `isFeatureEnabled(orgId, key)` reads per-org overrides with registry defaults. New Flags tab on the org detail page with toggle Switches + reason modal.
- **Billing delinquency view (Tier 3)** — new `/app/admin/platform/billing` page groups recent Stripe `invoice.payment_failed` webhook events by customer, showing org name, last-failure date, amount due, and a direct link to the Stripe customer. Backed by `platformBillingRepo.ts` + `platformBillingService.ts`.

### Changed
- **`orgProcedure` hardened** — switches from `findFirst({ where: { id } })` to `findUnique({ where: { id } })` for PK-scoped org lookups, and checks `suspendedAt` before returning the org context. Platform admins bypass the suspension block.
- **Audit action catalog** extends with `ORG_SUSPENDED`, `ORG_UNSUSPENDED`, and `FEATURE_FLAG_SET`.

## [0.22.0.1] - 2026-04-19

### Changed
- **Cleaned up biome warnings in test files** — replaced forbidden non-null assertions (`!`) on `res.headers.get('location')` with `?? ''` fallbacks in the case-study consent route tests, replaced `as any` casts with proper type assertions (`Awaited<ReturnType<...>>` for Prisma mocks, `ApplicationStatus` for screener-queries tests), removed unused `container` destructuring in platform-stats-bar tests, swapped `mock.calls[0]!` for `?? []` fallbacks in backgroundCheckService tests, and removed an unused `mockCreate` hoist in memberService audit tests. Zero biome warnings remain across `src docs prisma/schema.prisma`.

## [0.22.0.0] - 2026-04-17

### Added
- **Platform Admin Catalog Editor (Tier 2)** — new `/app/admin/platform/catalog` surface with tabs for Skill Families, Skills, and Default Screener Questions. CRUD on the reference-data catalog without shipping code, with audit rows for every mutation (`SKILL_FAMILY_CREATED/UPDATED/DEACTIVATED/REACTIVATED`, `SKILL_CREATED/UPDATED/DEACTIVATED/REACTIVATED`, `DEFAULT_QUESTION_CREATED/UPDATED/DEACTIVATED/REACTIVATED`).
- **Template screener questions** — `ScreenerQuestion.isTemplate` flag marks platform-org rows that serve as defaults for new-org onboarding. Admins edit templates in the catalog UI; new orgs created after an edit get the updated wording.
- **Catalog soft-delete** — `isActive` + `order` on `SkillFamily` and `Skill`; deactivating an entry removes it from active catalog views without losing audit history.
- **`platformCatalog` tRPC router** guarded by `platformAdminProcedure`: `getCatalog`, `createSkillFamily`, `updateSkillFamily`, `createSkill`, `updateSkill`, `getDefaultQuestions`, `createDefaultQuestion`, `updateDefaultQuestion`.
- **Name + slug uniqueness pre-checks** on skill families and skills with friendly `CONFLICT` error messages.

### Changed
- **`ensureReferenceData()` is now create-only** — boot-time seeding no longer overwrites admin DB edits, even across `CATALOG_VERSION` bumps. The TS constant (`SKILL_CATALOG`) becomes a bootstrap source only.
- **`seedDefaultQuestions()` reads templates from the DB** (`isTemplate=true, isActive=true`) instead of the TS constant, so admin edits propagate to new orgs immediately. Also guards against seeding onto the platform org itself (prevents `(orgId,key)` self-collision).
- **Boot guard seeds platform template questions** on first run from the TS constant, then never overwrites them.
- **Regular screener routes filter out template rows** — `listQuestions`, `getQuestion`, `getMaxOrder`, `updateQuestion`, `deleteQuestion`, `findAdjacentQuestion`, `swapOrders` in `screenerQuestionsRepo.ts` scope to `isTemplate: false` so platform-org admins cannot edit templates via non-catalog routes (bypassing audit).
- **Default-question backfill script** excludes the platform org to avoid collisions with template rows.

### Fixed
- **Inactive templates no longer leak into new orgs** — `seedDefaultQuestions()` filters `isActive: true` on the source query; deactivating a template in the catalog UI now honors the promise "inactive templates are not copied into new orgs."
- **Empty-template warning** — `seedDefaultQuestions()` emits a structured `console.warn` if no active templates exist (fresh install or all deactivated), instead of silently creating an org with zero screener questions.

## [0.21.0.0] - 2026-04-17

### Added
- **Platform Admin Console (Tier 1)** — new `/app/admin/platform` surface for platform admins with three tabs: Organizations, Users, and Audit log. Users and orgs support search and detail views; user detail shows memberships, sessions, submitted applications, and per-user audit history.
- **Platform admin actions** — grant/revoke the `isPlatformAdmin` flag on any user (with mandatory reason) and revoke all active sessions for a user. Every action writes an audit row with `selfAction` tracking.
- **Support impersonation flow** — platform admins can impersonate any non-admin user for up to 30 minutes. Impersonation emits `IMPERSONATION_START` / `IMPERSONATION_END` audit rows, binds a signed cookie to the admin, and shows a sticky `ImpersonationBanner` with a live countdown and End-session control.
- **`platformAdminProcedure`** — tRPC middleware that enforces platform-admin access, using `realUserId` so admins retain console access while impersonating another user.
- **REST `/api/platform-admin/impersonation/{start,end}`** — session-authenticated endpoints with platform-admin re-checks, Zod input validation, httpOnly cookie, and structured error mapping. Unexpected errors return 500 with a generic message (no internal detail leak).
- **Audit query service** — filterable log (actor/entity/action/org/date range/impersonation-only) with sensitive-key redaction before rows leave the server.

### Changed
- **tRPC context** resolves impersonation on every request: `realUserId` always points at the admin, `session.user.id` swaps to the impersonation target, and `platformAdminProcedure` checks `realUserId` so admin procedures still succeed.
- `getUser` (platform user service) now loads submitted application summary in parallel with user detail, surfaced on the user detail page's Applications tab.

### Fixed
- **SEC-1:** `endImpersonation` now rejects callers who are not the admin who started the session, preventing one platform admin from terminating another's active impersonation by passing a known session id.
- **SEC-2:** `/api/platform-admin/impersonation/end` clears the cookie even when the service throws, so a failed end request cannot silently leave the admin impersonating after the UI redirects them away.

## [0.20.0.1] - 2026-04-13

### Fixed
- **Sentry noise reduction** — added `ignoreErrors` and `denyUrls` filters to the client-side Sentry config to suppress false-positive alerts from browser extensions (password managers, ad blockers), ResizeObserver warnings, and network failures on visitor devices. Filters applied to the correct Next.js instrumentation file (`src/instrumentation-client.ts`).

## [0.20.0.0] - 2026-04-13

### Added
- **Animal shelter vertical page** at `/for/animal-shelters` — vertical-specific landing page with pain point acknowledgment, screening flow diagram, shelter-tailored FAQ, and custom lead form success state.
- **`/for` index page** with card grid linking to all audience pages (volunteers, nonprofits, employers, animal shelters).
- **UTM campaign attribution** — lead capture forms now read `utm_source`, `utm_campaign`, and `utm_content` from the URL and store them in the database. First-touch attribution preserves original source on resubmission.
- **Vertical slug registry** — `VERTICAL_SLUGS` array and `getValidLeadSlugs()` for Zod validation; `getLeadSourceLabel()` for human-readable display across admin and notifications.
- **Admin lead filter** — segmented control (All / Geo / Animal Shelters) replaces the location dropdown, with geo sub-filter for specific locations.
- **Screening flow diagram** — new `ScreeningFlowDiagram` component showing 4-step volunteer screening process (horizontal on desktop, vertical on mobile).
- **Cold email template** for shelter outreach in `docs/cold-email-template.md` with UTM link format and personalization placeholders.

### Changed
- **URL hierarchy** — `/for-volunteers`, `/for-nonprofits`, `/for-employers` moved to `/for/volunteers`, `/for/nonprofits`, `/for/employers` with permanent 301 redirects from old URLs.
- **Geo page CTAs** now use founding-organization positioning ("Be the first nonprofit in {location} on VolunteerReady").
- `ComparisonTable` and `FaqSection` accept optional `heading` prop for vertical-specific customization.
- `LeadCaptureForm` accepts `successContent` render prop for custom post-submission UI.
- Vertical lead notifications include follow-up guidance for higher-intent outreach.

## [0.19.1.1] - 2026-04-12

### Fixed
- "Book a Call" button on geo landing pages is now readable — added `bg-transparent` to override the outline variant's light background, matching the homepage CTA pattern.

## [0.19.1.0] - 2026-04-11

### Added
- **Atomic Review & Issue action** — CONSIDER background check rows now have a "Review & Issue" button that issues a VERIFIED credential and resolves FCRA in a single database transaction, eliminating the partial-success trap where one could succeed without the other.
- **Status transition on review** — Resolving a CONSIDER check now transitions it to COMPLETE, so the row no longer shows "Needs Review" after action is taken.
- **Tenure badge support** — Credentials issued via the Review & Issue flow now trigger tenure badge evaluation, matching the standard credential issuance path.

### Fixed
- Review & Issue button no longer appears on rows where adverse action was already sent (ADVERSE_ACTION_SENT or RESOLVED FCRA status).
- Expiration date picker now uses end-of-day local time instead of UTC midnight, preventing off-by-one date display in US timezones.
- Server-side validation rejects past expiration dates on credential issuance.

## [0.19.0.0] - 2026-04-11

### Added
- **Geo-targeted landing pages** — 5 location-specific pages for Stockton, Modesto, San Joaquin County, Stanislaus County, and Sacramento, each with unique content, pain points, comparison tables, FAQs, and local nonprofit data.
- **Location index page** — `/locations` directory page listing all available location pages with descriptions.
- **Lead capture system** — Public form with org name, email, volunteer count, current process, and pain points. Honeypot spam protection, rate limiting (5/hr/IP), and consent-aware analytics tracking.
- **Founder lead notifications** — Fire-and-forget email notification to founder on each new lead submission with full context (HTML-escaped for security).
- **Lead admin dashboard** — Platform admin page at `/app/admin/leads` with location filtering and lead triage.
- **Location OG images** — Dynamic Open Graph images for each location page via the existing OG image API.
- **Sitemap integration** — All location pages included in the dynamic sitemap.
- **Analytics utility** — Consent-aware `trackEvent()` function that respects cookie consent preferences before firing gtag events.
- **LeadCapture database model** — New table with upsert-on-duplicate (email + location), soft delete, and indexed queries.

## [0.18.0.0] - 2026-04-04

### Added
- **Design system implementation** — Porto warm palette (forest green, warm cream, gold accent) applied across all pages. Dark mode with warm hue-80 neutrals instead of cool blue-gray. Three-state theme toggle (light/dark/system) in both public header and app shell.
- **Storybook** — Component library with stories for Button, Badge, Card, Skeleton, EmptyState, and ThemeToggle. Configured with dark mode toggle and responsive viewports.
- **Centralized public page registry** — All public page metadata (nav links, footer sections, sitemap entries, OG image config) consolidated into `src/lib/public-pages.ts`.
- **Theme toggle test suite** — Unit tests for three-state cycling, SSR skeleton rendering, and keyboard accessibility.

### Changed
- **Dashboard redesign (staff)** — Replaced greeting banner and stat cards with compact KPI rail and 8/4 grid layout (primary workspace + sidebar context).
- **Dashboard redesign (volunteer)** — Replaced card-wrapped impact stats with inline KPI rail and region-based layout.
- **Typography dual personality** — Public/editorial pages use Fraunces (serif) for headlines; app/operational pages use Geist (sans) throughout. Font-display cleaned from ~10 app pages.
- **Homepage simplified** — Removed 3-card audience grid. Streamlined to hero + pillars + screenshot + CTA.
- **Error pages restyled** — not-found and error pages now use warm cream background with forest green Fraunces headline. global-error uses inline brand styles (CSS may not load).
- **Motion capped** — FadeInOnScroll limited to 1-2 intentional moments per page instead of per-item stagger.
- **246 hardcoded colors replaced** with semantic design tokens across 67+ files.
- **Email templates rebranded** — Warm cream body, Georgia serif header, consistent link and button colors. Fixed double-wrapping bug where callers pre-wrapped HTML before `buildEmailHtml()`.
- **Sidebar active state** — Border-left indicator replaces dark mode shadow glow.
- **Skeleton shimmer** — Custom warm-shimmer keyframes (cream tones in light, warm neutrals in dark).
- **OG image resilience** — Font loading wrapped in try/catch with system serif fallback.

### Fixed
- **Dark mode bg-white bugs** — ScreenshotSection, iOS install prompt, and onboarding checklist now use `bg-card` token.
- **CTA outline button readability** — Text now visible on dark backgrounds.
- **ScreenshotSection LCP** — Added optional `priority` prop for eager loading when screenshot is the hero image.
- **Search page discoverability** — `/search` added to header nav, footer, sitemap, and OG image API.

## [0.17.15] - 2026-03-31

### Changed
- **Centralized public page registry** — All public page metadata (nav links, footer sections, sitemap entries, OG image config) now lives in a single `src/lib/public-pages.ts` registry. Header, footer, sitemap, and OG image route all consume from one source of truth, eliminating drift when adding new pages.
- **Search page now discoverable** — `/search` appears in the header nav, the footer Platform section, the sitemap, and the OG image API. Previously it existed but was unreachable from navigation.

### Fixed
- **Feedback page SEO** — Added OG image metadata, JSON-LD breadcrumbs, and proper `noindex` for invalid/expired feedback links (using `generateMetadata()` instead of invalid `<head>` in page body).
- **OG image for `/search`** — `/api/og/page/search` no longer returns 404.

## [0.17.14] - 2026-03-31

### Added
- **Public search page** (`/search`) — Site-wide search powered by Google Custom Search Engine, with SEO metadata, JSON-LD breadcrumbs, and the standard public page layout.

## [0.17.13] - 2026-03-24

### Added
- **In-app feedback system** — Floating feedback widget (Dialog on desktop, Drawer on mobile) with 5-mood selector, message textarea, rate limiting (5/hour), and mood-aware success confirmation. Captures page context and org scope automatically.
- **Feedback admin triage page** (`/app/admin/feedback`) — Platform admin inbox with status/mood filters, collapsible insights panel (mood breakdown bar, top friction pages), responsive list/detail split layout (desktop side-by-side, tablet overlay, mobile full-screen), status dropdown auto-save, reply with email notification to user.
- **Feedback admin dashboard notice** — "N new feedback items" banner on staff dashboard for platform admins, linking to triage page.
- **My Feedback page** (`/app/my-feedback`) — Volunteer-facing feedback history with human-friendly status labels (Received, Being reviewed, We took action, Noted), expandable items showing admin replies.
- **Cookie banner + feedback pill coordination** — CSS custom property (`--cookie-banner-height`) on `:root` for smooth pill repositioning when consent banner is visible.
- **Platform admin flag in session** — `isPlatformAdmin` exposed in NextAuth session (DB column + `PLATFORM_ADMIN_IDS` env var fallback) for client-side admin UI gating.
- **Drawer UI component** (shadcn/vaul) — Mobile bottom-sheet component for feedback widget and future mobile-first interactions.

## [0.17.12] - 2026-03-23

### Added
- **Google Analytics (gtag.js) with consent gating** — Loads Google Analytics measurement tag (`G-8EYQH68KXC`) only when the user grants analytics cookie consent. Sets the `ga-disable-*` window flag to properly disable tracking in-memory when consent is revoked, preventing continued tracking after component unmount.

## [0.17.11] - 2026-03-22

### Added
- **Nonprofit discovery outreach conversation flow** — Complete conversation scripts for cold email (3-touch sequence), LinkedIn warm outreach, and volunteering-based relationship building. Includes 30-minute discovery interview script with 5 core questions and follow-up probes, conversation logging template, pattern recognition framework, and nonprofit sourcing guide.

## [0.17.10] - 2026-03-22

### Changed
- **Phase 11 plan placed ON HOLD** — All 12 Phase 11 PRs deferred pending first active org/user validation
- **Grant integration permanently removed** — Removed from Phase 11 plan and TODOS.md with tombstone explaining domain expertise rationale (grant APIs vary wildly by state/funder, integration outside CA/federal is prohibitively difficult)
- **TODOS.md cleanup** — Grant/Funding Tracker section replaced with permanent removal notice

## [0.17.9] - 2026-03-22

### Added
- **Shared `<FaqSection>` component** — Standardized FAQ accordion with `<details>/<summary>`, Fraunces heading, deep-link IDs, chevron animation, and automatic JSON-LD `FAQPage` structured data. Used on 5 pages.
- **Shared `<PlatformStatsBar>` component** — Async server component showing live platform stats (orgs, credentials, shifts, volunteers) with hide-on-zero filter. Extracted from homepage, now reused on for-nonprofits and for-employers.
- **Shared `<ScreenshotSection>` component** — Product screenshot with fade-in animation, configurable section/container backgrounds, caption, and graceful error handling. Used on 4 pages.
- **FAQ sections on audience pages** — Added 6-question FAQ blocks with JSON-LD to for-nonprofits, for-volunteers, and for-employers pages.
- **Product screenshots on marketing pages** — Added screener, dashboard, profile, and ESG dashboard screenshots to screening, for-nonprofits, for-volunteers, and for-employers pages.
- **Homepage competitive positioning** — Added "What makes us different" differentiator cluster (founder-led setup, real-time data) below platform pillars with sand left-border accent.
- **About page "Recently Shipped" section** — Grouped milestones into Platform Capabilities and Recently Shipped clusters with version badges.
- **`FOUNDER_BOOKING_URL` constant** — Centralized Google Calendar booking link in `src/lib/constants.ts`.
- **Testimonial teasers** — "More stories coming soon" text below testimonials on for-nonprofits and for-volunteers.
- **Test coverage** — 3 new test files (10 tests) covering FaqSection, PlatformStatsBar, and ScreenshotSection components.

### Changed
- **Marketing CTAs** — for-nonprofits and for-employers primary CTAs now link to founder booking instead of in-app onboarding. CTA labels vary per page (screening: "Get Set Up Free", nonprofits: "See It In Action", employers: "Schedule a Demo").
- **Sterling mentions** — Updated 6 pages to mention both Checkr & Sterling for background check providers.
- **FAQ standardization** — Refactored existing FAQ sections on how-it-works and screening pages to use the shared `<FaqSection>` component with consistent `{ question, answer }` data shape.
- **ISR caching** — for-nonprofits and for-employers pages converted to async with `revalidate = 3600` for platform stats.

### Fixed
- **False CSV export claim** — for-employers FAQ now correctly states CSV exports are available on Pro plans (was "all plans").
- **False screening claim** — Removed inaccurate per-opportunity screening form claim from for-nonprofits.
- **False document uploads claim** — Removed inaccurate document uploads claim from for-nonprofits apply flow description.
- **Hardcoded Calendly URLs** — Replaced 5 hardcoded `calendly.com` links with `FOUNDER_BOOKING_URL` constant across screening, stories, and referral pages.
- **Removed video placeholder** — Deleted "Founder demo video — embed URL here" placeholder section from screening page.

## [0.17.8] - 2026-03-22

### Added
- **Dynamic sitemap & robots.txt** — `sitemap.xml` now auto-generates URLs for all public pages plus per-org apply, opportunity, and story routes. `robots.txt` blocks authenticated app routes while allowing the OG image API.
- **Dynamic OG images** — `/api/og/[type]/[slug]` generates branded Open Graph images using Fraunces + Geist fonts with the VolunteerReady color scheme. Supports all 11 public pages (home, about, pricing, screening, how-it-works, for-nonprofits, for-volunteers, for-employers, security, privacy, terms) and org-specific images (apply, opportunities, stories).
- **JSON-LD structured data** — Added `BreadcrumbList` schema to all public pages and `FAQPage` schema to pricing, screening, and how-it-works pages. Organization schema added to root layout.
- **FAQ sections** — Visible FAQ blocks on pricing (5 questions) and screening (4 questions) pages with matching JSON-LD markup.
- **Centralized `BASE_URL` constant** — Extracted canonical production URL to `src/lib/constants.ts`, used by sitemap, robots, JSON-LD, OG images, and root layout metadata.
- **SEO metadata** — Added `openGraph.images` pointing to dynamic OG endpoints on all major public pages.
- **Test coverage** — 5 new test files (17 tests) covering OG image route, JSON-LD breadcrumb/FAQ components, sitemap, and robots.
- **Duplicate application prevention** — Volunteers can no longer accidentally apply twice to the same opportunity. The system enforces this at the database level, with a graceful fallback for race conditions.
- **"Already Applied" badges** — Opportunity listings now show your application status (Pending, In Review, Approved) with a "View My Application" link replacing the Apply button.
- **Apply form interception** — Navigating to an opportunity you've already applied to shows a friendly "You're already on the list!" card with a link to your existing application.
- **Anonymous email soft-block** — Unauthenticated applicants see a warning if their email was already used to apply to the same opportunity (advisory only, does not block submission).
- **Status notification emails** — You now receive branded email notifications when your application status changes to In Review, Approved, or Rejected, with a direct link to view your application.
- **Cross-org applied status** — The Browse Opportunities page shows your applied status across all organizations, not just the current one.
- **Safe migration** — Pre-existing duplicate applications are automatically cleaned up when the migration runs.
- **Comprehensive test suite** — 21 backend tests and 2 component test files covering the full dedup flow, race conditions, notification emails, and input validation.

### Changed
- **Biome config** — Added `noDangerouslySetInnerHtml: "error"` rule with targeted biome-ignore comments for legitimate JSON-LD usage.

### Fixed
- **Applied badges on Browse page** — Fixed a validation error that prevented applied-status badges from appearing on the Browse Opportunities page. The system was rejecting valid opportunity IDs due to an incorrect UUID format check.
- **Credential sharing on duplicate** — Duplicate applications no longer trigger phantom credential-sharing writes.

## [0.17.7] - 2026-03-22

### Fixed
- **Volunteer applications now submit correctly for new orgs** — Seeded screening questions had a malformed disqualifier config that caused a silent ZodError on every application submission. New orgs created after v0.17.6 would see applications silently fail to submit.

### Added
- **Backfill for existing orgs** — `pnpm backfill:default-questions` seeds the 5 default screener questions for any org that was created before v0.17.6. Safe to run multiple times — duplicates are skipped automatically. Also runs on every deploy via the build pipeline.

## [0.17.6] - 2026-03-22

### Fixed
- **Screener question form** — Fixed silent form submission failure when creating BOOLEAN or TEXT screener questions. The Zod schema validated option fields for all question types, but error messages were only visible for SINGLE_CHOICE, causing invisible validation failures.

### Added
- **Default screener questions** — New orgs are automatically seeded with 5 starter screening questions (age verification, background check consent, availability, prior experience, motivation). Seeded atomically inside the org creation transaction.
- **Test infrastructure** — Added React Testing Library + jsdom for component tests. 10 new schema/component tests for QuestionDialog, 8 new tests for default screener question catalog.

## [0.17.5] - 2026-03-21

### Fixed
- **Volunteer profile save** — Fixed `AuditLog_orgId_fkey` foreign key constraint error when volunteers save their profile. The audit log was using a bogus `'SYSTEM'` org ID instead of `null` for org-less actions.

## [0.17.4] - 2026-03-22

### Added
- **Reference Data Boot Guard** — Self-healing runtime check that ensures the skill catalog (13 families, 62 skills) and platform org exist before serving requests. Uses a module-level flag + promise lock for zero-cost after first check, with automatic re-seeding on cold starts.
- **Catalog version tracking** — New `ReferenceDataMeta` table tracks the seeded catalog version. Version mismatches (e.g., after a rollback) trigger automatic re-seeding with strict equality (`===` not `>=`).
- **Domain extraction** — `SKILL_CATALOG` moved from `prisma/seed-helpers.ts` to `src/server/domain/reference-data.ts` as the single source of truth, importable by both seed scripts and runtime services.
- **Startup instrumentation** — `instrumentation.ts` now runs `ensureReferenceData()` on Node.js startup as a belt-and-suspenders check alongside the runtime guard.
- **Empty catalog UI** — My Skills page now shows a friendly empty state with refresh button when the skill catalog is unavailable.
- **9 unit tests** — Full coverage for boot guard service: fast path, concurrent dedup, error retry, version mismatch re-seed, both-missing seeding, and logging.

### Changed
- **Matching router** — `getSkillCatalog` now routes through the service layer (with boot guard) instead of calling the repository directly.
- **Tenure badge service** — Now calls `ensureReferenceData()` before platform org lookup and imports `PLATFORM_ORG_SLUG` from the canonical domain module.
- **About page** — Replaced fictional team bios and origin story with the real founder story. Jason and Trisha Shultz are now featured as cofounders with authentic bios and photos from their 35 years of volunteering.

## [0.17.3] - 2026-03-21

### Added
- **RBAC Foundation** — Role-based permission checking via `hasPermission(role, permission)` with TypeScript constants as the source of truth. No DB tables in v1 — fast, in-memory lookups.
- **Advisory permission middleware** — Every API call now logs a warning if the existing role check and the new permission system disagree. Never blocks requests — just surfaces mismatches for safe migration.
- **DB-backed platform admin** — Platform admin status is now stored in the database instead of an env var. The old `PLATFORM_ADMIN_IDS` env var still works as a fallback during migration.
- **CLI escape hatch** — `pnpm admin:grant <email>` / `pnpm admin:revoke <email>` for platform admin management with transactional audit logging.
- **Seed migration script** — `pnpm seed:platform-admins` migrates `PLATFORM_ADMIN_IDS` env var to DB column (idempotent).
- **Auth change audit logging** — Inviting, removing, or changing a member's role now writes an audit log entry inside the same database transaction as the change itself — no more gaps between action and record.
- **Activity feed expansion** — `MEMBER_REMOVED` and `ROLE_CHANGED` events now appear in the admin activity feed.
- **18 RBAC tests** — Full coverage for permissions, platform admin, audit logging, business rules, and role hierarchy.
- **Magic link email tests** — 6 new tests covering subject line, branding, CTA link, design tokens, and template structure.

### Changed
- **ADMIN invite business rule** — Admins can only invite Staff or Read-only members (not other Admins). This rule is now enforced in the service layer with a proper FORBIDDEN error instead of the API layer.
- **TOCTOU fix** — Member removal and role changes now look up the target inside the transaction, closing a race condition where two concurrent requests could bypass each other's guards.
- **No-op role change guard** — Changing a member's role to their current role no longer writes a misleading audit log entry.
- **Branded magic link email** — The sign-in email now matches the VolunteerReady design system: forest green CTA button, warm neutral typography, and safety disclaimer.
- **Branded "Check your email" page** — After requesting a magic link, users now see a polished verify-request page with the same split-panel layout as the login page instead of an unstyled default.

### Fixed
- **Magic link emails now use verified domain** — Sign-in emails were sending from an unverified local domain (`volunteeermatch.local`), causing delivery failures. They now use the `RESEND_FROM_EMAIL` env var like all other emails.
- **Company invite emails now report delivery failures** — Invite emails use the shared `sendEmail()` helper for consistent bounce suppression and delivery tracking. Staff now see accurate feedback when an invite email fails to send.
- **Cleaned up stale env var docs** — Removed legacy `EMAIL_FROM` reference from README; only `RESEND_FROM_EMAIL` is documented.

## [0.17.2] - 2026-03-21

### Changed
- **Org feedback cron error visibility** — Real email failures are now tracked separately from idempotent skips, so you can tell the difference between "already sent" and "actually broken."
- **Shared `escapeHtml` utility** — Three copies of HTML escaping consolidated into one (`src/server/lib/html.ts`) with single-quote coverage for safer output.
- **Safer type handling** — Impact report baseline parsing and feedback pull-quote extraction now validate data at runtime instead of trusting unchecked casts.
- **Consistent feedback email URLs** — All org feedback email links now point to `volunteerready.org`.

### Fixed
- **Consent flow resilience** — If the database is unreachable during consent confirmation, orgs now see a clear "expired" page instead of a 500 error.
- **Feedback form error visibility** — If saving feedback fails, the form now shows an error message instead of spinning forever.
- **PDF generation debugging** — Case study PDF errors now log full stack traces for faster diagnosis.
- **Silent failure elimination** — Testimonial fetch, onboarding checklist dismiss, and feedback form failures now log errors instead of swallowing them.

### Added
- **Test coverage** — New test suites for `caseStudyService` (25 tests), `org-feedback-service` (10 tests), and consent route handlers (10 tests).
- **TODO** — P3 item for feedback form server-side length validation.

## [0.17.1] - 2026-03-21

### Added
- **Content Flywheel** — Case study generation pipeline that composes org usage data (applications, background checks, retention, fill rate, top volunteers) into shareable impact stories. Includes admin management UI at `/app/admin/case-studies`, public story pages at `/stories/[orgSlug]`, PDF export, and testimonial components on the screening landing page.
- **Two-step consent flow** — HMAC-signed email tokens with 7-day expiry. GET renders a confirmation page (safe for email prefetchers), POST sets consent via service layer with 303 redirect. Consent-expired and consent-confirmed static pages.
- **Testimonial section** — Live testimonials from consented orgs replace the social proof placeholder on the screening landing page.
- **Backfill script** — `scripts/backfill-consent.ts` parses existing DAY_30 feedback for affirmative consent strings and sets `consentToPublicize` on matching orgs.

### Fixed
- **Security: consent mutation on GET** — Consent endpoint split into GET (confirmation page) + POST (state change) to prevent email prefetchers from silently granting consent.
- **Security: public feedback auto-consent** — Removed unauthenticated consent grant from the public feedback form server action.
- **Security: XSS in consent HTML** — Org name and token are HTML-escaped in hand-built consent confirmation page.
- **Security: email HTML injection** — Org name and pull quote escaped in approval email HTML.
- **Security: timingSafeEqual crash** — Added length check and try/catch around `crypto.timingSafeEqual` to handle malformed hex signatures gracefully.
- **Graceful handling when CASE_STUDY_CONSENT_SECRET missing** — `verifyConsentToken` returns null instead of throwing when env var is not configured.

## [0.17.0] - 2026-03-21

### Added
- **Screening landing page** — New marketing page at `/screening` with pain-point messaging, feature highlights, social proof placeholder, and an interactive Switch Cost Calculator that shows nonprofits how much they're spending on manual volunteer management vs. VolunteerReady's $29/mo.
- **"Powered by VolunteerReady" footer** — Public apply pages now show a branded footer linking back to the screening landing page. Orgs can toggle this off via the `showPoweredBy` setting.
- **Onboarding checklist** — Staff dashboard shows a 4-milestone checklist (invite team, create opportunity, receive application, complete background check) with a progress bar. Dismissible once complete.
- **Referral prompt** — After an org completes their first background check, the dashboard shows a prompt to share a referral link. Copy-to-clipboard with localStorage-based dismissal.
- **Referral landing page** — `/apply/refer?from=[orgSlug]` displays the referring org's name and funnels new nonprofits to a Calendly booking.
- **Org feedback survey system** — Day-7 and day-30 feedback emails sent automatically to org admins. Public survey form at `/screening/feedback` with tailored questions per window (day-30 adds "would you pay?" and testimonial consent). Day-30 email includes an impact report link.
- **Org feedback cron** — Daily cron at 10:00 UTC (`/api/cron/org-feedback`) identifies orgs that have passed the 7-day or 30-day mark and sends branded feedback emails. Idempotent via `OrgFeedback` table with unique constraint on (orgId, type).
- **Onboarding baseline capture** — Settings page at `/app/settings/onboarding` where orgs record their pre-platform volunteer count, admin hours/week, and current tracking process. Data stored as JSON on the Organization model.
- **Impact report** — `/app/impact-report` shows baseline vs. platform usage metrics so orgs can see the value VolunteerReady delivers over time.
- **OrgFeedback Prisma model** — New `OrgFeedback` table with `OrgFeedbackType` enum (DAY_7, DAY_30), unique per org + type, with optional JSON responses field.
- **Organization activation fields** — `onboardingBaseline` (JSON), `showPoweredBy` (boolean), `onboardingComplete` (boolean), `referralSource` (string) added to the Organization model.

## [0.16.5] - 2026-03-21

### Added
- **Phase 11 design document** — Full vision for the Volunteer Marketplace & API Platform: 13-item scope across 3 sub-phases, 7 architecture decisions, 8 new data models, 12-PR implementation sequence, security model, and complete design specifications (information architecture, interaction states, responsive specs, accessibility). Reviewed via CEO review, eng review, and design review.

### Changed
- **Volunteer router guard** — Replaced non-null assertion with explicit session guard in the volunteer dashboard procedure for safer error handling.

## [0.16.4] - 2026-03-21

### Fixed
- **Discover page crash** — Fixed `<SelectItem value="">` crash on the Discover volunteers page. Radix UI's Select component forbids empty string values; replaced the "Any availability" option's empty string with a `_any` sentinel that gets converted back to `undefined` before the API call.

## [0.16.3] - 2026-03-21

### Added
- **Automated cron smoke tests** — 6 new test files covering all cron jobs: credential expiry, shift reminders, email digests, volunteer re-engagement, shift auto-close, and notification cleanup. Each route test verifies auth (no header, wrong header, empty secret → 401), happy-path service delegation with response assertions, and error handling (service throws → 500). Infrastructure test for `withCronAuth` wrapper covers CronJobRun recording for success/failure, duration tracking, and graceful handling when the recording itself fails.
- **Share token expiry service tests** — Service-level tests for `notifyExpiringShareTokens` covering email delivery, null-email skip, empty results, P2025 race condition handling, error isolation across multiple tokens, and credential type/org name in email body.

### Fixed
- **Dashboard role detection** — The dashboard now uses the resolved `session.orgId` (which includes fallback to first membership) instead of `session.currentOrgId` (raw DB value). This prevents org members from being incorrectly shown the volunteer dashboard when `currentOrgId` is unset.
- **Unlinked application visibility** — Volunteer dashboard now includes applications submitted before login (by email only, not yet linked to a user account) in the pending applications list and opportunity recommendations.
- **Session type completeness** — NextAuth session type declaration now includes all resolved auth fields (`orgId`, `role`, `companyId`, `companyRole`, `currentCompanyId`) that the auth callback populates.

## [0.16.2] - 2026-03-21

### Added
- **Volunteer dashboard** — Users without an org context now see a personalized volunteer dashboard at `/app` with impact stats (hours, orgs served, shifts attended, verified credentials), upcoming shifts, pending applications, expiring credentials, and recommended opportunities from previously interacted organizations. Impact stats use DB-side SQL aggregation for performance.
- **Onboarding funnel analytics** — Platform admins can view a 4-step org onboarding funnel at `/app/admin/onboarding` showing how many organizations have completed each step (account created → screener set up → opportunity published → first application received), plus a per-org detail table for the 20 most recent organizations.

### Fixed
- Dashboard no longer flashes the wrong view while the session is loading — a skeleton placeholder renders until the session resolves.
- Non-org users can now reach the dashboard at `/app` without being redirected to the welcome page.

## [0.16.1] - 2026-03-20

### Fixed
- Removed unused `beforeEach` and `vi` imports from `checkin-token.test.ts`.
- Replaced `as any` casts with proper Prisma enum types (`ApplicationStatus`, `ShiftStatus`, `SignupStatus`, `CredentialStatus`) in `orgAnalyticsRepo.integration.test.ts`.
- Renamed unused `shift` variable to `_shift` in analytics integration test.
- Added `biome-ignore` directive for `$transaction` mock callback in `volunteerDiscoveryService.test.ts`.

## [0.16.0] - 2026-03-20

### Added
- **Sterling background check adapter** — Full Sterling integration with API key authentication (Bearer token), HMAC-SHA256 webhook signature verification, and `screening.completed` webhook processing. Sterling orgs connect by pasting their API key in admin settings (no OAuth dance).
- **Admin Sterling settings UI** — New SterlingConnectCard on the Credentials settings page with Account ID + API Key form, connect/disconnect flow, and connection status badge. Mirrors the Checkr card pattern.
- **Adapter registry** — `getAdapter(provider)` factory returns the correct adapter (Checkr or Sterling) based on the `BackgroundCheckProvider` enum, enabling provider-agnostic service code.
- **Provider-agnostic service layer** — Refactored `initiateBackgroundCheck` and `handleCheckrWebhookEvent` into shared `initiateProviderCheck` and `handleProviderWebhookEvent` functions. Both Checkr and Sterling use the same DRY business logic with injected adapters and credentials.
- **Sterling webhook idempotency** — Sterling webhooks now use the same `CheckrWebhookEvent` idempotency table as Checkr, preventing duplicate processing on retries.
- **Sterling adapter tests** — 22 unit tests covering all error classes, API responses (401/403/422/429/503/timeout), HMAC signature verification (valid/invalid/empty/missing secret/length mismatch), payload parsing, and OAuth stub 501s.
- **Adapter registry tests** — 3 tests verifying factory returns correct adapter for each provider.

### Changed
- Renamed `mapCheckrResultToStatus` → `mapResultToStatus` and `sanitizeCheckrPayload` → `sanitizeWebhookPayload` for provider-agnostic naming.
- `BackgroundCheckRequest.provider` now defaults dynamically based on the adapter used (previously hardcoded to `CHECKR`).

## [0.15.0] - 2026-03-20

### Added
- **Email delivery tracking** — New `EmailEvent` and `EmailBounceStatus` Prisma models track email delivery lifecycle events (sent, delivered, bounced, complained) via Resend webhooks.
- **Resend webhook handler** — `/api/resend/webhook` endpoint with HMAC-SHA256 signature verification, event logging, and automatic bounce suppression after 3 bounces. Mirrors Stripe/Checkr webhook error routing pattern (400/200/500).
- **Unified webhook health dashboard** — Admin health page now shows webhook activity cards for Stripe, Checkr, and Resend with per-type event counts over a configurable time window.
- **Email bounce management UI** — Admin can view suppressed addresses, re-enable individual addresses, or reset all suppressions (platform admin override). Critical emails (e.g., FCRA notices) bypass suppression.
- **Encryption key rotation** — Dual-key decryption support in `crypto.ts` with `CHECKR_TOKEN_ENCRYPTION_KEY_NEW` env var for zero-downtime key rotation. Includes `reEncrypt()` with roundtrip verification and `scripts/reencrypt-tokens.ts` batch migration script.
- **ESG integration tests** — 13 integration tests for employer report service covering shift aggregates, credential counts, distinct employee counts, and full report pipeline.
- **Resend webhook tests** — 8 unit tests for the webhook handler covering event routing, bounce management, suppression cap, and error paths.
- **Email send tests** — Updated from 2 to 6 tests covering bounce suppression, critical email bypass, and SENT event logging.
- **Crypto rotation tests** — 7 new tests for dual-key fallback, primary key preference, reEncrypt roundtrip, and rotation key validation.

### Fixed
- Integration test env var loading — Vitest 4 forked workers now receive `DATABASE_URL` via config-level dotenv import.
- Credential seeding in `orgAnalyticsRepo.integration.test.ts` — rotating credential types to avoid unique constraint violations.

## [0.14.0] - 2026-03-20

### Added
- **Org Health Score Widget** — Dashboard greeting banner now shows a 0-100 health score based on four onboarding milestones (screener questions, published opportunities, shifts with signups, credentials issued). Contextual tips guide admins to the next milestone. Replaces the Getting Started Checklist.
- **Admin Activity Feed** — Dashboard shows the 20 most recent org events (applications, check-ins, credential issuances, shift completions, member invites) with contextual text from audit log metadata, relative timestamps, and date grouping.
- **Activity feed query tests** — 5 service-level tests verifying curated action type filtering, ordering, and actor inclusion.
- **Org health domain tests** — 8 unit tests covering all score combinations, tip priority order, and binary scoring behavior.

### Changed
- Dashboard page simplified: removed Getting Started Checklist, Recent Applications table, and onboarding wizard in favor of the Health Score Widget and Activity Feed.
- `MEMBER_INVITED` audit log now written when team members are invited, enabling activity feed visibility.
- `shift.completed` audit log now includes shift title in metadata for contextual feed display.
- Health score counts shifts with any non-cancelled signup status (`CONFIRMED`, `ATTENDED`, `NO_SHOW`) so scores don't regress after attendance is marked.

### Fixed
- Audit log write in `inviteMember` wrapped in try-catch so logging failures cannot break the invite flow.
- Activity feed group keys use ISO date strings instead of display labels, preventing React reconciliation issues across date boundaries.

## [0.13.4] - 2026-03-20

### Added
- **Shift auto-close cron** — Shifts past their endTime are automatically marked COMPLETED by a new hourly cron (`/api/cron/shift-auto-close`), triggering thank-you notifications and session summary emails.
- **Concurrent-safe shift completion** — `completeShift()` now checks current status atomically, preventing a race where auto-close could overwrite an admin's cancellation.
- **Activity feed indexes** — Composite indexes on `AuditLog(orgId, createdAt)` and `Shift(status, endTime)` for fast dashboard queries and cron lookups, created with `CONCURRENTLY` for zero-downtime.

### Changed
- `completeShift()` actorId is now nullable (`string | null`) so the auto-close cron can call it without an actor.
- Bulk import service uses `waitUntil()` from `@vercel/functions` instead of fire-and-forget `void`, keeping the serverless function alive until processing completes.

### Fixed
- Shift completion is now truly race-free — uses atomic `updateMany` with status WHERE clause instead of separate read+write.
- Shift auto-close cron processes oldest expired shifts first (`orderBy: endTime asc`) instead of non-deterministic planner order.
- `shifts.complete` tRPC mutation now throws `CONFLICT` error when shift status guard blocks, instead of silently returning null (which caused a false "success" toast).

## [0.13.3] - 2026-03-20

### Added
- **Digest cron cursor persistence** — Email digests now paginate through users in batches of 100 with cursor tracking via CronJobRun, preventing Vercel 300s timeouts at scale.
- **Per-type email preference filter** — Digest emails now respect per-notification-type email opt-outs (NotificationPreference.email=false).
- **Timezone-aware notification delivery** — Organizations can set an IANA timezone; digest emails and shift reminders are delivered at local morning time (8am and 6am respectively) instead of a fixed UTC hour. Crons now run hourly.
- **Organization timezone setting** — Staff can configure org timezone from Team Settings with a searchable dropdown of all IANA timezones.
- **Volunteer re-engagement emails** — Inactive volunteers receive automated outreach at 30, 60, and 90 days of inactivity. The 60-day email includes org-scoped published opportunities. Each segment fires once per member-org pair; activity resets the cycle.
- **Activity tracking** — Shift signups and application submissions now update OrganizationMember.lastActivityAt for re-engagement targeting.
- **Backfill script** — `pnpm backfill:activity` populates activity timestamps from historical shift signups and volunteer applications.

### Changed
- Shift reminder and email digest crons now run hourly to deliver notifications at the right local time for each timezone.
- Shift reminder emails now display times in your organization's timezone instead of UTC.
- Timezone picker upgraded from a flat 419-item dropdown to a searchable combobox — type to filter (e.g., "new york").

### Fixed
- Timezone selector no longer crashes the Team Settings page (Radix Select empty-string value error).

## [0.13.2] - 2026-03-20

### Fixed
- **iOS PWA install prompt** — iOS Safari users now see a banner prompting them to add the app to their home screen via Share → "Add to Home Screen." Previously no install prompt appeared because iOS doesn't support the `beforeinstallprompt` API.
- **PWA manifest PNG icons** — Added PNG icons (180px, 192px, 512px) alongside existing SVGs. iOS Safari ignores SVG icons in the manifest, causing broken home screen icons.
- **Apple web app meta tags** — Added `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`, and `apple-touch-icon` metadata for proper iOS standalone app behavior.
- **iOS browser detection** — Install prompt only appears in Safari (not Chrome, Firefox, Edge, Opera, or in-app webviews like Facebook/Instagram) since only Safari supports "Add to Home Screen."
- **localStorage safety** — Wrapped localStorage calls in try/catch to prevent errors in privacy mode or enterprise-locked browsers.

## [0.13.1] - 2026-03-19

### Added
- **Phase 10 plan: Scale & Enterprise Readiness** — 15 deliverables to make the platform trustworthy at scale and open the enterprise door: Sterling background check adapter, encryption key rotation, timezone-aware notifications, org health score, email delivery tracking, admin activity feed, shift auto-close, and production reliability fixes. Triple-reviewed (CEO, Eng, Design) with full design specs and deployment sequence.

## [0.13.0] - 2026-03-20

### Added
- **QR-based volunteer check-in** — Staff scan volunteer QR codes at events for fast attendance tracking. HMAC-SHA256 stateless tokens with 5-minute rotation, rate limiting (120/min per org), and multi-tenant orgId enforcement.
- **Staff scanner page** (`/app/scan`) — Dashboard-first layout with shift auto-selection, live stats bar, camera viewfinder, inline result card with haptic feedback, and search-by-name a11y fallback. Keyboard shortcuts: `/` focuses search, `Esc` returns to camera.
- **Volunteer QR display** — QR code on my-shifts page for CONFIRMED signups within 24h. Auto-refresh every 5 min with countdown timer, contextual copy (before/during/after shift), and check-in status polling with QR→checkmark transition.
- **PWA support** — Web app manifest, service worker with cache-first static assets and network-first API, install prompt (sand-toned inline card on mobile), and SW update banner.
- **Offline QR codes** — 10-minute token prefetch to localStorage with "Offline" badge and expiry warning.
- **Geo-fenced auto check-in** — Automatic check-in when volunteer is within 100m of shift location using Geolocation API + haversine distance calculation. New `latitude`/`longitude` fields on Shift model.
- **Real-time check-in counter** — Live progress bar in shift detail dialog, polling every 10s only when shift is within ±2h.
- **Post-shift thank-you notifications** — `SHIFT_COMPLETED` notification type. When a shift is completed, each ATTENDED volunteer gets a notification with their hours logged and total hours.
- **Session summary email** — Org admins receive an email with attended count, no-shows, and attendance rate when a shift is completed. HTML-escaped shift titles prevent injection.
- **Check-in analytics** — Method breakdown (QR/manual/geo) and busiest check-in hours on the analytics page using existing FunnelCard/StatCard patterns. COALESCE handles pre-QR audit entries.
- **QR color customization** — Orgs can set a custom QR foreground color with WCAG contrast validation (>=3:1 against white).
- **Check-in integration tests** — 28 new test cases covering markAttendance (method metadata, idempotency, cancelled-user rejection, FOR UPDATE locking), completeShift (notifications, email, HTML escaping), getCheckinStats, and getCheckinAnalytics (method breakdown, COALESCE, date filtering, org isolation).

### Fixed
- **Cancelled user check-in** — markAttendance now rejects check-in if signup status is not CONFIRMED or ATTENDED, preventing tokens obtained before cancellation from being used.
- **Audit log duplication** — Added `FOR UPDATE` row lock in markAttendance to prevent concurrent scans from writing duplicate audit entries.
- **N+1 query in completeShift** — Batched per-volunteer total-hours query into single SQL with `ANY()` instead of sequential queries.
- **HTML injection in shift summary email** — Shift titles are now escaped before interpolation into email HTML.
- **Offline QR cache corruption** — JSON.parse of localStorage wrapped in try-catch with cache purge on corruption.

## [0.12.3] - 2026-03-19

### Fixed
- **Vercel build failure** — Removed `pnpm seed` from the build command. Seeding during every deploy caused failures when `seed-dev.js` couldn't be resolved in production. Seeding is now a manual step (`pnpm seed:production`).
- **Seed script ESM resolution** — Replaced `ts-node` with `tsx` for all seed scripts. `ts-node` failed on Node 24 with ESM module resolution errors (`ERR_MODULE_NOT_FOUND` for `.js` imports).
- **Seed dotenv loading** — Updated `seed-helpers.ts` to match Next.js dotenv loading order (`.env.{NODE_ENV}.local` → `.env.local` → `.env.{NODE_ENV}` → `.env`). Previously only loaded `.env`, missing `DATABASE_URL` from `.env.local`.

### Changed
- **Removed `ts-node` dependency** — Replaced by `tsx` which handles TypeScript + ESM natively without configuration.
- **Documented seed commands** — Added `pnpm seed`, `pnpm seed:production`, and `pnpm seed:dev` to CLAUDE.md with usage notes.

## [0.12.2] - 2026-03-19

### Added
- **Privacy policy page** — Comprehensive `/privacy` page covering data collection, storage, security, sharing, retention, cookies, user rights, and children's privacy. Includes third-party service disclosure table (Google OAuth, Stripe, Checkr, Resend, Sentry, Vercel Analytics, Upstash Redis) and version history.
- **Terms of service page** — Full `/terms` page with 15 sections covering acceptance, service description, accounts, org/volunteer responsibilities, background checks, billing, IP, acceptable use, termination, disclaimers, liability, governing law, and contact.
- **Cookie consent banner** — GDPR-compliant cookie consent banner with essential (always on) and analytics (opt-in) categories. Expandable preferences panel with per-category toggles. Persists choice to localStorage.
- **Consented analytics** — `<ConsentedAnalytics>` component gates Vercel Analytics behind cookie consent. Listens for consent changes via custom event. Resets to disabled when consent is cleared.

### Changed
- **Seed file refactor** — Split monolithic `prisma/seed.ts` (2,191 lines) into four files: `seed-helpers.ts` (shared Prisma client, types, upsert helpers), `seed-production.ts` (platform org + skill catalog only), `seed-dev.ts` (full demo data + test accounts), and `seed.ts` (thin dispatcher based on NODE_ENV). Added `seed:production` and `seed:dev` npm scripts.
- **Cookie consent hardening** — Added localStorage shape validation to prevent corrupted JSON from permanently suppressing the consent banner. Added try/catch around localStorage writes for private browsing compatibility. Fixed analytics state not resetting when consent key is removed.

## [0.12.1] - 2026-03-19

### Fixed
- **Design system compliance** — Removed decorative floating circles from login page and colored left-border from employer differentiators (AI Slop Blacklist violations). Replaced `transition-all` with explicit `transition-[transform,opacity]` per DESIGN.md motion rules.
- **Typography consistency** — Added `font-display` (Fraunces) to `PageHeader` component and 5 inline h1 elements across dashboard, billing, company, and opportunity pages. Previously used system font instead of design system serif.
- **Welcome page mobile layout** — Restructured role-selection cards to stack content and button vertically, preventing text overflow and button overlap on small screens.
- **Nav bar mobile overflow** — Added responsive max-width and truncation to org/company switcher components to prevent long names from breaking the header layout on mobile.

## [0.12.0] - 2026-03-19

### Added
- **Phase 9: Production-Ready Infrastructure** — Cron job framework (`withCronAuth` wrapper with `CronJobRun` recording), shift reminder emails (24hr before, CONFIRMED signups only), credential expiry notifications (7-day advance warning for share tokens), Stripe webhook reconciliation admin tool.
- **Phase 9: Activation Features** — Application status timeline for volunteers, getting-started checklist for new org admins, first-volunteer celebration notification, onboarding wizard (4-step guided setup modal).
- **Phase 9: Email Digests** — Daily/weekly notification digest emails with `UserDigestPreference` model, notification preferences UI on profile page, digest cron job.
- **Phase 9: Bulk Import** — CSV bulk import for volunteer applications with progress tracking, duplicate detection, error reporting, and `BulkImportJob` model.
- **Phase 9: Admin Dashboard** — Cron health monitoring page at `/app/admin/health` with per-job status, consecutive failure alerting, and recent run history.
- **Marketing screenshots** — 6 product screenshots (dashboard, screener, shifts, credentials, ESG, profile) in `public/marketing/`.
- **Platform admin procedure** — `platformAdminProcedure` tRPC middleware for platform-wide admin routes.

### Fixed
- **Cron health failure counting** — Fixed bug where `break` statement in admin router exited the entire loop instead of just settling one job, causing incorrect consecutive failure counts.
- **HTML injection in email templates** — Added `escapeHtml()` to shift reminder and share token expiry email services to prevent XSS from user-controlled org names and shift titles.
- **Cron route test** — Updated expire-credentials test to mock prisma and share-token-expiry-service imports added in Phase 9.

## [0.11.1] - 2026-03-19

### Changed
- **Email consolidation** — All transactional emails now use the same branded template and delivery pipeline. Migrated 7 email senders to the shared `sendEmail()` helper (FCRA emails excluded for legal compliance).
- **Notification cleanup** — Dismissed notifications older than 90 days are automatically purged by the daily cron job, keeping inboxes clean.
- **PlanGate component** — Features behind higher plan tiers now show a polished lock card with upgrade CTA instead of being silently hidden. Replaces inline upgrade prompts in analytics.
- **Top volunteers date range** — The "Top Volunteers" leaderboard on the analytics dashboard now respects your selected date range (30d, 90d, 1y, all-time) instead of always showing all-time.

### Fixed
- **Accessibility audit** — Added `aria-label` to icon-only buttons on shifts page, `aria-hidden` on decorative icons (notification bell, shift actions), `aria-pressed` on analytics date toggle, and converted analytics date range from `div[role=group]` to semantic `<fieldset>`.

### Removed
- Dead `src/components/app/plan-gate.tsx` (superseded by `src/components/plan-gate.tsx`).

## [0.11.0] - 2026-03-18

### Added
- **Shift templates** — Staff can create recurring shift templates (day of week, time range, capacity) and generate concrete shifts from them for N weeks at a time. Templates are plan-gated to STARTER+.
- **Waitlist for full shifts** — Volunteers can join a waitlist when a shift is at capacity. When a confirmed volunteer cancels, the earliest waitlisted volunteer is auto-promoted (FIFO) with an in-app notification and audit trail.
- **Templates tab on Shifts page** — New "Templates" tab on the admin shifts page with full CRUD: create, edit, delete, and "Generate N Weeks" workflow.
- **Waitlist UI** — Staff see a waitlist section in the shift detail dialog. Volunteers see "Waitlisted" badges and "Leave Waitlist" actions on My Shifts.
- **Delete confirmations** — Shift and template delete buttons now require a confirmation dialog before proceeding.
- **Shared `requireUserId` utility** — Extracted duplicated auth helper from 6 tRPC routers into a single shared function in `trpc/init.ts`.

### Changed
- My Shifts page now uses `EmptyState` component with warm design system styling and a "Browse Opportunities" CTA.
- Shift create form and template create form use `Checkbox` component instead of native HTML input.

### For contributors
- `ShiftTemplate` Prisma model with org FK, opportunity FK, and indexes
- `WAITLISTED` added to `SignupStatus` enum
- `shiftTemplateRepo.ts` — template CRUD + bulk shift creation
- `shiftTemplateService.ts` — business logic with audit logging and time validation
- `shiftSignupService.ts` — `joinWaitlist()`, `leaveWaitlist()`, auto-promote in `cancelSignup()`
- `shift-templates.ts` tRPC router — `list`, `create`, `update`, `remove`, `generate` procedures
- 38 new tests: domain validation (17), waitlist service (10), template service (11)

## [0.10.0] - 2026-03-18

### Added
- **In-app notifications** — A notification bell in the app header shows unread notifications with infinite scroll. Notifications are scoped per-user and per-org, with real-time unread counts (30s polling) and mark-read/mark-all-read actions.
- **Plan gate component** — Features gated behind higher plan tiers show a branded lock card with the required tier and an upgrade CTA, instead of being silently hidden.
- **Shared `sendEmail()` helper** — A single entry point for all outbound email, wrapping Resend with branded HTML templates and error logging. New Phase 8 emails use this; existing emails will migrate in a follow-up.
- **Notification preferences model** — Per-user, per-org, per-notification-type preferences for in-app and email delivery channels (schema + migration ready, UI in a future PR).
- **`maxShiftTemplates` plan limit** — Plan-tier limits now include shift template caps (FREE: 0, STARTER: 10, PRO: unlimited).

### For contributors
- `Notification` + `NotificationPreference` Prisma models with soft delete, indexes, and cascade deletes
- `notificationRepo.ts` — CRUD with `deletedAt IS NULL` filtering and cursor-based pagination
- `notificationService.ts` — `notify()` (checks preferences), `tryNotify()` (fire-and-forget wrapper)
- `notifications.ts` tRPC router — `list`, `unreadCount`, `markRead`, `markAllRead` procedures
- `NotificationBell` component — Popover with infinite scroll, empty state, unread dot indicators
- `PlanGate` component — Tier comparison with lock icon, warm neutral background, upgrade button
- 20 new unit tests covering notification domain functions and sendEmail helper

## [0.9.0] - 2026-03-18

### Added
- **Branded email template** — All transactional emails (invitations, FCRA notices, credential notifications, billing) now use a consistent VolunteerReady-branded template with forest green header, warm neutral footer, and brand-colored buttons.
- **Billing lifecycle emails** — Org and company owners now receive transactional emails for plan upgrades, payment failures, and subscription cancellations. Emails are fire-and-forget (never crash the Stripe webhook handler).
- **Credential & token expiry cron** — A daily Vercel Cron job (03:00 UTC) automatically marks expired credentials as EXPIRED and cleans up stale share tokens, with per-record transactions and full audit logging.
- **Single source of truth for credential labels** — Credential display names and icons are now consolidated into shared constants, eliminating three duplicate maps across the codebase.

### For contributors
- **`buildEmailHtml()`** (`src/server/lib/email-template.ts`) — branded email wrapper matching DESIGN.md colors
- **`send-billing-emails.ts`** — three billing email senders: upgrade, payment failed, cancellation
- **`trySendBillingEmail()`** in `billingService.ts` — fire-and-forget helper resolving owner email for org/company entities
- **`credential-expiry-repo.ts`** — queries for expired credentials and share tokens
- **`credential-expiry-service.ts`** — batch expiry with P2025 (concurrent modification) handling
- **`/api/cron/expire-credentials`** — Vercel Cron route with `CRON_SECRET` bearer auth
- **`src/lib/credential-meta.ts`** — shared `CREDENTIAL_META` constant with labels + icons
- **22 new tests** — 7 billing email dispatch tests, 5 credential expiry service tests, 5 cron route tests, plus coverage across existing test files
- **`findOrgWithOwnerEmail`** / **`findCompanyWithOwnerEmail`** — owner email lookup helpers in orgRepo/companyRepo

## [0.8.0] - 2026-03-18

### Added
- **Platform-wide rate limiting** — Upstash Redis-based rate limiting protects key endpoints: volunteer discovery search (60/min per org), credential generation (5/min per user), credential claims (10/min per org), token info lookups (30/min per IP), and application submissions (3/min per IP). Fails open if Redis is unavailable so outages never block users.
- **Volunteer discovery is now available to all staff** — removed the `VOLUNTEER_DISCOVERY_ENABLED` feature flag gate; rate limiting replaces it as the abuse prevention mechanism.

### For contributors
- **`rate-limit.ts`** — lazy-initialized Upstash Redis singleton with cached `Ratelimit` instances per config; fail-open on errors
- **`rate-limit-middleware.ts`** — three tRPC middleware factories: `rateLimitByOrg`, `rateLimitByUser`, `rateLimitByIp`
- **IP extraction** — `createTRPCContext` now extracts client IP from `x-forwarded-for` / `x-real-ip` headers
- **18 new tests** — 9 for rate-limit lib (caching, fail-open, passthrough) + 9 for middleware (pass/block/missing-identifier for all 3 factories)

## [0.7.3] - 2026-03-18

### Added
- **Org Analytics Dashboard** (`/app/analytics`) — You can now see at a glance how your volunteer program is performing: application funnel (submitted → approved → shifted → credentialed), retention rate, average shift fill rate, and your top volunteers by hours; switch between 30-day, 90-day, 1-year, or all-time views. Available on the PRO plan — free orgs see a one-click upgrade prompt.
- **Analytics nav link** — "Analytics" appears in the staff sidebar navigation for easy access.

### For contributors
- **`orgAnalyticsRepo`** — raw SQL aggregate queries using parameterized `Prisma.sql` template literals; 4 functions: `getApplicationFunnel`, `getRetentionStats`, `getAvgFillRate`, `getTopVolunteers`
- **`orgAnalyticsService`** — orchestrates all 4 analytics queries in parallel via `Promise.all`; all-time queries use epoch date as `fromDate` and skip retention (undefined for all-time)
- **`analytics` tRPC router** — `getDashboard` procedure under `planTierProcedure('PRO')`; non-PRO orgs receive FORBIDDEN and see an upgrade prompt
- **Unit tests** (`orgAnalyticsService.test.ts`) — 11 unit tests covering date computation, retention skipping for all-time, parallel execution, and result assembly
- **Integration tests** (`orgAnalyticsRepo.integration.test.ts`) — 20 integration tests covering all 4 repo functions with real Postgres; tests include org isolation, date filtering, empty-org edge cases, and status filtering

## [0.7.2] - 2026-03-18

### Fixed
- **Security** — `getOrgVisibleProfile` tRPC procedure changed from `protectedProcedure` to `staffProcedure`; previously any authenticated volunteer could query another volunteer's ORGS_ONLY profile
- **SEO dedup** — `getPublicProfile` wrapped with `React.cache()` so `generateMetadata` and the page component share a single fetch (was 8 DB queries per page load, now 4)
- **Test reliability** — reverted module-level platform org ID cache in `tenureBadgeService`; the cache persisted `null` across test cases when the "org not found" test ran first, silently breaking 4 tenure badge issuance tests

## [0.7.1] - 2026-03-18

### Added
- **Volunteer discovery** (`/app/discover`) — org staff can search across all PUBLIC volunteer profiles by skills, credential types, city, state, and availability; results sorted by verified credential count; cursor-based pagination (20 per page); feature-flagged behind `VOLUNTEER_DISCOVERY_ENABLED` env var
- **Invite to Apply** — staff can invite any discovered volunteer to apply to a specific opportunity; rate-limited to 10 invitations per org per 24 hours with a TOCTOU-safe atomic transaction guard; duplicate invitations (same org + volunteer + opportunity) are rejected at the DB level
- **`volunteerDiscoveryRepo`** — privacy-first search repo with `visibility = PUBLIC` hardcoded (not caller-supplied); cursor-based pagination; filters on skills, credential types, location, availability
- **`volunteerDiscoveryService`** — orchestrates search + invite; rate limit check + already-applied check + invitation create wrapped in `prisma.$transaction()` for atomicity
- **`discovery` tRPC router** — `searchVolunteers` and `inviteToApply` procedures under `staffProcedure`
- **`sendInviteToApplyEmail`** — invite email sent to volunteers (fire-and-forget; email failures are logged, never surfaced to caller)
- **Navigation** — "Discover" link in staff nav (hidden when feature flag is off)

### Fixed
- **Rate-limit TOCTOU** — count + already-applied check + create now execute in a single `$transaction`, preventing concurrent requests from both passing the rate check before either creates a record
- **`actorId` audit log** — `staffProcedure` guarantees an active session; removed the `?? ''` fallback that could silently corrupt audit records

### For contributors
- `src/server/repositories/volunteerDiscoveryRepo.ts` — new; `searchPublicProfiles` always hardcodes `visibility = 'PUBLIC'` (structural privacy invariant, not injected by callers)
- `src/server/services/volunteerDiscoveryService.ts` — new; 10 unit tests in `volunteerDiscoveryService.test.ts`
- `src/server/trpc/routers/discovery.ts` — new; registered in `root.ts` as `discovery`
- `src/app/(app)/app/discover/page.tsx` — new; uses `VOLUNTEER_DISCOVERY_ENABLED` env var gate

## [0.7.0] - 2026-03-17

### Added
- **Tenure badge auto-issuance** — milestone credentials (`TENURE_1YR`, `TENURE_3YR`, `TENURE_5YR`) are now issued automatically when a volunteer crosses a tenure threshold; triggered on shift signups, application submissions, and credential issuance
- **Share your volunteer card** button on the credentials tab of `/app/profile` — opens the volunteer's public `/v/[userId]` page in a new tab

### Fixed
- **Tenure badge idempotency** — concurrent badge issuance (P2002) and unexpected errors are swallowed; parent operations (signups, applications, credentials) never fail due to badge issuance
- **Anonymous application submissions** no longer attempt a tenure check (no userId available)

### For contributors
- `tenureBadgeService.checkAndIssueTenureBadges(userId)` — fire-and-forget service, called from `shiftSignupService`, `volunteer-screening`, and `volunteerCredentialService`
- `profile.getMyUserId` tRPC procedure for client-side userId access
- `MS_PER_YEAR` constant exported from `volunteer-profile.ts` domain module (used by `computeTenure` and `tenureBadgeService`)

## [0.6.1] - 2026-03-17

### Changed
- **Matching bonus constant** — extracted magic number `5` into named constant `CONTEXT_BONUS` in `volunteer-matching.ts` for clarity

## [0.6.0] - 2026-03-17

### Added
- **Public volunteer identity page** (`/v/[userId]`) — SEO-optimized profile showing verified credentials, total volunteer hours, distinct org count, tenure badge, and reliability score; respects visibility settings (PUBLIC only on internet)
- **OG share card** (`/api/share-card/[userId]`) — 1200×630 social share image with Fraunces display font, forest green header, and sand stat boxes; generic fallback for non-public profiles
- **Volunteer identity panel** on the application screener page — org staff see a volunteer's credentials, hours, and reliability score inline when reviewing applications; respects ORGS_ONLY visibility (authenticated screeners see both PUBLIC and ORGS_ONLY profiles)
- **`computeTenure()`** domain function — calculates 1YR/3YR/5YR tenure level from earliest activity record
- **`computeReliabilityScore()`** domain function — 0–100 score (40% attendance, 30% credentials, 20% tenure, 10% recency); returns null when no past shifts exist
- **Matching engine context bonuses** — +5 for availability alignment, +5 for verified credential match (additive tiebreakers; capped at 100, don't affect PERFECT/PARTIAL classification)
- **Tenure credential types** — `TENURE_1YR`, `TENURE_3YR`, `TENURE_5YR` enum values added for system-issued milestone badges
- **`VolunteerInvitation` table** — tracks org-to-volunteer invitations with rate-limiting unique constraint (`orgId, volunteerId, opportunityId`)
- **Platform org** seeded (`slug: platform`) as the issuer for system-level tenure credentials
- **`getAttendedShiftsForUser` + `getSignupsForReliability`** repo functions for computing volunteer hours and reliability input data
- **`getOrgVisibleProfile`** service function — identical to `getPublicProfile` but also serves ORGS_ONLY profiles for authenticated org screeners

### Fixed
- **Reliability denominator** — CONFIRMED (upcoming) signups excluded from attendance rate; only past ATTENDED + NO_SHOW shifts count, preventing active volunteers with future commitments from appearing unreliable
- **ORGS_ONLY visibility gap** — volunteers who set visibility to ORGS_ONLY now correctly appear in the org screener identity panel (previously showed nothing)

## [0.5.2] - 2026-03-17

### Added
- **ESG Report PDF Export** — corporate admins can now download a branded PDF of the ESG Volunteer Impact Report with company header, summary stats, and per-organization breakdown table styled with the VolunteerReady design system
- **PDF export button** on the corporate team dashboard (`/app/company/[companyId]/team`) next to the existing CSV export
- **Bundled Fraunces + Geist fonts** for server-side PDF rendering (Vercel-compatible, no runtime font fetches)
- **Corporate company seed data** — Acme Corporation (PRO plan) with OWNER/ADMIN members and two linked nonprofits for local QA testing

### Fixed
- **AI slop removal** — replaced blacklisted 3-column icon-in-colored-circle feature grid on homepage with left-aligned stacked list per DESIGN.md
- **Touch targets** — footer links, "Learn more" buttons, and logo links in header/footer now meet 44px minimum per DESIGN.md
- **Unused type property** — removed dead `companyId` from `SessionExt` in PDF export route

## [0.5.0] - 2026-03-16

### Added
- **Full public site rewrite** — every marketing page now sells the complete platform (matching, background checks, portable credentials, shift scheduling, ESG reporting) instead of just early features
- **"For Employers" landing page** (`/for-employers`) — corporate buyers can now see ESG reporting, employee volunteering, nonprofit partnerships, and background check features at a glance
- **"Security & Compliance" page** (`/security`) — encryption, FCRA compliance, multi-tenant isolation, RBAC, audit logging, and data portability — all in one place for procurement teams
- **Shared marketing components** — `PublicHero`, `CTABanner`, `FadeInOnScroll`, and `TrackedLink` give all public pages a consistent, polished look
- **Live platform stats on homepage** — real aggregate counts (organizations, credentials, shifts, volunteers) with ISR (1-hour revalidation) and graceful fallback when the database is unavailable
- **Pricing comparison table** — 11-row feature comparison across Free / Starter / Pro tiers, powered by the same `getPlanLimits()` data the app uses
- **CTA click tracking** — every marketing page link is tracked via Vercel Analytics for conversion insights
- **Scroll-triggered animations** — subtle fade-in effects that respect `prefers-reduced-motion`
- **Per-page SEO metadata** — Open Graph tags on every public page for better social sharing
- **Design system** — `DESIGN.md` defines the Organic/Natural aesthetic, Fraunces + Geist typography, warm color palette, spacing, motion, and an AI slop blacklist

### Changed
- Rewrote homepage, for-volunteers, for-nonprofits, pricing, how-it-works, and about pages with specific, active-voice copy
- Removed SVG blob decorations from all pages — the design system blacklists generic AI aesthetic patterns
- How-it-works now walks three audiences through their journey (volunteers, nonprofits, and employers)
- About page shows "What we've built so far" milestones so visitors see a mature, shipping product
- Added "Pricing" to the main navigation header
- Footer now includes For Employers column, plus Pricing and Security links

## [0.4.0] - 2026-03-16

### Added
- **Corporate ESG reporting dashboard** — see aggregate volunteer impact across all linked nonprofits: employees active, organizations supported, shifts completed, total hours, and verified credentials with a per-org breakdown table at `/app/company/[companyId]/team`
- **CSV export** — download the full ESG report as a CSV file, with formula injection defense built in
- **PRO plan gate** — ESG features require a PRO company plan; FREE plan users see an upgrade prompt with a direct link to billing
- **Date range filtering** — narrow the report to a specific time window with from/to date inputs
- **Credential-only orgs included** — nonprofits where employees hold verified credentials but haven't attended shifts still appear in the report
- **Cross-org employee deduplication** — the "Employees Active" count correctly handles employees who volunteer at multiple linked nonprofits
- **ESG Report sidebar link** — quick access to the ESG dashboard from the company navigation
- **`companyPlanTierProcedure`** — new tRPC middleware factory for company-context plan enforcement (mirrors org-context `planTierProcedure`)
- **22 domain unit tests** covering report computation, CSV formatting, formula injection defense, and input validation

### For contributors
- `esg-report.ts` domain module: `ESGOrgRow`, `ESGReportSummary` types, `computeESGSummary()`, `escapeCsvField()`, `formatESGCsv()`, `esgReportInputSchema`
- `companyRepo.ts`: 4 new functions — `getCompanyPlanTier`, `getESGShiftAggregates` (5-table raw SQL join), `getESGCredentialCounts`, `getESGDistinctEmployeeCount`
- `employerReportService.ts`: `generateESGReport()` (parallel queries via `Promise.all`, bidirectional merge, audit log with await+catch), `generateESGCsvExport()`
- `esg-report` tRPC router with `getSummary` procedure gated on `companyPlanTierProcedure('PRO')`
- CSV route handler with inline auth (membership + ADMIN role + PRO plan tier)
- P2 TODO added for ESG report integration tests (raw SQL queries)

## [0.3.0] - 2026-03-17

### Added
- **Portable credential sharing** — volunteers can generate time-limited share links for their verified credentials. Org staff claim the link to import the credential without re-verification
- **Credential wallet** on the volunteer profile page — tabbed UI (Profile + Credentials) with share link generation, copy-to-clipboard, token expiry countdown, and revoke functionality
- **Credential claim page** at `/credentials/claim/[token]` — public page showing credential type, issuing org, and expiry with a one-click claim button for staff
- **"Bring my credentials" checkbox** on the volunteer apply form — auto-shares all verified credentials with the org at application time (volunteer opt-in)
- **Credential request from staff** — application detail page shows how many verified credentials a volunteer has at other orgs, with a button to send an email asking the volunteer to share
- **Shared token utility** (`src/server/lib/tokens.ts`) — DRY refactor of token generation and SHA-256 hashing used across invitations, status tokens, and credential share tokens
- **Claim notification email** — volunteers receive an email when their shared credential is claimed by an org (fire-and-forget, outside transaction)
- **Credential sharing request email** — staff can ask volunteers to share credentials via email with a direct link to their profile

### Fixed
- Radix UI hydration mismatch on the account dropdown — deferred DropdownMenu rendering to client-only to eliminate SSR/client ID mismatches

### For contributors
- `CredentialShareToken` model with SHA-256 hashed token storage, P2002 collision retry, and optimistic lock on claim
- `ShareTokenStatus` enum: ACTIVE → CLAIMED / EXPIRED
- `credential-sharing.ts` domain module: `canShareCredential()`, `canClaimToken()` (6 guards), `computeTokenExpiry()`, `tokenDaysRemaining()`
- `credentialShareService.ts`: `generateShareToken()`, `claimShareToken()`, `revokeShareToken()`, `shareAllOnApply()`, `requestCredentialSharing()`
- `credentialSharing` tRPC router: generate, listMyTokens, revoke (protected); getTokenInfo (public); claim, externalCredentialCount, requestSharing (staff)
- 23 domain unit tests for credential sharing logic
- New shadcn/ui components: Tabs, Checkbox
- Seed data extended with 3 share token scenarios (claimed, active, expired) and provenance credential

## [0.2.3] - 2026-03-16

### Added
- **FCRA adverse action workflow** — staff can now send pre-adverse notices, wait the required 5-day period, and finalize adverse actions for CONSIDER background check results. Volunteers receive legally-compliant emails with their FCRA rights and Checkr contact info
- **FCRA action buttons** on the background check table — one-click Pre-Adverse Notice, Finalize Adverse Action, and Issue Credential buttons appear on CONSIDER rows based on the current FCRA state
- **Checkr token encryption** — OAuth access tokens are now encrypted at rest using AES-256-GCM. Existing plaintext tokens are decrypted transparently (zero-downtime migration)
- **Shared email client** — all email sending now uses a single lazy-initialized Resend instance, fixing build-time errors when the API key isn't configured

### Fixed
- Concurrent FCRA actions can no longer send duplicate legally-significant emails — all status transitions use atomic database guards

### For contributors
- `FcraStatus` state machine: NONE → PRE_ADVERSE_SENT → ADVERSE_ACTION_SENT / RESOLVED (see `src/server/domain/background-check.ts`)
- Encryption utilities: `encrypt()`, `decrypt()`, `tryDecrypt()` in `src/server/lib/crypto.ts`
- New env var required: `CHECKR_TOKEN_ENCRYPTION_KEY` (64 hex chars / 32 bytes)

## [0.2.2] - 2026-03-16

### Fixed
- `handleConnect()` in `CheckrConnectCard` now shows an error toast when `getCheckrOAuthUrl` fails (e.g. `CHECKR_CLIENT_ID` not configured) instead of silently doing nothing
- Checkr webhook now returns 400 (not 500) when `CHECKR_CLIENT_SECRET` env var is missing — `clientSecret` getter now throws `CheckrSignatureError` so the webhook error handler routes it correctly

## [0.2.1] - 2026-03-15

### Added
- **Checkr Partner API background check integration** — nonprofit staff can initiate criminal background checks on volunteers directly from `/app/credentials`
- **Per-org Checkr OAuth connect flow** — org admins connect their Checkr account via Partner OAuth; `checkrAccessToken` + `checkrAccountId` stored on `Organization`
- **`/api/checkr/oauth/callback`** — OAuth callback route with CSRF protection (state = orgId validated against authenticated session)
- **`/api/checkr/webhook`** — Checkr webhook handler with four-way error routing: bad signature → 400, duplicate event → 200, unknown reportId → 500 (retry), other → 500
- **`BackgroundCheckRequest` model** — tracks provider, volunteer, status, and sanitized webhook payload; `externalId` (Checkr report ID) is `@unique` for idempotency
- **`CheckrWebhookEvent` model** — idempotency table for webhook deduplication (mirrors `StripeWebhookEvent`)
- **Background check status machine** — `PENDING → COMPLETE | CONSIDER | FAILED | CANCELLED`; `COMPLETE` auto-issues `VolunteerCredential(BACKGROUND_CHECK, VERIFIED)`
- **`backgroundChecks` tRPC router** — `initiate` (PRO plan + STAFF), `listByOrg` (STAFF), `cancel` (STAFF), `getCheckrOAuthUrl` (ADMIN), `getCheckrStatus` (STAFF), `disconnectCheckr` (ADMIN)
- **`CheckrConnectCard` component** — shows connection status, Account ID, Connect/Disconnect buttons in credentials settings
- **`BackgroundCheckRequestsTable`** — lists org's background checks with status badges; Cancel action for PENDING checks
- **`InitiateBackgroundCheckDialog`** — two-step PII form (volunteer selector + firstName/lastName/email/dob/SSN); SSN field is `type="password"` with `autocomplete="off"`, never stored in DB
- **`canBackgroundChecks` plan limit** — `PRO` only; `FREE`/`STARTER` see upgrade tooltip on disabled button
- **`sanitizeCheckrPayload`** — strips known PII fields (ssn, dob, mother_maiden_name, etc.) before storing webhook payload in DB
- **FCRA adverse action notices** added to TODOS.md [P1] with full legal context
- **Checkr OAuth token encryption** added to TODOS.md [P2] (tokens currently stored plaintext)
- gstack developer skills checked into `.claude/skills/gstack`

### Changed
- `BackgroundCheckAdapter` interface updated for Partner API: `initiateCheck` now requires per-org `accessToken` param; `parseActionableWebhookPayload` returns `accountId` for webhook routing
- Checkr adapter uses `CHECKR_CLIENT_ID`/`CHECKR_CLIENT_SECRET` (Partner API) instead of `CHECKR_API_KEY`; webhook signatures verified with `client_secret` via `HMAC-SHA256` + `crypto.timingSafeEqual`
- `.env.example` updated to reflect Partner API env vars (`CHECKR_CLIENT_ID`, `CHECKR_CLIENT_SECRET`, `CHECKR_DEFAULT_PACKAGE`)
- `roleRank` exported from `src/server/trpc/init.ts` for use in router middleware

## [0.2.0] - 2026-03-14

### Added
- **Employer accounts** — `CompanyAccount` with role-based membership (OWNER/ADMIN/MEMBER), company creation flow, CompanySwitcher, and sidebar nav
- **Company–nonprofit linking** — companies can sponsor nonprofits via `CompanyNonprofitLink`; link/unlink from company dashboard
- **Company invitations** — email-based invite flow with SHA-256 token hashing, 48-hour expiry, email ownership verification, and concurrent-accept safety
- **Stripe billing integration** — Checkout sessions and Billing Portal for nonprofit plan upgrades (FREE/STARTER/PRO)
- **Stripe webhook handler** — idempotent event processing via `StripeWebhookEvent` unique constraint; 3-way error routing (400 bad sig, 200 duplicate, 500 retry)
- **Plan tier enforcement** — `planTierProcedure` factory gates tRPC procedures by subscription tier; `getPlanLimits` / `assertPlanAtLeast` pure domain functions
- **Public `/pricing` page** — nonprofit tier cards with feature limits derived from domain layer
- **`/app/billing`** — nonprofit billing management: current plan badge, trial countdown, Stripe Portal link
- **`/app/company`** — company dashboard with linked nonprofits list and team member invitations
- **`/invite/company/[token]`** — public company invite acceptance route
- New Prisma models: `CompanyAccount`, `CompanyMember`, `CompanyInvitation`, `CompanyNonprofitLink`, `StripeWebhookEvent`
- Billing fields on `Organization`: `planTier`, `stripeCustomerId`, `stripeSubscriptionId`, `trialEndsAt`
- `currentCompanyId` on `Session` (mirrors `currentOrgId` pattern)
- `companyId` on `AuditLog` for queryable company audit history

### Fixed
- NextAuth v4 database sessions do not pass `sessionToken` to the session callback — added `cookies()` fallback in `auth.ts` and DB-query fallback in `createTRPCContext` so `orgId`/`companyId` resolve correctly on all request types
- Concurrent invite acceptance race: P2002 on `CompanyMember(companyId, userId)` now returns `{ alreadyMember: true }` instead of surfacing a 500
- `createBillingPortalSession` "no Stripe customer" condition now throws `TRPCError BAD_REQUEST` instead of a plain `Error` that leaked raw message to clients
- Invite email body expiry string now uses `INVITE_EXPIRY_HOURS` constant instead of hardcoded `"48 hours"`
- Volunteer matching tests updated to reflect exact-ID semantics (skill matching uses Set membership on CUIDs, not case-insensitive name comparison)

## [0.1.0] - 2026-03-13

Initial release: volunteer screening, opportunity management, volunteer profiles, skill catalog, matching engine foundation.
