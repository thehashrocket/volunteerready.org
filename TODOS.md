# TODOS

## Marketplace

### P3 — Member count privacy on org discovery
**Priority:** P3
`/organizations` shows `{org._count.members} member(s)`. Small orgs (1–2 members) may not want this exposed. Get platform product sign-off on whether to show, hide, or threshold this count.
Deferred from: v0.25.0.0 (Phase 11A)

### P3 — "This Weekend" uses server UTC not org/user time zone
**Priority:** P3
`getThisWeekendOpportunities` computes "next 3 days" in server UTC. Events starting Friday evening local time may or may not appear depending on the user's offset. Requires storing opportunity time zones to fix properly.
Deferred from: v0.25.0.0 (Phase 11A)

### P3 — Rate limiter IP fallback shared bucket
**Priority:** P3
When `ctx.ip` is null (Vercel edge/proxy edge cases), the marketplace browse rate limiter keys on the literal string `'unknown'` — all null-IP traffic shares one bucket. Investigate whether Vercel always provides X-Forwarded-For in the tRPC context.
Deferred from: v0.25.0.0 (Phase 11A)

### P3 — Digest service N+1 per-user queries
**Priority:** P3
In `opportunityDigestService.ts`, each user in the 100-user batch triggers 3 DB queries (applied IDs, interested IDs, opportunities fetch). At 100 users × 3 = 300 queries per Monday cron batch. Fix when active digest users approach 500+: batch-fetch all applied+interested IDs for the full batch at once, join in memory.
Deferred from: v0.26.0.0 (Phase 11C)

### P3 — /app/browse full pagination migration
**Priority:** P3
`listAllPublishedOpportunities` is capped at 200 rows as an OOM guard, but the auth browse page still loads all results server-side for client-side skill-match ranking. Full fix: move skill-match ranking into the `searchMarketplaceOpportunities` tRPC procedure (accept userId, look up skills, apply ranking server-side), then paginate. Until then the 200-row cap prevents memory spikes.
Deferred from: v0.26.0.0 (Phase 11C review)

## Completed

- **P2 — Composite index for marketplace browse** — `@@index([status, createdAt])` added to `VolunteerOpportunity` in Phase 11C migration (v0.26.0.0).
- **P3 — Marketplace service layer migration** — `getMyInterests`, `toggleInterest` extracted to `marketplaceService.ts`; `updateMarketplaceSettings` extracted to `orgMarketplaceService.ts` (v0.26.1.0).
