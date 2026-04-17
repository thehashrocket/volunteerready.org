# Platform Admin Console — Tier 1

**Status:** Draft
**Scope:** Tier 1 only (support-unblocking tools). Tier 2 (config editors) and Tier 3 (billing/ops) deferred.
**Owner:** Jason

## Problem

Today's `/app/admin/*` is issue-triage (leads, feedback, case studies) plus two analytics pages. There is no master interface for operating on tenants, users, or the platform itself. When the first support crisis hits — "a user can't log in," "this org looks wrong," "who changed this record?" — the only tools are `pnpm admin:grant`, direct DB queries, and deploy-to-change-code.

That's fine at zero customers. It's a loaded foot-gun at ten.

## Goal

Ship the minimum surface that lets a platform admin diagnose and recover any customer situation from the browser, with a defensible audit trail.

**Non-goals:** billing, feature flags, skill catalog editing, email template editing, webhook log, error dashboard, cron status. Those are Tier 2/3.

## Scope

Four features, one shell:

1. **Orgs list + detail** — see every org, drill into members/opportunities/applications.
2. **Users list + detail** — search by email/name, see memberships, sessions, consent state.
3. **User impersonation** — assume a user's session to reproduce their view, with banner + audit trail + expiry.
4. **Audit log viewer** — query `AuditLog` by actor, entity, action, date range.

Grant/revoke platform admin from the UI is bundled into (2) since it's a one-line addition.

## Route layout

All under the existing admin shell. Namespaced `/platform/` so future tenant-admin-scoped views (non-platform admins managing their own org) don't collide.

```
/app/admin/
  ├── leads/           (existing)
  ├── feedback/        (existing)
  ├── case-studies/    (existing)
  ├── onboarding/      (existing)
  ├── health/          (existing)
  └── platform/        (NEW)
      ├── orgs/
      │   ├── page.tsx               — list
      │   └── [id]/page.tsx          — detail
      ├── users/
      │   ├── page.tsx               — list/search
      │   └── [id]/page.tsx          — detail + grant/revoke + impersonate
      └── audit/
          └── page.tsx               — filterable log viewer
```

Auth guard: `isPlatformAdmin(userId)` check in each page's server component. Same pattern as existing admin pages.

## Data model

### Reuse
- `AuditLog` — already exists (`prisma/schema.prisma:177`). `auditRepo.ts` already has `writeAuditLog` and `writeAuditLogTx`.
- `User.isPlatformAdmin` — already exists.
- `Organization`, `OrganizationMember`, `User` — already have everything we need for lists/detail.

### New: `ImpersonationSession`

Impersonation is the only feature that needs new schema. We do NOT want to swap `session.userId` in-place — that's un-auditable and scary. Instead, the admin keeps their own session and carries a signed "acting-as" token.

```prisma
model ImpersonationSession {
  id              String    @id @default(cuid())
  adminUserId     String
  targetUserId    String
  reason          String
  startedAt       DateTime  @default(now())
  expiresAt       DateTime
  endedAt         DateTime?
  endedReason     String?   // "expired" | "manual" | "admin-logout"

  admin  User @relation("ImpersonationAdmin", fields: [adminUserId], references: [id], onDelete: Cascade)
  target User @relation("ImpersonationTarget", fields: [targetUserId], references: [id], onDelete: Cascade)

  @@index([adminUserId])
  @@index([targetUserId])
  @@index([expiresAt])
}
```

Hard cap: 30 min expiry. Admin can end early. Every start/end writes an `AuditLog` row too (redundant-on-purpose — audit log is the forever record, `ImpersonationSession` is the live state).

## Architecture — layers

Per CLAUDE.md: `app/**` composition only, services do logic, repos do Prisma, tRPC routers are thin.

```
server/
  domain/
    platform-admin.ts         (existing — add types)
    impersonation.ts          (NEW — invariants, expiry rules, reason validation)
  services/
    platformOrgService.ts     (NEW — list/search orgs, get detail with counts)
    platformUserService.ts    (NEW — list/search users, grant/revoke admin, get detail)
    impersonationService.ts   (NEW — start/end, expiry check, audit writes)
    auditQueryService.ts      (NEW — filter/paginate audit log, redact sensitive metadata)
  repositories/
    platformOrgRepo.ts        (NEW)
    platformUserRepo.ts       (NEW)
    impersonationRepo.ts      (NEW)
    auditRepo.ts              (existing — add query fns)
  trpc/routers/
    platformAdmin.ts          (NEW — all platform admin procedures)
```

