<!-- /autoplan restore point: /Users/jasonshultz/.gstack/projects/thehashrocket-volunteerready.org/thehashrocket-autoplan-review-autoplan-restore-20260322-200717.md -->
# Phase 11 — Volunteer Marketplace & API Platform

> **STATUS: ON HOLD** — Deferred pending first active org. CEO review (2026-03-22)
> concluded: zero users, zero demand evidence. Find one nonprofit first.
> See: `~/.gstack/projects/thehashrocket-volunteerready.org/jasonshultz-thehashrocket-autoplan-review-design-20260322-204717.md`
>
> Originally promoted from CEO plan review on 2026-03-21.
> Branch: thehashrocket/pr7-phase11-vision | Mode: SCOPE EXPANSION → **SCOPE REDUCTION (2026-03-22)**
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
| ~~Grant tracking + reporting~~ | — | — | ~~Yes~~ | REMOVED — see scope item #11 |
| Embeddable opportunity widget | — | — | Yes |

ENTERPRISE (Phase 12+): SSO/SAML, dedicated support, custom integrations.

---

## Scope (13 Items)

### Core (5 items)

1. **Cross-org opportunity marketplace** (`/opportunities`) — browse all published opportunities where `organization.marketplaceVisible = true`. Keyword search (tsvector), location/skills/remote filters, "Happening this weekend" section, skill-match badges, cursor-based pagination.

2. **Org discovery page** (`/organizations`) — browse participating nonprofits. Cards with name, description, logo, opportunity count, volunteer count, location, cause area tags, verified badge.

3. **Volunteer-initiated applications from marketplace** — clicking "Apply" redirects to existing `/apply/[orgSlug]` with `?opportunityId=X&source=marketplace`. Source tracking on `VolunteerApplication.source` (DIRECT | MARKETPLACE | REFERRAL | WIDGET). Credential sharing via existing Phase 6C mechanism. **Server-side validation required:** verify `opportunityId` belongs to the org identified by `orgSlug` and is PUBLISHED before associating.

4. **Public API v1** (`/api/v1/`) — REST API with API key auth (SHA-256 hashed keys, scoped permissions, 100 req/min rate limit via Upstash). Endpoints: opportunities, applications, credentials, shifts, webhooks. OpenAPI spec via `zod-to-openapi`, Swagger UI at `/api/v1/docs`.

5. **Outbound webhooks** — HMAC-SHA256 signed events (application.created, credential.verified, shift.attended, etc.). Initial delivery + 1 fast retry (1m) via `waitUntil()`, cron-based retry sweep every 5m: 5m, 30m, 2h, 24h. Admin UI at `/app/settings/webhooks` with delivery health table (recent deliveries, status badges, retry counts, failure details).

### Expansions (8 items)

6. **Weekly opportunity digest email** — cron at `/api/cron/opportunity-digest`, top 5 matched opportunities per volunteer, branded email template, WEEKLY/NEVER frequency preference.

7. **One-click "I'm interested"** — `OpportunityInterest` entity, heart/bookmark icon on marketplace cards, "Interested" tab on org opportunity dashboard with "Invite to Apply" button. Rate limit: 50/day per user.

8. **Volunteer impact portfolio** — enhanced `/v/[userId]` with hours breakdown by category, credential badges, reliability score, tenure badges, "Add to LinkedIn" button, streak display, referral count.

9. **Embeddable opportunity widget** — vanilla JS bundle (<20KB gzipped), Shadow DOM for CSS isolation, served from Edge-cached API route (`/api/widget/v1/[orgSlug].js`), shows up to 5 PUBLISHED opportunities. PRO tier.

10. **"Bring a friend" referral** — `ReferralLink` with short token, 30-day expiry, one link = one claim, landing page at `/refer/[token]`, rate limit 5/day/user, referrer credit on impact portfolio.

11. ~~**Grant opportunity integration**~~ — **REMOVED.** Domain expertise: grant program APIs vary wildly by state and funder; integrating outside California/federal is prohibitively difficult. Not a fit for this platform.

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

Initial delivery + 1 fast retry (1m delay) via `waitUntil()`. Remaining retries via cron sweep every 5 minutes: 5m, 30m, 2h, 24h. After 5 cron attempts → DEAD status. HMAC-SHA256 signature in `X-VR-Signature` header.

