# AI Context — VolunteerReady

> One-file orientation for LLMs and AI coding agents working in this codebase.
> For deeper dives, see the linked docs throughout.

---

## What Is This?

VolunteerReady is a **multi-tenant SaaS platform** that helps nonprofit organizations recruit, screen, and manage volunteers. It is being built as the foundation of a VolunteerMatch-style ecosystem. The tenant boundary is **Organization** — virtually every domain record is scoped by `orgId`.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router), React 19 |
| Language | TypeScript 5.9 (strict mode) |
| Database | PostgreSQL via Prisma 7.5 |
| API | tRPC v11 (superjson serialization) |
| Auth | NextAuth 4 with database sessions (Google OAuth + email magic links via Resend) |
| Validation | Zod 4 (shared schemas between client and server) |
| UI | Tailwind CSS 4 + shadcn/ui (Radix primitives) + Lucide icons |
| Forms | react-hook-form + @hookform/resolvers (Zod) |
| Linting/Formatting | Biome (no ESLint, no Prettier) |
| Testing | Vitest |
| Docs site | VitePress |
| Package manager | pnpm |

---

## Architecture (Layered, SOLID)

```
UI  (src/app + src/components)          — routing, page composition, rendering
 ↓
API  (src/server/trpc)                  — thin routers, input validation, delegation
 ↓
Services  (src/server/services)         — business logic, orchestration, audit logging
 ↓
Repositories  (src/server/repositories) — Prisma-only data access
 ↓
Domain  (src/server/domain)             — pure types, invariants, functions (no framework code)
 ↓
Database  (PostgreSQL)
```

**Hard rules:**

- No Prisma calls in UI, components, or tRPC routers.
- Routers call services. Services call repositories. No shortcuts.
- All DB writes go through services so audit logging is automatic.
- Domain layer is pure — no imports from Prisma, Next.js, or tRPC.
- Zod schemas live next to domain models; import on both client and server.
- All multi-step writes (create + audit, update + audit) use `prisma.$transaction` for atomicity.
- Audit logs are written inside the same transaction as the operation they record via `writeAuditLogTx(tx, input)`.

See `docs/ARCHITECTURE.md` for the full rationale.

---

## Directory Layout

