# Post-deploy checks

Claims that **cannot be tested before they ship**, and how to check each one
after a deploy.

This file exists because the alternative is a green test suite that quietly
claims more than it proves. Every entry here was considered for automation
first and moved here only because no local harness can reach it.

## Why some claims cannot be tested locally

`playwright.config.ts` boots **one long-lived `pnpm dev` server**. Every e2e
therefore runs one build against itself. There is no way locally to produce the
situation this app's version prompt exists for — an **old client bundle talking
to a new deployed server** — because there is only ever one build.

An e2e can intercept `/api/version` and prove the *render* path. It cannot
prove that a real deploy is detected, or that pressing `Reload` lands the user
on the new build. Those are properties of Vercel's routing, Next's asset
hashing and the service worker's caching, none of which the dev server models.

## The version update prompt

Shipped across v0.41.12.0 – v0.41.14.0. Three claims, in the order they fail.

### 1. `/api/version` is not cached in production

```
curl -si https://volunteerready.org/api/version | grep -i 'cache-control\|age\|x-vercel-cache'
```

**Expect:** `cache-control: no-store`, no `age` header, and either no
`x-vercel-cache` or `MISS`. Run it twice a few seconds apart and confirm the
response is regenerated rather than served from an edge cache.

**Why this one is first:** it is the failure that disables the whole feature
while looking perfectly healthy. A cached response returns a stale `buildId`
forever, so the comparison always matches, the prompt never fires, and nothing
errors anywhere. That is byte-for-byte how the banner this feature replaced
stayed dead for eight releases. `scripts/version-route-gate.test.ts` guards the
route's source, but it cannot see a CDN rule, a `vercel.json` edit, or a
platform default change.

### 2. `buildId` is a real commit SHA in production, not the semver fallback

```
curl -s https://volunteerready.org/api/version
```

**Expect:** `buildId` is a 40-character hex SHA and **differs** from `version`.

If `buildId` equals `version` (e.g. both `0.41.14.0`), the build did not
receive `NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA` and has silently fallen back to the
semver. The feature still works, but it has quietly lost rollback and
preview-promote detection — the entire reason T0 moved identity off the semver.

Compare the SHA against the deployment's commit in the Vercel dashboard.

### 3. `Reload` lands the user on the new build

**The claim no automated check can make**, and the reason this file exists.

1. Open `/app` as a staff user and leave the tab open.
2. Deploy a release with `RELEASE_SEVERITY = 'notice'`.
3. Return to the tab. Within five minutes of it becoming visible, the strip
   should appear.
4. Press `Reload`.
5. Confirm the strip does **not** come back, and that the account menu's
   version reads the new release.

**If the strip returns after reloading**, the reload landed on a stale cached
shell. That is the loop the guard in `use-app-update-check.ts` exists for: it
suppresses the repeat prompt and logs
`[app-update-check] reload did not change the running build` to Sentry — so
check Sentry rather than assuming step 5 passed. The root cause would be
`public/sw.js`, whose cache version is a frozen literal; that is tracked
separately in `docs/TODOS.md` and deliberately out of scope here.

### What is already covered automatically — do not re-check by hand

- The strip's gates, copy, latch and layout — `e2e/app-update-prompt.spec.ts`
  (named `(mocked /api/version)` precisely so nobody mistakes it for step 3).
- No prompt on a first visit — `e2e/public-pages.spec.ts`, an honest
  reproduction, since a fresh browser context genuinely is the first-visit path.
- Public pages issue zero `/api/version` requests — same spec.
- The route's cacheability directives, import list and build-id provenance —
  `scripts/version-route-gate.test.ts`.
