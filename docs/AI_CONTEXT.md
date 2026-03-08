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
| Database | PostgreSQL via Prisma 7.3 |
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

See `docs/ARCHITECTURE.md` for the full rationale.

---

## Directory Layout

```
src/
├── app/                          # Next.js App Router pages
│   ├── (app)/app/                # Protected org-scoped routes
│   │   ├── applications/         # Staff: review volunteer applications
│   │   ├── my-applications/      # Volunteer: track own applications
│   │   ├── opportunities/        # Staff: manage opportunities
│   │   ├── screener/             # Admin: configure screening questions
│   │   ├── settings/team/        # Admin: team/member management
│   │   ├── onboarding/           # Org setup flow
│   │   └── welcome/              # Post-login landing
│   ├── apply/[orgSlug]/          # Public volunteer application form
│   ├── apply/status/             # Email-based status lookup
│   ├── opportunities/[orgSlug]/  # Public opportunity listings
│   ├── login/                    # Auth page
│   └── health/                   # Health check endpoint
│
├── components/
│   ├── ui/                       # shadcn/ui primitives (button, input, dialog, etc.)
│   ├── app/                      # Page-specific compound components
│   ├── org/                      # Organization management components
│   ├── my-applications/          # Volunteer application tracking
│   └── opportunities/            # Opportunity display components
│
├── server/
│   ├── auth.ts                   # NextAuth config + session helpers
│   ├── trpc/
│   │   ├── init.ts               # Context creation, procedure definitions
│   │   ├── root.ts               # App router (combines all sub-routers)
│   │   └── routers/              # auth, health, members, onboarding,
│   │                               opportunities, org, screener, status
│   ├── services/                 # Business logic layer
│   ├── repositories/             # Prisma data access layer
│   └── domain/                   # Pure types + functions + tests
│       ├── volunteer-screening.ts
│       ├── screener/
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
- **AuditLog** — append-only, immutable activity log per org.
- **FeatureFlag** — per-org feature toggles.
- **OrganizationInvitation** — team invite tokens with expiry.
- **ApplicationStatusToken** — opaque tokens for public status lookups.

See `docs/DOMAIN.md` for canonical vocabulary.

---

## Authentication & Authorization

**Auth flow:** NextAuth with database sessions (not JWT). Providers: Google OAuth and email magic links (Resend).

**Session:** Extended with `currentOrgId` to support org switching without token refresh.

**tRPC procedure levels** (defined in `src/server/trpc/init.ts`):

| Procedure | Requires |
|---|---|
| `publicProcedure` | Nothing |
| `protectedProcedure` | Authenticated user |
| `orgProcedure` | Authenticated + org membership |
| `staffProcedure` | STAFF, ADMIN, or OWNER role |
| `adminProcedure` | ADMIN or OWNER role |

Always use the **narrowest** access level possible.

---

## tRPC Routers

All routers live in `src/server/trpc/routers/`. The combined app router is in `root.ts`.

| Router | Key procedures |
|---|---|
| `auth` | signout |
| `health` | ping |
| `members` | list, invite, updateRole, remove |
| `onboarding` | create org, initial setup |
| `opportunities` | create, update, delete, list, getById |
| `org` | getCurrentOrg, listOrgs, switchOrg |
| `screener` | submit (public), listApplications, getApplicationDetail, updateStatus, createQuestion, listQuestions, getDashboardStats, myApplications, myApplicationDetail |
| `status` | public token-based status lookups |

---

## Screening Logic (Core Domain)

The screening engine lives in `src/server/domain/volunteer-screening.ts`.

**Flow:** Volunteer submits answers → `validateResponses()` checks against question schemas → `evaluateScreening()` runs disqualifier and review rules → application is created with a screening status.

**Rule types:**

- **DisqualifierRule** — matched answer → `FAIL` (auto-reject)
- **ReviewRule** — matched answer → `REVIEW` (manual review needed)
- **Operators:** `equals`, `includes`, `lt`, `lte`, `gt`, `gte`

The service orchestrator is `src/server/services/volunteer-screening.ts`.

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
| `src/server/auth.ts` | NextAuth configuration |

---

## Roadmap Status

| Phase | Status |
|---|---|
| 1 — Volunteer Screening | ✅ Complete |
| 2 — Volunteer Opportunities | ✅ Complete |
| 3 — Matching Engine | In progress (requirements added, matching algo pending) |
| 4 — Volunteer Profiles | Planned |
| 5 — Scheduling & Shifts | Planned |
| 6 — Nonprofit Operations (grants, events, analytics) | Planned |

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
3. **Skipping audit logging** — route writes through services so audit logs are created automatically.
4. **Using JWT assumptions** — sessions are database-backed, not JWT. `currentOrgId` lives in the session row.
5. **Duplicating Zod schemas** — schemas are defined once in the domain layer and imported everywhere else.
6. **Ignoring role hierarchy** — use the narrowest procedure type. Don't default to `orgProcedure` when `staffProcedure` or `adminProcedure` is appropriate.