**Idempotency:** Cron retry sweep uses atomic `updateMany` with `WHERE status = 'PENDING' AND nextRetryAt <= NOW()` to claim rows, preventing duplicate deliveries from concurrent workers.

**Audit logging:** All new service-layer mutations (API key create/revoke, webhook subscription CRUD, interest create) must include audit log entries per existing service-layer pattern.

### AD-4: Marketplace Search

PostgreSQL `tsvector` full-text search with GIN index. Generated column on VolunteerOpportunity. Cursor-based pagination from day one. Algolia migration trigger: >10K published opps OR >200ms p95.

### AD-5: Org Marketplace Visibility

`Organization.marketplaceVisible Boolean @default(false)` — opt-in model. Existing orgs must explicitly enable marketplace visibility. In-app banner prompts orgs to enable. Settings toggle on `/app/settings/team`.

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
~~Grant~~ — REMOVED (see scope item #11)
~~OpportunityGrant~~ — REMOVED (see scope item #11)
VolunteerStreak { id, userId (unique), currentStreak, longestStreak, lastActivityWeek, updatedAt }
```

New fields on existing models:
- `Organization.marketplaceVisible Boolean @default(false)`
- `VolunteerApplication.source String` (DIRECT | MARKETPLACE | REFERRAL | WIDGET)
- `VolunteerOpportunity.search_vector` (tsvector, raw SQL migration)
- `UserDigestPreference.type` — add discriminator enum (CREDENTIAL_EXPIRY | OPPORTUNITY_DIGEST) to scope digest preferences by category. Reuse existing `digest-service.ts`. Do NOT add `VolunteerProfile.digestFrequency`.

---

## PR Sequence

Each PR ships its own schema migrations. No big-bang migration.

### Phase 11A: Marketplace Foundation (PRs 1-4)

| PR | Scope | Effort |
|----|-------|--------|
| PR1 | Marketplace infrastructure: `Organization.marketplaceVisible`, `VolunteerOpportunity.search_vector` (tsvector + GIN), `VolunteerApplication.source`, `OpportunityInterest` model, `publicProcedure`, `marketplaceRepository` with eager loading | L |
| PR2 | Cross-org marketplace UI + org discovery (`/opportunities`, `/organizations`) | L |
| PR3 | Marketplace applications + "I'm interested" + source tracking + apply redirect validation | M |
| PR4 | Weekly opportunity digest: extend `UserDigestPreference` with type discriminator, extend `digest-service.ts`, new cron | S |

**PR1 Tests:** tsvector search (empty, special chars, SQL injection), marketplaceRepository (PUBLISHED + visible filter, eager loading), publicProcedure auth bypass, OpportunityInterest uniqueness constraint
**PR2 Tests:** marketplace page rendering (empty state, pagination, filters), org discovery (filters, verified badges)
**PR3 Tests:** source tracking enum validation, apply redirect opportunityId validation (wrong org, non-existent, non-PUBLISHED), interest rate limit (50/day)
**PR4 Tests:** digest matching (no matches, 5+ matches), UserDigestPreference type discriminator, cron smoke test

### Phase 11B: API & Integrations (PRs 5-8)

| PR | Scope | Effort |
|----|-------|--------|
| PR5 | Public API v1 + `ApiKey` model + API key management + OpenAPI docs | L |
| PR6 | Outbound webhooks: `WebhookSubscription` + `WebhookDelivery` models, delivery engine + retry cron + admin UI with delivery health table | M |
| PR7 | Embeddable opportunity widget (vanilla JS + Shadow DOM + Edge) | M |
| ~~PR8~~ | ~~Grant integration~~ — **REMOVED** (not deferred — permanently cut per domain expertise) | — |

**PR5 Tests:** API key creation (hash verification, prefix display), key revocation, auth middleware (valid/invalid/revoked/expired), scope checking, rate limit (100 req/min), OpenAPI spec generation
**PR6 Tests:** HMAC-SHA256 signing correctness, webhook delivery (success/timeout/5xx), retry state machine (PENDING→DELIVERED/FAILED→DEAD), atomic row-claiming (concurrent workers), SSRF URL validation (private IPs, non-HTTPS), delivery health table rendering, cron smoke test
**PR7 Tests:** widget bundle generation, Shadow DOM isolation, org not visible (empty widget), Edge caching headers
~~**PR8 Tests:**~~ REMOVED with PR8

### Phase 11C: Volunteer Experience (PRs 9-12)

| PR | Scope | Effort |
|----|-------|--------|
| PR9 | Volunteer impact portfolio + LinkedIn deep link | M |
| PR10 | Volunteer streaks & gamification + `VolunteerStreak` model | S |
| PR11 | "Bring a friend" referral system + `ReferralLink` model | S |
| PR12 | Google Calendar sync (.ics + subscribable feed) | S |

**PR9 Tests:** impact portfolio data aggregation (hours, orgs, credentials), LinkedIn deep link URL generation
**PR10 Tests:** streak computation (consecutive weeks, gap reset), milestone badge triggers, VolunteerStreak upsert
**PR11 Tests:** referral token generation/hashing, claim flow (valid/expired/already-claimed), rate limit (5/day), referrer credit
**PR12 Tests:** .ics file generation (valid iCal format), calendar token auth (valid/invalid/regenerated), subscribable feed pagination

**Total estimated effort:** human team ~6-8 weeks / CC+gstack ~10-12 hours across 12 PRs.

---

## Security Considerations

- **SSRF prevention on webhook URLs:** validate URLs to reject private IP ranges, require HTTPS, resolve DNS to public IP. Build into webhook subscription creation (PR6).
- **API key security:** SHA-256 hashed, raw key shown once, scoped permissions, rate-limited.
- **Calendar feed token:** `crypto.randomBytes(32)`, stored hashed, regeneratable.
- **Widget source tracking:** validate `source` enum values server-side.
- **Marketplace moderation:** rate limit "I'm interested" (50/day), "Report listing" button for platform admin notification. Full moderation suite deferred.
- **Apply redirect validation:** server-side verification that `opportunityId` belongs to the org identified by `orgSlug` and is PUBLISHED. Prevents URL parameter tampering.
- ~~**Cross-org grant invariant:**~~ REMOVED with grant integration.

---

## Design Specifications

### Information Architecture

Each new page has a defined visual hierarchy — what the user sees first, second, third.

#### `/opportunities` — Marketplace Browse

```
  ┌─────────────────────────────────────────────────────┐
  │  SEARCH BAR (full-width, prominent)                  │  ← 1st: action
  │  Placeholder: "Search volunteer opportunities..."    │
  ├─────────────────────────────────────────────────────┤
  │  FILTER ROW: Location | Skills | Remote | Cause     │  ← 2nd: refine
  ├─────────────────────────────────────────────────────┤
  │  "THIS WEEKEND" SECTION                              │  ← 3rd: urgency
  │  Sand-tinted (#C4A882/10%) horizontal scroll strip   │
  │  Compact cards: title, org, date, location           │
  │  Mobile: horizontal scroll. Desktop: 3-4 inline.     │
  ├─────────────────────────────────────────────────────┤
  │  OPPORTUNITY LIST (left-aligned, NOT card grid)      │  ← 4th: browse
  │  Each row:                                           │
  │    Title (Fraunces 600, forest green)                │
  │    Org name (Geist 400, warm-600) · Location · Date  │
  │    Skill badges (sand bg, forest text, rounded)      │
  │    "Perfect Match" badge (green-500 bg) if scored    │
  │    ♡ Interest toggle (right-aligned)                  │
  │  Cursor pagination: "Load more" button at bottom     │
  └─────────────────────────────────────────────────────┘
```

**Layout rationale:** Left-aligned list (NOT card grid) — scannable like a job board, avoids AI slop card-grid pattern. Each row is a full-width item with clear hierarchy: title → org → metadata → badges.

#### `/organizations` — Org Discovery

```
  ┌─────────────────────────────────────────────────────┐
  │  HEADING: "Organizations" (Fraunces 700)             │  ← 1st
  │  Subtext: "Discover nonprofits looking for..."       │
  ├─────────────────────────────────────────────────────┤
  │  FILTER ROW: Cause area | Location | Verified only  │  ← 2nd
  ├─────────────────────────────────────────────────────┤
  │  ORG LIST                                            │  ← 3rd
  │  Each row:                                           │
  │    Logo (48px, rounded-lg) + Name (Fraunces 600)     │
  │    Description (2-line clamp, Geist 400)             │
  │    Stats: "12 opportunities · 45 volunteers"          │
  │    Cause area tags (sand bg pills)                   │
  │    ✓ Verified badge (green-500) if verified          │
  └─────────────────────────────────────────────────────┘
```

#### `/v/[userId]` — Impact Portfolio

```
  ┌─────────────────────────────────────────────────────┐
  │  HERO: Name + avatar + headline stat                 │  ← 1st: identity
  │  "42 hours · 3 orgs · 5 credentials"                │
  ├─────────────────────────────────────────────────────┤
  │  IMPACT STATS ROW (horizontal, not circular gauges)  │  ← 2nd: proof
  │  Total Hours | Orgs Served | Shifts | Credentials    │
  │  (Fraunces 700 numbers, Geist 400 labels)            │
  ├─────────────────────────────────────────────────────┤
  │  CREDENTIAL BADGES (horizontal scroll)               │  ← 3rd: trust
  │  Each: icon + name + issuer + expiry                 │
  ├─────────────────────────────────────────────────────┤
  │  HOURS BREAKDOWN (stacked bar or table)              │  ← 4th: detail
  │  By category, by org                                 │
  │  Streak display + "Add to LinkedIn" button           │
  └─────────────────────────────────────────────────────┘
```

**Anti-pattern:** NO circular gauges or donut charts for impact stats. Use typographic stat blocks (large number + label) per DESIGN.md AI slop blacklist.

#### `/app/settings/webhooks` — Webhook Admin

```
  ┌─────────────────────────────────────────────────────┐
  │  HEADING + "Add Webhook" button (top-right)          │  ← 1st
  ├─────────────────────────────────────────────────────┤
  │  SUBSCRIPTION LIST                                   │  ← 2nd
  │  Each: URL + events + active toggle + edit/delete    │
  ├─────────────────────────────────────────────────────┤
  │  DELIVERY HEALTH TABLE                               │  ← 3rd
  │  Columns: Event | Status badge | Attempts | Time     │
  │  Status badges: green=DELIVERED, amber=PENDING,      │
  │    red=FAILED, gray=DEAD                             │
  │  Mobile: stacked card layout (see Responsive below)  │
  └─────────────────────────────────────────────────────┘
```

#### ~~`/app/grants` — Grant Progress Dashboard~~ REMOVED

### Navigation Flow

```
  PUBLIC:
    Homepage → /opportunities (browse) → /apply/[orgSlug]?opportunityId=X
                                       → /organizations → [orgSlug] detail
    /refer/[token] → /apply/[orgSlug]

  AUTHENTICATED VOLUNTEER:
    /opportunities → ♡ interest → "Interested" tab on org dashboard
    /opportunities → Apply → /apply/[orgSlug]?source=marketplace
    /v/[userId] (impact portfolio)

  AUTHENTICATED ORG ADMIN:
    /app/settings/webhooks → CRUD subscriptions → delivery health
    ~~/app/grants~~ REMOVED
    /app/opportunities/[id] → "Interested" tab → "Invite to Apply"

  API CONSUMER:
    /api/v1/docs (Swagger UI) → API key from /app/settings/api-keys
```

### Interaction State Coverage

```
  FEATURE                  | LOADING              | EMPTY                        | ERROR                    | SUCCESS                  | PARTIAL
  ─────────────────────────|──────────────────────|──────────────────────────────|──────────────────────────|──────────────────────────|──────────────────
  Marketplace search       | Skeleton rows (3)    | "No opportunities match      | "Search unavailable.     | Result list with count   | Filtered results
                           | pulsing warm-100     |  your search. Try broader    |  Browse all below."      | "Showing 12 results"     | with active filter
                           |                      |  terms or clear filters."    |  + full list fallback    |                          | pills
                           |                      |  [Clear filters] button      |                          |                          |
  ─────────────────────────|──────────────────────|──────────────────────────────|──────────────────────────|──────────────────────────|──────────────────
  "This Weekend" section   | 3 placeholder cards  | Section hidden entirely      | Section hidden           | Horizontal scroll strip  | <3 items: no scroll,
                           |                      | (no empty box)               |                          |                          | left-aligned
  ─────────────────────────|──────────────────────|──────────────────────────────|──────────────────────────|──────────────────────────|──────────────────
  Org discovery            | Skeleton rows (3)    | "No organizations on the     | "Could not load orgs.    | Org list with stats      | Filtered subset
                           |                      |  marketplace yet. Check      |  Refresh to try again."  |                          |
                           |                      |  back soon!"                 |  [Refresh] button        |                          |
  ─────────────────────────|──────────────────────|──────────────────────────────|──────────────────────────|──────────────────────────|──────────────────
  "I'm interested" toggle  | Heart icon pulses    | N/A (always shows toggle)    | Toast: "Could not save.  | Heart fills green,       | N/A
                           |                      |                              |  Try again."             | toast: "Saved!"          |
  ─────────────────────────|──────────────────────|──────────────────────────────|──────────────────────────|──────────────────────────|──────────────────
  API key management       | Spinner on table     | "No API keys yet. Create     | Toast with error detail  | Key row appears,         | N/A
                           |                      |  one to get started."        |                          | raw key shown ONCE       |
                           |                      |  [Create API Key] button     |                          | in dismissable banner    |
  ─────────────────────────|──────────────────────|──────────────────────────────|──────────────────────────|──────────────────────────|──────────────────
  Webhook delivery health  | Skeleton table       | "No deliveries yet.          | "Could not load          | Table with status        | Pagination shows
                           |                      |  Send a test event."         |  delivery history."      | badges + timestamps      | partial data
                           |                      |  [Send Test] button          |                          |                          |
  ─────────────────────────|──────────────────────|──────────────────────────────|──────────────────────────|──────────────────────────|──────────────────
  ~~Grant progress~~       | REMOVED              | REMOVED                      | REMOVED                  | REMOVED                  | REMOVED
  ─────────────────────────|──────────────────────|──────────────────────────────|──────────────────────────|──────────────────────────|──────────────────
  Impact portfolio         | Skeleton blocks      | "Start volunteering to       | "Could not load          | Full portfolio with      | Some sections
                           |                      |  build your impact           |  portfolio."             | stats, badges, hours     | still loading
                           |                      |  portfolio!" + CTA           |                          |                          |
  ─────────────────────────|──────────────────────|──────────────────────────────|──────────────────────────|──────────────────────────|──────────────────
  Embeddable widget        | "Loading..." text    | "No opportunities            | Widget hidden entirely   | Branded mini-cards       | <5 items shown
                           |                      |  available." (1 line)        | (no broken embed)        | with org branding        |
  ─────────────────────────|──────────────────────|──────────────────────────────|──────────────────────────|──────────────────────────|──────────────────
  Referral claim           | Spinner on CTA       | N/A                          | "This link has expired   | "Welcome! You've been    | N/A
                           |                      |                              |  or already been used."  |  referred by [Name]."    |
                           |                      |                              |  [Browse opportunities]  |  [Create account] CTA    |
  ─────────────────────────|──────────────────────|──────────────────────────────|──────────────────────────|──────────────────────────|──────────────────
  Opportunity digest email | N/A (async)          | Email not sent (no matches)  | Silent failure + retry   | Branded email with       | <5 matches: all
                           |                      |                              | via cron                 | top 5 matched opps       | shown, no "more"
```

### User Journey & Emotional Arc

```
  STEP | USER DOES                        | USER FEELS            | DESIGN SUPPORTS IT WITH
  ─────|──────────────────────────────────|───────────────────────|──────────────────────────────
  1    | Lands on /opportunities          | Curious, browsing     | Warm sand tones, inviting search bar,
       |                                  |                       | "This Weekend" creates urgency without pressure
  2    | Searches/filters                 | Focused, purposeful   | Instant results (300ms debounce), filter pills
       |                                  |                       | show active state, result count updates live
  3    | Sees "Perfect Match" badge       | Validated, excited    | Green badge stands out from sand palette,
       |                                  |                       | feels personalized not algorithmic
  4    | Taps ♡ "I'm interested"          | Low commitment, safe  | Heart animation (scale 1→1.2→1, 200ms ease),
       |                                  |                       | toast confirms without blocking
  5    | Clicks "Apply"                   | Committed, hopeful    | Smooth redirect to familiar apply flow,
       |                                  |                       | source=marketplace tracked silently
  6    | After volunteering, views        | Proud, accomplished   | Impact numbers are large and typographic
       | /v/[userId] portfolio            |                       | (Fraunces 700), credential badges feel earned,
       |                                  |                       | "Add to LinkedIn" extends pride beyond platform
```

### Design System Token Mappings

All UI must use DESIGN.md tokens. Key mappings for Phase 11:

**Typography:**
- Page headings: Fraunces 700, 2rem (32px), forest green (#1B3C2A)
- Section headings: Fraunces 600, 1.5rem (24px), forest green
- Body text: Geist 400, 1rem (16px), warm-800 (#3D3529)
- Stat numbers: Fraunces 700, 2.5rem (40px), forest green
- Stat labels: Geist 400, 0.875rem (14px), warm-600 (#6B5E4F)
- Mono/technical: Geist Mono 400 (API keys, webhook URLs, timestamps)

**Colors:**
- Primary actions: forest green (#1B3C2A) bg, white text
- Secondary actions: sand (#C4A882) bg, forest green text
- Badges — skill match: sand bg (#C4A882/20%), forest text
- Badges — "Perfect Match": green-500 bg, white text
- Badges — verified org: green-500, checkmark icon
- Status — delivered: green-500, pending: amber-500, failed: red-500, dead: warm-400
- "This Weekend" section bg: sand (#C4A882) at 10% opacity
- Card/row hover: warm-50 (#FAF8F5) bg transition

**Components:**
- Buttons: shadcn Button, primary=forest, secondary=sand, ghost for icon-only
- Badges: shadcn Badge, custom color variants per above
- Tables: shadcn Table, warm-100 header bg, warm-50 hover
- Cards: shadcn Card, warm-50 bg, warm-200 border, 8px padding
- Toast: shadcn Toast, positioned bottom-right, auto-dismiss 3s
- Progress bars: custom — forest green fill on warm-100 track, rounded-full, h-2
- Skeleton: warm-100 bg with warm-200 pulse animation

**Spacing:**
- Base unit: 8px. Component padding: 16px (2 units). Section gaps: 32px (4 units).
- List item vertical gap: 12px. Filter row gap: 8px.

### Responsive Specifications

**Breakpoints** (per DESIGN.md): 375px (mobile), 768px (tablet), 1024px (desktop), 1440px (wide)

**`/opportunities` marketplace:**
- Mobile (375): Single-column list. Search bar full-width. Filters collapse into "Filters" dropdown sheet. "This Weekend" horizontal scroll with snap. Interest heart in row, not floating.
- Tablet (768): Same as mobile but with visible filter row (no collapse).
- Desktop (1024+): Sidebar filter panel (240px fixed) + main list. "This Weekend" shows 3-4 items inline.

**`/organizations` org discovery:**
- Mobile: Single-column, logo + name + 1-line description. Cause tags wrap.
- Desktop: Same list layout (not grid). Wider rows show full 2-line description.

**Webhook delivery health table:**
- Mobile: Each row becomes a stacked card — Event on top, Status badge, Attempts, Time stacked vertically. Cards separated by warm-200 border.
- Desktop: Standard table with columns.

~~**Grant progress dashboard:**~~ REMOVED

**Impact portfolio:**
- Mobile: Stats stacked vertically (not 4-across). Credentials horizontal scroll.
- Desktop: Stats in horizontal row. Credentials grid (2-3 per row).

**Embeddable widget:**
- Widget is always single-column (max-width: 400px). Responsive within its container via Shadow DOM. No external CSS bleed.

### Accessibility Requirements

- **Keyboard navigation:** All interactive elements (search, filters, interest toggle, pagination, form inputs) reachable via Tab. Focus ring: 2px forest green, 2px offset.
- **Screen readers:** Opportunity list uses `role="list"` with `aria-label="Volunteer opportunities"`. Interest toggle: `aria-pressed="true/false"`, `aria-label="Mark as interested"`. Status badges: include text label (not color-only). Filter dropdowns: `aria-expanded`, `aria-controls`.
- **Touch targets:** Minimum 44px × 44px for all tappable elements (buttons, heart toggle, filter chips, pagination controls).
- **Color contrast:** All text meets WCAG 2.1 AA (4.5:1 for body text, 3:1 for large text). Status badges use icon + text, not color alone.
- **Motion:** Respect `prefers-reduced-motion`. Heart animation and skeleton pulse disabled when set. All transitions ≤200ms per DESIGN.md motion spec.

### Embeddable Widget Visual Spec

The widget (`/api/widget/v1/[orgSlug].js`) renders inside Shadow DOM — NO external CSS bleed.

```
  ┌───────────────────────────────────┐
  │  VolunteerReady                   │  ← Small logo/wordmark, warm-600 text
  │  Opportunities at [Org Name]      │  ← Geist 600, forest green
  ├───────────────────────────────────┤
  │  ┌─────────────────────────────┐  │
  │  │ Title of Opportunity        │  │  ← Fraunces 600, forest
  │  │ 📍 Location · 📅 Date       │  │  ← Geist 400, warm-600
  │  │ [View →]                    │  │  ← Text link, forest green
  │  └─────────────────────────────┘  │
  │  ┌─────────────────────────────┐  │
  │  │ (repeat up to 5)            │  │
  │  └─────────────────────────────┘  │
  ├───────────────────────────────────┤
  │  View all on VolunteerReady →     │  ← Footer link, warm-600
  └───────────────────────────────────┘
```

**Style:** Warm-50 bg, warm-200 border, 12px border-radius, 16px padding. Fonts loaded from CDN (Fraunces + Geist subsets, <8KB combined). Total bundle <20KB gzipped. Edge-cached with 5-minute TTL.

### Search Behavior Spec

Marketplace search uses **instant search** with 300ms debounce:
- User types → 300ms pause → tsvector query fires → results replace inline (no page reload)
- Active filters persist during search — search narrows within filtered results
- Result count updates in real time: "Showing 12 of 847 opportunities"
- Clear search: ✕ button inside search field, restores unfiltered view
- Empty query: show all results (default browse state)
- Special characters: sanitized server-side before tsvector query (prevent SQL injection)
- Long queries: truncated to 200 chars client-side before submission

### Opportunity Digest Email Spec

Weekly branded HTML email sent via Resend:

```
  ┌───────────────────────────────────┐
  │  [VolunteerReady logo]            │  ← Forest green on white header
  │                                   │
  │  Your Weekly Opportunities        │  ← Fraunces 700, forest green
  │  Matched to your skills           │  ← Geist 400, warm-600
  ├───────────────────────────────────┤
  │                                   │
  │  1. Opportunity Title             │  ← Fraunces 600
  │     Org Name · Location · Date    │  ← Geist 400, warm-600
  │     "Perfect Match" if scored     │  ← Green badge inline
  │     [View Opportunity →]          │  ← CTA button, forest bg
  │                                   │
  │  (repeat up to 5)                 │
  │                                   │
  ├───────────────────────────────────┤
  │  [Browse all opportunities →]     │  ← Secondary CTA, sand bg
  │                                   │
  │  Manage preferences · Unsubscribe │  ← Footer links, warm-500
  └───────────────────────────────────┘
```

**Template:** Reuse existing Resend email patterns from Phase 10 (credential expiry emails). Sand-tinted section background for opportunity rows. All images have alt text. Render correctly in Gmail, Outlook, Apple Mail.

---

## NOT in Scope (Phase 12+)

- **Grant opportunity integration** — PERMANENTLY REMOVED (not deferred). Founder has direct
  experience building a grant matching application. Grant program APIs vary wildly by state
  and funder; integrating with anything outside California or federal programs is
  prohibitively difficult. The `Grant` and `OpportunityGrant` models, `/app/grants`
  dashboard, and all related specs have been removed from this plan. Do not re-propose
  without evidence of a standardized grant API ecosystem.
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

<!-- AUTONOMOUS DECISION LOG -->
## Decision Audit Trail

| # | Phase | Decision | Principle | Rationale | Rejected |
|---|-------|----------|-----------|-----------|----------|
| 1 | CEO | Mode: SELECTIVE EXPANSION | P2+P3 | Marketplace foundation has standalone value; API/webhooks premature for 3-5 orgs | SCOPE EXPANSION |
| 2 | CEO | Defer PR5 (Public API v1) | P3 | No identified API consumers; high maintenance for solo dev | Ship API now |
| 3 | CEO | Defer PR6 (Webhooks) | P3 | Depends on API; high maintenance; no customer demand | Ship webhooks now |
| 4 | CEO | Defer PR8 (Grant integration) | P3 | PRO feature with no PRO customers yet | Ship grants now |
| 5 | CEO | Defer PR10 (Streaks/gamification) | P5 | Gamification before critical mass is premature | Ship streaks now |
| 6 | CEO | Defer PR11 (Referral links) | P4 | Phase 12 already has referral system | Ship duplicate referral |
| 7 | CEO | Defer PR12 (Calendar sync) | P3 | Nice-to-have, not adoption-driving | Ship calendar now |
| 8 | CEO | Add empty marketplace org CTA | P1 | Empty state needs activation hook, not just "check back" | Leave generic empty state |
| 9 | CEO | Add rate limit user-facing message | P1 | "I'm interested" rate limit needs UX, not silent failure | Silent rate limit |
| 10 | CEO | Add marketplace SEO to PR2 | P1 | New public pages need sitemap/meta/structured data | Defer SEO |
| 11 | CEO | Add marketplace analytics | P1 | Can't measure adoption impact without event tracking | Ship without analytics |
| 12 | CEO | Add org marketplace onboarding | P1 | marketplaceVisible=false needs activation flow | No activation prompt |
| 13 | Design | Add post-apply navigation flow | P1 | Volunteer needs clear path back after applying from marketplace | Leave unspecified |
| 14 | Design | Add org admin emotional journey | P1 | Adoption focus requires org admin perspective, not just volunteer | Volunteer-only journey |
| 15 | Design | Add widget accessibility spec | P1 | Shadow DOM needs independent focus management | Trust embedder's a11y |
| 16 | Design | Batch interest notification at 5+ threshold | P5 | Per-interest notifications would be noisy; batched threshold is actionable | Per-interest notification |
| 17 | Eng/Codex | Add Organization schema fields (description, location, causeArea, verified) | P1 | Org discovery page references fields that don't exist | Skip org discovery |
| 18 | Eng/Codex | New UserMarketplacePreference model for cross-org digest | P5 | Existing UserDigestPreference is org-scoped; marketplace digest is per-user cross-org | Hack nullable orgId |
| 19 | Eng/Codex | Extend publicOpportunityRepo, don't create marketplaceRepository | P4 | Existing repo + browse page already exists; avoid parallel stack | New separate repo |
| 20 | Eng/Codex | Add unauthenticated "I'm interested" state | P1 | Marketplace is public but heart toggle only handles auth users | No anonymous behavior |
| 21 | Eng | Reconcile plan: update PR sequence to match revised scope | P1 | Plan still lists deferred PRs as in-scope | Leave inconsistent |
| 22 | CEO-2 | SCOPE REDUCTION: Defer ALL Phase 11 PRs pending first active org | P1 | Zero users, zero demand evidence. /office-hours concluded: find one nonprofit first | Ship any Phase 11 PR now |
| 23 | CEO-2 | PERMANENTLY REMOVE grant integration (PR8) | P1 | Founder domain expertise: grant APIs fragmented outside CA/federal, prohibitively difficult | Keep grants as deferred |
| 24 | CEO-2 | Mark plan ON HOLD (not archived, not deleted) | P2 | Plan is well-reviewed (4 passes); worth preserving as reference when users are found | Archive or delete plan |

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 2 | ON HOLD | Run 1: trimmed to 7 items. Run 2: SCOPE REDUCTION — all PRs deferred, grants permanently removed |
| Codex Review | `/codex review` | Independent 2nd opinion | 1 | CLEAN | 10 findings, 4 applied to revised scope |
| Eng Review | `/plan-eng-review` | Architecture & tests | 1 | STALE | 4 critical fixes — stale due to scope reduction |
| Design Review | `/plan-design-review` | UI/UX gaps | 1 | STALE | 4 additions — stale due to scope reduction |

**VERDICT:** ON HOLD — Plan deferred pending first active org. /office-hours assignment: find one nonprofit volunteer coordinator. Grants permanently removed (domain expertise). Re-run eng + design reviews when plan is re-activated.

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
  ~~No grant tracking~~    →    ~~Grant progress~~        →   REMOVED — not a platform fit
```
