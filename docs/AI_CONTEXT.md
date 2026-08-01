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
| Database | PostgreSQL via Prisma 7.7 |
| API | tRPC v11 (superjson serialization) |
| Auth | NextAuth 4 with database sessions (Google OAuth + email magic links via Resend) |
| Validation | Zod 4 (shared schemas between client and server) |
| UI | Tailwind CSS 4 + shadcn/ui (Radix primitives) + Lucide icons |
| Forms | react-hook-form + @hookform/resolvers (Zod) |
| Linting/Formatting | Biome (no ESLint, no Prettier) |
| Testing | Vitest (unit/component), Playwright (e2e) |
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
│   │   ├── company/[companyId]/esg/ # Company admin: ESG dashboard (renamed from /team, redirect in next.config.ts)
│   │   ├── my-applications/      # Volunteer: track own applications
│   │   ├── my-shifts/            # Volunteer: upcoming shift signups
│   │   ├── my-skills/            # Volunteer: manage skill tags
│   │   ├── opportunities/        # Staff: manage opportunities
│   │   ├── volunteers/           # Staff: volunteer roster (rosterProcedure/feature-flagged) — add, search, remove/undo, row-click detail dialog
│   │   ├── analytics/            # Staff: org engagement dashboard (PRO-gated) — funnel, retention, fill rate, top volunteers
│   │   ├── discover/             # Staff: search PUBLIC volunteers + invite to apply (rate-limited)
│   │   ├── my-feedback/          # Volunteer: feedback history with admin replies
│   │   ├── admin/feedback/       # Platform admin: feedback triage inbox (list/detail, status, reply)
│   │   ├── admin/platform/       # Platform admin console (Tier 1): orgs, users, audit viewer, impersonation launch
│   │   ├── profile/              # Volunteer: manage profile + view stats
│   │   ├── screener/             # Admin: configure screening questions
│   │   ├── shifts/               # Staff: manage shifts + attendance + templates tab (STARTER-gated)
│   │   ├── settings/             # Admin: org settings hub — org name + apply slug editor
│   │   ├── settings/background-checks/ # Staff: manage verification badges (moved from /app/credentials, redirect in next.config.ts)
│   │   ├── settings/team/        # Admin: team/member management
│   │   ├── onboarding/           # Org setup flow
│   │   └── welcome/              # Post-login landing
│   ├── (public)/                 # Public marketing pages (homepage, about, pricing, etc.)
│   │   ├── for/                  # Audience index (link rows) + sub-pages:
│   │   │   ├── volunteers/       #   Volunteer marketing page
│   │   │   ├── nonprofits/       #   Nonprofit marketing page
│   │   │   ├── employers/        #   Corporate CSR marketing page
│   │   │   └── animal-shelters/  #   Shelter vertical marketing page
│   │   ├── how-it-works/         # Product walkthrough
│   │   ├── pricing/              # Plan comparison + pricing
│   │   ├── about/                # Team and mission
│   │   ├── security/             # Security & compliance
│   │   ├── privacy/              # Privacy policy page (10 sections, third-party services table)
│   │   ├── terms/                # Terms of service page (15 sections)
│   │   └── v/[userId]/           # Public volunteer identity page (SEO-optimized, share card)
│   ├── api/
│   │   ├── og/[type]/[slug]/     # Dynamic OG images for pages + org routes (Fraunces + Geist fonts)
│   │   ├── share-card/[userId]/  # OG social share image (@vercel/og) — forest green/sand palette
│   │   ├── cron/expire-credentials/ # Daily Vercel Cron — expires stale credentials + share tokens
│   │   ├── cron/email-digests/    # Hourly Vercel Cron — timezone-aware digest emails (cursor-paginated)
│   │   ├── cron/shift-reminders/  # Hourly Vercel Cron — timezone-aware shift reminder emails
│   │   ├── cron/volunteer-reengagement/ # Daily Vercel Cron — 30/60/90-day re-engagement emails
│   │   ├── cron/shift-auto-close/ # Hourly Vercel Cron — auto-completes expired shifts (TOCTOU-safe)
│   │   └── ...                   # stripe webhook, checkr webhook, etc.
│   ├── apply/[orgSlug]/          # Public volunteer application form
│   ├── apply/status/             # Email-based status lookup
│   ├── credentials/claim/[token]/ # Public credential share claim page
│   ├── opportunities/[orgSlug]/  # Public opportunity listings
│   ├── login/                    # Auth page
│   ├── sitemap.ts                # Dynamic sitemap (all public + per-org routes)
│   ├── robots.ts                 # Robots.txt (blocks /app/, /api/ except /api/og/)
│   └── health/                   # Health check endpoint
│
├── components/
│   ├── ui/                       # shadcn/ui primitives (button, input, dialog, etc.)
│   ├── app/                      # Page-specific compound components (notification-bell, shift-templates, org-health-widget, activity-feed, feedback-widget, feedback-admin-notice)
│   ├── app/card-list.tsx         # `CardList` + `CARD_LIST` (`gap-0 divide-y py-0`) — the below-`lg` card counterpart of a staff data table. Card's own `flex flex-col gap-6 py-6` fights `divide-y`, so a bare `<Card className="divide-y">` draws hairlines floating in 24px of space. Four consumers (applications, opportunities, team, volunteers); ShiftsClient deliberately uses neither, its list already sits inside a Card. Never pass `hidden`/`lg:hidden` to it — visibility belongs on a wrapper `div`, since tailwind-merge would drop either it or Card's `flex`
│   ├── plan-gate.tsx             # Plan-tier gating UI (lock card with upgrade CTA)
│   ├── org/                      # Organization management components
│   ├── my-applications/          # Volunteer application tracking
│   ├── opportunities/            # Opportunity display components
│   ├── public-header.tsx         # Marketing site header with nav
│   ├── public-footer.tsx         # Marketing site footer
│   ├── public-hero.tsx           # Shared hero section (eyebrow, heading, CTA)
│   ├── cta-banner.tsx            # Full-width CTA banner
│   ├── fade-in-on-scroll.tsx     # IntersectionObserver scroll animation
│   ├── tracked-link.tsx          # Link with Vercel Analytics click tracking
│   ├── cookie-consent-banner.tsx # GDPR-compliant cookie consent (essential + analytics categories)
│   ├── consented-analytics.tsx   # Google Analytics gtag.js + Vercel Analytics, consent-gated via cookie banner
│   ├── json-ld-breadcrumb.tsx    # BreadcrumbList JSON-LD structured data
│   ├── json-ld-faq.tsx           # FAQPage JSON-LD structured data
│   └── ui/drawer.tsx             # Bottom sheet (shadcn/vaul) — mobile feedback widget
│
├── server/
│   ├── auth.ts                   # NextAuth config + session helpers
│   ├── trpc/
│   │   ├── init.ts               # Context creation, procedure definitions
│   │   ├── root.ts               # App router (combines all sub-routers)
│   │   └── routers/              # auth, health, members, notifications, onboarding,
│   │                               analytics, feedback, opportunities, org, screener,
│   │                               shift-templates, status, volunteer (volunteer's own
│   │                               dashboard), volunteers (staff roster), … — see the
│   │                               tRPC Routers table below
│   ├── services/                 # Business logic layer
│   ├── repositories/             # Prisma data access layer (includes statsRepo for homepage aggregates)
│   ├── lib/                      # Shared utilities and adapters
│   │   ├── adapters/             # External service adapters (Checkr, etc.)
│   │   ├── crypto.ts             # AES-256-GCM encryption for secrets at rest
│   │   ├── tokens.ts             # Shared token generation + SHA-256 hashing
│   │   ├── resend.ts             # Shared Resend email client (lazy singleton)
│   │   ├── email-template.ts     # Branded email wrapper (VolunteerReady header/footer)
│   │   ├── email.ts              # sendEmail() helper — single entry point for all outbound email
│   │   ├── html.ts               # escapeHtml() — shared XSS escape for server-rendered HTML (email + consent pages)
│   │   ├── admin-alerts.ts       # sendNewUserAlert / sendNewOrgAlert / sendNewCompanyAlert / sendImpersonationStartAlert — fire-and-forget admin emails
│   │   ├── admin-recipients.ts   # getAdminEmails() — resolves admin recipients from PLATFORM_ADMIN_ALERT_EMAIL env var or DB isPlatformAdmin flag; 5-min cache
│   │   └── rate-limit.ts         # Upstash Redis rate limiting (lazy singleton, fail-open)
│   └── domain/                   # Pure types + functions + tests
│       ├── volunteer-screening.ts  # Core screening logic (evaluateScreening, validateResponses)
│       ├── notification.ts        # Notification types and domain functions
│       ├── org-health.ts          # Org health score (computeOrgHealth, 0-100, four 25-pt metrics)
│       ├── user-feedback.ts       # Feedback mood/status enums, validation, rate limit constants, Zod schemas
│       ├── reference-data.ts      # SKILL_CATALOG (13 families, 62 skills), CATALOG_VERSION, PLATFORM_ORG_SLUG
│       ├── screener/
│       │   ├── configSchema.ts     # Zod schemas for screening question config
│       │   ├── publicForm.ts       # Public form type mapping
│       │   └── __tests__/
│       └── __tests__/
│
├── lib/
│   ├── trpc/                     # Client-side tRPC setup + provider
│   ├── credential-meta.ts        # Shared credential labels + icons (single source of truth)
│   ├── feedback-config.ts        # Feedback UI config (mood icons, labels, confirmation messages)
│   ├── hooks/use-media-query.ts  # Responsive media query primitive — safe ONLY for Dialog↔Drawer switching, and as of v0.38.3.0 not the thing a new modal calls (use the hook below). Never for page layout: it initialises to false and resolves in an effect, so it flashes the mobile tree to desktop. admin/feedback/page.tsx still does this and should be converted. Still read directly by feedback-widget.tsx and org-profile-form.tsx, which switch at `md`
│   ├── hooks/use-frozen-desktop-shell.ts # `useFrozenDesktopShell(open, query?)` + `DESKTOP_QUERY` (`lg`) — the sanctioned Dialog↔Drawer switch. Reads the query while closed and FREEZES it while open, because Dialog and Drawer are different roots: a live value crossing the breakpoint mid-session (an iPad rotating portrait→landscape crosses 1024) unmounts the modal and takes everything typed into it. Extracted from AddVolunteerDialog at T27's second consumer (VolunteerDetailDialog); do not re-inline it and do not call useMediaQuery directly in a new modal — pass a query override for an `md` one. See CLAUDE.md "Responsive staff tables", "Stay-open add-volunteer form", "Volunteer detail dialog"
│   ├── hooks/use-pending-ids.ts  # `usePendingIds()` — a `Set` of row ids with a mutation in flight, so a list disables exactly the acting rows and leaves the rest live. Fed from `onMutate`/`onSettled` (settled, not success — releasing only on success strands a failed row disabled forever). Replaces `mutation.isPending ? mutation.variables?.id`, which is wrong under concurrency: query-core's `MutationObserver.mutate()` detaches the observer from the previous call, so `variables`/`isPending` describe only the MOST RECENT mutation and at most one row is ever disabled. Keyed by row, not by mutation (shifts has three acting on one row). Used by volunteers, opportunities, shifts and team — NOT applications, which has no row mutations
│   ├── slug.ts                   # URL slug utilities
│   └── utils.ts                  # General utilities (cn, etc.)
│
├── middleware.ts                  # Auth middleware — protects /app/* routes
└── styles/globals.css            # Tailwind directives + CSS variables