**Why separate `platformOrgRepo` from existing `orgRepo`:** existing `orgRepo` is scoped to a single tenant's operations (members, slug lookup). Platform queries are cross-tenant — different access patterns, different auth. Keeping them separate makes the "this query is platform-admin-only" boundary legible at the file level.

## Flow: Impersonation

This is the one with real failure modes. Spell it out.

```
┌─────────────────────────────────────────────────────────────────┐
│  START IMPERSONATION                                             │
│                                                                   │
│  Admin clicks "Impersonate" on /app/admin/platform/users/[id]   │
│           │                                                       │
│           ▼                                                       │
│  Modal: "Reason for impersonation" (required, 10-200 chars)     │
│           │                                                       │
│           ▼                                                       │
│  POST → trpc.platformAdmin.impersonation.start                  │
│           │                                                       │
│           ▼                                                       │
│  impersonationService.start(adminId, targetId, reason)          │
│    ├─ Verify adminId is platform admin (re-check, don't trust UI)│
│    ├─ Verify targetId exists and is not already being impersonated│
│    ├─ Refuse if target is also a platform admin (prevent chains) │
│    ├─ Create ImpersonationSession (expiresAt = now + 30min)     │
│    ├─ Write AuditLog (action=IMPERSONATION_START, metadata={reason, targetId})│
│    └─ Return session.id                                          │
│           │                                                       │
│           ▼                                                       │
│  Client sets cookie: impersonation-session-id = <id>            │
│  Client navigates to /app                                        │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  REQUEST WHILE IMPERSONATING                                     │
│                                                                   │
│  Every server request reads both cookies:                        │
│    next-auth.session-token     → admin's real session           │
│    impersonation-session-id    → impersonation record           │
│           │                                                       │
│           ▼                                                       │
│  getEffectiveUser(req):                                          │
│    ├─ adminSession = getServerSession()                          │
│    ├─ if no impersonation cookie → return adminSession.user     │
│    ├─ imp = impersonationRepo.findActive(cookieId)              │
│    ├─ if imp == null || imp.expiresAt < now:                    │
│    │    └─ clear cookie, return adminSession.user (back to admin)│
│    ├─ if imp.adminUserId !== adminSession.user.id:              │
│    │    └─ reject (someone copied the cookie — security fail)   │
│    └─ return { user: target, impersonatedBy: admin }            │
│           │                                                       │
│           ▼                                                       │
│  All services/queries use effectiveUser                          │
│  Writes add metadata.impersonatedBy = admin.id to audit log     │
│           │                                                       │
│           ▼                                                       │
│  UI always renders <ImpersonationBanner /> at top of app shell  │
│  "You are impersonating X. [End session]"                        │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  END IMPERSONATION                                               │
│                                                                   │
│  Three exit paths, all converge:                                 │
│    1. Admin clicks "End session" in banner                       │
│    2. 30-min expiry (detected on next request)                   │
│    3. Admin explicitly signs out                                 │
│           │                                                       │
│           ▼                                                       │
│  impersonationService.end(sessionId, reason)                    │
│    ├─ Set endedAt = now, endedReason                            │
│    ├─ Write AuditLog (action=IMPERSONATION_END)                 │
│    └─ Clear impersonation cookie                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Security invariants

1. **Platform admins cannot impersonate other platform admins.** Prevents privilege chains and keeps the audit simple.
2. **Impersonation cookie is bound to the admin's session.** If `imp.adminUserId` doesn't match the real session's user, reject hard. Cookie theft can't cross users.
3. **30-minute hard cap.** No refresh. If you need more time, start a new session (new audit row, new reason).
4. **Banner is non-dismissible.** `z-index: 9999`, sticky top. Admins must see it.
5. **Writes during impersonation tag the audit row.** `metadata.impersonatedBy = adminId`. Downstream audit queries can filter for "what did the target actually do" vs. "what did an admin do as the target."
6. **Read-only mode option (Phase 1.5, not Tier 1):** add `mode: 'READ_ONLY' | 'READ_WRITE'` to `ImpersonationSession`. Tier 1 ships READ_WRITE only — accept that and document it. Most support cases need read to diagnose, but you also need write to fix. Read-only is an optimization, not a requirement.

## Flow: Audit log viewer

Simple. The hard part is not leaking secrets.

```
/app/admin/platform/audit

Filters (URL-encoded, so links are shareable):
  - actor (user id or email lookup)
  - entityType (dropdown: populated from distinct values)
  - entityId (free text)
  - action (free text)
  - orgId (dropdown)
  - dateFrom / dateTo
  - impersonatedOnly (checkbox)