```
src/
├── app/                          # Next.js App Router pages
│   ├── (app)/app/                # Protected org-scoped routes
│   │   ├── applications/         # Staff: review volunteer applications
│   │   ├── credentials/          # Staff: manage volunteer verification badges
│   │   ├── my-applications/      # Volunteer: track own applications
│   │   ├── my-shifts/            # Volunteer: upcoming shift signups
│   │   ├── my-skills/            # Volunteer: manage skill tags
│   │   ├── opportunities/        # Staff: manage opportunities
│   │   ├── discover/             # Staff: search PUBLIC volunteers + invite to apply (feature-flagged)
│   │   ├── profile/              # Volunteer: manage profile + view stats
│   │   ├── screener/             # Admin: configure screening questions
│   │   ├── shifts/               # Staff: manage shifts + attendance
│   │   ├── settings/team/        # Admin: team/member management
│   │   ├── onboarding/           # Org setup flow
│   │   └── welcome/              # Post-login landing
│   ├── (public)/                 # Public marketing pages (homepage, about, pricing, etc.)
│   │   ├── for-volunteers/       # Volunteer marketing page
│   │   ├── for-nonprofits/       # Nonprofit marketing page
│   │   ├── for-employers/        # Corporate CSR marketing page
│   │   ├── how-it-works/         # Product walkthrough
│   │   ├── pricing/              # Plan comparison + pricing
│   │   ├── about/                # Team and mission
│   │   ├── security/             # Security & compliance
│   │   └── v/[userId]/           # Public volunteer identity page (SEO-optimized, share card)
│   ├── api/
│   │   ├── share-card/[userId]/  # OG social share image (@vercel/og) — forest green/sand palette
│   │   └── ...                   # stripe webhook, checkr webhook, etc.
│   ├── apply/[orgSlug]/          # Public volunteer application form
│   ├── apply/status/             # Email-based status lookup
│   ├── credentials/claim/[token]/ # Public credential share claim page
│   ├── opportunities/[orgSlug]/  # Public opportunity listings
│   ├── login/                    # Auth page
│   └── health/                   # Health check endpoint
│
├── components/
│   ├── ui/                       # shadcn/ui primitives (button, input, dialog, etc.)
│   ├── app/                      # Page-specific compound components
│   ├── org/                      # Organization management components
│   ├── my-applications/          # Volunteer application tracking
│   ├── opportunities/            # Opportunity display components
│   ├── public-header.tsx         # Marketing site header with nav
│   ├── public-footer.tsx         # Marketing site footer
│   ├── public-hero.tsx           # Shared hero section (eyebrow, heading, CTA)
│   ├── cta-banner.tsx            # Full-width CTA banner
│   ├── fade-in-on-scroll.tsx     # IntersectionObserver scroll animation
│   └── tracked-link.tsx          # Link with Vercel Analytics click tracking
│
├── server/
│   ├── auth.ts                   # NextAuth config + session helpers
│   ├── trpc/
│   │   ├── init.ts               # Context creation, procedure definitions
│   │   ├── root.ts               # App router (combines all sub-routers)
│   │   └── routers/              # auth, health, members, onboarding,
│   │                               opportunities, org, screener, status
│   ├── services/                 # Business logic layer
│   ├── repositories/             # Prisma data access layer (includes statsRepo for homepage aggregates)
│   ├── lib/                      # Shared utilities and adapters
│   │   ├── adapters/             # External service adapters (Checkr, etc.)
│   │   ├── crypto.ts             # AES-256-GCM encryption for secrets at rest
│   │   ├── tokens.ts             # Shared token generation + SHA-256 hashing
│   │   └── resend.ts             # Shared Resend email client (lazy singleton)
│   └── domain/                   # Pure types + functions + tests
│       ├── volunteer-screening.ts  # Core screening logic (evaluateScreening, validateResponses)
│       ├── screener/
│       │   ├── configSchema.ts     # Zod schemas for screening question config
│       │   ├── publicForm.ts       # Public form type mapping
│       │   └── __tests__/
│       └── __tests__/
│
├── lib/
│   ├── trpc/                     # Client-side tRPC setup + provider
│   ├── email/                    # Email template builders
│   ├── slug.ts                   # URL slug utilities
│   └── utils.ts                  # General utilities (cn, etc.)
│
├── middleware.ts                  # Auth middleware — protects /app/* routes
└── styles/globals.css            # Tailwind directives + CSS variables

prisma/
├── schema.prisma                 # Database schema (source of truth)
└── seed.ts                       # Development seed data

docs/                             # VitePress documentation site
```

---

## Database Schema (Key Models)

The full schema lives in `prisma/schema.prisma`. Key entities:

