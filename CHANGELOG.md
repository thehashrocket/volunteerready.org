# Changelog

All notable changes to this project will be documented in this file.

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
