# Platform Admin Console — Roadmap

**Status:** Tier 1, Tier 2, and Tier 3 (priority items 1–4) all shipped.
**Context:** This doc now tracks deferred Tier 3 work and known gaps.

> **Doc history:** Originally written as a Tier 1 design doc, then rewritten as a Tier 3 roadmap when Tier 1+2 turned out to be shipped. The four highest-priority Tier 3 items (impersonation alerting, org suspend/unsuspend, per-org feature flags, billing delinquency) shipped on branch `thehashrocket/admin-tier-3-plan`.

## What's shipped

### Tier 1 — Support-unblocking tools

Shipped in commit `0f8cda8` (PR #92). All under `/app/admin/platform/*`.

| Feature | Route | Backend |
|---------|-------|---------|
| Orgs list + detail | `platform/orgs/`, `platform/orgs/[id]/` | `platformOrgService`, `platformOrgRepo` |
| Users list + detail | `platform/users/`, `platform/users/[id]/` | `platformUserService`, `platformUserRepo` |
| Grant/revoke platform admin | user detail page | `setPlatformAdmin` |
| Revoke all sessions | user detail page | `revokeAllSessions` |
| Impersonation | user detail button + banner | `ImpersonationSession` model, `impersonationService`, `ImpersonationBanner` |
| Audit log viewer | `platform/audit/` | `auditQueryService`, filter options |

Impersonation implementation: dual-cookie (`next-auth.session-token` + impersonation cookie) resolved in `src/server/trpc/init.ts:48-65`. Admin's real identity preserved in `ctx.realUserId` for audit tagging. Cookie-binding security check in `resolveImpersonation()`.

### Tier 2 — Config editors

Shipped in commits `1e74faa` + `825d882`. All under `/app/admin/platform/catalog/`.

- Skill catalog editor (`catalog/skills/`) — add/edit skill families and skills without a deploy.
- Default screener questions editor (`catalog/screener-defaults/`) — edit `DEFAULT_SCREENER_QUESTIONS` via UI.

Backend in `platformCatalog.ts` router.

### Tier 3 — Priority items 1–4 (shipped on branch `thehashrocket/admin-tier-3-plan`)

| Feature | Surface | Backend |
|---------|---------|---------|
| Impersonation start alert | fire-and-forget email to all platform admins | `sendImpersonationStartAlert` in `admin-alerts.ts`, hooked into `impersonationService.startImpersonation` |
| Org suspend/unsuspend | `platform/orgs/[id]` modals, Suspended badge in list | `Organization.suspendedAt/Reason/ById` cols, `setOrgSuspendedTx`, `suspendOrg/unsuspendOrg`, enforced at `orgProcedure` chokepoint with platform admin bypass |
| Per-org feature flags | `platform/orgs/[id]` Flags tab with toggle Switches per registry entry | `FEATURE_FLAG_REGISTRY`, `featureFlagRepo`, `featureFlagService` (transactional + audit), `isFeatureEnabled(orgId, key)` helper |
| Billing delinquency | `platform/billing` table with last failure, amount, Stripe link | `platformBillingRepo` (groups recent `invoice.payment_failed` events), `listDelinquentOrgs` |

Audit actions added: `IMPERSONATION_STARTED` (existing, plus email side-effect), `ORG_SUSPENDED`, `ORG_UNSUSPENDED`, `FEATURE_FLAG_SET`.

Env: `PLATFORM_ADMIN_ALERT_EMAIL` (optional override; defaults to all platform admins minus the actor).

### Adjacent admin tooling (shipped, not under `/platform/`)

Already in `adminRouter`:
- Cron health dashboard with consecutive-failure alerting (`cronHealth`).
- Webhook health across Stripe/Checkr/Resend (`webhookHealth`).
- Email bounce management — list, re-enable, reset all (`bouncedEmails`, `reEnableBounce`, `resetAllBounces`).
- Stripe reconciliation — replay missed events (`stripeReconcile`).
- Onboarding funnel analytics (`onboardingFunnel`).

---

## Tier 3 — Remaining unshipped work

The four priority items in the table above are done. The items below remain deferred — none are blocking for current scale; pick them up when the pain shows up.

### A. Org write actions

**Status:** suspend/unsuspend shipped. Other write actions still missing.

Still missing:
- **Hard delete org** — GDPR + cleanup. Must cascade through all related tables with confirmation + audit.
- **Transfer ownership** — change the owner when the original owner leaves. Currently requires SQL.
- **Merge duplicate orgs** — two orgs registered with slight name variations. Needed when support gets tickets about "merging accounts."
- **Per-org billing view** — current plan, next billing date, payment method status, delinquency state. `billingService` exists but no admin surface.

**Build cost:** ~2 days CC. Suspend/unsuspend is the highest-leverage, lowest-risk starter. Transfer and merge need careful design (especially merge — what wins when both orgs have a conflicting slug?).

### B. User write actions

Missing:
- **GDPR delete** — user erasure with full cascade. Legal requirement once you're serving EU or California traffic. Needs its own design doc covering retention exceptions (audit log actor attribution, financial records).
- **Merge duplicate users** — same person signed up with two emails. Currently requires SQL surgery.
- **Change email** — bypass the magic-link verification for support cases where the user lost access.
- **Force password reset / resend magic link** — one-click from user detail.

**Build cost:** ~1-2 days. Start with force-magic-link (trivial). Defer GDPR delete until you actually have the regulatory pressure — it's a rabbit hole.

### C. Feature flag system

**Status:** minimal per-org boolean flags shipped (see Tier 3 priority table above). Generalized flag service (multivariate, percentage rollout, segmentation) not built and not recommended until real experiments demand it.

Pre-shipped baseline (still applies — flags layer on top of these):
- Plan tier (`assertPlanAtLeast` in `billing.ts`)
- Role (RBAC via `permissions.ts`)
- Hard-coded checks scattered in services

Missing: per-org boolean flags that platform admin can flip. Classic use cases:
- Early-access beta rollout (new screener UI, new matching algorithm)
- Kill switches when a feature misbehaves in production
- Customer-specific overrides ("this org needs Feature X even though they're on Base plan")

**Build cost:** ~2 days for a minimal `OrgFeatureFlag` table + admin UI + `isFeatureEnabled(orgId, flag)` helper. Don't build the generalized flag service — start with boolean per-org overrides. Expand only if multivariate experiments become a real need.

### D. Platform billing surface

**Status:** delinquency-only view shipped at `/app/admin/platform/billing` (see Tier 3 priority table). Aggregates and finance-tooling still missing.

Still missing:
- MRR / ARR dashboard (trailing 30 days, trend)
- Manual credit / refund UI
- Per-org invoice history
- Plan upgrade/downgrade audit

**Build cost:** ~3 days if you want it polished. ~1 day for a minimal delinquency-only view. Do the minimal view first — the rest can live in Stripe's dashboard until it hurts.

### E. Email template editor

**Status:** templates live in code (`buildMagicLinkEmail`, status notification emails, case-study consent email, etc.).

Missing: preview + edit UI. Low priority — changing email copy via deploy is fine until marketing wants to A/B test wording.

**Recommendation:** skip for now. Revisit when growth needs it.

### F. Error dashboard

**Status:** no Sentry-equivalent surface. Errors live in Vercel logs only.

**Recommendation:** don't build one. Install Sentry or equivalent. Not worth the reinvention cost.

### G. Impersonation alerting

**Status:** shipped (see Tier 3 priority table). Email goes to all platform admins minus the actor on every `startImpersonation`. Resend `isCritical: true` bypasses bounce suppression. Failure of the alert does not fail the impersonation start (fire-and-forget IIFE).

Future enhancement: route to Slack instead of/in addition to email when a Slack integration exists.

### H. Audit retention + export

**Status:** audit rows accumulate forever, viewable only in the admin UI.

Missing:
- CSV / JSON export for compliance requests
- Retention policy (e.g., purge rows older than 7 years unless flagged)

**Build cost:** ~0.5 day for export. Retention policy is a DB job — defer until storage bites.

---

## Priority recommendation

The 1-week Tier 3 budget shipped:

1. ✅ **Impersonation alerting** (G) — `sendImpersonationStartAlert`, hooked into `impersonationService`.
2. ✅ **Org suspend/unsuspend** (A subset) — enforced at `orgProcedure` chokepoint with platform admin bypass.
3. ✅ **Feature flags — per-org boolean overrides** (C minimal) — `FEATURE_FLAG_REGISTRY` + `isFeatureEnabled(orgId, key)` helper.
4. ✅ **Minimal billing delinquency view** (D minimal) — `/app/admin/platform/billing` derived from `invoice.payment_failed` webhook events.

Still deferred: GDPR delete, org merge, email template editor, error dashboard, audit export, transfer ownership, generalized feature flag service, full billing dashboard.

## Not recommended

- **Error dashboard.** Use Sentry.
- **Full generalized feature flag service.** Boolean per-org overrides first. Only expand if you're running real experiments.
- **Email template editor.** Redeploys are fine at current scale.

## Lessons from the Tier 1 build (retrospective)

Worth keeping in mind for Tier 3 execution:

1. **Dual-cookie impersonation over session swap** — already proven in `init.ts`. If Tier 3 adds more "act as" flows (e.g., org admin impersonating a staff member for troubleshooting), reuse this pattern.
2. **Separate `platformOrgRepo` from `orgRepo`** — the boundary is "cross-tenant vs single-tenant queries." Maintain this split.
3. **Audit in the same transaction as the write** — existing `writeAuditLogTx(tx, input)` handles this. Every new write action must use it.
4. **Redact sensitive audit metadata** — existing `auditQueryService` does this. Any new action type that stores metadata should audit-review its payload.
5. **Block platform-admin-on-platform-admin impersonation** — kept the privilege graph simple. Don't break this for convenience.

## Open questions (Tier 3)

1. Do we need soft-delete + undelete for orgs, or is hard-delete acceptable with full audit? (Soft-delete is safer but adds query complexity everywhere.)
2. Feature flags: boolean-only or do we need percentage rollouts from day one? (Boolean is enough until proven otherwise.)
3. Should platform admin actions have per-action rate limits? (Probably yes on destructive ones — suspend, delete, revoke sessions.)
4. Do we need structured impersonation reason categories, or is free-text sufficient? (Free-text is currently enforced at 10-200 chars — revisit if audit querying gets harder.)