- **User** — global identity (email, name, image). Relates to accounts, sessions, memberships.
- **Organization** — the tenant. All operational data hangs off this via `orgId`.
- **OrganizationMember** — join table with role: `OWNER | ADMIN | STAFF | READONLY`.
- **VolunteerApplication** — an application to an org, with status (`SUBMITTED | REVIEW | APPROVED | REJECTED`) and screening result (`PASS | REVIEW | FAIL`).
- **VolunteerAnswer** — individual response to a screening question (JSON blob).
- **ScreenerQuestion** — org-specific question with type (`TEXT | SINGLE_CHOICE | MULTI_CHOICE | BOOLEAN | NUMBER`), disqualifier rules, and review rules.
- **VolunteerOpportunity** — a volunteer position with status (`DRAFT | PUBLISHED | CLOSED`), location, dates, capacity.
- **OpportunityTag / OpportunityRequirement** — metadata for opportunities.
- **VolunteerProfile** — 1:1 with User (cross-org). Bio, phone, location, availability, visibility, interests.
- **VolunteerCredential** — org-scoped verification badges (unique per user + org + type). Types: BACKGROUND_CHECK, TRAINING_COMPLETE, ID_VERIFIED, REFERENCE_CHECK, ORIENTATION_COMPLETE, TENURE_1YR, TENURE_3YR, TENURE_5YR. Status lifecycle: PENDING → VERIFIED → EXPIRED / REVOKED. Credentials shared from other orgs carry provenance fields (`sharedFromOrgId`, `sharedFromCredentialId`). Tenure badges are system-issued by the platform org (slug: `platform`) via `tenureBadgeService`.
- **CredentialShareToken** — time-limited (30-day) share link for a VERIFIED credential. SHA-256 hashed token storage. Status lifecycle: ACTIVE → CLAIMED / EXPIRED. Optimistic lock on claim prevents concurrent claims.
- **VolunteerInvitation** — tracks org-to-volunteer invitations for proactive talent discovery. Unique constraint on `(orgId, volunteerId, opportunityId)` for duplicate detection. Rate-limited per org (10 invites/day).
- **Shift** — org-scoped volunteer shift with time range, capacity, status, optional opportunity link.
- **ShiftSignup** — volunteer sign-up for a shift (unique per shift + user). Status: CONFIRMED / CANCELLED / NO_SHOW / ATTENDED.
- **BackgroundCheckRequest** — org-scoped background check lifecycle (PENDING → COMPLETE / CONSIDER / FAILED / CANCELLED). FCRA status nested within CONSIDER: NONE → PRE_ADVERSE_SENT → ADVERSE_ACTION_SENT / RESOLVED. Provider tokens encrypted at rest (AES-256-GCM).
- **CheckrWebhookEvent** — idempotency table for webhook deduplication (mirrors StripeWebhookEvent pattern).
- **AuditLog** — append-only, immutable activity log per org.
- **FeatureFlag** — per-org feature toggles.
- **OrganizationInvitation** — team invite tokens with expiry.
- **ApplicationStatusToken** — opaque tokens for public status lookups.

See `docs/DOMAIN.md` for canonical vocabulary.

---

## Authentication & Authorization

**Auth flow:** NextAuth with database sessions (not JWT). Providers: Google OAuth and email magic links (Resend).

**Session resolution (single source of truth):** The NextAuth session callback in `auth.ts` performs a single DB query that fetches `session.currentOrgId` and the user's full membership list. It resolves `orgId` and `role` from that data and attaches them to the session object. The tRPC context in `init.ts` reads these pre-resolved values — no additional queries needed.

**tRPC procedure levels** (defined in `src/server/trpc/init.ts`):

| Procedure | Requires | Context narrowing |
|---|---|---|
| `publicProcedure` | Nothing | — |
| `protectedProcedure` | Authenticated user | — |
| `orgProcedure` | Authenticated + org membership | `orgId: string` (non-null) |
| `staffProcedure` | STAFF, ADMIN, or OWNER role | `role: Role` (non-null) |
| `adminProcedure` | ADMIN or OWNER role | `role: Role` (non-null) |

Each middleware narrows the context type via `next({ ctx: { ... } })`, so downstream code can use `ctx.orgId` and `ctx.role` without non-null assertions. Always use the **narrowest** access level possible.

---

## tRPC Routers

All routers live in `src/server/trpc/routers/`. The combined app router is in `root.ts`.

