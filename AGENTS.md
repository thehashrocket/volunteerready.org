# AGENTS.md

Agent orientation for the VolunteerReady codebase. Read these in order before writing any code.

## Required reading

1. **`docs/AGENT_RULES.md`** — strict rules: layer boundaries, multi-tenancy scope, naming, audit logging. Non-negotiable.
2. **`docs/AI_CONTEXT.md`** — full project orientation: tech stack, patterns, conventions, key file paths.
3. **`docs/ARCHITECTURE.md`** — layered system design and architectural intent.
4. **`docs/DOMAIN.md`** — canonical domain model (entities, relationships, invariants).
5. **`CLAUDE.md`** — complete project conventions, repo layout, locked-in stack decisions.

## The one rule that matters most

This is a multi-tenant platform. Every query and mutation **must** be scoped to the tenant. Missing scope is a security bug, not a style issue.

Which key you scope by depends on who is calling:

- **Staff procedures** scope by `orgId` from `ctx`. When the procedure also acts on a `userId` arriving in its *input*, that id is untrusted — call `requireOrgVolunteerRelationship()` first.
- **Company procedures** scope by `companyId` read from the request, never from session state.
- **Volunteer procedures** scope by the caller's own `userId`, held inside the Prisma `WHERE` of every statement. A volunteer is not an `OrganizationMember`, so there is no membership to check, and the client must never supply an `orgId` — read it back off the row the caller already owns. See `profile.leaveOrgRoster`.

The reasoning behind each is in `docs/AGENT_RULES.md` §2.

## Layer order (never skip layers)

```
UI / page
  → tRPC router   (validate input, enforce auth, call service)
  → service       (business logic, orchestration)
  → repository    (Prisma queries only)
  → database
```

No Prisma in routers. No Prisma in components. No business logic in repositories.

## Stack at a glance

- Next.js 16 App Router + React 19
- Auth: NextAuth + Prisma Adapter
- DB: PostgreSQL + Prisma 7 (`src/prisma/generated/client`)
- API: tRPC v11
- Validation: Zod (shared client/server)
- UI: Tailwind + shadcn/ui + lucide-react
- Lint/Format: Biome (`pnpm lint` / `pnpm format`)
- Package manager: pnpm
