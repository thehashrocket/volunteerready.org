# VolunteerReady Platform

VolunteerReady is a multi-tenant SaaS platform designed to help nonprofit organizations recruit, screen, and manage volunteers.

The system is being built as the foundation for a larger VolunteerMatch-style ecosystem where nonprofits can:

- publish volunteer opportunities
- screen and onboard volunteers
- match volunteers to opportunities using skills
- manage shifts and attendance
- issue and verify portable credentials
- integrate background checks (Checkr + Sterling)
- manage organizational members and billing
- support corporate CSR / employer volunteer programs

The platform is intentionally designed as a modular nonprofit infrastructure layer, not just a form builder.

---

# Vision

VolunteerReady aims to become a central operating system for nonprofit volunteer engagement.

Long-term goals include:

- Volunteer discovery and matching (shipped)
- Volunteer screening and onboarding (shipped)
- Organization management (shipped)
- Volunteer activity tracking via shifts (shipped)
- Portable volunteer credentials (shipped)
- Background check integration (shipped)
- Corporate CSR / employer accounts (shipped)
- Billing and plan tiers (shipped)
- Portable credential sharing across organizations (shipped)
- Corporate ESG reporting (shipped)
- Cross-organization volunteer identity (shipped)
- In-app notifications and shift templates (shipped)
- Volunteer marketplace with cross-org opportunity browse and org discovery (shipped)
- Weekly opportunity digest emails with one-click unsubscribe (shipped)
- Nonprofit analytics and reporting (shipped)

The current system implements Phases 1 through 12. See `docs/ROADMAP.md` for the full plan.

---

# Core Concepts

## Organization

An organization is the top-level tenant in the system.

Each organization has:

- members (with roles)
- volunteers
- screening questions
- volunteer applications
- volunteer opportunities
- shifts
- credentials
- feature flags
- audit logs
- plan tier (FREE / STARTER / PRO)

Organizations are fully isolated from each other.

---

## OrganizationMember

Join table between `User` and `Organization`.

Contains role information used for authorization.

Roles:

- OWNER
- ADMIN
- STAFF
- READONLY

Users may belong to multiple organizations.

This is the **staff** join. The volunteer-side join is `OrgVolunteer`.

---

## OrgVolunteer

Join table between `User` and `Organization` recording that someone is a
volunteer on that org's roster. Roster membership carries no role and does not
make the volunteer a member of the org.

A row is created either by a coordinator typing a name and email into
`/app/volunteers` (`source: STAFF_ADDED`) or automatically from an approved
application (`source: APPLIED`). Staff can add any email address without the
recipient's agreement, so the roster-added email tells the recipient they can
leave — and `/app/profile` has an "Organizations you volunteer with" card where
they do (`profile.leaveOrgRoster`). That card lists every org that can act on
them, not just the ones holding a roster row.

Removal from either side is a soft delete, so the row's provenance survives and
a removed volunteer can be re-added or restored — with one exception: staff
cannot re-add or restore someone who left of their own accord. See
`OrgVolunteerBlock`.

---

## OrgVolunteerBlock

A volunteer's standing refusal of one organization's access to them, written
when they leave that org from `/app/profile` (`profile.leaveOrgRoster`).

Through v0.36.0.0 leaving soft-deleted the roster row and nothing else, which
revoked nothing durable: staff can recreate that row from an email address, so
the org could undo the departure in two clicks. As of v0.37.0.0 the same
transaction also writes an `OrgVolunteerBlock`, and that row is the one piece of
state in the relationship staff cannot clear.

While a block stands:

- the org's application, roster, and shift-signup edges stop authorizing it, so
  it loses the volunteer's org-visible profile, credential issuing, and
  background-check initiation
- adding, restoring, or auto-rostering that person is refused
- assigning them to a shift is refused

Two things a block does **not** touch: staff membership (someone who is both a
coordinator and a volunteer at the same org cannot lock themselves out of it),
and revoking a credential the org already issued (otherwise that credential
would stay visible and permanently unrevokable).

Only the volunteer lifts a block, and only by re-engaging with that org
themselves — applying **while signed in**, claiming an application, or signing
up for a shift. An anonymous application does not lift one: the public apply
form accepts any email address typed into it, so an address alone must not be
able to hand an organization its access back.

Because leaving is now keyed on the organization rather than on a roster row,
an org that holds only an application or a shift signup can be left too. An org
cannot deny the exit by removing the volunteer from its roster first.

---

## VolunteerApplication

Represents a volunteer submission to an organization.

Applications are composed of answers to screening questions and may be linked to a specific opportunity.

Status lifecycle: SUBMITTED -> REVIEW -> APPROVED / REJECTED. A volunteer may also WITHDRAW their own application.

Screening result: PASS / REVIEW / FAIL (auto-evaluated by disqualifier and review rules)