| Router | Key procedures |
|---|---|
| `auth` | signout |
| `backgroundChecks` | initiate, listByOrg, cancel, sendPreAdverseNotice, finalizeAdverseAction, resolveFcra, getCheckrOAuthUrl, getCheckrStatus, disconnectCheckr |
| `credentials` | getMyCredentials, listOrgCredentials, issue, revoke, remove |
| `credentialSharing` | generate, listMyTokens, revoke, getTokenInfo (public), claim (staff), shareCount, externalCredentialCount (staff), requestSharing (staff) |
| `health` | ping |
| `matching` | getMySkills, updateMySkills, getRecommendations |
| `members` | list, invite, updateRole, remove |
| `onboarding` | create org, initial setup |
| `opportunities` | create, update, delete, list, getById |
| `org` | getCurrentOrg, listOrgs, switchOrg |
| `discovery` | searchVolunteers (staff), inviteToApply (staff) |
| `profile` | getMyProfile, updateMyProfile, getMyStats, getMyUserId, getPublicProfile (public), getOrgVisibleProfile (staff) |
| `screener` | submit (public), listApplications, getApplicationDetail, updateStatus, createQuestion, listQuestions, getDashboardStats, myApplications, myApplicationDetail |
| `shifts` | list, getById, create, update, cancel, complete, remove, getSignups, markAttendance, myUpcoming, signup, cancelSignup |
| `billing` | createCheckoutSession, createBillingPortalSession, getBillingStatus |
| `company` | create, list, switchCompany, inviteMember, listMembers, linkNonprofit |
| `status` | public token-based status lookups |

---

## Screening Logic (Core Domain)

The screening engine lives in `src/server/domain/volunteer-screening.ts`.

**Flow:** Volunteer submits answers → `validateResponses()` checks against question schemas → `evaluateScreening()` runs disqualifier and review rules → application is created with a screening status.

**Rule types:**

- **DisqualifierRule** — matched answer → `FAIL` (auto-reject)
- **ReviewRule** — matched answer → `REVIEW` (manual review needed)
- **Operators:** `equals`, `includes`, `lt`, `lte`, `gt`, `gte`

**Config validation:** `src/server/domain/screener/configSchema.ts` provides Zod schemas for validating screening question configurations, including `disqualifierRuleSchema`, `reviewRuleSchema`, and `questionConfigSchema`.

The service orchestrator is `src/server/services/volunteer-screening.ts`. It wraps application creation, answer submission, and audit logging in a single `prisma.$transaction`.

---

## Matching Engine (Core Domain)

The volunteer–opportunity matching system lives in `src/server/domain/volunteer-matching.ts`.

**Flow:** Volunteer adds skills via `/app/my-skills` → skills stored in `VolunteerSkill` → when browsing opportunities, `rankOpportunities()` scores each opportunity against the volunteer's skill set → results shown as match badges on cards.

**Scoring algorithm:**

