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
 └─ seed.ts             # Development seed data
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
- `background-check.ts` — FCRA state machine, PII sanitization
- `billing.ts` — plan tier limits, trial validation
- `credential-sharing.ts` — share token lifecycle guards, expiry computation
- `esg-report.ts` — ESG report types, CSV formatting, formula injection defense

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
- `shiftSignupService.ts` — signup with conflict detection and attendance
- `backgroundCheckService.ts` — Checkr integration, FCRA workflow, token encryption
- `credentialShareService.ts` — credential sharing: generate, claim, revoke, shareAllOnApply
- `billingService.ts` — Stripe integration, plan management, billing lifecycle emails (upgrade, payment failed, cancellation)
- `credential-expiry-service.ts` — daily credential and share token expiry (Vercel Cron)
- `companyService.ts` — corporate account management
- `employerReportService.ts` — ESG report generation and CSV export

---

## src/server/trpc

API layer.

Contains routers and procedures that call services.

Routers should stay thin.

---

## src/server/lib

Shared utilities and external service adapters.

- `adapters/background-check/` — `BackgroundCheckAdapter` interface with `CheckrAdapter` implementation
- `crypto.ts` — AES-256-GCM encrypt/decrypt for Checkr OAuth tokens
- `tokens.ts` — shared token generation (256-bit random) and SHA-256 hashing
- `resend.ts` — lazy-initialized Resend email client singleton
- `email-template.ts` — branded email wrapper (VolunteerReady header/footer matching DESIGN.md)

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
- Shift / ShiftSignup
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

---

# External Integrations

## Stripe (Billing)

- Checkout sessions and billing portal via tRPC
- Webhook handler at `/api/stripe/webhook` (signature verification, idempotency via `StripeWebhookEvent`)
- Plan tier updates on subscription events

## Checkr (Background Checks)

- OAuth flow for per-org Checkr account connection
- Background check initiation via Checkr Partner API
- Webhook handler at `/api/checkr/webhook` (signature verification, idempotency via `CheckrWebhookEvent`)
- OAuth tokens encrypted at rest (AES-256-GCM)
- FCRA adverse action email workflow

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