Columns:
  - timestamp (local tz)
  - actor (email + role badge; "impersonated by X" if metadata flags it)
  - action
  - entityType / entityId
  - org / company
  - metadata (click to expand — RAW JSON, but filtered)

Pagination: cursor-based. Default 50 per page.
```

### Metadata redaction

`AuditLog.metadata` is untyped JSON — callers can stuff anything in there. Before rendering:

- `auditQueryService` runs each row's metadata through `redactAuditMetadata()`.
- Drop any key matching `/password|token|secret|key|credential/i`.
- Replace value with `"[REDACTED]"` — keep the key so the reader knows the field existed.
- Log a warning the first time a new sensitive-looking key appears — flags bad writes upstream.

## Flow: Orgs list / detail

### List (`/app/admin/platform/orgs`)

- Server component. Reads `platformOrgService.listOrgs({ search, cursor, limit })`.
- Search: slug + name, case-insensitive.
- Columns: slug, name, createdAt, memberCount, openAppCount, published opp count, lastActivity (most recent audit row).
- `memberCount`, `openAppCount`, `oppCount` computed in a single query with `_count` selectors — avoid N+1.
- `lastActivity` is the one that could hurt. Prefer `AuditLog.createdAt DESC LIMIT 1 WHERE orgId = ?` per row only on detail page. On the list, skip it — or compute it in a single `GROUP BY` in the repo.

### Detail (`/app/admin/platform/orgs/[id]`)

Tabs:
- **Overview** — basic fields, member count, opp count, app count, background-check adapter, health score.
- **Members** — list of `OrganizationMember` with role. Click-through to user detail. No role edits in Tier 1.
- **Opportunities** — list. Status badges. Link to per-opp dashboard (existing route, but scoped to platform admin via `isPlatformAdmin` bypass).
- **Applications** — recent apps. Status.
- **Audit** — pre-filtered audit log for this org.

No write actions in Tier 1. Suspending an org, editing fields, deleting — Tier 2.

## Flow: Users list / detail

### List (`/app/admin/platform/users`)

- Search: email + name, case-insensitive.
- Columns: email, name, createdAt, org memberships count, isPlatformAdmin badge, last session.
- `last session` = `Session.expires DESC LIMIT 1`. Approximates "last seen."

### Detail (`/app/admin/platform/users/[id]`)

Tabs:
- **Overview** — email, name, created, last seen, platform admin toggle (with confirmation + audit).
- **Org memberships** — list with roles + join dates.
- **Sessions** — active sessions (from `Session` table). Option to revoke all sessions (forces re-login).
- **Applications** — volunteer applications submitted via `submittedByUserId`.
- **Audit** — pre-filtered audit log for this user as actor AND as entity.

Actions:
- **Grant/revoke platform admin** — button, confirmation modal, audit row.
- **Impersonate** — button, reason modal (see impersonation flow).
- **Revoke all sessions** — button, confirmation, writes audit, deletes `Session` rows for the user.

## tRPC router (`platformAdmin.ts`)

All procedures wrapped in a `platformAdminProcedure` middleware that checks `isPlatformAdmin(ctx.session.user.id)` and throws `UNAUTHORIZED` otherwise. Every procedure also writes an audit row.

```ts
platformAdmin.orgs.list({ search?, cursor?, limit? })        → { orgs, nextCursor }
platformAdmin.orgs.get({ id })                                → OrgDetail
platformAdmin.users.list({ search?, cursor?, limit? })       → { users, nextCursor }
platformAdmin.users.get({ id })                               → UserDetail
platformAdmin.users.setPlatformAdmin({ id, value, reason })  → { ok }
platformAdmin.users.revokeAllSessions({ id, reason })        → { count }
platformAdmin.impersonation.start({ targetId, reason })      → { sessionId }
platformAdmin.impersonation.end({ sessionId })               → { ok }
platformAdmin.impersonation.current()                        → ImpersonationStatus | null
platformAdmin.audit.query({ filters, cursor?, limit? })      → { rows, nextCursor }
```

## Testing plan

### Code paths → test coverage

```
impersonationService.start()
  ├── [TEST] Happy path — admin impersonates volunteer, session created, audit written
  ├── [TEST] Rejects non-platform-admin caller
  ├── [TEST] Rejects target=another platform admin
  ├── [TEST] Rejects if target doesn't exist
  ├── [TEST] Rejects if reason is empty or < 10 chars
  └── [TEST] Writes both ImpersonationSession AND AuditLog in one transaction
             (verify: if audit write fails, impersonation is NOT created)

