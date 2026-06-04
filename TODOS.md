# TODOS

## Marketplace

### ~~P2 — Composite index for marketplace browse queries~~ ✅ Completed v0.26.0.0 (2026-06-03)
`CREATE INDEX IF NOT EXISTS "VolunteerOpportunity_status_createdAt_idx"` shipped in migration `20260603110000_add_digest_and_status_indexes`. Also added `UserMarketplacePreference(digestFrequency, lastDigestSentAt)` index for digest queries.
Deferred from: v0.25.0.0 (Phase 11A)

### P3 — Marketplace service layer migration (partial)
**Priority:** P3
`getMyInterests` and `toggleInterest` have been extracted to `marketplaceService.ts` (v0.26.0.0). `updateMarketplaceSettings` in `src/server/trpc/routers/org.ts` still calls Prisma directly in the tRPC router, bypassing the service layer (CLAUDE.md rule: routers → services → repositories). Refactor to add an `orgMarketplaceService.ts` and route through it.
Deferred from: v0.25.0.0 (Phase 11A)

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

## Completed

<!-- Items moved here after shipping -->