Duplicate prevention: authenticated volunteers cannot submit duplicate applications to the same opportunity. A partial unique index enforces this at the database level. Applied-status badges appear on opportunity listings, and the apply form redirects already-applied users to their existing application.

---

## ScreenerQuestion

Questions configured by organizations to screen volunteers.

Each organization controls its own screening questions. Types: TEXT, SINGLE_CHOICE, MULTI_CHOICE, BOOLEAN, NUMBER.

Questions support disqualifier rules (auto-reject) and review rules (flag for manual review).

---

## VolunteerOpportunity

A volunteer position published by an organization.

Status lifecycle: DRAFT -> PUBLISHED -> CLOSED

Opportunities include location, dates, commitment hours, capacity, tags, and skill requirements (REQUIRED / PREFERRED).

---

## VolunteerProfile

Cross-org volunteer identity (1:1 with User).

Includes bio, phone, location, availability preferences, interest tags, and visibility controls (PUBLIC / ORGS_ONLY / PRIVATE).

Profile completeness is scored 0-100.

---

## VolunteerCredential

Org-scoped verification badges for volunteers.

Types: BACKGROUND_CHECK, TRAINING_COMPLETE, ID_VERIFIED, REFERENCE_CHECK, ORIENTATION_COMPLETE

Status lifecycle: PENDING -> VERIFIED -> EXPIRED / REVOKED

Unique per user + org + type.

Credentials can be shared across organizations via time-limited share tokens. Shared credentials carry provenance (which org they came from).

---

## CredentialShareToken

Time-limited share link for a VERIFIED credential. Volunteers generate share links; org staff claim them to import the credential without re-verification.

Token lifecycle: ACTIVE -> CLAIMED / EXPIRED

Tokens are SHA-256 hashed before storage (raw token is never persisted).

---

## Shift

Org-scoped volunteer time block with capacity and optional opportunity link.

Status lifecycle: OPEN -> FULL (auto at capacity) -> COMPLETED / CANCELLED

Volunteers sign up for shifts. Signup status: CONFIRMED -> ATTENDED / NO_SHOW / CANCELLED

Time overlap detection prevents double-booking.

---

## BackgroundCheckRequest

Tracks a background check initiated by org staff for a volunteer.

Status lifecycle: PENDING -> COMPLETE / CONSIDER / FAILED / CANCELLED

FCRA adverse action workflow: NONE -> PRE_ADVERSE_SENT -> ADVERSE_ACTION_SENT / RESOLVED

PII (SSN, DOB) is never stored. Provider tokens are encrypted at rest (AES-256-GCM).

---

## CompanyAccount

Corporate employer account for CSR / employee volunteer programs.

Companies can sponsor nonprofit organizations (CompanyNonprofitLink) and manage team members with roles (OWNER / ADMIN / MEMBER).

---

## Billing & Plan Tiers

Organizations and CompanyAccounts each have their own plan tier: FREE / STARTER / PRO.

Billing is managed via Stripe (checkout sessions, billing portal, webhook processing).

Plan enforcement is server-side only via `planTierProcedure` (org context) and `companyScopedProcedure({ minPlanTier })` (company context).

---

## AuditLog

Append-only log of organization and company actions.

Used for traceability and compliance.

Audit logs cannot be edited or deleted. All DB writes go through services so audit logging is automatic.

---

## FeatureFlag

Per-organization feature toggles.

Used to enable or disable experimental or premium functionality.

---

# Architecture

## Tech Stack

- Next.js 16 (App Router)
- React 19
- TypeScript 5.9
- Prisma 7 ORM
- PostgreSQL
- NextAuth (Auth.js)
- tRPC v11
- Zod (shared validation)
- Tailwind CSS + shadcn/ui
- react-hook-form
- Stripe (billing)
- Resend (transactional email)
- Checkr (background checks)
- Vitest (unit/component testing)
- Playwright (end-to-end testing)
- Biome (linting/formatting)

---

# Repository Structure

```
src/
 ├─ app/                # Next.js routes and page composition
 ├─ components/         # Reusable UI components
 ├─ lib/                # Client-side utilities, constants, and React hooks (src/lib/hooks/)
 └─ server/
     ├─ domain/         # Domain types, invariants, pure functions
     ├─ repositories/   # Database access layer (Prisma only)
     ├─ services/       # Business logic and workflows
     ├─ trpc/           # API routers and procedures
     └─ lib/            # Shared utilities and adapters (crypto, email, Checkr)

prisma/
 ├─ schema.prisma       # Database schema (source of truth)
 ├─ seed.ts             # Seed dispatcher (runs production or dev based on NODE_ENV)
 ├─ seed-helpers.ts     # Shared Prisma client, types, and upsert helpers
 ├─ seed-production.ts  # Production seed (platform org + skill catalog)
 └─ seed-dev.ts         # Dev/staging seed (full demo data + test accounts)

docs/                   # VitePress documentation site

e2e/                    # Playwright end-to-end tests
 ├─ global-setup.ts     # Warms every public route before the workers start (see below)
 └─ utils/              # Auth harness (db.ts) and layout assertions (layout.ts)
```

