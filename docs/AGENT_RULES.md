# AGENT_RULES

This document provides strict rules for AI coding agents working in this repository.

These rules exist to prevent architecture drift and accidental design regressions.

---

# 1. Respect Layer Boundaries

Code must follow the project architecture.

Layer responsibilities:

UI
-> tRPC router
-> service
-> repository
-> database

Do not skip layers unless absolutely necessary.

---

# 2. Organization Scope Is Mandatory

VolunteerReady is multi-tenant.

When adding queries or mutations:

- require orgId
- filter records by orgId
- ensure authorization checks use org membership

Failure to enforce org scope is a security bug.

---

# 3. Routers Must Stay Thin

Routers should:

- validate input
- enforce access rules
- call services
- return results

Routers should not contain:

- complex workflows
- large Prisma queries
- business rules

---

# 4. Business Logic Lives in Services

Services orchestrate workflows.

Examples:

- submitVolunteerApplication
- createScreenerQuestion
- updateOrganizationMemberRole

Services may:

- call repositories
- enforce business rules
- write audit logs

---

# 5. Repositories Are Persistence Only

Repositories should contain:

- Prisma queries
- entity fetch/update logic

Repositories should not contain:

- authorization logic
- workflow orchestration
- cross-entity business rules

Raw SQL rule: never compose `Prisma.sql` fragments (via `Prisma.join`, or
conditional `Prisma.sql`/`Prisma.empty`) and interpolate them into a
`$queryRaw` template. Turbopack dev duplicates the generated client's `Sql`
class across module graphs, the `instanceof` check fails, and the fragment is
sent to Postgres as one literal parameter — "invalid input syntax" 500s that
only reproduce under `next dev`. Write a single static template with
NULL-checked optional filters instead (see the "Raw SQL" rule in `CLAUDE.md`
for the preferred sargable patterns).

---

# 6. Never Access Prisma Directly from UI or Routers

Prisma calls must live inside repositories or server modules.

Do not import Prisma inside:

- React components
- tRPC routers
- UI utilities

---

# 7. Use Explicit Names

Prefer descriptive function names.

Good:

- submitVolunteerApplication
- listOrganizationMembers
- createScreenerQuestion

Bad:

- handleSubmit
- doThing
- processData

---

# 8. Audit Important Actions

If a change affects organization state, consider writing an audit log.

Examples:

- member role changes
- screener updates
- volunteer applications submitted

---

# 9. Prefer Small, Composable Services

Avoid giant services.

Split services when they grow too large or cover unrelated domains.

---

# 10. Write Code for Future Platform Expansion

VolunteerReady will expand beyond screening.

When designing features, consider:

- will this work across multiple organizations?
- should this be reusable later?
- does this belong in a new service?

Build primitives, not hacks.