prisma/
├── schema.prisma                 # Database schema (source of truth)
├── seed.ts                       # Seed dispatcher (production vs dev based on NODE_ENV)
├── seed-helpers.ts               # Shared Prisma client, types, and upsert helpers
├── seed-production.ts            # Production seed (platform org + skill catalog)
└── seed-dev.ts                   # Dev/staging seed (full demo data + test accounts)

docs/                             # VitePress documentation site
```

---

## Database Schema (Key Models)

The full schema lives in `prisma/schema.prisma`. Key entities:

- **User** — global identity (email, name, image). Relates to accounts, sessions, memberships.
- **Organization** — the tenant. All operational data hangs off this via `orgId`.
- **OrgSlugHistory** — past org apply slugs recorded on rename (`orgId`, `oldSlug` indexed). Powers 307 redirects on `/apply`, `/opportunities`, `/stories` old-slug links and blocks slug re-registration (anti-squat). Cascades on org delete.
- **OrganizationMember** — join table with role: `OWNER | ADMIN | STAFF | READONLY`.
- **VolunteerApplication** — an application to an org, with status (`SUBMITTED | REVIEW | APPROVED | REJECTED | WITHDRAWN`) and screening result (`PASS | REVIEW | FAIL`).
- **VolunteerAnswer** — individual response to a screening question (JSON blob).
- **ScreenerQuestion** — org-specific question with type (`TEXT | SINGLE_CHOICE | MULTI_CHOICE | BOOLEAN | NUMBER`), disqualifier rules, and review rules.
- **VolunteerOpportunity** — a volunteer position with status (`DRAFT | PUBLISHED | CLOSED`), location, dates, capacity.
- **OpportunityTag / OpportunityRequirement** — metadata for opportunities.
- **VolunteerProfile** — 1:1 with User (cross-org). Bio, phone, location, availability, visibility, interests.
- **VolunteerCredential** — org-scoped verification badges (unique per user + org + type). Types: BACKGROUND_CHECK, TRAINING_COMPLETE, ID_VERIFIED, REFERENCE_CHECK, ORIENTATION_COMPLETE, TENURE_1YR, TENURE_3YR, TENURE_5YR. Status lifecycle: PENDING → VERIFIED → EXPIRED / REVOKED. Credentials shared from other orgs carry provenance fields (`sharedFromOrgId`, `sharedFromCredentialId`). Tenure badges are system-issued by the platform org (slug: `platform`) via `tenureBadgeService`.
- **CredentialShareToken** — time-limited (30-day) share link for a VERIFIED credential. SHA-256 hashed token storage. Status lifecycle: ACTIVE → CLAIMED / EXPIRED. Optimistic lock on claim prevents concurrent claims.
- **VolunteerInvitation** — tracks org-to-volunteer invitations for proactive talent discovery. Unique constraint on `(orgId, volunteerId, opportunityId)` for duplicate detection. Rate-limited per org (10 invites/day).
- **Shift** — org-scoped volunteer shift with time range, capacity, status, optional opportunity link.
- **ShiftSignup** — volunteer sign-up for a shift (unique per shift + user). Status: CONFIRMED / CANCELLED / NO_SHOW / ATTENDED / WAITLISTED.
- **ShiftTemplate** — org-scoped recurring shift pattern (day of week, time range, capacity). Plan-gated to STARTER+.
- **Notification** — user-scoped, org-scoped notification with type, title, body, optional href, soft delete. Types: APPLICATION_UPDATE, SHIFT_REMINDER, CREDENTIAL_UPDATE, SYSTEM, BADGE_EARNED, FIRST_APPLICATION, REENGAGEMENT.
- **NotificationPreference** — per-user, per-org, per-type delivery channel toggles (inApp, email).
- **BackgroundCheckRequest** — org-scoped background check lifecycle (PENDING → COMPLETE / CONSIDER / FAILED / CANCELLED). FCRA status nested within CONSIDER: NONE → PRE_ADVERSE_SENT → ADVERSE_ACTION_SENT / RESOLVED. Provider tokens encrypted at rest (AES-256-GCM).
- **CheckrWebhookEvent** — idempotency table for webhook deduplication (mirrors StripeWebhookEvent pattern).
- **AuditLog** — append-only, immutable activity log per org. Also carries platform-level actions (IMPERSONATION_START/END, PLATFORM_ADMIN_GRANTED/REVOKED, SESSIONS_REVOKED) where `orgId` is null.
- **ImpersonationSession** — platform-admin impersonation record. Fields: `adminUserId`, `targetUserId`, `reason`, `startedAt`, `expiresAt`, `endedAt`, `endedReason`. Indexed on all three for active-lookup + per-user history. Hard-capped at 30 minutes — no refresh, start a new session instead.
- **FeatureFlag** — per-org feature toggles.
- **OrganizationInvitation** — team invite tokens with expiry.
- **ApplicationStatusToken** — opaque tokens for public status lookups.
- **UserFeedback** — in-app feedback submitted via the floating widget. Mood (HAPPY / NEUTRAL / FRUSTRATED / BUG / IDEA), status lifecycle (NEW → IN_PROGRESS → RESOLVED / DISMISSED), page context, admin reply with email notification. Rate limited to 5/hour per user. Soft-deletable.
- **ReferenceDataMeta** — key-value table for reference data version tracking (key: string, version: int, seededAt: DateTime). Used by the boot guard to detect when the skill catalog needs re-seeding after a `CATALOG_VERSION` bump.

See `docs/DOMAIN.md` for canonical vocabulary.

---

## Authentication & Authorization

**Auth flow:** NextAuth with database sessions (not JWT). Providers: Google OAuth and email magic links (Resend).

**Session resolution:** The NextAuth session callback in `auth.ts` performs a single DB query that fetches `session.currentOrgId` and the user's full membership list, and resolves `orgId`/`role` from that data. The tRPC context in `init.ts` reads these pre-resolved values when a session token is available — but NextAuth v4 database sessions don't always pass the token to the callback, and under impersonation there's no session token for the target user at all. In both cases `init.ts` falls back to its own `Session`/`User` lookup keyed on `effectiveUserId`, so "no additional queries" only holds for the common real-session-with-token case, not universally.

**tRPC procedure levels** (defined in `src/server/trpc/init.ts`):

| Procedure | Requires | Context narrowing |
|---|---|---|
| `publicProcedure` | Nothing | — |
| `protectedProcedure` | Authenticated user | — |
| `orgProcedure` | Authenticated + org membership | `orgId: string` (non-null) |
| `staffProcedure` | STAFF, ADMIN, or OWNER role | `role: Role` (non-null) |
| `adminProcedure` | ADMIN or OWNER role | `role: Role` (non-null) |
| `companyScopedProcedure(opts?)` | Company membership (+ optional `minRole`/`minPlanTier`), keyed off `companyId` in the tRPC **input**, never session state | `companyId: string`, `companyRole: CompanyMemberRole` |
| `platformAdminProcedure` | `ctx.realUserId` is a platform admin (checked against real session, not impersonated one) | — |

Each middleware narrows the context type via `next({ ctx: { ... } })`, so downstream code can use `ctx.orgId` and `ctx.role` without non-null assertions. Always use the **narrowest** access level possible.

**Input-supplied `userId` is untrusted, even for staff.** The procedure type says the caller is staff and `ctx.orgId` says at which org; neither says anything about a `userId` the caller typed into the input. User ids are discoverable — `/v/[userId]` is a public route. Staff procedures that act on an input-supplied `userId` call `requireOrgVolunteerRelationship(orgId, userId, opts?)` (`src/server/services/orgVolunteerAccessService.ts`, v0.32.1.0), backed by `findOrgVolunteerRelationship()` (`orgVolunteerRepo.ts`). It is the org↔volunteer mirror of `requireCompanyAccess()` with the trust direction inverted: the tenant id comes from `ctx`, the user id from input. Accepted relationships are `APPLICATION`, `ORG_VOLUNTEER`, `SHIFT_SIGNUP`, and `ORG_MEMBER` — the set deliberately excludes anything staff can mint unilaterally against a stranger (`VolunteerCredential` and `BackgroundCheckRequest` are circular, since they are the rows the guarded write creates; `VolunteerInvitation` is an outbound solicitation any staff user can send cross-org; `OpportunityInterest` is a public marketplace heart-click). It throws `NOT_FOUND`, not `FORBIDDEN`, so a caller probing ids cannot tell "not yours" from "not real"; `getOrgVolunteerRelationship()` is the non-throwing form for reads that render an empty state. `revokeCredential` passes `acceptExistingCredential: true` and is the only caller that does — revocation is strictly narrowing so it cannot bootstrap itself, and without it a de-rostered volunteer's credential stays visible in `listOrgCredentials` but can never be revoked. Gated procedures: `profile.getOrgVisibleProfile`, `credentials.issue`, `credentials.revoke`, `backgroundChecks.initiate` (guarded inside the shared Checkr/Sterling `initiateProviderCheck` path, before the paid API call that receives SSN and date of birth). The resolved kind is stamped onto audit metadata as `relationship`, so the authorizing edge survives a later roster soft-delete — with two exceptions: `credentials.remove` needs no guard (`removeCredential()` deletes on the `(userId, orgId, type)` compound key, so a stranger's row cannot match), and `issueCredentialAndResolveFcra()` writes `CREDENTIAL_ISSUED` with no `relationship` key, since it resolves an existing `BackgroundCheckRequest` the guard already cleared at initiation.

**A volunteer can revoke the whole set (v0.37.0.0).** Leaving an org from `/app/profile` writes an `OrgVolunteerBlock`, and `findOrgVolunteerRelationship()` then suppresses every kind it resolved except `ORG_MEMBER` and `EXISTING_CREDENTIAL`. This exists because every other accepted edge is one staff can mint from an email address — `addVolunteer` needs no consent — so soft-deleting the roster row alone revoked nothing the org could not recreate in two clicks. The block lookup runs **after** the probes (blocks are rare; the rejection path is already the expensive one) and the accept path pays one indexed lookup on a unique key. `ORG_MEMBER` is exempt *and* re-probed after a suppression, so a coordinator who is also on their own org's roster cannot lock themselves out by leaving it, and does not lose membership access merely because `APPLICATION` was found first. `EXISTING_CREDENTIAL` is exempt because it is opt-in and reached only by the strictly-narrowing `revokeCredential` — suppressing it leaves an issued credential visible in `listOrgCredentials` and permanently unrevokable. Four paths also check `findOrgVolunteerBlock()` directly, refusing in three shapes chosen per surface: `addVolunteer` / `restoreVolunteer` → `FORBIDDEN`, `ensureAppliedRosterRow` → returns false (an approval must not fail), `assignVolunteerToShift` → `NOT_FOUND` (it reads roster rows directly, not through the guard). Blocks are lifted **only** by `liftOrgVolunteerBlock()` (`orgVolunteerAccessService.ts`), and only from a volunteer's own act — application submit with a known `submittedByUserId`, claim, or shift signup. An anonymous submit deliberately does not lift, since `screener.submit` accepts an attacker-supplied address. Adding a staff-reachable lift path would hand the revocation back to the party it exists to constrain.

**Impersonation.** A platform admin can temporarily act as another user via `/app/admin/platform/users/[id]`. Resolution goes through `resolveEffectiveUserId(realUserId, cookieValue)` (`src/server/lib/impersonation-context.ts`) — a pure function with no `getServerSession()`/`cookies()` inside it, so it resolves identically from tRPC's `createTRPCContext`, raw Next.js Route Handlers, and Server Component layout guards, not just inside tRPC. `platformAdminProcedure` uses `realUserId` so admins retain platform access while impersonating. All platform-admin actions call `requireRealUserId(ctx)` so audit rows attribute to the real admin, never the effective user. Resolution fails **closed**: if a cookie is present but resolution throws, `resolveEffectiveUserId()` returns `effectiveUserId: null` + `resolutionFailed: true` rather than silently falling back to the real admin's identity — mutation paths and read-then-write SSR pages (e.g. `company/page.tsx`, `settings/page.tsx`) must check `resolutionFailed` and refuse rather than fall back. Callers that resolve an impersonated target's company (no session token exists for a user who isn't actually signed in) list all memberships via `listCompaniesForUser()` (`companyRepo.ts`); when the target belongs to 2+ companies, `company/page.tsx` renders an explicit `LinkRowList` picker instead of guessing, and `app/(app)/app/layout.tsx` leaves `companyId` null so the sidebar's "Company" link falls back to the bare `/app/company` picker route rather than a guessed company — v0.30.0.0 closed the P2 multi-company gap. The Checkr OAuth org-selection flow (`src/app/api/checkr/oauth/callback/route.ts`) still uses `findFirst({ orderBy: { createdAt: 'asc' } })` to guess an impersonated target's org; see `docs/TODOS.md` P2 item for that remaining gap. Company-scoped mutations taken while impersonating (`company.switchCompany`, `linkNonprofit`, `unlinkNonprofit`, `invite`) now record `impersonatedBy: ctx.realUserId` in the audit log metadata instead of attributing the action to the impersonated user alone (v0.30.0.0). **Only `id` is swapped.** `createTRPCContext` builds the session as `{ ...realSession.user, id: effectiveUserId }`, so every other field — `ctx.session.user.email` above all — still belongs to the *real admin*. Code that pairs `session.user.id` with `session.user.email` is mixing two identities. Resolve the address from the id instead, with `findEmailByUserId()` (`userAccountStateRepo.ts`); `screener.claimableApplications` / `screener.claimApplication` take only a user id for exactly this reason (v0.33.1.0).

**Application claiming.** An anonymous application (`submittedByUserId: null`) is **never** bound to a user implicitly. `screener.submit` is a `publicProcedure` that accepts an arbitrary `submittedByEmail`, so orphan rows are attacker-controllable, and binding one mints the `APPLICATION` relationship that `requireOrgVolunteerRelationship()` accepts as authorization for `profile.getOrgVisibleProfile` and `credentials.issue`. Until v0.33.1.0 a function named `linkApplicationsToUser()` ran an unscoped `updateMany` on every `/app/my-applications` load, auto-attaching every address match — a live privilege escalation. It is deleted. Binding now runs through `screener.claimApplication` → `claimApplication()` (`src/server/services/my-applications.ts`) → `claimApplicationForUser()` (`src/server/repositories/volunteer-applications.ts`), which enforces the email match **inside the Prisma `where` clause** rather than as a caller-side comparison, so a foreign application id matches zero rows. Candidates are offered by `screener.claimableApplications` → `listClaimableApplications()` → `listClaimableApplicationsByEmail()` and surfaced as an "Is this you?" confirmation card on `/app/my-applications`. `screener.submit` and `screener.checkAnonymousApplication` normalize `submittedByEmail` on input so both sides of that exact-equality predicate stay canonical — never reach for Prisma's `mode: 'insensitive'` on an authorization predicate. Any new path that attaches an application to a user must go through `claimApplicationForUser()` or repeat its `where`.

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
| `org` | getCurrentOrg, listOrgs, switchOrg, updateQrColor, updateTimezone, updateOrgProfile (admin: name + apply slug, slug safety rails), updateMarketplaceSettings |
| `discovery` | searchVolunteers (staff), inviteToApply (staff) |
| `feedback` | submit, myFeedback, listAll (platform admin), updateStatus (platform admin), reply (platform admin), newCount (platform admin) |
| `platformAdmin` | `orgs.{list,get}`, `users.{list,get,setPlatformAdmin,revokeAllSessions}`, `impersonation.{start,end,current,history}`, `audit.{query,options}` — all `platformAdminProcedure`. Audit metadata is redacted by `auditQueryService` before return. |
| `profile` | getMyProfile, updateMyProfile, getMyStats, getMyUserId, getPublicProfile (public), getOrgVisibleProfile (staff + org-relationship gated) |
| `screener` | submit (public), list, detail, updateApplicationStatus, createQuestion, listQuestions, getDashboardStats, myApplications, myApplicationDetail, claimableApplications, claimApplication (rate-limited; explicit user-confirmed binding — see "Application claiming") |
| `shifts` | list, getById, create, update, cancel, complete, remove, getSignups, markAttendance, myUpcoming, signup, cancelSignup |
| `shiftTemplates` | list, create, update, remove, generate (staffProcedure, STARTER-gated) |
| `volunteers` | list, count, getById, add, remove, restore — all `rosterProcedure` (`staffProcedure` + the roster feature flag for `ctx.orgId`). Every `volunteerId` input is an `OrgVolunteer.id`, never a `User.id`, and both reads withhold `userId` from the client — it is a cross-org correlation handle. `getById` (v0.38.3.0) backs the roster's row-click detail dialog; the roster row IS the org relationship, so it needs no `requireOrgVolunteerRelationship` |
| `notifications` | list, unreadCount, markRead, markAllRead (protectedProcedure) |
| `analytics` | getDashboard (staffProcedure, PRO-gated via `planTierProcedure('PRO')`) |
| `billing` | createCheckoutSession, createBillingPortalSession, getBillingStatus |
| `company` | create, listMyCompanies, switchCompany, getCurrent, linkNonprofit, unlinkNonprofit, listLinkedNonprofits, invite, acceptInvite — company-scoped procedures take `companyId` via `companyScopedProcedure(opts?)`, never session state |
| `esgReport` | getSummary (`companyScopedProcedure({ minRole: 'ADMIN', minPlanTier: 'PRO' })`) |
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

**Duplicate prevention:** A partial unique index on `(submittedByUserId, opportunityId)` WHERE `submittedByUserId IS NOT NULL AND status NOT IN ('REJECTED', 'WITHDRAWN')` prevents authenticated volunteers from double-applying. The service catches P2002 violations as a race-condition safety net. Applied-status badges appear on opportunity listings, and the apply form intercepts already-applied users with a redirect to their existing application.

**Status notification emails:** Branded emails are sent when application status changes to REVIEW, APPROVED, or REJECTED via `sendApplicationStatusEmail()` in the screening service.

---

## Matching Engine (Core Domain)

The volunteer–opportunity matching system lives in `src/server/domain/volunteer-matching.ts`.

**Flow:** Volunteer adds skills via `/app/my-skills` → skills stored in `VolunteerSkill` → when browsing opportunities, `rankOpportunities()` scores each opportunity against the volunteer's skill set → results shown as match badges on cards. Since v0.31.0.0, `OpportunitiesListing.tsx` (public org listing) and `BrowseOpportunities.tsx` (the authenticated, cross-org `/app/browse` page) also hide `NONE`-match opportunities by default once match results exist, with a "Show opportunities I'm not qualified for" checkbox to reveal them again; a missing match-result entry is treated as unqualified (fails closed) rather than shown. Any signed-in user with no skill profile yet sees the unfiltered list plus a nudge to `/app/my-skills` — matching (and the nudge) is keyed off having a `VolunteerSkill` profile, not off a volunteer role, so a staff or company user with one gets filtered too (`docs/TODOS.md` P2).

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
- `src/server/services/volunteerCredentialService.ts` — `issueCredential()`, `revokeCredential()`, `removeCredential()` (all transactional with audit). `issueCredential` and `revokeCredential` call `requireOrgVolunteerRelationship()` first — the only UI for both is a free-text "Volunteer User ID" field, and `revokeCredential` goes through the same `upsertCredential` as issuance, so ungated it would *create* a REVOKED credential on a stranger's account that `getCredentialsByUserId` (no org filter) then shows them
- `src/server/services/orgVolunteerAccessService.ts` — `requireOrgVolunteerRelationship()` / `getOrgVolunteerRelationship()`, the single place the "may this org act on this user" policy lives, plus `liftOrgVolunteerBlock()`. That "single place" covers whether an org may **act**; roster **membership** is deliberately callsite-local, with three services across five call sites (`staffVolunteerService`, `appliedRosterService`, `shiftSignupService`) importing `findOrgVolunteerBlock` from the repository directly across four call sites, because they refuse in three different shapes

**tRPC routers:**
- `src/server/trpc/routers/profile.ts` — `getMyUserId`, `getMyProfile`, `updateMyProfile`, `getMyStats`, `listMyOrgMemberships`, `leaveOrgRoster` (`protectedProcedure`); `getPublicProfile` (`publicProcedure`); `getOrgVisibleProfile` (`staffProcedure`, gated by `requireOrgVolunteerRelationship`). `leaveOrgRoster` takes an `orgId` as of v0.37.0.0 (an org holding only an application has no roster row to name, and must still be leavable) and deliberately needs no org↔volunteer guard — the service proves a real edge with `hasLeavableOrgRelationship()` before writing, and the caller's `userId` sits inside the repository `WHERE`, so a crafted `orgId` reaches only their own rows. `listMyOrgMemberships` is backed by `listMyOrgRelationships()`, which lists every org that can act on the caller — roster row, application, or shift signup — not just live roster rows; listing only roster rows let an org deny the remedy by removing the volunteer first
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

**Signup:** Unique per shift + user. Validated against capacity, duplicate check, and time overlap with user's other confirmed shifts. Status: CONFIRMED → ATTENDED / NO_SHOW / CANCELLED / WAITLISTED. When a shift is FULL, volunteers join as WAITLISTED; when a confirmed signup cancels, the earliest waitlisted volunteer is auto-promoted (FIFO).

**Shift Templates:** Recurring shift patterns (day of week, time range, capacity) that generate concrete shifts for N weeks. Plan-gated to STARTER+ via `maxShiftTemplates` limit.

**Key types:** `ShiftData`, `SignupRecord`, `ShiftCapacity`, `AttendanceSummary`, `SignupValidation`

**Key functions:** `computeShiftCapacity()`, `validateSignup()`, `validateShiftTimes()`, `summarizeAttendance()` — all pure, no side effects

**Service orchestration:**
- `src/server/services/shiftService.ts` — `createNewShift()`, `updateExistingShift()`, `cancelShift()`, `completeShift(id, orgId, actorId: string | null)`, `removeShift()` (all transactional with audit). `completeShift` uses atomic `updateMany` with status WHERE clause for TOCTOU safety; returns `null` if status guard blocks.
- `src/server/services/shift-auto-close-service.ts` — `autoCloseExpiredShifts()` — hourly cron auto-completes shifts past endTime using per-record try/catch (P2025 safe)
- `src/server/services/shiftSignupService.ts` — `signUpForShift()` (validates + auto-FULL), `cancelSignup()` (auto-reopen + waitlist auto-promote), `markAttendance()`, `joinWaitlist()`, `leaveWaitlist()` (all transactional with audit)
- `src/server/services/shiftTemplateService.ts` — template CRUD + bulk shift generation with time validation and audit logging

**tRPC routers:**
- `src/server/trpc/routers/shifts.ts` — Staff: `list`, `getById`, `create`, `update`, `cancel`, `complete`, `remove`, `getSignups`, `markAttendance` (`staffProcedure`). Volunteer: `myUpcoming`, `signup`, `cancelSignup` (`protectedProcedure`).
- `src/server/trpc/routers/shift-templates.ts` — `list`, `create`, `update`, `remove`, `generate` (`staffProcedure`, STARTER-gated).

---

## In-App Notifications

The notification system lives in `src/server/domain/notification.ts`.

**Notification:** User-scoped, org-scoped notification with type, title, body, optional href, and soft delete. Types: APPLICATION_UPDATE, SHIFT_REMINDER, CREDENTIAL_UPDATE, SYSTEM. Unread count polled every 30 seconds.

**Preferences:** Per-user, per-org, per-type delivery channel toggles (inApp, email). The `notify()` function checks preferences before creating the notification.

**Cleanup:** Daily cron job purges dismissed notifications older than 90 days alongside credential expiry.

**Service orchestration:** `src/server/services/notificationService.ts` — `notify()` (checks preferences), `tryNotify()` (fire-and-forget wrapper for use in other services)

**tRPC router:** `src/server/trpc/routers/notifications.ts` — `list` (cursor-based, protectedProcedure), `unreadCount`, `markRead`, `markAllRead`

**UI:** `src/components/app/notification-bell.tsx` — Popover with infinite scroll, empty state ("You're all caught up"), unread dot indicator.

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
pnpm e2e                  # Playwright e2e (boots the dev server; authenticated specs only run against localhost targets)
                          #   Pauses ~30-60s first while e2e/global-setup.ts warms every public route
pnpm screenshots          # Regenerate marketing screenshots in public/marketing/ (CAPTURE=1 Playwright project; needs pnpm seed:dev data; refuses non-local DATABASE_URL; filter with CAPTURE_ONLY=key1,key2)
pnpm check                # Biome check on src/docs/prisma (applies safe fixes)
pnpm prisma migrate deploy  # Apply migrations
pnpm prisma db seed         # Seed data (production or dev based on NODE_ENV)
pnpm seed:production        # Production seed only (platform org + skill catalog)
pnpm seed:dev               # Dev/staging seed (full demo data + test accounts)
pnpm prisma studio          # Prisma Studio UI
pnpm docs:dev               # VitePress dev server
```

