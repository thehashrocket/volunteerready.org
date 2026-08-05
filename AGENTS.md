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
- **Route Handlers under `/api/org/[orgId]/**`** scope by the `orgId` in the URL, via `requireOrgAccess()` in `src/server/services/orgAccessService.ts`. `staffProcedure`/`ctx.orgId` read the session's *active* org, which is right for tRPC and wrong here — for a multi-org user the active org and the org in the path can differ.
- **Volunteer procedures** scope by the caller's own `userId`, held inside the Prisma `WHERE` of every statement. A volunteer is not an `OrganizationMember`, so there is no membership to check. Where the caller owns a row, read the `orgId` back off it rather than accepting one. Where they do not — `profile.leaveOrgRoster` (v0.37.0.0) is addressed by `orgId`, because an org holding only an application has no roster row to name — prove the relationship first, then keep `userId` in every `WHERE` so a crafted `orgId` can only ever reach the caller's own rows.

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

## Before you throw or render an error

What an error says to the caller is decided on the **server**, by the
`errorFormatter` in `src/server/trpc/init.ts`, against the one allowlist in
`src/server/domain/error-disclosure.ts`. Two rules follow, and both fail silently:

- A refusal someone is meant to READ must be a `TRPCError` with an allowlisted
  code. `throw new Error('Cannot remove yourself.')` becomes
  `INTERNAL_SERVER_ERROR` and the person reads the generic copy instead. Assert
  the code in tests — a `toThrow('…')` assertion passes for a plain `Error` too.
- Never render `error.message` (or `err.message`, or `await res.text()`) into
  JSX. Use `safeErrorMessage()` / `safeCaughtErrorMessage()` / `QueryErrorCard`.
  `src/server/domain/error-disclosure.guard.test.ts` fails on a raw render.

`docs/AGENT_RULES.md` §3, §4 and §6 carry the reasoning; the full request/error
ordering is in `docs/REQUEST_FLOW.md`.

## Stack at a glance

- Next.js 16 App Router + React 19
- Auth: NextAuth + Prisma Adapter
- DB: PostgreSQL + Prisma 7 (`src/prisma/generated/client`)
- API: tRPC v11
- Validation: Zod (shared client/server)
- UI: Tailwind + shadcn/ui + lucide-react
- Lint/Format: Biome (`pnpm lint` / `pnpm format`)
- Tests: Vitest unit + component (`pnpm test`), Vitest integration against real Postgres
  (`pnpm test:integration`), Playwright e2e (`pnpm e2e`)
- Package manager: pnpm

## Before a visual or UI change

`DESIGN.md` is the source of truth for aesthetic direction, type, color, spacing and the
authenticated shell. Read it first — it describes the *shipped* app deliberately, because a
design doc that drifts from the product has already generated a round of confidently wrong
work here (see its Decisions Log).

Two conventions that are easy to get wrong and are not obvious from the code:

- A responsive table↔card switch is **pure CSS** (`hidden lg:block` / `lg:hidden`, both
  trees rendered from the same array). `useMediaQuery` is safe inside a modal and nowhere
  else — for layout it paints the mobile tree to every desktop user and swaps it after
  hydration.
- Per-row pending state comes from `usePendingIds()`, never `mutation.variables`.

Both are spelled out under "Responsive staff tables" in `CLAUDE.md`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
