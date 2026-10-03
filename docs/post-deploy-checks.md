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

## The credential expiry notice

Shipped in v0.42.0.0. Checked **the morning after the first nightly run**, not
at deploy time — the job runs at 03:00 UTC and there is nothing to look at
until it has.

This one earns a place here for a different reason than the version prompt. It
is not that no harness can reach it; it is that **its first production run is
unlike every run after it**. On night one the entire backlog is due at once —
every credential already inside the 30-day window, across every org, none of
them stamped. Fixtures cannot reproduce that shape, and the failure it produces
is silent: the job reports success, staff simply never hear about the orgs that
fell past the cap.

It also sends real email and writes irreversible `notifiedAt` stamps, so a bad
night is not something you can re-run your way out of. That is what
`pnpm credentials:reset-notice` is for, and step 3 is how you find out you need it.

### 1. The run finished, and finished cleanly

Open `/app/admin/health` (or query `CronJobRun` for `expire-credentials`).

**Expect:** a SUCCESS row for the 03:00 UTC run whose `resultSummary` carries
`credentialsScanned`, `credentialsNotified`, `orgsProcessed` and
`noticeEmailsSent`.

**A FAILURE row has no `resultSummary` at all.** `withCronAuth` writes
`resultSummary` only on the success path; the failure path records `error` and
nothing else. That is exactly why the route builds the partial summary before
rethrowing and embeds it in the error *message* — so on a FAILURE row, read the
`error` string, not the empty summary column. It names which of the four
branches threw and carries what the other three actually did.

Read it before re-running anything. The notifier's `notifiedAt` stamps are not
replayable, and that string is the only record of what the failed run had
already consumed.

### 2. The org cap did not silently absorb the backlog

**Expect:** `orgCapReached` is `false`.

Read the flag precisely: it is `orgIds.length >= CREDENTIAL_EXPIRY_NOTICE_ORG_CAP`
(50) against a query already limited to 50, so it means **"the page came back
full"** — not "orgs were deferred". An exactly-50-org night with nothing left
over sets it too. It is a "look closer" signal, not a finding.

When it is true, the way to tell the two apart is the next night: if
`orgCapReached` is false and `orgsProcessed` is small, the backlog drained and
the 50 was the whole of it. If it stays true for several nights running, orgs
really are being deferred and the cap needs raising for a few runs. Deferral
itself is the design working — a bundle is served whole or waits, never
truncated — but on night one it can mean a long tail.

Also check `orgsWithNoRecipients` is 0. A non-zero value is orgs with no OWNER
or ADMIN — they are excluded at the query rather than starving the queue, but
each one is a real org whose expiring credentials nobody is being told about.

`credentialsNotified + credentialsUnresolved === credentialsScanned` always
holds; the summary is built so it does. If it ever does not, the arithmetic is
wrong somewhere and no other number in the row can be trusted.

### 3. The email actually arrived, and says the right org

**The claim no automated check can make.**

1. Pick one org from the run and one OWNER or ADMIN on it.
2. Confirm they received the summary email, and that the in-app bell shows the
   matching notification.
3. Confirm the volunteer names, credential types and day counts in the email
   match that org — not another org the same person is staff at.
4. Confirm `noticeEmailsFailed` is 0. A non-zero value means `sendEmail`
   returned false (Resend rejection, 429, bounce-suppressed address); those
   orgs are deliberately left unstamped and retried tomorrow.

**If a batch was stamped but nobody received anything** — a Resend outage, a
broken template — the credentials are now silent for the rest of their cycle.
Recover with a dry run first, always:

```
pnpm credentials:reset-notice --org <slug> --since <ISO of the run>
pnpm credentials:reset-notice --org <slug> --since <ISO of the run> --yes
```

`--audit-run <auditLogId>` targets exactly one run's stamps instead, which is
the narrower and usually better choice when you have the audit row to hand.

### What is already covered automatically — do not re-check by hand

