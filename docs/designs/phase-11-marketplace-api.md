# Phase 11 — Volunteer Marketplace & API Platform

> Promoted from CEO plan review on 2026-03-21.
> Branch: thehashrocket/pr7-phase11-vision | Mode: SCOPE EXPANSION
> Source: `~/.gstack/projects/thehashrocket-volunteerready.org/ceo-plans/2026-03-21-phase11-marketplace-api.md`

## Vision

### Strategic Thesis

Phases 1-10 built the **supply-side infrastructure** (org tools: screening, scheduling,
credentials, background checks, billing). The platform is feature-complete for a single
nonprofit. Phase 11 creates the **demand side** — making VolunteerReady valuable for
volunteers independently, which creates network effects.

### 10x Check

Transform VolunteerReady from "a tool nonprofits use" into "the place volunteers go."
A two-sided marketplace with network effects: volunteers discover opportunities across
all orgs, orgs get pre-verified applicants, and a public API enables an ecosystem of
integrations. The growth flywheel: more volunteers attract more orgs, which attract
more volunteers.

### Platonic Ideal

A volunteer opens VolunteerReady on their phone. The homepage shows "Happening this
weekend" near them — opportunities sorted by skill match with warm green "Perfect Match"
badges. They tap one, see the org's verified profile, and hit "I'm interested" — one tap.
The org sees interested volunteers with credentials already attached. After volunteering,
the volunteer's impact portfolio updates automatically — hours, credentials, shareable
social card. Their employer's CSR dashboard reflects hours in real time. Third-party apps
sync via API. The experience feels inevitable — every competitor feels clunky because
they're org-centric tools, not volunteer-centric platforms.

### Growth Flywheel

```
  Volunteers discover opportunities on marketplace
        |
        v
  Volunteers create accounts, build profiles
        |
        v
  Orgs see verified volunteers applying -> join platform
        |
        v
  More org opportunities on marketplace
        |
        v
  More volunteers discover opportunities (loop)
```

---

## Revenue Model — Tier-Feature Mapping

