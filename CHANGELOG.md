# Changelog

All notable changes to this project will be documented in this file.

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