- Window arithmetic, per-cycle idempotency, the stamp predicate and the notice
  copy — `src/server/domain/credential-expiry.test.ts` and
  `credential-expiry.copy.test.ts`, run under `TZ=America/Los_Angeles` so DST
  divergence is exercised rather than hidden by a UTC runner
  (`credential-expiry.tz-gate.test.ts` pins that).
- Org grouping, the cap, pacing, and that a failed send leaves the org
  unstamped — `credential-expiry-notice-service.test.ts`.
- The queries, including the suspended-org and no-recipient exclusions, against
  real Postgres — `credentialExpiryNotice.integration.test.ts`.
- The route's `allSettled` behaviour, shared clock and partial summary —
  `src/app/api/cron/expire-credentials/__tests__/route.test.ts`.
- Every rail on the reset script, including the `--dry-run --yes` refusal —
  `scripts/reset-credential-expiry-notice.test.ts`.

## Production migrations over the direct connection

Shipped in v0.43.1.0. No local harness has Neon's PgBouncer pooler or
Vercel's production environment variables, so both claims can only be checked
against a real production deploy.

### 1. `DATABASE_URL_UNPOOLED` is set for Production, and is the direct host

The production build now refuses to start without it, so check before the
first deploy of v0.43.1.0, not after it fails. In the Vercel dashboard
(Project → Settings → Environment Variables), `DATABASE_URL_UNPOOLED` must be
scoped to **Production** and its host must **not** contain `-pooler`. The Neon
integration normally provisions it. If it is missing, the deploy fails at
install (`prisma generate`) with `DATABASE_URL_UNPOOLED is not set`, which is
the intended failure: the alternative is migrating through the pooler, which
is what caused the P1002 outage.

### 2. The deploy log shows migrations running and releasing the lock

In the production build log, `Production build: running prisma migrate
deploy...` is followed by `No pending migrations to apply.` (or the applied
list) and the build continues to `next build`. A `migration lock busy (P1002),
retrying` line on its own is fine: another production build was migrating at
the same moment. Three of them followed by a failed build means a lock is
held by something that is not a build. On the production database:

```sql
SELECT pid, application_name, state, backend_start
FROM pg_locks JOIN pg_stat_activity USING (pid)
WHERE locktype = 'advisory' AND objid = 72707369;
```

`72707369` is the lock id Prisma printed in the v0.43.0.0 failures. Terminate
the holder (`SELECT pg_terminate_backend(<pid>);`) only once it is confirmed
not to be a migration that is still running.

### What is already covered automatically — do not re-check by hand

Which URL the CLI picks, the refusal when `DATABASE_URL` and the direct URL
name different databases, and the production refusal of a missing or pooled
URL are all unit-tested in `scripts/cli-database-url.test.ts`. The retry loop
was exercised against a stubbed `pnpm` while this shipped: it retries only
`Error: P1002`, at most three times, and fails immediately on anything else.

## Sentry source maps after the `brace-expansion` raise

Shipped in v0.43.3.0. The `brace-expansion` override moved from 5.0.9 to
5.0.12, and that package sits under `@sentry/bundler-plugin-core` (through
`glob` and `minimatch`), which finds the source map files to upload during
`next build`. If the new version expands a file pattern differently, fewer
files match and the build still passes. CI does not set `SENTRY_AUTH_TOKEN`,
so no pull request check runs the upload.

### 1. The production build log shows a normal upload

In the build log of the first production deploy of v0.43.3.0, the Sentry
plugin should report uploading source maps, with a file count close to the
previous production deploy's. A `Didn't find any matching sources for debug
ID upload` line means the patterns matched nothing. `next.config.ts` sets
`silent: !process.env.CI`, so if the log has no Sentry lines at all, check
the release's uploaded source maps in Sentry instead.

### 2. A new production error shows original source

Open the next production issue in Sentry. **Expect:** stack frames that name
files under `src/`, not minified chunk names. Minified frames on a new release
mean the upload missed files, even if the build log looked fine.

### What is already covered automatically — do not re-check by hand

The override's range and the installed version are pinned by
`scripts/pnpm-overrides.test.ts`, and the CI `Security advisories` job runs
`pnpm audit`. Neither runs the Sentry upload.