impersonationService.getEffectiveUser()
  ├── [TEST] No impersonation cookie → returns admin
  ├── [TEST] Valid impersonation → returns target, flagged
  ├── [TEST] Expired impersonation → returns admin, clears cookie
  ├── [TEST] Cookie adminId mismatch → rejects (SECURITY — regression test)
  └── [TEST] Ended impersonation (endedAt set) → returns admin

impersonationService.end()
  ├── [TEST] Manual end — endedReason="manual", audit written
  ├── [TEST] Expiry detection on request — endedReason="expired"
  └── [TEST] Idempotent — ending an already-ended session is no-op

platformUserService.setPlatformAdmin()
  ├── [TEST] Grant — DB updated, audit written
  ├── [TEST] Revoke — DB updated, audit written
  ├── [TEST] Self-revoke allowed but warned in audit metadata
  └── [TEST] Requires reason

auditQueryService
  ├── [TEST] Redacts keys matching password|token|secret|key|credential
  ├── [TEST] Filters by actor, entityType, date range
  ├── [TEST] Cursor pagination stable under concurrent writes
  └── [TEST] impersonatedOnly filter picks up metadata.impersonatedBy
```

### E2E tests (→E2E)

- Full impersonation round-trip: admin impersonates volunteer → sees volunteer dashboard → writes something → ends impersonation → audit log shows both actions tagged correctly.
- Banner visibility — cannot be hidden, persists across navigation.
- Expiry — set expiry short in test env, verify auto-end.

### Regression tests (CRITICAL)

- Cookie adminId mismatch must reject. If this ever passes without rejection, it's a CVE.
- Impersonation audit row must be written in the same transaction as session creation.

## Failure modes

| Codepath | Failure | Detected by | User impact |
|----------|---------|-------------|-------------|
| Impersonation cookie stolen cross-user | Would swap user identities | adminId binding check | Security incident — reject and log |
| Impersonation session expires mid-request | 30-min boundary crossed during a long operation | Expiry check on every request | Reverts to admin identity, next write is tagged correctly |
| `AuditLog` write fails silently | Lost accountability | Wrap in transaction with the actual write | — |
| Audit metadata leaks secrets | PII/credentials in UI | Redaction function with warn-log | — |
| Admin impersonates admin (privilege chain) | Audit becomes ambiguous | Explicit check in `start()` | Rejected at start |
| Redaction allow-list drifts as new sensitive keys appear | New keys leak | Warn-log on unfamiliar sensitive-looking keys | Caught in logs before user sees |

## Effort

- **Human team:** ~2 weeks for one engineer.
- **CC + gstack:** ~1 day for the first pass, another half-day for tests + polish.

## NOT in scope (Tier 2/3)

- Organization write actions (suspend, delete, transfer ownership) — deferred to Tier 2.
- User delete (GDPR) — deferred, needs its own design (cascades, retention policy).
- Feature flags — Tier 2, requires flag system first.
- Skill catalog / screener question editor — Tier 2.
- Background check adapter config UI — Tier 2.
- Email template preview/edit — Tier 2.
- Billing / MRR / refunds — Tier 3.
- Webhook log, error dashboard, cron status — Tier 3.
- Read-only impersonation mode — Phase 1.5 follow-up, not blocking Tier 1.

## What already exists (reuse)

- `AuditLog` schema + `auditRepo.ts` with transactional write helper.
- `isPlatformAdmin()` resolver.
- `/app/admin/*` layout, auth guard pattern, `feedback-admin-notice.tsx` style for admin-only UI.
- tRPC advisory-permission-middleware pattern.
- `User.isPlatformAdmin` DB column and grant/revoke CLI — UI will call the same service path.

## Open questions

1. Do we need per-action rate limits on platform admin procedures? (Probably yes — 10/min per admin is enough.)
2. Should audit rows for platform admin actions write to a separate log table with tighter retention? (Not for Tier 1 — one audit table is simpler.)
3. Impersonation reason — free text or dropdown of common reasons ("user support ticket #X", "bug repro", "data migration")? (Free text Tier 1, consider structured later.)
4. Do we need Slack/email alerting when impersonation starts? (Good idea for Tier 1.5 — not blocking initial ship.)

## Build order

1. New Prisma model + migration (`ImpersonationSession`).
2. `impersonation.ts` domain + `impersonationService` + `impersonationRepo`.
3. `getEffectiveUser()` + banner + app shell integration.
4. `platformAdmin.impersonation.*` tRPC procedures.
5. `platformUserService` + `platformUserRepo` + users list/detail pages.
6. `platformOrgService` + `platformOrgRepo` + orgs list/detail pages.
7. `auditQueryService` + audit viewer page.
8. E2E tests for impersonation.
9. Documentation (`docs/AI_CONTEXT.md` pointers to new surfaces).