- No requirements → score 100 (PERFECT)
- Any REQUIRED skill missing → score 0 (NONE)
- All REQUIRED met → base 50 + up to 50 bonus for PREFERRED match ratio
- Phase 7 context bonuses (additive, cap at 100): +5 availability alignment, +5 verified credential match
- PERFECT = 100 (skill score only, bonuses don't change match verdict), PARTIAL = 50–99, NONE = 0
- Skills are compared case-insensitively with whitespace trimming

**Key types:** `VolunteerSkillSet`, `OpportunityRequirementSet`, `MatchResult`, `MatchType`

**Key functions:** `scoreOpportunity()`, `rankOpportunities()` — both pure, no side effects

**Service orchestration:** `src/server/services/volunteerMatchingService.ts` — `updateVolunteerSkills()` (transactional with audit), `getMatchedOpportunities()` (parallel fetch + rank)

**tRPC router:** `src/server/trpc/routers/matching.ts` — `getMySkills`, `updateMySkills`, `getRecommendations` (all `protectedProcedure`)

**Note:** Volunteer skills are cross-org (tied to `User`, not `Organization`). The `VolunteerSkill` model uses `@@unique([userId, skill])` for deduplication.

---

## Volunteer Profiles & Credentials

The volunteer profile system lives in `src/server/domain/volunteer-profile.ts`.

**Profile:** Cross-org identity (1:1 with User). Includes bio, phone, location, availability, interests, and visibility settings. Profile completeness is scored 0–100 based on weighted fields (name 20, email 15, bio 15, location 15, interests 15, phone 10, photo 5, availability 5).

**Credentials:** Org-scoped verification badges. Each credential is unique per `userId + orgId + type`. Types: BACKGROUND_CHECK, TRAINING_COMPLETE, ID_VERIFIED, REFERENCE_CHECK, ORIENTATION_COMPLETE. Phase 7 adds system-issued tenure badges: TENURE_1YR, TENURE_3YR, TENURE_5YR (issued by platform org). Status lifecycle: PENDING → VERIFIED → EXPIRED / REVOKED.

**Key types:** `ProfileData`, `ProfileCompleteness`, `CompletenessLevel`, `CredentialRecord`, `CredentialSummary`, `TenureLevel`, `TenureResult`, `ActivityRecord`, `SignupRecord`

**Key functions:** `computeProfileCompleteness()`, `isCredentialValid()`, `summarizeCredentials()`, `computeTenure()`, `computeReliabilityScore()` — all pure, no side effects

**Service orchestration:**
- `src/server/services/volunteerProfileService.ts` — `getVolunteerProfileWithCompleteness()`, `saveVolunteerProfile()` (transactional with audit)
- `src/server/services/volunteerCredentialService.ts` — `issueCredential()`, `revokeCredential()`, `removeCredential()` (all transactional with audit)

**tRPC routers:**
- `src/server/trpc/routers/profile.ts` — `getMyProfile`, `updateMyProfile`, `getMyStats` (all `protectedProcedure`)
- `src/server/trpc/routers/credentials.ts` — `getMyCredentials` (`protectedProcedure`), `listOrgCredentials`, `issue`, `revoke`, `remove` (`staffProcedure`)

---

## Portable Credential Sharing

The credential sharing system lives in `src/server/domain/credential-sharing.ts`.

**Flow:** Volunteer generates a share link for a VERIFIED credential → link contains a raw token (never stored) → org staff visits `/credentials/claim/[token]` → staff claims credential into their org → credential copy is created with provenance fields.

**Token lifecycle:** ACTIVE → CLAIMED (staff claims) / EXPIRED (time-based or volunteer revokes)

**Claim guards (6 conditions):** token ACTIVE, token not expired, credential VERIFIED, credential not expired, not claiming own org's credential, no duplicate credential type in claiming org.

**Auto-share on apply:** "Bring my credentials" checkbox on apply form triggers `shareAllOnApply()` — creates tokens + immediately claims them in a single transaction for audit trail.

**Key types:** `ShareTokenStatus`, `CredentialStatus`, `CredentialType`

**Key functions:** `canShareCredential()`, `canClaimToken()`, `isTokenExpired()`, `computeTokenExpiry()`, `tokenDaysRemaining()` — all pure, no side effects

**Service orchestration:** `src/server/services/credentialShareService.ts` — `generateShareToken()` (P2002 collision retry), `claimShareToken()` (optimistic lock + provenance), `revokeShareToken()`, `shareAllOnApply()`, `requestCredentialSharing()` (org-initiated email request)

**tRPC router:** `src/server/trpc/routers/credentialSharing.ts` — `generate`, `listMyTokens`, `revoke` (`protectedProcedure`); `getTokenInfo` (`publicProcedure`); `claim`, `externalCredentialCount`, `requestSharing` (`staffProcedure`)

**UI routes:**
- `/credentials/claim/[token]` — public claim page (preview + claim button)
- `/app/profile` — Credentials tab with share link generation, token management, revoke
- `/app/applications/[id]` — "Portable credentials" card (staff sees external credential count + request sharing button)
- `/apply/[orgSlug]` — "Bring my credentials" checkbox

**Shared token utility:** `src/server/lib/tokens.ts` — `generateToken()` (256-bit random hex) and `hashToken()` (SHA-256), used across invitations, status tokens, and credential share tokens.

---

## Scheduling & Shifts

The shift scheduling system lives in `src/server/domain/shift.ts`.

**Shift:** Org-scoped time block with capacity. Optional link to a VolunteerOpportunity. Status lifecycle: OPEN → FULL (auto at capacity) → COMPLETED / CANCELLED. FULL auto-reverts to OPEN when a signup is cancelled.

**Signup:** Unique per shift + user. Validated against capacity, duplicate check, and time overlap with user's other confirmed shifts. Status: CONFIRMED → ATTENDED / NO_SHOW / CANCELLED.

**Key types:** `ShiftData`, `SignupRecord`, `ShiftCapacity`, `AttendanceSummary`, `SignupValidation`

**Key functions:** `computeShiftCapacity()`, `validateSignup()`, `validateShiftTimes()`, `summarizeAttendance()` — all pure, no side effects

**Service orchestration:**
- `src/server/services/shiftService.ts` — `createNewShift()`, `updateExistingShift()`, `cancelShift()`, `completeShift()`, `removeShift()` (all transactional with audit)
- `src/server/services/shiftSignupService.ts` — `signUpForShift()` (validates + auto-FULL), `cancelSignup()` (auto-reopen), `markAttendance()` (all transactional with audit)

**tRPC router:** `src/server/trpc/routers/shifts.ts` — Staff: `list`, `getById`, `create`, `update`, `cancel`, `complete`, `remove`, `getSignups`, `markAttendance` (`staffProcedure`). Volunteer: `myUpcoming`, `signup`, `cancelSignup` (`protectedProcedure`).

---

## Commands

```bash
pnpm install              # Install dependencies
pnpm dev                  # Dev server (port 3005)
pnpm build                # Production build
pnpm start                # Production server
pnpm lint                 # Biome lint
pnpm format               # Biome format
pnpm typecheck            # tsc --noEmit
pnpm test                 # Vitest (run once)
pnpm test:watch           # Vitest (watch mode)
pnpm check                # typecheck + lint + test (full CI suite)
pnpm prisma migrate deploy  # Apply migrations
pnpm prisma db seed         # Seed dev data
pnpm prisma studio          # Prisma Studio UI
pnpm docs:dev               # VitePress dev server
```

---

## Conventions

- **Files:** `kebab-case.ts` (e.g., `volunteer-screening.ts`)
- **Components:** `PascalCase` (e.g., `PageHeader.tsx`)
- **Functions/variables:** `camelCase`
- **Types/interfaces:** `PascalCase`
- **Indentation:** 2 spaces
- **Quotes:** single
- **Path alias:** `@/` → `src/`
- **Tests:** co-located in `__tests__/` dirs or `*.test.ts` files

---

## Key Files to Read First

| File | Why |
|---|---|
| `AGENTS.md` | Repository rules and locked-in decisions |
| `prisma/schema.prisma` | Database schema — source of truth for data model |
| `src/server/trpc/init.ts` | tRPC context, auth middleware, procedure definitions |
| `src/server/domain/volunteer-screening.ts` | Core domain logic and types |
| `src/server/services/volunteer-screening.ts` | Primary service orchestration pattern |
| `src/server/trpc/routers/screener.ts` | Largest router — shows tRPC patterns |
| `src/middleware.ts` | Auth middleware for route protection |
| `src/server/auth.ts` | NextAuth configuration + session org resolution |
| `src/server/repositories/auditRepo.ts` | Audit logging (both standalone and transactional variants) |
| `src/server/domain/screener/configSchema.ts` | Zod schemas for screening question configuration |
| `src/server/domain/volunteer-matching.ts` | Pure matching/scoring logic (case-insensitive, 0–100 scores) |
| `src/server/services/volunteerMatchingService.ts` | Matching service orchestration |
| `src/server/domain/volunteer-profile.ts` | Profile completeness scoring + credential validation |
| `src/server/services/volunteerProfileService.ts` | Profile service orchestration |
| `src/server/services/volunteerCredentialService.ts` | Credential service orchestration |
| `src/server/domain/shift.ts` | Shift capacity, signup validation, attendance summaries |
| `src/server/services/shiftService.ts` | Shift CRUD with audit logging |
| `src/server/services/shiftSignupService.ts` | Signup orchestration with capacity + conflict checks |
| `src/server/services/volunteerIdentityService.ts` | Public volunteer identity assembly — getPublicProfile (React.cache-wrapped), getOrgVisibleProfile (staff-only), reliability score |
| `src/server/services/volunteerDiscoveryService.ts` | Volunteer search + invite-to-apply — rate-limited, TOCTOU-safe transaction, audit logged |
| `src/server/repositories/volunteerDiscoveryRepo.ts` | `searchPublicProfiles()` — `visibility = PUBLIC` hardcoded invariant, cursor pagination, credential/skill/location filters |
| `src/server/services/tenureBadgeService.ts` | Fire-and-forget tenure badge issuance — idempotent, P2002-safe, called from 3 service triggers |
| `src/server/domain/credential-sharing.ts` | Share token lifecycle guards, expiry computation |
| `src/server/services/credentialShareService.ts` | Credential sharing workflows (generate, claim, revoke, shareAllOnApply) |
| `src/server/lib/tokens.ts` | Shared token generation (256-bit) and SHA-256 hashing |
| `src/server/domain/background-check.ts` | FCRA state machine guards, waiting period helpers, PII sanitization |
| `src/server/services/backgroundCheckService.ts` | Background check lifecycle, FCRA workflow, token encryption |
| `src/server/lib/crypto.ts` | AES-256-GCM encrypt/decrypt/tryDecrypt for secrets at rest |
| `vitest.config.mts` | Test configuration (ESM, path aliases) |

---

## Roadmap Status

| Phase | Status |
|---|---|
| 1 — Volunteer Screening | ✅ Complete |
| 2 — Volunteer Opportunities | ✅ Complete |
| 3 — Matching Engine | ✅ Complete |
| 4 — Volunteer Profiles | ✅ Complete |
| 5 — Scheduling & Shifts | ✅ Complete |
| 6A — Employer Accounts & Billing | ✅ Complete |
| 6B — Background Check Integration | ✅ Complete |
| 6C — Portable Credential Sharing | ✅ Complete |
| 6D — Corporate ESG Reporting | ✅ Complete |
| 6E — Mobile PWA | Planned |
| 7 — Network Growth & Volunteer Identity | 🚧 In Progress |

Phase 7 delivered: `/v/[userId]` public identity page, OG share card, volunteer identity panel on screener, tenure badge auto-issuance (TENURE_1YR/3YR/5YR), reliability score, availability + credential matching bonuses, volunteer discovery (`/app/discover`) with invite-to-apply (feature-flagged).

See `docs/ROADMAP.md` for details.

---

## LLM Reference Docs

When you need framework-specific guidance, consult these:

- Prisma: <https://www.prisma.io/llms.txt>
- Next.js: <https://nextjs.org/docs/llms-full.txt>
- React: <https://react.dev/reference/react>
- shadcn/ui: <https://ui.shadcn.com/llms.txt>

---

## Common Pitfalls

1. **Forgetting `orgId`** — every org-scoped query must filter by it. If you skip it, data leaks across tenants.
2. **Putting Prisma in routers** — routers must call services, services call repositories. No exceptions.
3. **Skipping audit logging** — route writes through services so audit logs are created automatically. Use `writeAuditLogTx(tx, input)` inside transactions, not the fire-and-forget `writeAuditLog`.
4. **Using JWT assumptions** — sessions are database-backed, not JWT. `currentOrgId` lives in the session row.
5. **Duplicating Zod schemas** — schemas are defined once in the domain layer and imported everywhere else.
6. **Ignoring role hierarchy** — use the narrowest procedure type. Don't default to `orgProcedure` when `staffProcedure` or `adminProcedure` is appropriate.
7. **Using non-null assertions (`!`)** — tRPC middleware narrows context types. Use `ctx.orgId` (already `string`), not `ctx.orgId!`.
8. **Fire-and-forget writes** — always wrap related writes (e.g., create + audit) in `prisma.$transaction` so they succeed or fail together.
9. **Pagination** — opportunity and application list endpoints use cursor-based pagination. Use `take + cursor + skip: 1` pattern, not offset-based `skip`.
