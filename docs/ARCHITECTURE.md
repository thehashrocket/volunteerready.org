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
- `shift.ts` — shift capacity, signup validation, attendance
- `notification.ts` — notification types and domain functions
- `background-check.ts` — FCRA state machine, PII sanitization
- `billing.ts` — plan tier limits, trial validation (includes `maxShiftTemplates`)
- `credential-sharing.ts` — share token lifecycle guards, expiry computation
- `esg-report.ts` — ESG report types, CSV formatting, formula injection defense
- `org-health.ts` — `computeOrgHealth()` pure domain function — 0-100 org health score with four 25-pt metrics and next actionable tip
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
- `volunteer-screening.ts` — screening evaluation
- `volunteerMatchingService.ts` — skill matching and recommendations
- `volunteerProfileService.ts` — profile management
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
- `onboardingAnalyticsService.ts` — platform admin onboarding funnel: 4-step funnel counts + per-org progress detail (last 20 orgs)
- `referenceDataService.ts` — boot guard (`ensureReferenceData()`) — self-healing runtime check that ensures the skill catalog and platform org exist before serving requests; uses a module-level `_seeded` flag and promise dedup to make subsequent calls free; called by `volunteerMatchingService` and `tenureBadgeService`, and at startup via `src/instrumentation.ts`

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

---

# Core Domain Model

Entities:

- User
- Organization / OrganizationMember
- VolunteerApplication / VolunteerAnswer
- ScreenerQuestion
- VolunteerOpportunity / OpportunityTag / OpportunityRequirement
- Skill / SkillFamily / VolunteerSkill
- VolunteerProfile
- VolunteerCredential
- Shift / ShiftSignup / ShiftTemplate
- Notification / NotificationPreference
- BackgroundCheckRequest
- CredentialShareToken
- CompanyAccount / CompanyMember / CompanyNonprofitLink
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
 │         │    └─ OpportunityRequirement
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
 ├─ CompanyMember
 │    └─ CompanyAccount
 │         └─ CompanyNonprofitLink
 ├─ VolunteerProfile (cross-org, 1:1)
 ├─ VolunteerSkill (cross-org)
 └─ ShiftSignup
```

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
| `companyProcedure` | Company membership | `companyId: string` |
| `companyAdminProcedure` | Company ADMIN or OWNER | `companyRole: Role` |
| `companyPlanTierProcedure(tier)` | Company plan at or above tier | `planTier: PlanTier` |
| `planTierProcedure(tier)` | Org plan at or above tier | — |

Use the narrowest access level possible.

Each middleware narrows the context type via `next({ ctx: { ... } })`, so downstream code can use `ctx.orgId` and `ctx.role` without non-null assertions.

### Platform Admin

Platform admin is DB-backed via `User.isPlatformAdmin` (with env-var fallback during migration).

- **Domain utility:** `src/server/domain/platform-admin.ts` — `isPlatformAdmin(userId)` queries DB on demand (no session enrichment)
- **CLI escape hatch:** `pnpm admin:grant <email>` / `pnpm admin:revoke <email>`
- **Seed script:** `prisma/scripts/seed-platform-admins.ts` — one-time migration from `PLATFORM_ADMIN_IDS` env var
- **Audit:** `PLATFORM_ADMIN_GRANTED` / `PLATFORM_ADMIN_REVOKED` logged transactionally

### Permission Model (RBAC Foundation)

TypeScript constants are the source of truth for permissions — no DB tables in v1.

- **Constants:** `src/server/domain/permissions.ts` — flat permission keys (`namespace.action`), role-to-permission mappings
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
- Admin connects by entering API key + Account ID on credentials page
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
pnpm check                # typecheck + lint + test
pnpm prisma migrate deploy
pnpm prisma db seed
```

Health check: http://localhost:3005/health
