# Architecture

This document explains the architectural intent of the VolunteerReady platform for human developers and coding agents.

VolunteerReady is a multi-tenant nonprofit platform that connects volunteers, nonprofits, and corporate employers. The tenant boundary is **Organization** for nonprofit data and **CompanyAccount** for corporate data.

---

# Architectural Principles

## Multi-tenant first

Every meaningful domain action must be scoped to an organization (or company).

Assumptions:

- one user may belong to multiple organizations and companies
- each organization has isolated data
- permissions are organization-specific
- features may be enabled per organization
- plan tier enforcement is server-side only

If new code ignores `orgId`, it is probably wrong.

---

## Layered design

Each layer has a single responsibility:

- UI renders state and collects input
- API validates requests and delegates work
- services implement workflows
- repositories perform persistence
- domain contains invariants and pure logic

---

# Repository Structure

```
src/
 ├─ app/                # Next.js App Router pages
 ├─ components/         # Reusable UI components
 │   ├─ ui/             # shadcn/ui primitives
 │   └─ app/            # Authenticated-shell components (app-shell, card-list, …)
 ├─ lib/                # Client-side utilities, constants, and React hooks
 │   └─ hooks/          # use-pending-ids, use-frozen-desktop-shell, use-media-query
 └─ server/
     ├─ domain/         # Pure types, invariants, functions (no framework code)
     ├─ repositories/   # Database access layer (Prisma only)
     ├─ services/       # Business logic and workflows
     ├─ trpc/           # API routers and procedures
     └─ lib/            # Shared utilities and adapters
         ├─ adapters/   # External service adapters (Checkr, etc.)
         ├─ crypto.ts   # AES-256-GCM encryption for secrets at rest
         └─ resend.ts   # Shared Resend email client (lazy singleton)

prisma/
 ├─ schema.prisma       # Database schema (source of truth)
 ├─ seed.ts             # Seed dispatcher (production vs dev based on NODE_ENV)
 ├─ seed-helpers.ts     # Shared Prisma client, types, and upsert helpers
 ├─ seed-production.ts  # Production seed (platform org + skill catalog)
 └─ seed-dev.ts         # Dev/staging seed (full demo data + test accounts)
```

---

## src/app

Routing and page composition.

Should not contain business logic.

---

## src/components

Reusable UI components and forms.

Should not contain database queries or workflow orchestration.

Two shared primitives are worth knowing before writing a staff surface, because both were
extracted after the hand-rolled version had been copied several times:

| Module | What it is |
|--------|-----------|
| `components/app/card-list.tsx` | `CardList` + `CARD_LIST` — the below-`lg` card counterpart of a staff data table. Never pass visibility utilities (`hidden`, `lg:hidden`) to it; those belong on a wrapper `div`, since they and `Card`'s own `flex` are both display utilities and tailwind-merge would drop one. |
| `lib/hooks/use-pending-ids.ts` | `usePendingIds()` — tracks which ROWS have a mutation in flight. Use it instead of `mutation.variables`, which describes only the most recent mutation and so disables at most one row however many requests are open. |

A table↔card switch is **pure CSS** — both trees render from the same array inside
`hidden lg:block` / `lg:hidden` wrappers. Gating layout on `useMediaQuery` paints the mobile
tree to every desktop user and swaps it after hydration.

---

## src/server/domain

Contains:

- domain types
- invariants
- pure functions (scoring, validation, state machine guards)

No framework or database logic.

Key files:

