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

## Sentry after the `@sentry/nextjs` 11 upgrade

Shipped in v0.43.7.0. Sentry 11 replaced the upload tooling (`@sentry/cli` and
`@sentry/bundler-plugin-core` gave way to `@sentry/bundler-plugins`, which
loads the `sentry` CLI package in-process) and changed what each runtime
collects. CI does not set `SENTRY_AUTH_TOKEN`, and no local harness sends to
Sentry, so all five checks below need a production deploy.

### 1. The production build log shows a normal upload

Same check as the `brace-expansion` section above: the first production build
of v0.43.7.0 should report a source-map upload with a file count close to the
previous deploy's. A missing upload or a `Didn't find any matching sources`
line means the new plugin is not uploading.

### 2. A new production error shows original source

**Expect:** stack frames naming files under `src/`, not minified chunk names.

### 3. Server, edge and browser events all arrive

Over the first day, Sentry should receive at least one event from each
runtime. Browser events come through the `/monitoring` tunnel. A runtime
going quiet that sent events before the upgrade means its init did not run.

### 4. Server events carry no cookies or client IP

Open any server or edge error event from the new release. **Expect:** no
`request.cookies`, no `Cookie` or `Authorization` header, and IP-bearing
headers such as `x-forwarded-for` shown as `[Filtered]`. Then open a trace and
check the span volume against the Sentry quota: v11 streams spans, and the
browser still samples every page view.

### 5. No secret token reaches Sentry from a URL

After the URL-scrubbing follow-up ships, open a page whose URL carries a token
(an expired invite link, `/invite/<anything>`, is enough) and trigger a
browser error from the console: `setTimeout(() => { throw new Error('url scrub check') })`.
**Expect:** the event's URL, breadcrumbs and transaction show
`/invite/[Filtered]`, and no session replay exists for that page. Then search
Sentry's traces for `/invite/` and `token=`: span names and `url.full`,
`http.target` and `sentry.segment.name` attributes should show `[Filtered]`,
never a token, and no `http.request.header.next-router-state-tree` value.

For the server side, open any server error from a token route (or from
`/apply/status?token=`). **Expect:** `contexts.nextjs.request_path`, the
request URL and the `next-url` header show `[Filtered]`, and
`next-router-state-tree` / `x-now-route-matches` are `[Filtered]` or absent.
A raw token anywhere means a path the scrubber does not cover.

### What is already covered automatically — do not re-check by hand

`scripts/sentry-data-collection.test.ts` pins the server and edge
`dataCollection` options, the `beforeSend` scrubbing and the `beforeSendSpan`
URL scrubbing as passed to `Sentry.init`; `src/instrumentation-client.test.ts`
pins the browser's scrubbers and the no-replay-on-secret-URL rule;
`src/lib/sentry-url-scrub.test.ts` covers the patterns. None of them can see
what the SDK actually sends.

## Email sends after the v0.43.4.0 dependency bump

Shipped in v0.43.4.0. Every email the app sends goes through `sendEmail()` in
`src/server/lib/email.ts`, which calls Resend, and `resend` moved from 6.29.0
to 6.32.0. CI sets no `RESEND_API_KEY` and tests must never drive
`/api/auth/signin/email`, so no check before deploy makes a real send.

`nodemailer` (10.0.12 to 10.0.14) is not on the send path. `src/server/auth.ts`
gives `EmailProvider` its own `sendVerificationRequest`, so next-auth loads
`nodemailer` but never calls it. next-auth 4.24.15 declares an optional
`nodemailer` `^7.0.7` peer, and the app was already on 10.x before this release.

### 1. A magic link arrives and signs you in

Request a link at `/login` with an address you can read. **Expect:** the email
arrives and the link signs you in. If it does not, search the Vercel runtime
logs for `[sendEmail] Resend rejected the send` or `Failed to send magic link
email`.

### 2. New `SENT` rows still carry a Resend id

```sql
SELECT "createdAt", "subject", "resendId"
FROM "EmailEvent"
WHERE "eventType" = 'SENT' AND "createdAt" > '<deploy time>'
ORDER BY "createdAt" DESC
LIMIT 10;
```

**Expect:** a row for the step 1 email, and no null `resendId` on any row.
`sendEmail` reads the id from `result.data.id`, so a null there means the
client's response no longer has the shape the code reads. Compare against the
Resend dashboard before trusting any count built on these rows.

Also add one new volunteer from `/app/volunteers` and confirm the toast says
"We let them know by email." That notice is sent inside `waitUntil` from
`@vercel/functions` (3.9.9 to 3.9.11), as are the background-check disclosure
email and the bulk CSV import job. A row for the magic link but none for this
add points at `waitUntil`, not Resend.

### What is already covered automatically — do not re-check by hand

Unit tests mock both the Resend client and `waitUntil`, so they prove the
callers, not the sends. Checked while this shipped: the `@vercel/functions`
changelog lists only `@vercel/oidc` dependency updates for 3.9.10 and 3.9.11,
and the package's root entry, which is all the app imports, does not load
`@vercel/oidc`. The new `@vercel/oidc` 4.0.0 major is reachable only through
the `@vercel/functions/oidc` subpath, which nothing in `src/` or `scripts/`
uses.

## Stripe calls and webhooks after the `stripe` 23 upgrade

Shipped in v0.43.6.0. `stripe` moved from 22.6.2 to 23.0.0, and `getStripe()`
in `src/server/services/billingService.ts` now pins API version
`2026-09-30.endive` (it was `2026-08-26.dahlia`). That pin sets the version of
the calls the app makes to Stripe: creating customers, checkout sessions and
billing portal sessions, and listing events for reconciliation. It does not set
the version of the webhooks Stripe sends back. Tests mock the Stripe client or
sign payloads offline, so nothing before deploy talks to Stripe.

### 1. Checkout and the billing portal open in test mode

On a deployment whose `STRIPE_SECRET_KEY` is a test-mode key (`sk_test_...`),
sign in as an org OWNER and open `/app/billing`.

1. Press `Upgrade to Starter` (or `Upgrade to Pro`). **Expect:** a redirect to
   Stripe Checkout. Pay with a Stripe test card and confirm you land back on
   `/app/billing` with the "Plan upgraded successfully!" toast.
2. Press `Manage subscription`. **Expect:** the Stripe billing portal opens and
   its return link brings you back to `/app/billing`.

A "Failed to open checkout" or "Failed to open billing portal" toast means
Stripe refused the call. Check the Vercel runtime logs or Sentry for the
Stripe error, which names the parameter it rejected.

### 2. A subscription webhook returns 200 and updates the plan tier

Stripe sends each webhook at the API version set on the webhook endpoint in
the Stripe dashboard, not at the version the SDK pins. Upgrading the SDK does
not change what arrives, but the code now reads those payloads through the
23.0.0 types, so confirm a real one still parses.

1. In the Stripe dashboard, open the endpoint that points at
   `/api/stripe/webhook` and **write down its API version** in the PR or the
   deploy notes. A later change to that setting changes the payload shape, and
   this check should be repeated then.
2. After the first `customer.subscription.created`, `.updated` or `.deleted`
   delivery following the deploy (step 1 produces one in test mode, if that
   deployment has a test-mode endpoint), the endpoint's delivery log should
   show a 200 response.
3. Confirm it was recorded at the version you wrote down:

```sql
SELECT "stripeId", "type", "processedAt", "payload"->>'api_version' AS api_version
FROM "StripeWebhookEvent"
WHERE "type" LIKE 'customer.subscription.%' AND "processedAt" > '<deploy time>'
ORDER BY "processedAt" DESC
LIMIT 10;
```

4. **Expect:** the org's `/app/billing` badge shows the new plan, and an
   `AuditLog` row with action `PLAN_UPDATED` (or `PLAN_DOWNGRADED` for a
   deletion) carries that `stripeEventId` in its `metadata`.

A 400 means the signature check failed: compare `STRIPE_WEBHOOK_SECRET` with
the endpoint's signing secret. Each one logs `[stripe-webhook] Rejected a
request whose signature did not verify`. A 500 from a price the app cannot map
logs `[billing] unknown-stripe-price <price> on event <id>` on every delivery,
and for events under an hour old the platform admins get a "[Billing] Stripe
price not recognised by the app" email naming the price and the customer. A 500 means processing threw; search the Vercel
runtime logs for `[stripe-webhook] Unhandled error`. Stripe retries a 500, so
the event is not lost, but the plan tier stays stale until it succeeds.

### What is already covered automatically — do not re-check by hand

`src/app/api/stripe/webhook/__tests__/route.signature.test.ts` runs the real
route, the real billing service and the real `stripe` 23 library against
payloads signed offline. It proves a correctly signed event is accepted and
recorded, and that a tampered body, a wrong secret, a stale timestamp, a
missing signature or an unset `STRIPE_WEBHOOK_SECRET` each get a 400 with
nothing recorded. It makes no network call, so it cannot show that Stripe
accepts the new API version or what version the endpoint sends.
`route.test.ts` and `src/server/services/__tests__/billingService.test.ts`
mock Stripe entirely.


## Plan tiers after the billing-correctness fix

Shipped in v0.43.8.0. Every `customer.subscription.*` event for a known org or
company now lists the customer's subscriptions from Stripe and applies the best
paying one: `active`, `trialing` and `past_due` count, highest tier first, then
newest; none means FREE. Paying orgs no longer see checkout buttons: they
change plans in the Stripe billing portal, and checkout refuses an org that
already pays. Tests mock Stripe, so the real list call, the portal and a real
status sequence are only seen after deploy.

### 1. Three Stripe dashboard settings this now depends on

Check all three in **test and live mode**:

1. **Billing → Customer portal → Subscriptions → "Customers can switch
   plans"** is on, with the Starter and Pro prices listed, and **"Customers
   can cancel subscriptions"** is on. Without switching, a paying org has no
   way to change plans: the app no longer offers them a checkout. Without
   cancelling, an org stuck on an unpaid subscription cannot clear it to
   check out again.
2. **Developers → Webhooks → the endpoint for `/api/stripe/webhook`** sends
   `customer.subscription.paused` and `customer.subscription.resumed` as well
   as `.created`, `.updated` and `.deleted`. Without them a pause keeps the paid
   tier and a resume leaves the org on Free until some other subscription event
   arrives (the admin reconcile on `/app/admin/health` replays them too).
3. **Billing → Revenue recovery → "If all retries for a payment fail"** is set
   to cancel the subscription or mark it unpaid, not to leave it past due.
   `past_due` keeps the paid tier while Stripe retries the card; left past due
   forever, a card that never pays would keep the plan forever.

### 2. A test-mode checkout grants the plan once payment completes

On a deployment with a test-mode `STRIPE_SECRET_KEY`, run the checkout in
"Checkout and the billing portal open in test mode" above. **Expect:** the
webhook deliveries return 200, the `/app/billing` badge shows the new plan, the
upgrade buttons are gone and the page says to switch plans through Manage
subscription. The latest `PLAN_UPDATED` `AuditLog` row for the org has
`"subscriptionStatus": "active"` in its `metadata`. One upgrade email should
arrive. Two would mean Stripe's `created` and `updated` deliveries were
processed at the same moment, each seeing the org still on Free.

### 3. Switching plans in the portal keeps one subscription

Press `Manage subscription` and switch from Starter to Pro. **Expect:** the
badge shows Pro, and the Stripe customer still has exactly one active
subscription.

### 4. A cancellation drops the plan and stays dropped

Cancel that subscription immediately from the Stripe dashboard. **Expect:** the
badge returns to Free and a `PLAN_DOWNGRADED` row has
`"subscriptionStatus": "none"`. Then run the platform admin reconcile on
`/app/admin/health` over the last hour. **Expect:** the badge is still Free.

A 500 on these deliveries with a Stripe error in the logs means the list call
failed; Stripe retries it, so the tier catches up once Stripe answers.

### What is already covered automatically — do not re-check by hand

`src/server/services/__tests__/billingService.test.ts` covers each status, a
stale event after a cancellation, two live subscriptions (a cancelled one
beside a paid one, a renewing lower tier beside a higher one, a same-tier
tie), the refused second checkout and the concurrent first-checkout race,
against a mocked Stripe. `orgStripeCustomerClaim.integration.test.ts` runs the
customer claim against Postgres, and `stripeCustomerLock.integration.test.ts`
shows two transactions for one customer never overlap.