| Feature | FREE | STARTER | PRO |
|---------|------|---------|-----|
| Marketplace listing (org's opps visible) | Yes | Yes | Yes |
| Basic search + browse | Yes | Yes | Yes |
| Opportunity digest email (volunteer) | Yes | Yes | Yes |
| "I'm interested" analytics (org) | — | Yes | Yes |
| Advanced matching + skill badges | — | Yes | Yes |
| API access (read) | — | — | Yes |
| API access (write) + webhooks | — | — | Yes |
| Grant tracking + reporting | — | — | Yes |
| Embeddable opportunity widget | — | — | Yes |

ENTERPRISE (Phase 12+): SSO/SAML, dedicated support, custom integrations.

---

## Scope (13 Items)

### Core (5 items)

1. **Cross-org opportunity marketplace** (`/opportunities`) — browse all published opportunities where `organization.marketplaceVisible = true`. Keyword search (tsvector), location/skills/remote filters, "Happening this weekend" section, skill-match badges, cursor-based pagination.

2. **Org discovery page** (`/organizations`) — browse participating nonprofits. Cards with name, description, logo, opportunity count, volunteer count, location, cause area tags, verified badge.

3. **Volunteer-initiated applications from marketplace** — clicking "Apply" redirects to existing `/apply/[orgSlug]` with `?opportunityId=X&source=marketplace`. Source tracking on `VolunteerApplication.source` (DIRECT | MARKETPLACE | REFERRAL | WIDGET). Credential sharing via existing Phase 6C mechanism.

4. **Public API v1** (`/api/v1/`) — REST API with API key auth (SHA-256 hashed keys, scoped permissions, 100 req/min rate limit via Upstash). Endpoints: opportunities, applications, credentials, shifts, webhooks. OpenAPI spec via `zod-to-openapi`, Swagger UI at `/api/v1/docs`.

5. **Outbound webhooks** — HMAC-SHA256 signed events (application.created, credential.verified, shift.attended, etc.). Initial delivery via `waitUntil()`, cron-based retry sweep (1m, 5m, 30m, 2h, 24h). Admin UI at `/app/settings/webhooks`.

### Expansions (8 items)

6. **Weekly opportunity digest email** — cron at `/api/cron/opportunity-digest`, top 5 matched opportunities per volunteer, branded email template, WEEKLY/NEVER frequency preference.

7. **One-click "I'm interested"** — `OpportunityInterest` entity, heart/bookmark icon on marketplace cards, "Interested" tab on org opportunity dashboard with "Invite to Apply" button. Rate limit: 50/day per user.

8. **Volunteer impact portfolio** — enhanced `/v/[userId]` with hours breakdown by category, credential badges, reliability score, tenure badges, "Add to LinkedIn" button, streak display, referral count.

9. **Embeddable opportunity widget** — vanilla JS bundle (<20KB gzipped), Shadow DOM for CSS isolation, served from Edge-cached API route (`/api/widget/v1/[orgSlug].js`), shows up to 5 PUBLISHED opportunities. PRO tier.

10. **"Bring a friend" referral** — `ReferralLink` with short token, 30-day expiry, one link = one claim, landing page at `/refer/[token]`, rate limit 5/day/user, referrer credit on impact portfolio.

11. **Grant opportunity integration** — `Grant` + `OpportunityGrant` models, hours accumulate from ATTENDED shifts, progress dashboard at `/app/grants`, CSV + PDF export (reuse ESG pattern). PRO tier.

12. **Volunteer streaks & gamification** — `VolunteerStreak` tracking (consecutive weeks with ATTENDED status), milestone badge computation, display on profile and dashboard.

13. **Google Calendar sync** — "Add to Calendar" links (Google URL scheme + .ics download), "Export all shifts" .ics file, subscribable `.ics` feed at `/api/calendar/[token].ics` (hashed token auth).

---

## Architecture Decisions

### AD-1: Cross-Org Read Pattern (Multi-Tenancy)

New `publicProcedure` (no org context) calling dedicated `marketplaceRepository` that ONLY reads PUBLISHED opportunities where `organization.marketplaceVisible = true`. No cross-org writes.

```
  PUBLIC USER                    AUTHENTICATED USER
       |                              |
       v                              v
  publicProcedure              protectedProcedure
       |                              |
       v                              v
  marketplaceRepository        marketplaceRepository
  (no orgId filter,            (same + skill match scoring
   PUBLISHED + visible only)    from volunteer's profile)
```

### AD-2: API Key Authentication

SHA-256 hashed keys with prefix display (`vr_sk_abc1...`). Scoped permissions array. `apiKeyProcedure` middleware validates hash, injects orgId, checks scopes. Rate limit: 100 req/min per key via Upstash.

### AD-3: Webhook Delivery & Retry

Initial delivery via `waitUntil()`. Retries via cron sweep every 5 minutes. Schedule: immediate, 1m, 5m, 30m, 2h, 24h. After 6 attempts → DEAD status. HMAC-SHA256 signature in `X-VR-Signature` header.

### AD-4: Marketplace Search

PostgreSQL `tsvector` full-text search with GIN index. Generated column on VolunteerOpportunity. Cursor-based pagination from day one. Algolia migration trigger: >10K published opps OR >200ms p95.

### AD-5: Org Marketplace Visibility

`Organization.marketplaceVisible Boolean @default(true)` — opt-out model for marketplace liquidity. Settings toggle on `/app/settings/team`.

### AD-6: API Documentation

`@asteasolutions/zod-to-openapi` generates OpenAPI 3.0 spec from existing Zod validators. Swagger UI at `/api/v1/docs`.

### AD-7: "I'm Interested" vs Application

`OpportunityInterest` is a lightweight signal (userId + opportunityId + createdAt). Independent from `VolunteerApplication`. A volunteer can express interest AND later apply — they are independent signals.

---

## New Data Models

```
ApiKey { id, orgId, keyHash, keyPrefix, label, scopes[], lastUsedAt?, revokedAt?, createdAt }
WebhookSubscription { id, orgId, url, events[], secret (encrypted), active, createdAt }
WebhookDelivery { id, subscriptionId, event, payload, status, attempts, nextRetryAt?, lastResponseCode?, createdAt }
OpportunityInterest { id, userId, opportunityId, createdAt } @@unique([userId, opportunityId])
ReferralLink { id, referrerId, orgId?, shiftId?, token, claimedBy?, claimedAt?, createdAt, expiresAt }
Grant { id, orgId, name, funder, hoursTarget, startDate, endDate, status, createdAt, updatedAt }
OpportunityGrant { opportunityId, grantId } @@id([opportunityId, grantId])
VolunteerStreak { id, userId (unique), currentStreak, longestStreak, lastActivityWeek, updatedAt }
```

New fields on existing models:
- `Organization.marketplaceVisible Boolean @default(true)`
- `VolunteerApplication.source String` (DIRECT | MARKETPLACE | REFERRAL | WIDGET)
- `VolunteerOpportunity.search_vector` (tsvector, raw SQL migration)
- `VolunteerProfile.digestFrequency` (WEEKLY | NEVER)

---

## PR Sequence

### Phase 11A: Marketplace Foundation (PRs 1-4)

| PR | Scope | Effort |
|----|-------|--------|
| PR1 | DB schema + marketplace infrastructure (all new models, publicProcedure, marketplaceRepository) | L |
| PR2 | Cross-org marketplace UI + org discovery (`/opportunities`, `/organizations`) | L |
| PR3 | Marketplace applications + "I'm interested" + source tracking | M |
| PR4 | Weekly opportunity digest email | S |

### Phase 11B: API & Integrations (PRs 5-8)

| PR | Scope | Effort |
|----|-------|--------|
| PR5 | Public API v1 + API key management + OpenAPI docs | L |
| PR6 | Outbound webhooks (delivery engine + retry cron + admin UI) | M |
| PR7 | Embeddable opportunity widget (vanilla JS + Shadow DOM + Edge) | M |
| PR8 | Grant opportunity integration (CRUD + progress dashboard + export) | M |

### Phase 11C: Volunteer Experience (PRs 9-12)

| PR | Scope | Effort |
|----|-------|--------|
| PR9 | Volunteer impact portfolio + LinkedIn deep link | M |
| PR10 | Volunteer streaks & gamification | S |
| PR11 | "Bring a friend" referral system | S |
| PR12 | Google Calendar sync (.ics + subscribable feed) | S |

**Total estimated effort:** human team ~6-8 weeks / CC+gstack ~10-12 hours across 12 PRs.

---

## Security Considerations

- **SSRF prevention on webhook URLs:** validate URLs to reject private IP ranges, require HTTPS, resolve DNS to public IP. Build into webhook subscription creation (PR6).
- **API key security:** SHA-256 hashed, raw key shown once, scoped permissions, rate-limited.
- **Calendar feed token:** `crypto.randomBytes(32)`, stored hashed, regeneratable.
- **Widget source tracking:** validate `source` enum values server-side.
- **Marketplace moderation:** rate limit "I'm interested" (50/day), "Report listing" button for platform admin notification. Full moderation suite deferred.

---

## NOT in Scope (Phase 12+)

- SSO/SAML enterprise authentication
- Real-time event-driven architecture (Inngest/similar)
- Volunteer-to-volunteer messaging
- Mobile native app
- AI-powered matching (ML model beyond current skill-based scoring)
- Org ratings/reviews by volunteers
- Multi-language / i18n
- Full marketplace moderation tools (trust & safety)
- OAuth2 for API (v2 — API keys sufficient for v1)
- Algolia search migration (monitor scale trigger first)

---

## Dream State Delta

Phase 11 brings VolunteerReady to ~60% of the 12-month ideal:

```
  CURRENT STATE (v0.16)         THIS PLAN (Phase 11)         12-MONTH IDEAL
  ─────────────────────         ──────────────────────       ──────────────────
  Org-centric SaaS tool    →    Two-sided marketplace    →   Dominant volunteer
  No cross-org discovery   →    Full-text search + match →   AI-powered matching
  No API                   →    REST API v1 + webhooks   →   GraphQL + SDK
  No external integrations →    Widget + calendar + .ics →   App store ecosystem
  Identity page exists     →    Impact portfolio         →   Portable resume
  No growth mechanics      →    Referrals + digest       →   Social + viral loops
  No grant tracking        →    Basic grant progress     →   Full compliance suite
```