---

## Conventions

- **Files:** `kebab-case.ts` (e.g., `volunteer-screening.ts`)
- **Component files:** `kebab-case` (e.g. `page-header.tsx`, `card-list.tsx`) — matching CLAUDE.md's repo-wide file naming rule. The *exported component* is `PascalCase` (`PageHeader`, `CardList`); only the filename is kebab. A handful of pre-existing files deviate (`OrgSwitcher.tsx`, `CompanySwitcher.tsx`, `ApplicationStatusBadge.tsx`) — those are the exception and are tracked in `docs/UI_CONSISTENCY_REVIEW.md`, not the convention to copy
- **Functions/variables:** `camelCase`
- **Types/interfaces:** `PascalCase`
- **Indentation:** 2 spaces
- **Quotes:** single
- **Path alias:** `@/` → `src/`
- **Tests:** co-located in `__tests__/` dirs or `*.test.ts` files; Playwright e2e specs live in `e2e/`

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
| `src/server/repositories/auditRepo.ts` | Audit logging (both standalone and transactional variants) + cursor-paginated query API for the platform-admin viewer |
| `src/server/domain/impersonation.ts` | Impersonation constants, reason Zod schema, `EffectiveUser` type, audit action constants |
| `src/server/services/impersonationService.ts` | `startImpersonation` (txn: session + audit), `endImpersonation` (idempotent), `resolveImpersonation` (security: cookie must be bound to admin's real session) |
| `src/server/services/platformUserService.ts` | List/get users, grant/revoke platform admin, revoke all sessions — reason required, audits every mutation |
| `src/server/services/platformOrgService.ts` | Platform-wide org list/detail with counts and recent applications |
| `src/server/services/auditQueryService.ts` | Query + metadata redaction (sensitive keys replaced with `[REDACTED]`, warned once per key) for the audit viewer |
| `src/server/lib/impersonation-context.ts` | `resolveEffectiveUserId(realUserId, cookieValue)` — pure, fail-closed impersonation resolver shared by tRPC context, Route Handlers, and layout guards; `getImpersonationContext()` (Server-Component helper, reads the cookie itself, returns banner metadata + `resolutionFailed`) wraps it |
| `src/components/app/impersonation-banner.tsx` | Sticky top banner with countdown + end-session button; renders above `AppShell` when impersonating |
| `src/app/(app)/app/admin/platform/` | Platform admin console pages: orgs, users, audit viewer, impersonation launch |
| `src/app/api/platform-admin/impersonation/{start,end}/route.ts` | Cookie-setting endpoints — cookie is HTTP-only, scoped to the impersonation session id, 30-min max-age |
| `src/server/domain/screener/configSchema.ts` | Zod schemas for screening question configuration |
| `src/server/domain/volunteer-matching.ts` | Pure matching/scoring logic (case-insensitive, 0–100 scores) |
| `src/server/services/volunteerMatchingService.ts` | Matching service orchestration |
| `src/server/domain/volunteer-profile.ts` | Profile completeness scoring + credential validation |
| `src/server/services/volunteerProfileService.ts` | Profile service orchestration |
| `src/server/services/volunteerCredentialService.ts` | Credential service orchestration |
| `src/server/domain/shift.ts` | Shift capacity, signup validation, attendance summaries, and hours math (`shiftDurationHours`, `sumAttendedHours` — the total rounds ONCE from the raw millisecond sum, never by adding rounded per-row figures) |
| `src/server/services/shiftService.ts` | Shift CRUD with audit logging |
| `src/server/services/shiftSignupService.ts` | Signup orchestration with capacity + conflict checks |
| `src/server/services/volunteerIdentityService.ts` | Public volunteer identity assembly — getPublicProfile (React.cache-wrapped), getOrgVisibleProfile(userId, orgId) (staff-only; `orgId` required and checked — returns null for not-found, PRIVATE, and out-of-org alike), reliability score |
| `src/server/services/orgVolunteerAccessService.ts` | Org↔volunteer guard — `requireOrgVolunteerRelationship(orgId, userId, opts?)` (throws NOT_FOUND) and `getOrgVolunteerRelationship()` (returns null); the one module that decides whether an org may act on an input-supplied `userId` |
| `src/server/services/orgAccessService.ts` | `requireOrgAccess({ userId, orgId, minRole })` — the Route-Handler counterpart to tRPC's `staffProcedure`, for `/api/org/[orgId]/**`. `staffProcedure` reads `ctx.orgId` from the session's ACTIVE org, so a URL-scoped route cannot reuse it; this takes `orgId` as a parameter and re-checks membership, role rank AND suspension against it. Any new `/api/org/[orgId]/**` handler must use this |
| `src/server/repositories/orgVolunteerRepo.ts` | Roster reads + `findOrgVolunteerRelationship()` — the accepted-relationship set, the reasoning for what is deliberately excluded, and the `OrgVolunteerBlock` suppression that overrides all of it except `ORG_MEMBER` / `EXISTING_CREDENTIAL`. Also `listMyOrgRelationships()` (the volunteer's own list, keyed on access rather than roster) and the block create/delete/find helpers. Holds the ONE definition of "an attended shift, at this org" — a private `attendedShiftWhere(orgId, user)` shared by `countAttendedShiftsByUser` (the roster row's `Shifts` cell) and `listAttendedShiftsForUserInOrg` (the detail dialog behind it), joined through `shift.orgId` because `ShiftSignup` has no `orgId` column. Do not reach for `getAttendedShiftsForUser` in `shiftSignupRepo.ts` from a staff surface: it is cross-org on purpose |
| `src/server/services/my-applications.ts` | Volunteer-facing application reads + `listClaimableApplications()` / `claimApplication()` — the only sanctioned path that binds an anonymous application to a user; takes a user id, never a session email |
| `src/server/repositories/volunteer-applications.ts` | `listClaimableApplicationsByEmail()` / `claimApplicationForUser()` — the email match lives in the Prisma `where`, so a foreign application id matches zero rows |
| `src/server/repositories/userAccountStateRepo.ts` | `AccountState` transitions + `findEmailByUserId()` — resolve an address from the id you are acting on, since `ctx.session.user.email` is the real admin's under impersonation |
| `src/server/services/volunteerDiscoveryService.ts` | Volunteer search + invite-to-apply — rate-limited, TOCTOU-safe transaction, audit logged |
| `src/server/services/notificationService.ts` | Notification delivery — checks preferences, creates notifications, fire-and-forget wrapper |
| `src/server/services/shiftTemplateService.ts` | Shift template CRUD + bulk shift generation with plan-tier enforcement |
| `src/server/services/orgMarketplaceService.ts` | Org marketplace settings — `updateMarketplaceSettings()` (visibility, description, location, causeAreaTags); extracted from org router to enforce service-layer boundary |
| `src/server/services/orgAnalyticsService.ts` | Org analytics dashboard — orchestrates 4 parallel queries; days=null skips retention and uses epoch fromDate |
| `src/server/repositories/orgAnalyticsRepo.ts` | Raw SQL analytics queries (Prisma.sql parameterized); getApplicationFunnel, getRetentionStats, getAvgFillRate, getTopVolunteers |
| `src/server/repositories/volunteerDiscoveryRepo.ts` | `searchPublicProfiles()` — `visibility = PUBLIC` hardcoded invariant, cursor pagination, credential/skill/location filters |
| `src/server/services/tenureBadgeService.ts` | Fire-and-forget tenure badge issuance — idempotent, P2002-safe, called from 3 service triggers |
| `src/server/services/credential-expiry-service.ts` | Daily cron — expires stale credentials + share tokens (P2025 safe) |
| `src/server/services/shift-auto-close-service.ts` | Hourly cron — auto-completes expired shifts using atomic updateMany guard, per-record try/catch (P2025 safe) |
| `src/server/domain/org-health.ts` | Pure domain: `computeOrgHealth()` — 0-100 score from four 25-pt metrics (screener, opportunity, shift signup, credential); returns score + next actionable tip |
| `src/components/app/org-health-widget.tsx` | `OrgHealthWidget` — progress bar + tip text; renders inside dashboard greeting banner |
| `src/components/app/activity-feed.tsx` | `ActivityFeed` — curated AuditLog query (last 20 events), grouped by date, relative timestamps; uses `screener.getActivityFeed` tRPC query |
| `src/server/lib/email-template.ts` | Branded email wrapper matching DESIGN.md colors |
| `src/lib/credential-meta.ts` | Shared credential labels + icons (single source of truth for all UI) |
| `src/server/domain/credential-sharing.ts` | Share token lifecycle guards, expiry computation |
| `src/server/services/credentialShareService.ts` | Credential sharing workflows (generate, claim, revoke, shareAllOnApply) |
| `src/server/lib/tokens.ts` | Shared token generation (256-bit) and SHA-256 hashing |
| `src/server/domain/background-check.ts` | FCRA state machine guards, waiting period helpers, PII sanitization, provider-agnostic `mapResultToStatus` |
| `src/server/services/backgroundCheckService.ts` | Background check lifecycle, FCRA workflow, token encryption; provider-agnostic via shared `initiateProviderCheck` + `handleProviderWebhookEvent` |
| `src/server/lib/adapters/background-check/registry.ts` | `getAdapter(provider)` factory — returns Checkr or Sterling adapter |
| `src/server/lib/adapters/background-check/sterling.ts` | Sterling adapter: API integration, HMAC-SHA256 webhook verification, 7 typed error classes |
| `src/server/lib/crypto.ts` | AES-256-GCM encrypt/decrypt/tryDecrypt for secrets at rest |
| `src/server/domain/esg-report.ts` | ESG report domain — `esgReportInputSchema` + `normalizeESGDateRange` (end-of-day `to` bounds, inverted-range rejection), `computeESGSummary`, CSV formatting. Re-exports `escapeCsvField` from `domain/csv.ts` for back-compat; the implementation moved there |
| `src/server/domain/csv.ts` | The repo's ONE CSV parser and writer — `parseCsvRecords`, `escapeCsvField`, `toCsvLine`, `unescapeCsvField`, `CsvFormatError`. RFC 4180: quoted fields, embedded commas and newlines, `""` escapes, BOM, CRLF/LF/CR. Read this before writing any CSV code; a `split(',')` is wrong for the files this actually receives (`"Smith, Jane"` shifts every later column left). `unescapeCsvField` exists because our own export is an input to our own importer — it undoes the formula-injection prefix, without which a round trip corrupts every international phone number. Consumers: ESG export, roster export, roster import |
| `vitest.config.mts` | Test configuration (ESM, path aliases) |
| `playwright.config.ts` | E2E configuration (boots `pnpm dev`; `PLAYWRIGHT_BASE_URL` override; `CAPTURE=1` swaps the `chromium` project for the marketing-screenshot `capture` project — mutually exclusive so a leaked env var can't rewrite `public/marketing/*.png` mid-e2e) |
| `e2e/utils/db.ts` | Playwright auth harness — seeds a NextAuth database session for authenticated e2e specs; refuses non-local `DATABASE_URL` unless `E2E_ALLOW_REMOTE_DB=1` |
| `e2e/global-setup.ts` | Playwright `globalSetup` — fetches every public route SEQUENTIALLY before the workers start. `webServer.url` only proves `/` answers; in `next dev` the rest are uncompiled, and N workers hitting ~20 at once makes Next read a `.next` manifest another compile is mid-write, surfacing as `SyntaxError: Unexpected end of JSON input` 500s (worst on `/locations/*` — six slugs share one `generateStaticParams` with `dynamicParams = false`). Route list is DERIVED from `PUBLIC_PAGES` + `LOCATIONS`, never retyped. Skipped when `PLAYWRIGHT_BASE_URL` is set; warns rather than throws |
| `e2e/utils/layout.ts` | Layout assertions — `expectNoHorizontalOverflow` (document-level, names the widest node), `expectNoInternalScroll` (a `Table`'s `overflow-auto` wrapper scrolls internally while the document stays exactly the viewport width), `expectEllipsized` (proves `truncate` is doing work; needs a fixture string with no line-break opportunities — underscores, not spaces or hyphens). All three are different properties; the document check alone is necessary but not sufficient. Consumers: `staff-tables-mobile.spec.ts`, `staff-created-volunteers.spec.ts` |
| `src/lib/marketing-screenshots.ts` | Marketing screenshot asset manifest — single source of truth for `public/marketing/*.png`; pages import entries; each entry has `src` and an optional `darkSrc` dark-mode variant; `marketing-screenshots.test.ts` asserts every asset exists on disk |
| `src/components/annotated-screenshot.tsx` | `AnnotatedScreenshot` — product screenshot with numbered %-positioned markers + HTML legend (homepage pillar rows, `/how-it-works`, `/screening`, `/for/animal-shelters`; `ScreenshotSection`'s optional `annotations` prop); optional `darkSrc` prop renders a paired dark-mode image, toggled via Tailwind `dark:` classes (no `useTheme()` hook) |
| `e2e/capture-scenarios.ts` | Typed capture scenarios (actor/path/clickTabs/waitForText/`variants`) for `pnpm screenshots` — deterministic 1280×720 captures from seeded demo data, one pass per declared color-scheme variant (`e2e/capture.spec.ts`) |

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
| 6E — Mobile PWA | ✅ Complete |
| 7 — Network Growth & Volunteer Identity | ✅ Complete |
| 8 — Operational Polish & CEO Quick Wins | ✅ Complete |
| 9 — Production-Ready + Activation | ✅ Complete |
| 10 — Scale & Enterprise Readiness | ✅ Complete |
| 11A — Volunteer Marketplace (browse + map) | ✅ Complete |
| 11B — Marketplace Interest + Digest | ✅ Complete |
| 11C — Marketplace Phase Review | ✅ Complete |
| 12 — Concierge Activation Engine | ✅ Complete |

The staff-created-volunteer roster (v0.32.0.0 onward) is tracked as a **lane** in
[`docs/designs/staff-created-volunteers.md`](designs/staff-created-volunteers.md), not as a
phase here. Its most recent ships: Lane G concierge import/export/metrics (v0.38.0.0),
responsive staff tables T28 (v0.38.1.0), the stay-open add form T25 (v0.38.2.0), the
volunteer detail dialog T27 (v0.38.3.0), and the remaining four staff tables T36
(v0.38.4.0).

The per-phase notes below stop at v0.26.2.0 and are kept as history. **`CHANGELOG.md` is
authoritative for anything more recent** — do not read the last note below as the latest
release.

Phase 7 delivered: `/v/[userId]` public identity page, OG share card, volunteer identity panel on screener, tenure badge auto-issuance (TENURE_1YR/3YR/5YR), reliability score, availability + credential matching bonuses, volunteer discovery (`/app/discover`) with invite-to-apply (rate-limited), org analytics dashboard (`/app/analytics`, PRO-gated).

Phase 8 delivered: in-app notifications (bell + preferences), plan gate component (tier-based feature gating), shared `sendEmail()` helper, shift templates (recurring patterns + bulk generation), waitlist for full shifts (FIFO auto-promote), email consolidation (7 senders migrated), notification cleanup cron, top volunteers date range filter, accessibility audit.

Phase 9 delivered: onboarding wizard, getting-started checklist, shift reminder emails, application status timeline, email digests (daily/weekly), bulk CSV import, Stripe webhook reconciliation, credential expiry notifications, cron health dashboard, product screenshots, design system compliance fixes, privacy policy page, terms of service page, GDPR-compliant cookie consent banner, consented analytics.

Phase 10 (partial) delivered: shift auto-close cron (TOCTOU-safe), AuditLog/Shift composite indexes (CONCURRENTLY), bulk import durability (`waitUntil`), timezone-aware notification delivery, re-engagement emails, digest cursor pagination — and (v0.14.0) org health score widget, admin activity feed, dashboard rewrite (Getting Started Checklist replaced by OrgHealthWidget + ActivityFeed), audit log improvements (MEMBER_INVITED event, shift.completed metadata, try-catch resilience).

Phase 11C delivered: tag-aware searchVector (trigger includes title + description + tags; GIN index split to separate migration for zero-downtime), `orgMarketplaceService.ts` extraction, RFC 8058 unsubscribe split (GET=form, POST=mutate), `suspendedAt: null` guards on all marketplace queries, P2002 catch scoped inside transaction for `toggleInterest`.

v0.26.2.0 delivered: admin signup notification emails (`sendNewUserAlert`, `sendNewOrgAlert`, `sendNewCompanyAlert` in `admin-alerts.ts`), shared admin recipient resolver (`admin-recipients.ts`, `getAdminEmails()` with 5-min cache), feedback notifications refactored to use shared helper, `PLATFORM_ADMIN_ALERT_EMAIL` now controls all admin notification recipients, CRLF injection fix in email subjects.

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
10. **Trusting a `userId` from the input because the caller is staff** — `staffProcedure` proves the caller is staff and `ctx.orgId` says where; neither says the person named in the input belongs to that org, and user ids are public (`/v/[userId]`). Call `requireOrgVolunteerRelationship(ctx.orgId, input.userId)` before acting on them, and don't widen the accepted-relationship set at the callsite. If your path creates a live `OrgVolunteer` row instead of acting on one, check `findOrgVolunteerBlock()` too — the guard governs actions, not membership, so without it a block produces an inert roster row staff cannot schedule, credential, or background-check, with no explanation in the UI.
11. **Unscoped e2e cleanup under `fullyParallel`** — `playwright.config.ts` runs spec files in parallel worker processes, each with its own `beforeAll`/`afterAll`. A shared-prefix cleanup sweep (`startsWith: PREFIX`) run in `afterAll` can delete a sibling worker's still-in-use rows mid-test — scope `afterAll` to the exact IDs that worker's `beforeAll` created instead (see `e2e/esg-dashboard.spec.ts`).
12. **Disabling a list row with `mutation.variables`** — `mutation.isPending ? mutation.variables?.id : undefined` looks like per-row pending state and is not. query-core's `MutationObserver.mutate()` detaches the observer from the previous call before starting the next, so both fields describe only the MOST RECENT mutation: act on row B while row A is in flight and A's controls silently re-enable, leaving at most one row disabled however many requests are open. That is strictly worse than the bare `mutation.isPending` it usually replaces, which at least made concurrent submits impossible. Use `usePendingIds()` (`src/lib/hooks/use-pending-ids.ts`), fed from `onMutate`/`onSettled`.
13. **Gating page LAYOUT on `useMediaQuery`** — it initialises to `false` and only reads `matchMedia` in an effect, so every desktop user gets the mobile tree painted first and swapped after hydration. Table↔card switches are pure CSS (`hidden lg:block` / `lg:hidden`, both trees rendered from the same array). The hook is safe only inside a modal, which mounts after the effect has run — and there it must be frozen while open via `useFrozenDesktopShell`, never re-read live. `src/app/(app)/app/admin/feedback/page.tsx` still violates this.