- `volunteer-screening.ts` — screening evaluation rules
- `volunteer-matching.ts` — skill matching and scoring (0-100)
- `volunteer-profile.ts` — profile completeness scoring
- `org-volunteer.ts` — roster invariants: `normalizeEmail()`, display-name/phone/email Zod schemas, page-size and cap constants, add-volunteer outcome types, and `MyOrgRelationshipReason` + `MY_ORG_RELATIONSHIP_COPY` (why an org appears on the volunteer's own list — wider than `OrgVolunteerSource`, since that enum describes a roster row and the list is no longer roster-only). Source copy is split by AUDIENCE, not shared: `ORG_VOLUNTEER_SOURCE_COPY` is second-person to the volunteer, `ORG_VOLUNTEER_SOURCE_COPY_STAFF` (v0.38.3.0) is the same enum told to the org's staff. Share the enum, never pronoun-bearing prose — both stay `Record`s so a third `OrgVolunteerSource` is a type error in both voices
- `shift.ts` — shift capacity, signup validation, attendance, hours math (`shiftDurationHours`, `sumAttendedHours`, `HOURS_DECIMAL_PLACES`)
- `notification.ts` — notification types and domain functions
- `background-check.ts` — FCRA state machine, PII sanitization
- `billing.ts` — plan tier limits, trial validation (includes `maxShiftTemplates`)
- `credential-sharing.ts` — share token lifecycle guards, expiry computation
- `csv.ts` — the repo's ONE CSV parser and writer: `parseCsvRecords` (RFC 4180 — quoted fields, embedded commas and newlines, `""` escapes, BOM, CRLF/LF/CR), `escapeCsvField` + the formula-injection defense, `toCsvLine`, and `unescapeCsvField` (the inverse, because our own export is an input to our own importer). Consumers: ESG export, roster export, roster import
- `esg-report.ts` — ESG report types, `computeESGSummary`, `formatESGCsv`. Re-exports `escapeCsvField` from `csv.ts`; the escaping and formula-injection defense moved there when the roster export became their second consumer
- `roster-import.ts` — concierge import: column-header aliases, per-row validation reusing `org-volunteer.ts`'s name/email/phone schemas
- `roster-export.ts` — roster export column contract, `ROSTER_EXPORT_CAP` (10k) and `ROSTER_EXPORT_BATCH`, `rosterExportFilename()`, and the two terminal notices (`formatTruncationNotice`, `formatFailureNotice`) that keep a capped or interrupted file from looking complete
- `org-health.ts` — `computeOrgHealth()` pure domain function — 0-100 org health score with four 25-pt metrics and next actionable tip
- `user-feedback.ts` — feedback mood/status enums, validation (max 2000 chars), rate limit constants, Zod schemas, volunteer-friendly status labels
- `reference-data.ts` — `SKILL_CATALOG` constant (13 families, 62 skills), `CATALOG_VERSION`, `PLATFORM_ORG_SLUG`; imported by both `referenceDataService` and `prisma/seed-helpers.ts`

---

## src/server/repositories

Database access layer.

Only Prisma queries should exist here.

---

## src/server/services

Application workflows.

Responsible for orchestrating repositories and enforcing business rules.

All DB writes go through services so audit logging is automatic.

Key services:

- `volunteerApplicationService.ts` — application submission and status
- `volunteer-screening.ts` — screening evaluation, duplicate application prevention (P2002 handler), status notification emails (REVIEW/APPROVED/REJECTED)
- `volunteerMatchingService.ts` — skill matching and recommendations
- `volunteerProfileService.ts` — profile management
- `staffVolunteerService.ts` — org volunteer roster: staff add/remove/restore, the roster reads (`getRoster`, `getRosterCount`, `getVolunteerDetail`), plus the volunteer's own `listMyOrgMemberships` / `leaveOrgRoster`. `addVolunteer` and `restoreVolunteer` refuse with `FORBIDDEN` while an `OrgVolunteerBlock` stands. `getVolunteerDetail` (v0.38.3.0) needs no `requireOrgVolunteerRelationship`: it loads through `findOrgVolunteerById(orgId, id)`, whose `WHERE` carries the org, so the live roster row it returns IS the `ORG_VOLUNTEER` edge. It sums hours across every attended row and only then slices the list to `SHIFT_HISTORY_WIRE_CAP`, so the totals still agree with the uncapped count on the roster row
- `appliedRosterService.ts` — materializes the roster row an approved application implies (`ensureAppliedRosterRow()`); returns false instead of creating one when the applicant has blocked the org
- `orgVolunteerAccessService.ts` — `requireOrgVolunteerRelationship()`, the org↔volunteer authorization guard, plus `liftOrgVolunteerBlock()` — the only way a block is cleared, called from the three places a volunteer re-engages with an org of their own accord (application submit **only when `submittedByUserId` is set** — `screener.submit` is a `publicProcedure`, so an attacker-supplied address must not clear a block — plus claim and shift signup) (application submit, claim, shift signup)
- `volunteerCredentialService.ts` — credential lifecycle
- `shiftService.ts` — shift CRUD and status transitions
- `shiftSignupService.ts` — signup with conflict detection, attendance, waitlist auto-promote
- `shiftTemplateService.ts` — recurring shift template CRUD + bulk shift generation
- `notificationService.ts` — notification delivery with preference checking
- `orgAnalyticsService.ts` — org engagement dashboard (funnel, retention, fill rate, top volunteers)
- `backgroundCheckService.ts` — provider-agnostic background check lifecycle (Checkr + Sterling), FCRA workflow, token encryption; shared `initiateProviderCheck` and `handleProviderWebhookEvent` with injected adapters
- `credentialShareService.ts` — credential sharing: generate, claim, revoke, shareAllOnApply
- `billingService.ts` — Stripe integration, plan management, billing lifecycle emails (upgrade, payment failed, cancellation)
- `credential-expiry-service.ts` — daily credential and share token expiry (Vercel Cron)
- `shift-auto-close-service.ts` — hourly auto-completion of expired shifts (atomic updateMany guard, per-record try/catch)
- `digest-service.ts` — email digest aggregation with cursor pagination and timezone-aware delivery (Vercel Cron, hourly)
- `shift-reminder-service.ts` — shift reminder emails with timezone-aware delivery (Vercel Cron, hourly)
- `reengagement-service.ts` — 30/60/90-day volunteer re-engagement emails (Vercel Cron, daily)
- `companyService.ts` — corporate account management
- `employerReportService.ts` — ESG report generation and CSV export
- `volunteerDashboardService.ts` — volunteer-facing dashboard: upcoming shifts, pending applications, expiring credentials, impact stats, recommended opportunities (user-scoped, no org context)
- `onboardingAnalyticsService.ts` — platform admin onboarding funnel: 5-step funnel counts (the fifth is "roster populated") + per-org progress detail (last 20 orgs), plus `rosterActivation` — the launch success metric, deliberately NOT a sixth funnel step because it measures something else: orgs that added `ROSTER_POPULATED_THRESHOLD`+ volunteers **themselves** (`STAFF_ADDED`) within `ROSTER_ACTIVATION_WINDOW_DAYS` of signup
- `orgAccessService.ts` — `requireOrgAccess({ userId, orgId, minRole })`, the Route-Handler counterpart to tRPC's `staffProcedure`; see Authorization below
- `rosterImportService.ts` — concierge CSV import: per-row transactions through `addVolunteer()` (never a parallel insert), so the block refusal, shadow-user branch and audit row are the same code the add form runs. Writes no audit rows of its own. Opts out of `addVolunteer`'s fire-and-forget notification and paces the sends itself, sequentially and awaited
- `rosterExportService.ts` — streams the roster CSV in `ROSTER_EXPORT_BATCH` pages, appends the truncation notice at the cap and the failure notice on a mid-stream error
- `feedbackService.ts` — in-app feedback lifecycle: submit (rate-limited 5/hr), list with filters (status/mood), update status, reply with email notification, admin triage
- `referenceDataService.ts` — boot guard (`ensureReferenceData()`) — self-healing runtime check that ensures the skill catalog and platform org exist before serving requests; uses a module-level `_seeded` flag and promise dedup to make subsequent calls free; called by `volunteerMatchingService` and `tenureBadgeService`, and at startup via `src/instrumentation.ts`
- `marketplaceService.ts` — volunteer marketplace: `toggleInterest` (heart-toggle with auto-enroll into weekly digest, idempotent P2002/P2025 handling), extracted from the tRPC router so the router stays thin
- `opportunityDigestService.ts` — weekly opportunity digest: selects up to 5 fresh published opportunities per user based on hearted interests, excludes already-applied/hearted opps, sends branded email, updates `lastDigestSentAt` for idempotency; cursor-based pagination handles all eligible users per run (Vercel Cron, Mondays)

---

## src/server/trpc

API layer.

Contains routers and procedures that call services.

Routers should stay thin.

---

## src/server/lib

Shared utilities and external service adapters.

- `adapters/background-check/` — `BackgroundCheckAdapter` interface with `CheckrAdapter` and `SterlingAdapter` implementations; `getAdapter(provider)` registry factory returns the correct adapter by `BackgroundCheckProvider` enum
- `crypto.ts` — AES-256-GCM encrypt/decrypt for OAuth tokens and API keys at rest (dual-key rotation support)
- `tokens.ts` — shared token generation (256-bit random) and SHA-256 hashing
- `resend.ts` — lazy-initialized Resend email client singleton
- `email-template.ts` — branded email wrapper (VolunteerReady header/footer matching DESIGN.md)
- `email.ts` — `sendEmail()` helper — single entry point for all outbound email
- `html.ts` — `escapeHtml()` shared XSS escape for all server-rendered HTML (email templates + consent pages)
- `rate-limit.ts` — Upstash Redis rate limiting (lazy singleton, fail-open)
- `digest-unsubscribe-token.ts` — HMAC-SHA256 signed unsubscribe tokens for the opportunity digest; `generate(userId)` / `verify(userId, token)` with timing-safe comparison

---

# Core Domain Model

Entities:

- User
- Organization / OrganizationMember (staff side)
- OrgVolunteer (volunteer side of the same join — roster membership, no role)
- OrgVolunteerBlock (the volunteer's standing refusal of one org's access)
- VolunteerApplication / VolunteerAnswer
- ScreenerQuestion
- VolunteerOpportunity / OpportunityTag / OpportunityRequirement / OpportunityInterest
- Skill / SkillFamily / VolunteerSkill
- VolunteerProfile
- VolunteerCredential
- Shift / ShiftSignup / ShiftTemplate
- Notification / NotificationPreference
- BackgroundCheckRequest
- CredentialShareToken
- CompanyAccount / CompanyMember / CompanyNonprofitLink
- UserFeedback
- UserMarketplacePreference
- FeatureFlag
- AuditLog

Relationship overview:

```
User
 ├─ OrganizationMember
 │    └─ Organization
 │         ├─ ScreenerQuestion
 │         ├─ VolunteerApplication
 │         │    └─ VolunteerAnswer
 │         ├─ VolunteerOpportunity
 │         │    ├─ OpportunityTag
 │         │    ├─ OpportunityRequirement
 │         │    └─ OpportunityInterest
 │         ├─ Shift
 │         │    └─ ShiftSignup
 │         ├─ ShiftTemplate
 │         ├─ Notification
 │         ├─ NotificationPreference
 │         ├─ VolunteerCredential
 │         │    └─ CredentialShareToken
 │         ├─ BackgroundCheckRequest
 │         ├─ FeatureFlag
 │         └─ AuditLog
 ├─ OrgVolunteer (roster row, org-scoped, soft-deleted)
 │    └─ Organization
 ├─ OrgVolunteerBlock (access revoked by the volunteer, org-scoped, hard row)
 │    └─ Organization
 ├─ CompanyMember
 │    └─ CompanyAccount
 │         └─ CompanyNonprofitLink
 ├─ VolunteerProfile (cross-org, 1:1)
 ├─ VolunteerSkill (cross-org)
 ├─ UserFeedback
 └─ ShiftSignup
```

`OrgVolunteer` hangs off `User` rather than under `OrganizationMember` on
purpose: a volunteer on an org's roster is not a member of that org. The row is
created by staff (or materialized from an approved application) and can be
soft-deleted from either side — staff removal, or the volunteer leaving via
`profile.leaveOrgRoster`. `OrgVolunteerBlock` hangs off `User` for the same
reason and is the volunteer's own row: staff can create, remove, and restore an
`OrgVolunteer` row, but only the volunteer writes a block and only their own
re-engagement lifts one.

See `docs/DOMAIN.md` for canonical vocabulary.

---

# Authentication

Authentication uses NextAuth with:

- Google OAuth
- Email magic links (via Resend)

Database sessions (not JWT). Session stores `currentOrgId` and `currentCompanyId`.

Flow:

1. user visits /login
2. authentication completes
3. session created with org/company context
4. user redirected to /app

---

# Authorization

tRPC procedure types (defined in `src/server/trpc/init.ts`):

| Procedure | Requires | Context narrowing |
|---|---|---|
| `publicProcedure` | Nothing | — |
| `protectedProcedure` | Authenticated user | — |
| `orgProcedure` | Authenticated + org membership | `orgId: string` |
| `staffProcedure` | STAFF, ADMIN, or OWNER role | `role: Role` |
| `adminProcedure` | ADMIN or OWNER role | `role: Role` |
| `companyScopedProcedure(opts?)` | Company membership (+ optional `minRole`/`minPlanTier`) | `companyId: string`, `companyRole: CompanyMemberRole` |
| `planTierProcedure(tier)` | Org plan at or above tier | — |
| `rosterProcedure` | `staffProcedure` + the roster flag on for `ctx.orgId` | `role: Role` (via `staffProcedure`) |

`rosterProcedure` lives in `src/server/trpc/roster-flag-middleware.ts` rather than
`init.ts` because it is a temporary launch gate, and it is shared by
`routers/volunteers.ts` and `routers/shifts.ts` so a hand-copied flag check in a
second router cannot be the one that gets missed when the flag retires. Grepping
`rosterProcedure` does **not** enumerate every roster surface — grep
`isRosterEnabledForOrg` (in `services/featureFlagService.ts`) instead; see CLAUDE.md.

Use the narrowest access level possible.

`companyScopedProcedure` is a factory (`src/server/trpc/init.ts`) that reads
`companyId` from the tRPC **input**, never from session state — the
session's active company can differ from the company named in the request
(a multi-company user browsing a non-active company's URL), and authorizing
against the session would serve or mutate the wrong tenant. It requires an
`{ companyId: string }` input shape, delegates the membership/role/plan
check to `requireCompanyAccess()` in
`src/server/services/companyAccessService.ts`, and narrows the context with
`companyId`/`companyRole`. Pass `{ minRole }` for an ADMIN/OWNER gate or
`{ minPlanTier }` for a plan gate — both checked server-side against the
company named in the request. This replaced the session-scoped
`companyProcedure` / `companyAdminProcedure` / `companyPlanTierProcedure`
in v0.29.2.0 after a bug let multi-company users see another company's data
when the session's active company didn't match the URL.

Each middleware narrows the context type via `next({ ctx: { ... } })`, so downstream code can use `ctx.orgId` and `ctx.role` without non-null assertions.

## Route Handlers under `/api/org/[orgId]/**`

A tRPC procedure type is not available to a raw Route Handler, and `staffProcedure`
could not be reused even if it were: it reads `ctx.orgId` from the **session's active
org**, while a URL-scoped route is being asked about the org in its path. Those two
can differ for a multi-org user, which is the same shape as the v0.29.2.0
company bug above. So `requireOrgAccess({ userId, orgId, minRole })` in
`src/server/services/orgAccessService.ts` (v0.38.0.0) is the Route-Handler
counterpart to `staffProcedure`: it takes `orgId` as a **parameter** and re-checks
membership, then role rank, then org suspension against it, throwing
`OrgAccessDeniedError` for the handler to convert. **Any new
`/api/org/[orgId]/**` handler must use it.** Two deliberate boundaries: feature
flags are not folded in (the caller checks those itself, *after* the access check,
so a stranger cannot probe pilot membership), and the handler — not the service —
decides the response, which for `GET /api/org/[orgId]/roster/csv` is a uniform 404
for every miss so the address cannot enumerate orgs.

`roleRank` — the total order on `Role` that both this guard and `staffProcedure`
compare against — lives in `src/server/domain/permissions.ts`. It was consolidated
there from two private copies when `orgAccessService` became its third caller;
`trpc/init.ts` re-exports it for back-compat.

A procedure type is only half the authorization story. `staffProcedure`
establishes that the caller is staff and `ctx.orgId` establishes where, but a
`userId` arriving in the procedure's **input** is still untrusted — and user ids
are discoverable, since `/v/[userId]` is a public route. Staff procedures that
act on an input-supplied `userId` call `requireOrgVolunteerRelationship()` in
`src/server/services/orgVolunteerAccessService.ts` (v0.32.1.0), the org↔volunteer
mirror of `requireCompanyAccess()`, with the trust direction inverted: here the
tenant id comes from `ctx` and the user id is the untrusted value. The guard
resolves via `findOrgVolunteerRelationship()` (`orgVolunteerRepo.ts`), which
probes only relationships an org cannot manufacture against a stranger —
application, roster row, shift signup, org membership — and throws `NOT_FOUND`
rather than `FORBIDDEN` so a caller probing ids cannot distinguish "not yours"
from "not real". It gates `profile.getOrgVisibleProfile`, `credentials.issue`,
`credentials.revoke`, and `backgroundChecks.initiate`, and the resolved
relationship kind is written to the audit metadata as the record of why the
action was permitted.

The guard accepts several relationship kinds, so removing one does not by itself
end the org's access — which is why leaving an org is not modelled as a removal.
Through v0.36.0.0 `profile.leaveOrgRoster` soft-deleted the `OrgVolunteer` edge
and nothing else, so an application or a shift signup still resolved and the org
kept `getOrgVisibleProfile` / `credentials.issue` / `backgroundChecks.initiate`
— and `addVolunteer` could recreate the roster row from an email address anyway.

As of v0.37.0.0 leaving writes an `OrgVolunteerBlock` in the same transaction,
and `findOrgVolunteerRelationship()` suppresses every kind it resolved except
`ORG_MEMBER` and `EXISTING_CREDENTIAL` once one exists. Three properties of that
design are load-bearing:

- **The block check runs after the probes, not before.** Blocks are rare;
  checking first would add a query to every call to save one on almost none. The
  rejection path (already four queries) is unchanged and the accept path pays one
  indexed lookup on a unique key.
- **`ORG_MEMBER` is exempt, and is re-probed after a suppression.** Staff
  membership is not a volunteer relationship and is not what leaving revokes.
  Without the exemption a coordinator who is also on their own org's roster would
  lock themselves out by leaving it; without the re-probe they would lose it
  merely because `APPLICATION` was found first.
- **`EXISTING_CREDENTIAL` is exempt.** It is opt-in and reached only by
  `revokeCredential`, which is strictly narrowing. Suppressing it recreates the
  dead end `acceptExistingCredential` exists to prevent — `listOrgCredentials`
  filters on `orgId` alone, so the credential stays visible and permanently
  unrevokable, and only the volunteer can lift a block.

Blocks are lifted only by `liftOrgVolunteerBlock()`, and only from an act the
volunteer takes themselves: submitting an application while signed in, claiming
one, or signing up for a shift. Staff have no path to it — which is the whole
point, since every other edge in the set is one they can mint from an email
address.

The mirror of this guard runs on volunteer-facing procedures, where the trust
direction inverts again: the caller is the volunteer and there is no `ctx.orgId`
(a volunteer is not an `OrganizationMember`). Those procedures put the caller's
`userId` inside the Prisma `WHERE` of every statement that reads or writes the
row. Where the caller owns a row, the `orgId` is read back off it rather than
accepted from the client; where they may not own one — `leaveOrgRoster` is now
addressed by `orgId`, because an org holding only an application has no roster
row to name — the service proves a real relationship exists before writing
anything, so a crafted `orgId` still reaches only the caller's own rows.

### Platform Admin

Platform admin is DB-backed via `User.isPlatformAdmin` (with env-var fallback during migration).

- **Domain utility:** `src/server/domain/platform-admin.ts` — `isPlatformAdmin(userId)` queries DB on demand (no session enrichment)
- **CLI escape hatch:** `pnpm admin:grant <email>` / `pnpm admin:revoke <email>`
- **Seed script:** `prisma/scripts/seed-platform-admins.ts` — one-time migration from `PLATFORM_ADMIN_IDS` env var
- **Audit:** `PLATFORM_ADMIN_GRANTED` / `PLATFORM_ADMIN_REVOKED` logged transactionally

### Permission Model (RBAC Foundation)

TypeScript constants are the source of truth for permissions — no DB tables in v1.

- **Constants:** `src/server/domain/permissions.ts` — flat permission keys (`namespace.action`), role-to-permission mappings, and `roleRank`
- **`roleRank`** — the total order on `Role`, which is a *different* question from `ROLE_PERMISSIONS` and not a replacement for it: rank answers "is this role at least X?" for the `minRole` gates in `staffProcedure`, `memberService` and `requireOrgAccess`, while `ROLE_PERMISSIONS` answers "may this role do Y?". It was consolidated here from two private copies when `orgAccessService` became the third caller; `trpc/init.ts` re-exports it for back-compat
- **`hasPermission(role, permission)`** — in-memory lookup, no DB query per call
- **Advisory mode:** Global middleware in `publicProcedure` runs `advisoryPermissionCheck()` for all org-scoped procedures. Logs warnings when middleware and `hasPermission()` disagree. Never blocks.
- **Procedure map:** `src/server/trpc/advisory-permission-middleware.ts` — maps tRPC procedure paths to permission keys

#### Permission Matrix (Org Roles)

| Permission scope | READONLY | STAFF | ADMIN | OWNER |
|---|:---:|:---:|:---:|:---:|
| Org settings, billing, notifications | ✓ | ✓ | ✓ | ✓ |
| Opportunities, shifts, credentials, discovery | | ✓ | ✓ | ✓ |
| Screener, members, questions, bulk import | | | ✓ | ✓ |
| (Business rules in services, not permissions) | | | | ✓ |

**Inline business rules** (enforced in services, not permission constants):
- ADMIN cannot invite ADMIN (only STAFF/READONLY) — `memberService.inviteMember()`
- Cannot remove OWNER — `memberService.removeOrgMember()`
- Cannot change OWNER role or promote to OWNER — `memberService.updateOrgMemberRole()`

### Auth Change Audit Logging

All auth-change events use `writeAuditLogTx` inside the same transaction as the mutation:

| Action | Trigger |
|---|---|
| `MEMBER_INVITED` | `memberService.inviteMember()` |
| `MEMBER_REMOVED` | `memberService.removeOrgMember()` |
| `ROLE_CHANGED` | `memberService.updateOrgMemberRole()` |
| `PLATFORM_ADMIN_GRANTED` | `scripts/admin-grant.ts` |
| `PLATFORM_ADMIN_REVOKED` | `scripts/admin-grant.ts` |

---

# External Integrations

## Stripe (Billing)

- Checkout sessions and billing portal via tRPC
- Webhook handler at `/api/stripe/webhook` (signature verification, idempotency via `StripeWebhookEvent`)
- Plan tier updates on subscription events

## Background Checks (Checkr + Sterling)

Both providers use the `BackgroundCheckAdapter` interface with a `getAdapter(provider)` registry factory.

**Checkr:**
- OAuth flow for per-org Checkr account connection
- Background check initiation via Checkr Partner API
- Webhook handler at `/api/checkr/webhook` (signature verification, idempotency via `CheckrWebhookEvent`)
- OAuth tokens encrypted at rest (AES-256-GCM)

**Sterling:**
- API key authentication (Bearer token) — no OAuth dance
- Admin connects by entering API key + Account ID on the background checks page (`/app/settings/background-checks`)
- Webhook handler at `/api/sterling/webhook` (HMAC-SHA256 signature verification)
- Shares `CheckrWebhookEvent` idempotency table for webhook deduplication
- 7 named error classes (`SterlingAuthError`, `SterlingForbiddenError`, `SterlingValidationError`, `SterlingRateLimitError`, `SterlingTimeoutError`, `SterlingNetworkError`, `SterlingApiError`)

**Shared:** Provider-agnostic `initiateProviderCheck` and `handleProviderWebhookEvent` in `backgroundCheckService.ts`. FCRA adverse action email workflow applies to both providers.

## Resend (Email)

- Transactional emails: invitations, status lookups, background check notifications, FCRA notices, credential claim notifications, credential sharing requests, billing lifecycle (upgrade, payment failed, cancellation)
- All emails use branded template (`buildEmailHtml` from `email-template.ts`)
- Lazy-initialized singleton client

---

# Request Flow

Typical request flow:

```
UI
 -> tRPC procedure
   -> service
     -> repositories
       -> Prisma/Postgres
     -> audit log (inside same transaction)
   -> response
 -> UI render
```

---

# Coding Rules for Agents

1. Always respect organization scope
2. Keep business logic in services
3. Keep routers thin
4. Keep Prisma access inside repositories
5. Prefer explicit naming
6. Maintain domain vocabulary consistency
7. All multi-step writes use `prisma.$transaction`
8. Audit logs are written inside the same transaction via `writeAuditLogTx`

---

# Development Commands

```bash
pnpm install              # Install dependencies
pnpm dev                  # Dev server (port 3005)
pnpm build                # Production build
pnpm start                # Production server
pnpm lint                 # Biome lint
pnpm format               # Biome format
pnpm test                 # Vitest
pnpm e2e                  # Playwright e2e (boots the dev server; authenticated specs only
                          #   run against localhost. Pauses ~30-60s first while
                          #   e2e/global-setup.ts warms every public route — `next dev`
                          #   serves an uncompiled route while rewriting the .next
                          #   manifest, and N workers hitting ~20 at once turns that into
                          #   intermittent 500s. Skipped when PLAYWRIGHT_BASE_URL is set.)
pnpm check                # Biome check on src/docs/prisma (applies safe fixes)
pnpm prisma migrate deploy
pnpm prisma db seed
```

Health check: `http://localhost:3005/health`