---

# Development

## Install dependencies

```bash
pnpm install
```

## Start development server

```bash
pnpm dev
```

Health endpoint: http://localhost:3005/health

## Other commands

```bash
pnpm build          # Production build
pnpm start          # Production server
pnpm lint           # Biome lint
pnpm format         # Biome format
pnpm test           # Vitest (run once)
pnpm e2e            # Playwright e2e (boots the dev server; authenticated specs only run against localhost targets)
                    #   Pauses ~30-60s first: e2e/global-setup.ts compiles every public route
                    #   sequentially, because `next dev` serves an uncompiled route while it
                    #   rewrites the .next manifest, and N workers hitting ~20 at once turns
                    #   that into intermittent 500s. Skipped when PLAYWRIGHT_BASE_URL is set.
pnpm screenshots    # Regenerate marketing screenshots in public/marketing/ (needs pnpm seed:dev data; refuses non-local DATABASE_URL; filter with CAPTURE_ONLY=key1,key2)
pnpm typecheck      # tsc --noEmit
pnpm check          # Biome check on src/docs/prisma (applies safe fixes)
```

---

# Environment Variables

```
# Database
DATABASE_URL

# NextAuth
NEXTAUTH_URL
NEXTAUTH_SECRET
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET

# Email
RESEND_API_KEY
RESEND_FROM_EMAIL
NEXT_PUBLIC_APP_URL

# Stripe (billing)
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_PRICE_ID_STARTER
STRIPE_PRICE_ID_PRO

# Checkr (background checks)
CHECKR_CLIENT_ID
CHECKR_CLIENT_SECRET
CHECKR_DEFAULT_PACKAGE
CHECKR_TOKEN_ENCRYPTION_KEY

# Platform admin (legacy env-var fallback; prefer DB column)
PLATFORM_ADMIN_IDS

# Cron
CRON_SECRET
```

See `.env.example` for safe defaults.

---

# Database

PostgreSQL is used as the primary database.

Prisma is the ORM. Client is generated to `src/prisma/generated/client`.

Apply migrations:

```bash
pnpm prisma migrate deploy
```

Seed data:

```bash
pnpm prisma db seed          # Auto-detects: production seed in NODE_ENV=production, dev seed otherwise
pnpm seed:production         # Production only (platform org + skill catalog)
pnpm seed:dev                # Dev/staging (full demo data + 3 test accounts)
```

---

# Roadmap Status

| Phase | Name | Status |
|-------|------|--------|
| 1 | Volunteer Screening | Complete |
| 2 | Volunteer Opportunities | Complete |
| 3 | Matching Engine | Complete |
| 4 | Volunteer Profiles & Credentials | Complete |
| 5 | Scheduling & Shifts | Complete |
| 6A | Employer Accounts & Billing | Complete |
| 6B | Background Check Integration | Complete |
| 6C | Portable Credential Sharing | Complete |
| 6D | Corporate ESG Reporting | Complete |
| 6E | Mobile PWA | Complete |
| 7 | Network Growth & Volunteer Identity | Complete |
| 8 | Operational Polish & CEO Quick Wins | Complete |
| 9 | Production-Ready + Activation | Complete |
| 10 | Scale & Enterprise Readiness | Complete |
| 11 | Volunteer Marketplace & API Platform | In Progress |
| 12 | Concierge Activation Engine | Complete |

See `docs/ROADMAP.md` for full detail.

---

# Design System

The product follows a documented design system defined in `DESIGN.md` — the public marketing
site and the authenticated staff shell alike. Key choices:

- **Aesthetic:** Refined Editorial — warm editorial authority meets operational precision
- **Typography:** Fraunces (display) + Geist (body)
- **Color:** `#1B3C2A` primary, `#C4A882` secondary, warm neutrals
- **Touch targets:** 44px minimum on all interactive elements
- **Motion:** `prefers-reduced-motion` respected on all animations
- **Staff lists:** every staff table has two shapes — a `Table` above `lg`, a card list below
  it — switched by CSS, never a JS media query

See `DESIGN.md` for the full specification.

---

# Long-Term Goal

VolunteerReady aims to become the infrastructure layer for nonprofit volunteer engagement.

The platform connects:

- volunteers (portable verified identity)
- nonprofits (full workflow from application through credentialing)
- corporate employers (CSR programs and ESG reporting)
- background check providers (integrated, not bolted on)

into a unified ecosystem.
