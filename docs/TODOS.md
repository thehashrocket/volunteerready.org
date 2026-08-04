# TODOS

Deferred work captured during CEO + engineering plan reviews for Phase 6.
Each item includes enough context for a future engineer to pick it up cold.

---

## Opened by the Dependabot security review (2026-08-03, 23 alerts)

Deferred from the alert-remediation plan. Both were considered and explicitly
scoped out of the security PRs so an urgent account-takeover fix would not wait
on unrelated work.

### [P2] `normalizeEmail` is validate-then-normalize, protected only by zod's ASCII regex

`normalizeEmail()` (`src/server/domain/org-volunteer.ts:87`) is
`email.trim().toLowerCase()` with no Unicode normalization — structurally the
same defect as the next-auth CRITICAL advisory (email normalizer validates
before Unicode normalization, allowing a homoglyph `@` bypass). It is used as an
**authorization** comparison in three places: `memberService.ts:230` (org
invitation acceptance), `companyService.ts:327` (company invite acceptance), and
`backgroundCheckService.ts:398` (Guard 1.5, binding submitted PII to the
volunteer being checked).

It is not exploitable today, and that was verified by execution rather than
assumed: zod v4's `.email()` rejects fullwidth `＠` (U+FF20), small `﹫`
(U+FE6B), and fullwidth-`a` domains, so every app path guarded by
`volunteerEmailSchema` is safe. But that protection is a property of **zod's
implementation**, not a decision this codebase made. A future zod release
relaxing toward RFC 6531 international addresses would make three authorization
predicates collide on homoglyphs, with no failing test and no code change here.

**The fix is not a one-liner, which is why it was deferred.** Adding
`.normalize('NFKC')` to `normalizeEmail` needs a matching migration: the
Postgres index is `lower(btrim(email))` with no NFKC pass, and next-auth's
adapter writes `User.email` rows **without** going through this function — so a
JS-normalized lookup would miss un-normalized rows. Needs the index change and a
backfill in the same ship.

**Interim guard (shipped with the security PR):**
`src/server/domain/org-volunteer.test.ts` pins that zod rejects four homoglyph
forms (U+FF20, U+FE6B, U+FF41 in the domain, U+017F), so a zod bump that
relaxes this goes red instead of silent. Do not delete it when this TODO lands —
it covers the `volunteerEmailSchema` paths, which
`EmailProvider.normalizeIdentifier` does not touch. **Effort:** M.

### [P2] `pnpm e2e` is not in CI, and three coverage gaps depend on it

`.github/workflows/ci.yml` runs lint, typecheck, `docs:build`, unit, scripts and
integration. It does **not** run e2e, and it does not run `next build` either —
the only production-build signal is the Vercel preview deploy, which is not a
gate.

Three findings in the Dependabot review resolved to "e2e covers it, but CI does
not run e2e": `/_next/image` rendering (the scrolled `naturalWidth` assertions in
`e2e/public-pages.spec.ts`), the Turbopack dev loop (the `Prisma.sql`
`instanceof` bug class only reproduces under `next dev`), and the signed-out
`/app` redirect. Each one currently falls to a manual checklist on the PR, which
means every future framework bump repeats the same manual pass.

**The hard part is already done.** `e2e/global-setup.ts` solved the sequential
route warmup that fixes the Turbopack manifest-race 500s, so the remaining work
is CI plumbing: Playwright browsers, a Postgres service container, and
`seed:dev`. It is the slowest job in the pipeline, which is why it warrants its
own ship rather than riding along with a security fix.

**Blocks:** retiring the manual verification checklists on runtime dependency
PRs. **Effort:** M.

---

## Opened by the marketing claims audit (2026-08-03)

Every public page was read against the code that backs it. Thirteen mismatches
were found and the copy for all of them is now corrected; these four are the
parts that need a decision or new code rather than accurate words.

### [P2] The matcher ignores two inputs its own domain already scores

`scoreOpportunity` (`domain/volunteer-matching.ts`) accepts optional
`credentialTypes` and `availability` and awards `CONTEXT_BONUS` (+5) for each as
a tiebreaker. **No caller passes either.** All four call sites —
`app/browse/page.tsx:41`, `opportunities/[orgSlug]/page.tsx:66`,
`volunteerMatchingService.ts:96` and `:143` — pass `{ skillIds }` alone, so
`computeAvailabilityBonus` hits its `if (!availability || !shiftSchedule) return 0`
guard on every request in production. The scoring code is written and unit
tested; only the arguments are missing.

`VolunteerProfile` already stores `availability` (schema:531) and
`VolunteerCredential` rows are queryable per user, so this is plumbing, not new
modelling. Worth doing — it is the cheapest available improvement to match
quality, and it would make the pre-audit marketing copy true rather than the
copy having to retreat to "skills".

**Location is different.** Nothing scores it anywhere, and `VolunteerProfile`
holds only `city`/`state` free text with no geocoding, so distance matching is
real work. Do not lump it in with the two above.

### [P2] Nothing warns anyone that a credential is about to expire

`/screening` promised "get notified before they lapse" for months and no such
notification exists for any audience. The only expiry notifier in the codebase
is `notifyExpiringShareTokens()` (`expire-credentials/route.ts:12`), which is
about credential *share links* — a different object with a different lifetime.

What exists today: `volunteerDashboardService.ts:85` surfaces credentials
expiring within 30 days on the **volunteer's own** dashboard, in-app only. The
org — which is who cares, because a lapsed background check is their compliance
exposure — gets nothing. There is already a daily cron
(`api/cron/expire-credentials`) that would be the natural home, and
`sendEmail`'s boolean must be read per the v0.40/v0.41 rule if a notice is
added.

Copy now describes only what the product does. If this ships, `/screening`'s
feature card and pain-point list should go back to leading with it.

### [P3] `pnpm typecheck` does not cover test files

`tsconfig.json:33-37` excludes `**/*.test.ts`, `**/*.test.tsx` and `**/*.spec.ts`.
So `billing.test.ts` could assert `limits.maxOpportunities` after the field was
removed from `PlanLimits` and `pnpm typecheck` stayed green; only vitest caught
it. Verified by experiment: appending `const x: number = "nope"` to a test file
leaves `pnpm typecheck` at exit 0.

Harmless while CI also runs the suites, which it does — but it means "typecheck
passes" covers less than the name suggests, and a type-only regression in test
helpers (no assertion to fail) could slip through entirely.

### [P3] Five non-failing Biome diagnostics sit on `main`

`digest-unsubscribe-token.test.ts:47` (useTemplate),
`opportunityDigestService.ts:42` (unused `e`), and `marketplace.ts:73,81` (two
non-null assertions), plus two infos. All are warnings, so `pnpm lint` exits 0
and CI is green — **this is cleanup, not a broken build.** Each has a fix Biome
classes as unsafe, so they want a human call rather than `--write`.

Worth knowing while you are here: `pnpm lint` is `biome check .` (whole repo)
and the pre-commit hook runs `pnpm check` (`src docs prisma/schema.prisma`) with
`--write`, so the hook silently auto-formats your diff before it is committed.
A formatting error you introduce will disappear without being reported, which is
briefly confusing if you saw `pnpm lint` fail and then saw it pass.

---

## Opened by the importer-hardening ship (2026-08-03, v0.41.0.0)

### Caught while building — recorded so it is not reintroduced

**`sendRosterAddedEmail` was discarding `sendEmail`'s boolean, so the importer
reported notices it had not sent.** `sendEmail` returns `false` — it does not
throw — for a Resend error and for a bounce-suppressed address, so
`sendImportNotifications`' `try/catch` was dead on the likeliest failure and
counted every silent failure as `sent++`. A 60-row import printed
`notifications sent: 60` with nothing delivered. This is the **same defect
`sendBackgroundCheckEmail` was fixed for in v0.40.0.0**, on the same kind of
email: the only notice its recipient ever gets, carrying the only link to the
surface where they can revoke the access. The rule was written down at the time
and the roster path was not audited against it — **when a rule is recorded
because one sender got it wrong, grep every other `sendEmail` caller then, not
at the next incident.**

Two tests are needed and one does not imply the other: `mockResolvedValue(false)`
and a genuine rejection. The rejection test existed and passed the whole time the
hole stood.

**`addVolunteer`'s notice was a floating `void` promise.** Fixed to `waitUntil`
in the same pass, `.catch` still inside. Same reasoning as
`backgroundCheckService`: on Vercel the function can be frozen as soon as the
tRPC response is written, and the thing being dropped is that notice.

**`sendEmail` never looked at Resend's error channel, so reading its boolean
proved nothing.** Found by the security specialist during `/ship`, one layer
below where this ship was working. Resend does NOT throw on a rejected send —
its response type is `{ data, error: null } | { data: null, error }` — and
`sendEmail` read only `result?.data?.id`, wrote a SENT `EmailEvent`, and
returned `true`. So a 429, the exact failure `DEFAULT_NOTIFY_DELAY_MS` exists to
avoid, was recorded as a delivery. **The rule: reading a status flag is worthless
if the code computing it cannot see the failure — check the transport's own
error channel, not just its exceptions.** The phantom SENT rows made this worse
than a bad count: `--notify-only` correlates against `EmailEvent`, so the
recovery mode would have skipped precisely the people whose notices were lost.
The check now runs BEFORE the `EmailEvent` write, so a send that did not happen
leaves no record claiming it did. Pre-existing and platform-wide — every sender
was affected, not just the roster.

**A comment claiming two code paths are unified does not unify them.**
`sendNoticesSequentially`'s docstring said both notify paths went through it;
`sendOwedNotices` had its own copy of the loop. Caught by two specialists
independently, and it had already propagated into `CLAUDE.md`. Fixed by making
the claim TRUE — the loop takes a per-recipient `resolveContext` callback — not
by softening the comment. **A shared-implementation claim should be checked by
grepping the callers, not by reading the docstring.**

**A summary line that is structurally always zero is worse than no line.**
`--notify-only`'s write path converts every `OWED` row to `SENT` or `FAILED`
before returning, so printing an `owed:` count put `owed: 0` directly above
`sent: 1`. Caught in review, not by a test — the test asserted the tallies that
were present and never that a misleading one was absent.

### [P3] `isLocalDatabaseUrl` calls an SSH-tunnelled production database "local"

Raised by the security specialist during the `/ship` review. `isLocalDatabaseUrl`
decides from `new URL(url).hostname` alone, so
`postgres://user@localhost:5433/prod_db` — the ordinary way an operator reaches a
managed Postgres that is not publicly routable — skips the typed-slug
confirmation entirely, leaving `--yes` as the only gate on the exact write the
prompt was added to catch.

Not fixed in that ship because the alternatives each have a real cost and the
choice is a judgement call: always prompt and exempt only `--dry-run` (one line
of typing on every genuinely local run, and it would fire constantly in
development); require the default port 5432 as well (breaks a legitimate local
container on a non-standard port); or require an explicit `IMPORT_ROSTER_LOCAL=1`
opt-out (a new env var to document and remember). **Fix:** pick one, and prefer
the fail-closed shape — a prompt costs seconds, a mis-aimed production write
costs a stranger's tenant. **Effort:** S.

### [P3] `--notify-only` exits 0 on a file whose every row is invalid

`notifyOnlyExitCode` counts `FAILED` and `MALFORMED_AUDIT_ROW` only, while the
ordinary import path's `exitCodeFor` also counts `INVALID`. The script does feed
the invalid count into the summary, but `NotifyOnlySummary` does not declare the
key, so it is silently dropped.

Concretely: point `--notify-only --yes` at a spreadsheet whose phone column Excel
reformatted, so every row fails validation. The run prints 60 INVALID lines,
classifies nobody, sends nothing, and exits 0 — and a wrapper script reading only
the exit code records the recovery as successful while all 60 volunteers remain
untold. **Fix:** decide it explicitly rather than by omission — either add
`INVALID` to `NotifyOnlySummary` and to the predicate (consistent with
`MALFORMED_AUDIT_ROW`, which exits 1 on the stated "we cannot tell is not no"
principle), or pin the current behaviour with a test and a comment saying why
notify-only differs. **Effort:** S.

### [P3] A truncated concierge-audit scan reports "never added" instead of "cannot tell"

`findConciergeImportAuditRows` stops at `CONCIERGE_IMPORT_SCAN_CAP` (20,000) and
returns no signal that it did. Past the cap `computeOwedNotices` sees no audit
row for an address and returns `NOT_COMMITTED` — which the exit code deliberately
treats as success — so a truncated scan tells the operator "not added by an
import, nothing to send" about someone who WAS added and IS still owed a notice.

That is the same "we cannot tell" versus "no" distinction the same file insists
on for `MALFORMED_AUDIT_ROW`, applied inconsistently. Unreachable today at any
plausible concierge scale (the cap is an org's cumulative import history), which
is why it is a P3 rather than a P2. **Fix:** return `{ rows, truncated }` when
`rows.length === take` and surface it as its own status or at minimum a warning
plus a non-zero exit. The `take` parameter also has no production caller and is
exercised only by the integration test. **Effort:** S.

### [P3] `LOCAL_DB_HOSTS` is now duplicated four times

`e2e/utils/db.ts`, `src/test/integration-setup.ts`,
`scripts/seed-email-collision-fixture.ts` and now `scripts/import-roster.ts`
each declare `new Set(['localhost', '127.0.0.1', '::1', '[::1]'])` and the same
`new URL(url).hostname` membership test.

The four differ in what they DO about a non-local database — two refuse with an
env-var override, one refuses outright, the importer prompts for the org slug —
but the set and the predicate are byte-identical, and by this repo's own
`escapeCsvField` precedent (extracted at its SECOND consumer, "two copies is
where one of them stops being maintained") four is well past the line.

**Fix:** extract the predicate ALONE — `isLocalDatabaseUrl(url): boolean`,
failing closed on a missing or unparseable URL — and migrate all four. Leave each
site's enforcement policy where it is; that is the part that legitimately
differs. Do it to all four at once: a shared module only the newest caller
imports is genuinely worse than the status quo. Not folded into the importer diff
because it reaches into the e2e and integration harnesses. **Effort:** S.

### [P3] The `--notify-only` `EmailEvent` dedupe cannot be made reliable without a marker

`findSentAddresses` matches `(to, eventType: 'SENT', subject)`, and that is the
best available signal rather than a good one: `sendEmail` writes the SENT row
fire-and-forget, writes nothing at all when Resend throws, and `EmailEvent`
carries no `orgId` — so the subject (which embeds only the org NAME) is the whole
scope, and two orgs sharing a display name collide. An org renamed between the
original send and the recovery will not match its own earlier sends either.

This is why the check is advisory and reported rather than a silent gate: every
one of those failure modes errs toward "we think it was sent when it was not",
which is exactly the state `--notify-only` exists to repair, so the safe
direction is to re-send and say so. A `notifiedAt` column on `OrgVolunteer`
would make it exact — the same column already tracked as a P3 for the
background-check disclosure, and worth doing once for both. **Effort:** M.

### [P3] `--notify-only` has no e2e and no test of `main()`

The classification, the sends and the two repository reads are each covered
(unit, mocked-service and real-Postgres respectively), and the flow was smoke
-tested by hand end to end — import with `--no-notify` to stage the interrupted
state, then `--notify-only --dry-run` to see the notice reported as owed. But
`main()` is still invoked by no test, so the wiring between those pieces — the
streamed-vs-printed row logic, the exit code, the confirmation prompt actually
being reached — is held by hand-verification only. Same pre-existing gap the
import path has. **Effort:** M.

---

## Opened by the background-check consent ship (2026-08-02, v0.40.0.0)

### Caught while building — recorded so it is not reintroduced

**A unit test asserting "the service passed X to the repository" does not test
that X is written.** `records the attesting actor on the request row` passed with
BOTH attestation columns deleted from `createBackgroundCheckRequestTx`'s `data`
block, because the repository is mocked at that layer and the service does still
hand the value over. Found by mutation-testing, not by review. The test was
renamed to the claim it actually supports (`passes the attesting actor to the
repository`) and the persistence moved to
`repositories/backgroundCheckConsent.integration.test.ts`, which goes red on that
exact mutation. **The general rule: when the property you care about is a
database write, the assertion has to reach the database.** Same shape as the
`isError`-vs-`QueryErrorCard` lesson — the convenient grep answers the wrong
question.

**Guard 0's POSITION is load-bearing and needs its own test.** A test that only
asserts the refusal happens passes whether the attestation check runs before or
after the relationship guard and the paid provider call. `SECURITY: refuses
before any query and before the paid provider call` asserts
`requireOrgVolunteerRelationship` was never called; mutation-verified by moving
the block below it.

**Three fixtures went vacuous the moment Guard 0 landed.** The pre-existing
access tests share one `input` object with no `consentAttested`, so every one of
them started refusing at Guard 0 — including `SECURITY: never sends PII to the
provider when the guard rejects`, which would then have been asserting that an
*attestation* refusal skips the adapter rather than that the *relationship* guard
does. Adding a required field to a shared fixture silently reroutes every test
that uses it; check what the tests are still proving, not just that they are
green.

### [P1] ~~Nothing binds the submitted PII to the `userId` being checked~~ ✅ FIXED (2026-08-02, T38)

**Fixed by Guard 1.5 in `initiateProviderCheck`** — see the closing note at the
end of this entry for what shipped, what it does NOT close, and the two things
the build got wrong first. The original write-up is kept intact below because
the reasoning about which fields are verifiable is still the reasoning.

**Pre-existing, found by the Codex adversarial pass during the v0.40.0.0 ship.**
Not introduced by that diff and deliberately not fixed in it — recorded here
because it is the most serious thing in this flow.

`backgroundChecks.initiate` takes a `userId` AND a free-text `pii` block
(firstName / lastName / email / dob / ssn) from the same form, and **nothing
checks that they describe the same person**. The service authorizes the
`userId`, ships the *typed* SSN and DOB to Checkr/Sterling, binds the resulting
`BackgroundCheckRequest` (and any credential) to the `userId`, and — as of
v0.40.0.0 — sends the disclosure to the `userId`'s stored address.

So a coordinator who mistypes one digit of an SSN sends a **stranger's** SSN and
date of birth to a consumer reporting agency, and the report comes back attached
to the volunteer they meant to check. The new disclosure email does not make
this worse (it correctly reaches the person the org targeted) but it does not
catch it either, and the attestation column will name someone as having sworn
they hold a signed authorization for a report that is about a different human.

**Fix shape:** validate the submitted `pii` against the `User` record before the
provider call — at minimum `normalizeEmail(pii.email) === findEmailByUserId(userId)`,
which is free and catches the copy-paste-the-wrong-row case. A name check is
softer (legal vs preferred names) and should warn rather than refuse. The deeper
version drops the free-text identity fields entirely and derives them from the
roster row, leaving only SSN/DOB as input. **Effort:** M.

#### What shipped (T38)

`Guard 1.5` sits in `initiateProviderCheck`, between the relationship guard and
the capacity/credential guards, so both provider entry points inherit it:

1. **The submitted email must be the account's**, compared with `normalizeEmail`
   on BOTH sides and plain equality — never `mode: 'insensitive'`. Refusal is a
   hand-written `BAD_REQUEST` so `errorFormatter` lets the coordinator read it.
2. **The account's address, not the typed one, is what reaches the provider.**
   The guard has just proved they are the same address, so this changes no
   fact about the report — it means the coordinator-controlled field can only
   ever CONFIRM the identity, never steer the provider's correspondence.
3. **A name mismatch is recorded, not refused.** `submittedNameMatchesAccount()`
   in `domain/background-check.ts` is a token-overlap test, so "Jane Q.
   Smith-Jones" against "Jane Smith" does not flag; a disjoint name stamps
   `identityNameMismatch: true` on the audit row (conditionally spread, so the
   key stays filterable) and warns. Legal names and account names legitimately
   differ, so refusing would block real checks on real people.
4. **No email on file ⇒ refuse.** Nothing to verify against, and the disclosure
   the subject is owed has nowhere to go either.

**Two decisions that went the other way from the fix shape above.** (a) The
"deeper version" — deleting the free-text email — was considered and **rejected**:
it is strictly WEAKER here. Deriving the address means the coordinator never
restates the identity, so the wrong-row case proceeds silently; keeping the
field and requiring it to match is what turns a row mistake into a refusal. The
elimination half is achieved instead by not FORWARDING the submitted value.
(b) The guard runs **after** `requireOrgVolunteerRelationship`, not before: run
first it answers "does user X have address Y?" for any `userId` a caller cares
to submit, and user ids are not secret (`/v/[userId]` is public). Pinned by a
test that asserts `findUserIdentity` was never called when the relationship
guard rejects; mutation-verified by swapping the two.

**What this does NOT close.** A mistyped SSN or DOB — the literal example in the
opening paragraph — still reaches the provider. Those fields are unverifiable by
construction: the platform holds no copy to compare against. The email binding
catches the whole-row mistake and the name flag records the rest; a coordinator
who names the right volunteer, types their right address, and fat-fingers one
SSN digit is still unprotected, and no amount of server-side validation changes
that. Say so out loud rather than describing this flow as verified.

### [P2] Guard 1.5 proves nothing against a coordinator who controls the account

**Raised by the Codex adversarial pass during the T38 ship, and it is the right
framing of what shipped.** Staff mint a shadow `User` from an address they type
themselves — `addVolunteer`, and sixty at a time via `pnpm import:roster` — so
for an UNCLAIMED account the coordinator authored BOTH sides of the equality the
guard checks. Guard 1.5 is therefore a **mistake detector** (it catches the wrong
row) and not an integrity proof.

This is not a regression and not a reason to withhold the guard: the whole-row
mistake is the likely failure and the guard closes it. It is recorded because the
temptation on the next pass will be to read a `BACKGROUND_CHECK_INITIATED` row as
"identity was confirmed". It was not. The audit row deliberately stamps nothing
positive — only `identityNameMismatch` on failure — precisely so no later reader
can infer a confirmation that never happened.

**Fix shape, if it is ever worth it:** require `accountState === 'ACTIVE'` (a
claimed account, i.e. someone who proved control of that mailbox) before a check
may be initiated. That is a real strengthening and it also blocks the concierge
case outright — a spreadsheet of existing volunteers is entirely people who have
never logged in — which is the same trade-off the v0.40.0.0 ship considered and
rejected for `ORG_VOLUNTEER`. Do not take it without deciding that question
again. A softer version stamps `accountState` onto the audit row so a dispute can
see whether the subject had ever claimed the mailbox. **Effort:** S for the
stamp, M for the gate plus the concierge answer.


#### The name heuristic took FOUR adversarial rounds, and that is the lesson

`submittedNameMatchesAccount()` is ~30 lines of pure function with no I/O, and
every single round of adversarial review found a real defect in it — all four
invisible to a test suite written in English by someone who reads Latin script:

1. `[^a-z0-9]` as the separator class **deleted every non-Latin script**. A
   Chinese, Korean, Greek, Cyrillic, Arabic or Hebrew name tokenized to the
   empty set, which the caller reads as "nothing to compare", so the signal was
   silently dead for those volunteers and live for everyone else.
2. Widening to `\p{L}\p{N}` then **shattered the abugidas**: Devanagari and Thai
   write vowels as `\p{M}`, so `शर्मा` broke into one-letter fragments that
   corroborate almost anything.
3. Requiring only ONE corresponding token cleared `Robert Smith` against a
   stored `John Smith` — a shared surname is exactly what two different people
   in one spreadsheet have.
4. The two rules for a one-character token are **both wrong in opposite
   directions**: refusing containment flags the majority of Chinese names
   (surnames are one character), allowing it corroborates `A Doe` against
   `Jane Doe` because `jane` contains `a`. The discriminator is script
   casedness, not length — and a mutation proves the two constraints genuinely
   conflict, so a length rule cannot satisfy both.

**None of these were in the guard itself.** The email binding — the actual
control — came through all four rounds unchanged. The heuristic is the part
with no ground truth to test against, and it is the part that kept being wrong.

**Deliberately not iterated further.** This is a warning flag on an audit row,
not a gate; further calibration should come from real `identityNameMismatch`
rates in production rather than from another round of invented examples. If the
flag turns out noisy, the first thing to look at is Latin containment ("Ann"
inside "Joanne"), which is the remaining known false-negative source.
**Effort:** S to retune once there is data.

**Caught while building.** (1) The existing consent test's `TYPED_EMAIL` was
deliberately a DIFFERENT address from the account's, which the new guard now
refuses — so the fixture had to change, and narrowing it to a different address
would have made `SECURITY: notifies the address on the User record, never the
typed one` unable to fail. It is now the same address in different casing and
whitespace, which keeps the two strings distinguishable AND exercises
`normalizeEmail`. Third time a shared background-check fixture has silently
rerouted its own tests — check what they still prove, not that they are green.
(2) The name comparison needed a suffix filter before it was worth anything:
without one, "John Smith Jr" and "Robert Jones Jr" overlap on `jr` and the
mismatch goes unrecorded. Found by writing the mutation test, not by review.

### [P3] A failed notification loses the witness silently

`notifyVolunteerOfCheck` is not awaited (it runs under `waitUntil`) — correct,
because by that point the paid provider call has happened and the row is
committed, so throwing would report a failure for a check that is genuinely
underway. But a send failure means the subject is never told and nothing on the
request row records that.

**Narrowed during the ship's adversarial pass, and the correction is the useful
part.** `sendEmail` **does not throw** on failure — it RETURNS `false`, both for
a Resend error and for a bounce-suppressed address. So the `.catch` never fired
on the likeliest failure, and the original test passed while that hole stood
because it mocked a *rejection*, which is a different and rarer path.
`sendBackgroundCheckInitiatedEmail` now returns the boolean and
`notifyVolunteerOfCheck` logs `DISCLOSURE NOT SENT` via `console.error`. Two
tests now cover the two paths separately, because one does not imply the other.

What remains, and why this is still open: the loss is loud in logs but not
queryable, and a bounce-suppressed address is skipped **by design** — the notice
is not `isCritical`, unlike the FCRA adverse-action mail that deliberately
bypasses both guards. Whether a consent disclosure should bypass bounce
suppression the way a legally-required notice does is a genuine judgment call,
deliberately left unresolved rather than silently decided.
**Fix:** a `notifiedAt` column on `BackgroundCheckRequest` set on send success,
which also makes "checks whose subject was never notified" a one-query report.
**Effort:** S.

### [P3] `initiateSterlingCheck` has no tRPC caller

Pre-existing, noticed while threading `consentAttested` through both entry
points. `initiateSterlingCheck` is exported and fully guarded but nothing in
`routers/background-checks.ts` exposes it — the Sterling path is reachable only
by the webhook, so a Sterling-connected org cannot actually start a check from
the UI. Either wire it up or say out loud that Sterling is webhook-only.
**Effort:** S to wire.

### [P3] The `/terms` §6 notification promise is bound by a comment, not a type

The disclosure rule in CLAUDE.md wants a new member of a definition to be a type
error or a red test. There is no enum here — the "definition" is that
`initiateProviderCheck` calls `sendBackgroundCheckInitiatedEmail`, and deleting
that call turns one service test red. So the promise IS protected, but only
because that test exists; nothing structurally connects the sentence on the page
to the send. A comment on the bullet names the test. Better shapes exist (assert
the page copy from a constant the service also reads) and none of them are worth
much here. Recorded so the weakness is known rather than assumed away.
**Effort:** S.

---

## Opened by the docs-tree cleanup (2026-08-01, v0.38.5.0)

### Caught while building — recorded so it is not reintroduced

**`vitepress build` does NOT validate `themeConfig.nav`/`sidebar` links.** Verified
by experiment, not inferred: inserting `link: "/THIS_PAGE_DOES_NOT_EXIST"` into the
nav *and* into the sidebar both report `build complete` and exit 0. VitePress only
accumulates dead-link failures while transforming `.md` files. This is exactly how
the nav rotted for ~5 months after 3109623 deleted the six `docs/guide/*` stubs it
pointed at — the dead links that *did* fail the build were the ones in
`docs/index.md`'s markdown, not the config. `pnpm docs:build` in CI is therefore
necessary but **not sufficient**; config links are covered by
`scripts/docs-nav-links.test.ts` (`pnpm test:scripts`), mutation-verified against a
replay of the real 2026-03-09 regression. **Do not delete that test as redundant
with the build step — it is the half the build cannot see.**

**Merging a forked doc needs a diff, not a read.** The first pass at merging the
deleted `docs/DESIGN.md` into the root one carried over five rule sets and wrote
"five rule sets existed only there" into the decisions log. Adversarial review then
found **four more** that had been silently dropped (`font-display: swap` +
preconnect, the public-page layout rules, `color-scheme: dark`, the 700ms animation
ceiling). The assertion of completeness was the harmful part — it tells the next
reader not to check. Diff section-by-section before claiming what is unique.

### [P3] The design system is not reachable from the docs site

VitePress builds from `docs/`, and `DESIGN.md` is canonically at the repo root
(that is where `CLAUDE.md` sends everyone), so deleting `docs/DESIGN.md` removed the
design system from the site and a `/DESIGN` bookmark now 404s. Accepted for now: the
site is not deployed anywhere (`vercel-build.sh` never invokes vitepress, no workflow
builds it, `dist` is gitignored), and a second copy under `docs/` is the exact
duplication this ship existed to end. `docs/index.md` names the file and its location
instead. **If the docs site is ever published, fix with a symlink or a VitePress
`rewrites` entry — never a copy.** **Effort:** S.

### [P3] Focus-ring consistency debt, now written down rather than papered over

`DESIGN.md` states the focus contract as the `--ring` token at `ring-[3px]`
(`ui/button.tsx:8`), but the older `ring-2 … ring-offset-2` shape is the **majority**
in the tree: 18 call sites against 6, including `ui/checkbox.tsx`, `ui/input.tsx`,
`ui/select.tsx` and `public-header.tsx`. Both render a visible focus ring, so this is
consistency debt, not an a11y defect. The doc now says so out loud rather than
implying uniformity. Converging them is a mechanical sweep whenever someone wants it.
Related: the disabled state is a genuine two-way split (`pointer-events-none` on
`ui/button.tsx`, `cursor-not-allowed` across 8 form primitives) and is **not** debt —
`cursor-not-allowed` keeps a cursor cue on a natively-disabled field that
`pointer-events-none` suppresses. Do not "unify" that one. **Effort:** M.

---

## Opened by the T36 staff-tables ship (2026-07-31)

### Caught while building — recorded so it is not reintroduced

**The roster's shape does not transfer to three of the four pages, and copying
it literally would have removed capabilities from phones.** T28's rule is "the
row is the whole tap target; row actions move into the detail view." That worked
because T27 had just built a detail dialog containing `Remove`. Here:
`Publish`/`Close` exist on the opportunities LIST and nowhere else (the
opportunity detail page has only `Edit`); `Complete`/`Cancel`/`Delete` exist on
the shifts list and nowhere else (`ShiftDetailDialog` holds signups, the assign
picker and attendance, none of the three); and the team page has no detail view
at all. So all three keep their actions on the card, and the card is a `<div>`
with a linked title rather than a `<button>` — which is also what makes the
markup valid, since a nested `<button>` inside a tappable row is not.
**The general rule: check the detail view actually HAS the action before
deciding the card can drop it.**

**The shifts card list must not use `CardList`.** It is the only one of the five
that already sits inside a `Card` (the page's "Shift Schedule" card), so another
one is double chrome. A first pass used `CardList` pulled out with `-mx-6` to
cancel the inherited `px-6`; that makes the list wider than the wrapper the e2e
measures, and it failed as **internal sideways scroll** — the exact failure mode
these lists exist to remove. Plain `divide-y` on the wrapper is the whole
requirement there.

**`CARD_LIST` moved to `src/components/app/card-list.tsx`** at its fifth copy,
as a `CardList` component, and `volunteers/page.tsx` was migrated to it. The
class string is not self-explanatory and its reason lived two components away —
the shape that gets "simplified" back to a bare `<Card className="divide-y">` by
someone who cannot see why the dividers then look wrong.

**A Playwright name match is a SUBSTRING match.** `getByRole('button', { name:
shiftTitle })` matched four nodes, because the three action buttons are labelled
`Mark "{title}" complete` and friends. `exact: true` on the title button.

**`PageHeader` had the same `min-width: auto` bug as the app shell**, found by
screenshotting the four pages rather than by any test. Its actions row is a flex
item, so it forced itself wider than its own parent instead of reflowing, and on
`/app/opportunities` the fix was really that the page had nested a SECOND
identical flex row inside `PageHeader`'s — the inner one overflowed while the
outer stayed in bounds. `PageHeader` now carries `min-w-0 flex-wrap` and the
page passes a fragment.

**Three e2e assertions in this ship were written, mutation-tested, and found
vacuous.** All three were fixed rather than kept: the header-actions geometry
check measured the wrapper (which stays in bounds) rather than its widest
descendant; the fixture strings were hyphenated, and a hyphen is a line-break
opportunity, so removing `truncate` would have wrapped harmlessly and left the
suite green (underscores now); and the toaster assertion passed with the cap
removed, which is what revealed the cap was inert. **Mutation-test a layout
assertion before believing it** — three of the four written here did not hold
on the first attempt.

### [P3] Three of the four pages still render a generic loading skeleton

`applications` gained a card-shaped `CardListSkeleton` alongside its table one,
per the T28 rule that a skeleton must reserve the real row's height.
`opportunities`, `shifts` and `settings/team` still render one unconditional
stack of `Skeleton h-12 w-full` bars for both trees, so on a phone the loading
state is a list of 48px bars that resolves into a two-or-three-line card with
badges — the reflow the rule exists to prevent. Pre-existing (the generic stack
was there before T36) but now inconsistent with the sibling page. **Effort:** S
each. Raised by the conventions review of this ship.

### [P3] Two card lists announce a vanishing row only through a toast

`settings/team`'s Remove and `shifts`' Delete both drop a row from the list on
success with nothing but `toast.success`. The roster states the rule directly
(`volunteers/page.tsx`): *"A row vanishing is the only durable confirmation that
a removal happened — the toast is transient and a screen-reader user may be
reading elsewhere when it fires."* Both pages want the same discrete
`<output aria-live="polite" className="sr-only">`. Not done here because the
diff was already a layout change across five files, and this is a behaviour
change on two of them. **Effort:** S each. Raised by the conventions review.

### [P3] The card title is the smallest tap target on two cards

On `opportunities` and `shifts` the card's navigation control is a bare
`<Link>`/`<button>` around the title text, ~24px tall, while the action buttons
beside it are `h-11`. The roster avoids this by making the whole row the target,
which these two cannot do (they carry their own action buttons, and a nested
button inside a tappable row is invalid markup). `py-2` on the title, or an
invisible padded hit area, closes it. **Effort:** S. Raised by the conventions
review.

### [P3] ~~Untested branches the T36 unit tests cannot reach~~ → mostly CLOSED; two remain

The ship's coverage audit found these; a second generation pass closed most of
them, each mutation-verified. Closed: the per-mutation pending isolation on
shifts and team (the tRPC mock returned ONE shared object for every
`useMutation`, so `isShiftPending`'s three clauses and `isMemberPending`'s two
were copies of one expression — two of three and one of two were deletable with
everything green; the mock is keyed by procedure now); the Delete `confirm()`
gate; the desktop side of the CSS switch on all four pages; `PageHeader` and
`CardList`, which had no tests at all; both switchers' width caps; applications'
loading skeleton; team's desktop tree and its 44px card targets; opportunities'
per-row action naming; and the shifts date-format extraction.

**The switcher dropdown states are now seeded** — `staff-tables-mobile.spec.ts`
creates a second org and a company membership, so the widest header state
finally renders in a test, at 375/800/1280.

Still open:
- ~~**`settings/team`: `ADMIN` is only offered by an OWNER**~~ ✅ **CLOSED
  (2026-08-01).** The session email is now per-test state, so the caller can be
  put at OWNER or ADMIN and both branches render; the `SelectContent` items are
  reached with a `fireEvent` open, as this entry predicted they would have to be.
  **And the "confirm the server refuses it too" clause was the important half** —
  it did not. That was the P2 above, fixed in the same change. A test here alone
  would have pinned the affordance and left the mutation open, which is precisely
  how the gap survived. The role change is still never *fired* from either tree.
- **`memberLabel`'s `name ?? email ?? 'this member'` fallback** — feeds an
  accessible name, never exercised with a null name.

**Effort:** S for the remainder.

### [P3] `app-shell`'s `shrink-0` on the right cluster is inert, not load-bearing

Flagged by the audit as "revertible green", and it is — but measurement showed
the reason is not a missing test. With and without it the account control is
**240px at 800px**, identical, because `min-w-0` plus truncation on the left
cluster absorbs all the pressure before the right one feels any. An earlier
127-vs-240 reading that appeared to prove otherwise was the pre-hydration
fallback branch (which renders no email span), caught by waiting for the
hydrated button.

Kept anyway: it costs nothing, it declares the intent the layout depends on
(left gives, right does not), and it becomes real the moment anything
unshrinkable lands in that cluster. Deliberately NOT pinned by a test — one
would assert nothing today, and this ship already removed two assertions that
turned out to prove nothing. The comment in `app-shell.tsx` says so explicitly
so nobody "fixes" the missing coverage by writing a vacuous test.

Same shape as the sonner cap, one step less far along: that one was a no-op
change and was deleted; this one is a no-op guard and was kept. **Effort:** —
(no action; revisit if the right cluster gains content).

### [P3] ~~`/locations/*` returns a 500 under parallel e2e load~~ ✅ ROOT-CAUSED AND FIXED (2026-07-31)

**It was Next's dev server reading a `.next` manifest another concurrent
route-compile was still writing.** Caught by capturing the `[WebServer]` output
during a cold run with 8 workers — the output every previous run had filtered
away:

```
⨯ SyntaxError: Unexpected end of JSON input
    at JSON.parse (<anonymous>) { page: '/locations/modesto' }
```

It landed on `/locations/*` far more often than anywhere else because those six
slugs share ONE `generateStaticParams` with `dynamicParams = false`, so every
request to them consults the prerender manifest — six routes racing one file.
Which slug lost was luck, which is why it looked like a different test each run
(`fresno`, `san-joaquin-county`, `modesto`, `stanislaus-county`, `sacramento`
across five runs) and why re-running one spec alone always passed.

**Production is unaffected, and that was VERIFIED rather than assumed** — the
open question this entry was originally filed to keep. All six slugs prerender
at build time (`● /locations/[slug]`), and 18 concurrent requests against
`pnpm build && pnpm start` returned 200 with no manifest error in the log.
Manifests are written once at build time and are immutable at serve time; only
`next dev` writes them while serving.

**Fix:** `e2e/global-setup.ts`, wired as Playwright's `globalSetup`. It compiles
every public route SEQUENTIALLY before the workers start, so there is no
concurrent manifest write to race. `webServer.url` only ever proved `/` answers;
this makes "ready" mean what that setting implies. Deliberately **not** a retry:
a retry that swallows a 500 on a public smoke test swallows the next real one
too. Verified under the exact conditions that reproduced it — cold `.next`,
8 workers, `--repeat-each=2` (88 tests) — 0 manifest errors where there were
previously 3 failures, plus two full cold `pnpm e2e` runs at 0.

Side effect worth knowing: this also cleared most `/for/nonprofits` marketing-image
flakes, which were the same stampede. It did **not** clear all of them — see the
open P2 above, which reproduces with a warm cache and is a different bug.

### [P2] ~~`updateOrgMemberRole` never checks the CALLER's role — an ADMIN can grant ADMIN~~ ✅ FIXED (2026-08-01)

Fixed strict, as written below, plus two things the entry did not anticipate.

**The acting role is resolved from the DATABASE, not passed in.** The entry
said "resolve the acting member's role inside the existing transaction", and
that is what `resolveActingRole()` does — but the reason turned out to be
sharper than tidiness. `inviteMember` already had this rule and took the actor's
role as an **optional parameter**, which fails **open**: omit it and the check
does not apply. It also read `ctx.role`, which `createTRPCContext` sets to
`null` on the impersonation branch before re-resolving it. Both are the same
lesson as the `email` parameters dropped in v0.34.0.0 — while the parameter
exists, every callsite is one wrong argument from restoring the hole. So
`inviteMember` lost the parameter too and now resolves the actor itself.

**The rule is one function with two callsites** (`assertMayGrantRole`), because
it is enforced at two doors — an invitation and a role change — and it had
exactly one of them for months while the client's `{isOwner && …}` made both
look covered.

The check sits **before** the target lookup, so the rule is "an ADMIN may not
submit `newRole: ADMIN`" independent of the target's current role. That costs
one confusing refusal (an ADMIN re-selecting ADMIN on someone who already is
one) and buys a rule that does not depend on another row's state.

Verified: 8 service tests, **mutation-verified in both directions** — deleting
the guard reddens exactly the two SECURITY tests, and widening it to refuse
every role for a non-OWNER reddens the STAFF/READONLY contrast pair, so neither
is vacuous. Plus 2 client tests covering the `SelectContent` branch listed as
uncovered below; removing `{isOwner && …}` reddens one. The client docstring now
says out loud that all three of its gates are affordances with server
counterparts.

#### Original write-up — SUPERSEDED, kept for the diagnosis

Found by the security specialist during T36's ship review. `MemberRowActions`
renders `{isOwner && <SelectItem value="ADMIN">}`, and its docstring now states
that rule as the reason the component was extracted — but
`updateOrgMemberRole()` (`memberService.ts`) rejects only `newRole === 'OWNER'`,
the OWNER target row and self. It never looks at the acting member's role.
`members.updateRole` is an `adminProcedure`, which admits anyone at
`roleRank >= ADMIN`, so an ADMIN can promote any STAFF/READONLY member to ADMIN
by calling the mutation directly.

**Pre-existing and byte-identical before this diff** — the gate was inline JSX
and is now inside a shared component. Not self-escalation, and not a tenancy
break. But it is admin-tier privilege spread with no server-side control, and
T36 is what promoted the claim from an inline conditional to a documented
invariant, which is exactly when it should be made true.

Fix: resolve the acting member's role inside `updateOrgMemberRole`'s existing
transaction and refuse `newRole === 'ADMIN'` unless the caller is OWNER. Then
the client `isOwner &&` becomes an affordance rather than the control. The other
two client gates (`OWNER` row, self) DO have server counterparts in both
`removeOrgMember` and `updateOrgMemberRole`. **Effort:** S.

### [P2] `removeOrgMember` is the one member mutation that never re-checks the caller

Found by the Codex adversarial pass during the v0.38.6.0 ship. `updateOrgMemberRole`
and `inviteMember` now both resolve the acting member's row from the database and
re-assert the ADMIN floor (`resolveActingRole`). `removeOrgMember` does not — it
loads the TARGET row, checks it is not the OWNER and not the caller, and deletes.
Its only authorization is `adminProcedure`'s `ctx.role`, resolved once when the
request context was built.

Concretely: an admin demoted or removed in a concurrent request can still win the
race and delete another member on the already-authorized request. The window is
small and this is **pre-existing** — it is not a regression from that ship. What
that ship DID create is the asymmetry: two of the three member mutations now read
the row as it stands and one does not, which reads as an oversight rather than a
decision.

Fix: call `resolveActingRole(tx, orgId, actingUserId)` at the top of
`removeOrgMember`'s existing transaction, exactly as `updateOrgMemberRole` does.
It is one line and the helper already exists. **Effort:** S.

### [P3] Concurrent role changes lose updates and can write a false audit history

Also from the same Codex pass, also pre-existing. `updateOrgMemberRole` reads
`target.role`, then updates by `id` with no lock and no optimistic predicate, then
writes `previousRole` into the audit row from the value it read. Two concurrent
changes to the same member can therefore both record the same `previousRole`, one
operator's change can be silently overwritten, and the audit log ends up
describing a transition sequence that never happened.

Partly mitigated in the UI by `usePendingIds` (v0.38.4.0), which stops one
coordinator double-submitting a row — but not two coordinators, and not two tabs
in different sessions. Fix with an optimistic predicate: `updateMany` with
`where: { id, role: previousRole }` and treat `count === 0` as a lost race, the
same shape `softDeleteOwnOrgVolunteerByOrg` already uses. **Effort:** M.

### [P3] ~~`memberService`'s other refusals are plain `Error`s, so the user never reads them~~ ✅ FIXED (2026-08-01, with T37)

Fixed considerably wider than described: the same defect existed in
`shiftService`, `shiftTemplateService`, `shiftSignupService` and
`employerReportService`, eighteen throws in total, and T37's `errorFormatter`
turned it from "withheld by the client" into "redacted at the server for every
caller." The estimate below (**S**, four sites in one file) was written from the
one file the P2 happened to be open in. See T37's entry for the rule and the
code-level regression test. Original write-up:

Noticed while fixing the P2 above. `updateOrgMemberRole` and `removeOrgMember`
raise `new Error('Member not found.')`, `"Cannot change the owner's role."`,
`'Cannot change your own role.'` and `'Cannot remove yourself.'` — plain
`Error`s, which tRPC maps to `INTERNAL_SERVER_ERROR`, which `safeErrorMessage()`
then correctly withholds. So `settings/team` shows "Something went wrong. Please
try again." for four refusals that are entirely safe to state, and every one of
them is a case where the user needs to know *which* rule they hit to do anything
different. The two new `assertMayGrantRole` refusals are `TRPCError` +
`FORBIDDEN`, which IS allowlisted, so they read correctly — which makes the
inconsistency visible on the same surface for the first time.

Same shape as the `acceptInvitation` `PRECONDITION_FAILED` note already in that
file: a fact about the caller's own request reported as a server fault. Fix by
converting the four to `TRPCError` with `FORBIDDEN`/`NOT_FOUND`, and check the
component tests do not assert the generic string. **Effort:** S.

### [P3] `settings/team` decides "is this me?" from the session email, not the effective user

`const currentUserEmail = session?.user?.email ?? ''` drives both `isCurrentUser`
and `isOwner`. `authOptions.callbacks.session` has no impersonation branch, so
the client session is always the REAL admin's identity — the same identity-mixing
CLAUDE.md forbids server-side (`ctx.session.user.email` is not the effective
user's address). While impersonating, the target's own row renders live controls
(the server then refuses with "Cannot remove yourself."), the real admin's row
renders "You", and `isOwner` reflects the wrong person's role.

Pre-existing and unchanged here; the server-side self-checks are the real
control, so this is a wrong-affordance bug rather than a bypass. Fix by having
`members.list` return an `isSelf` flag computed from `effectiveUserId(ctx)` and
dropping the client-side email comparison. **Effort:** S.

**Update (2026-08-01):** the third derived gate — `isOwner` deciding whether the
`ADMIN` option renders — now has a server counterpart too
(`assertMayGrantRole()`), so all three of this component's rules are affordances
over enforced rules and `isOwner` naming the wrong person under impersonation
is purely cosmetic. That does not close this entry: showing a real admin the
wrong controls for the person they are impersonating is still wrong, and the
`isSelf`-flag fix is unchanged. It does mean the blast radius is now bounded by
construction rather than by the two checks that happened to exist.

### [P3] ~~The per-row pending idiom is now hand-written in five files~~ → EXTRACTED, and it was hiding a regression

Filed as a DRY nit; the adversarial review then found the idiom itself was
wrong. `mutation.isPending ? mutation.variables?.id : undefined` reads only the
most recent call, because query-core's `MutationObserver.mutate()` runs
`this.#currentMutation?.removeObserver(this)` before starting the next one. So
acting on row B re-enabled row A while A's request was still open.

On `/app/opportunities` and `/app/settings/team` that was **worse than what it
replaced** — both had a bare global `isPending`, which greyed out the whole list
but did make concurrent submits impossible. The concrete failure on team is two
`members.updateRole` writes for one member in flight on separate requests with
no ordering guarantee: the member lands on the role from the FIRST click while
the coordinator watched the second succeed. On shifts it was still an
improvement (that page had no disabled state at all), but incomplete.

Now `usePendingIds()` (`src/lib/hooks/use-pending-ids.ts`) — a `Set` fed from
`onMutate`/`onSettled`, keyed by row rather than by mutation. **Four** of the
five staff lists use it — the roster (which carried the original `variables`
shape), opportunities, shifts and team. `/app/applications` does **not**, and
that is correct rather than an omission: its rows only navigate, so it has no
row mutation to hold. Do not "make it consistent" by adding it there.
Mutation-verified: collapsing the set to a single id reddens the concurrency
test. CLAUDE.md's rule is corrected, since it prescribed the broken shape.

**The lesson worth keeping: a DRY finding and a correctness finding can be the
same finding.** Five hand-written copies of an expression is also five chances
for nobody to check whether the expression is right.

### [P3] Three of the four pages still have no pagination

`applications` hardcodes `page: 1, pageSize: 50`; `opportunities` fetches a
cursor page and never asks for the next; `shifts` takes 50 with no `hasMore`
surfaced. Pre-existing and deliberately out of T36's scope — but the card list
makes it more visible, since fifty rows is a much longer scroll on a phone than
fifty table rows are on a desktop. The roster's `LoadMore` is the pattern.
**Effort:** M.

### [P3] The desktop row-click on applications and opportunities is still mouse-only

Both put `onClick={() => router.push(...)}` on a `<tr>` with no focusable child,
so there is no keyboard path to the detail page on desktop. The new card trees
use a real `<Link>` and are reachable — so the phone is now MORE accessible than
the desktop on these two pages. The roster solved this with a real `<button>` in
the name cell (`volunteers/page.tsx`); the same fix applies. Deliberately not
folded into a layout diff. **Effort:** S.

---

## Opened by the T27 detail-dialog ship (2026-07-31)

### [P2] The roster CSV export ships VOLUNTEER-voiced copy to staff

`roster-export.ts:75` writes `ORG_VOLUNTEER_SOURCE_COPY[row.source]` into the
staff CSV. That Record's own docstring says it is "told to the volunteer
themselves", and its strings are second-person to the volunteer — so a
coordinator opening their own export reads `Added when they approved your
application`, which inverts who approved whom, and `Added by their staff`,
which reads as some other organisation.

**Pre-existing, not introduced by T27** — but T27 made the same mistake on the
detail dialog, which is what surfaced it. The fix is now one word: swap to
`ORG_VOLUNTEER_SOURCE_COPY_STAFF` (added in this ship). Deliberately NOT done
here because it changes the bytes of an existing export that has its own tests
and a round-trip contract with the concierge importer, and that belongs in a
diff about the export rather than one about a dialog.

The general rule, now recorded in the Record's docstring: **share the ENUM,
never pronoun-bearing prose.** Exhaustiveness is what a `Record` over the enum
buys you; voice is per-audience and does not transfer. **Effort:** S.

### [P3] The detail dialog renders email and phone as inert text

Raised by the design specialist. The dialog's primary mobile shell is a bottom
sheet on a phone, and the most likely next action after a coordinator opens a
volunteer's record there is to call or message them — which currently means
selecting and copying out of a `<dd>`. `mailto:`/`tel:` anchors with the page's
link treatment and a 44px target would close it.

Deferred rather than done: the specialist flagged it "verify visually", it adds
two link affordances to a panel deliberately built as flat facts, and the
approved mockup does not show them. Worth a look the next time this surface is
touched. **Effort:** S.

---

## Opened by the T25 repeat-entry ship (2026-07-31)

### Caught while building — recorded so it is not reintroduced

**The empty state could not keep its own `AddVolunteerDialog`.** It sits inside
`page.tsx`'s `volunteers.length === 0` branch, so the first successful add flips
that branch and unmounts it. Harmless while the form closed on success; once it
stays open, it takes the half-typed second volunteer with it — and the roster's
empty state is precisely the batch-entry case the whole task exists for. `open`
now lives on the page, there is exactly ONE dialog, and the empty state renders
a shared `AddVolunteerButton` that opens it. **The unit tests could not have
caught this**: they render the component directly, never through the page.

**And the first draft of this entry claimed the e2e covered it when it did
not.** `addVolunteerViaUi` added exactly ONE volunteer and closed the form, so
nothing ever typed a second name into a form that had just survived the
empty→populated flip — the only sequence that can fail. Caught in review, by
reading the claim against the spec rather than trusting it. The helper is now
`addVolunteersViaUi(page, entries[])` and the identity test passes **two**
entries, from the one call site guaranteed to start from a truly empty roster.
Naming the submit per iteration (`Add volunteer` then `Add another`) means a
form that closed on success fails on the second pass with nothing to click.
**A one-add e2e is not coverage of a stay-open form.**

**`Done` had to be disabled while a mutation is in flight.** Closing unmounts
the form and with it the mutation's `onSuccess`, so a volunteer the server DID
create gets no toast, no count, and — the part that outlives the moment — no
`onAdded()`, leaving the roster behind the form permanently missing them, with
nothing to suggest it is wrong. Reachable before this ship via Cancel, but
`Add another` → `Done` in one motion is how a batch naturally ends, so T25 made
it the likely path rather than a race.

**The `aria-live` count region is mounted EMPTY with the dialog**, with only its
content conditional. A live region inserted in the same commit as its first text
is unreliably announced — screen readers announce changes to regions they were
already observing — so the first add, the one that tells the coordinator the
form works at all, is the one most likely to be silent. It must not be hidden
with `hidden`/`empty:hidden` while empty either: `display: none` takes it back
out of the accessibility tree and restores the same bug.

### [P3] ~~Repeat entry issues one full `volunteers.invalidate()` per name~~ — CORRECTED, and it is cheaper than this said

**The first version of this entry was wrong twice, and review caught both.** It
claimed T25 introduced the per-add invalidation and cost "forty queries" for
twenty names. Neither holds:

1. **The rate is pre-existing.** `git show main:…/AddVolunteerDialog.tsx` shows
   the old `onSuccess` ended `onAdded(); onClose();` — `onAdded()` already fired
   on every successful add. This diff only deletes `onClose()`. Do not read the
   per-add refetch as a T25 regression.
2. **The wire cost is one request per add, not two.** `httpBatchLink` coalesces
   the two invalidated active queries (`list` + `count`) into a single HTTP
   request, and the server side is three indexed statements.
3. **Refetches cancel rather than stack.** query-core's `refetchQueries` sets
   `cancelRefetch: true` and `invalidateQueries` defaults to `type: 'active'`,
   so a second add aborts the in-flight refetch and inactive cursor pages are
   marked stale without being fetched. There is no queue growth while typing.

The original conclusion survives and is worth keeping: **do not add a debounce.**
It could swallow the final refresh, which is the one the coordinator actually
reads, and the last invalidate always wins anyway. Nothing to fix here; the
entry is retained because a future reader would otherwise re-derive the wrong
version of it. **Effort:** none.

### [P3] Batch entry makes the accepted account-enumeration oracle cheaper

Security §7 knowingly accepted that `notified` tells a coordinator whether an
address belongs to an existing ACTIVE account. That bit has not changed, and the
two SILENT branches remain indistinguishable — the invariant is intact. What
changed is the *cost per probe*: the form now clears and returns focus to Name,
so an address list can be walked at typing speed instead of one trigger →
submit → close cycle each. `volunteers.add` has no rate limit.

Self-limiting for now: every probe writes a real roster row and a
`VOLUNTEER_ADDED` audit row carrying the email and outcome, and mails the ACTIVE
ones — noisy, attributable, and requires authenticated staff at a real org. **If
the roster leaves pilot, add a per-org rate limit on `volunteers.add`**;
`TOO_MANY_REQUESTS` is already in `safeErrorMessage`'s allowlist, so the refusal
would render inline with no new plumbing. **Effort:** S.

### [P3] The two silent branches still differ in server-side latency

`CREATED_SHADOW` runs two INSERTs (the `User` plus its `VolunteerProfile`);
`LINKED_UNCLAIMED` runs at most one conditional `user.update`. Pre-existing, and
practically unexploitable — a second add of the same address throws `CONFLICT`,
so each email yields exactly one timing sample and no averaging is possible.

Recorded because a future change that adds per-branch work on the response path
would widen it. In particular, `notifyRosterAdd`'s fire-and-forget
`void … .catch(console.error)` is load-bearing: awaiting it would put
`LINKED_ACTIVE`'s network call on the response path. **Effort:** none, unless
someone touches that path.

### [P3] Two buttons named "Add volunteer" on an empty roster

Pre-existing, not introduced by T25 — the empty state has always rendered an
action with the same label as the header's. A screen-reader rotor therefore
lists two identical "Add volunteer" buttons, and it is why the empty-state
action needs `data-testid="empty-roster-add-volunteer"` for tests to reach the
right one at all. Distinct copy on the empty-state action (e.g. "Add your first
volunteer") would fix the ambiguity, remove the need for the testid, and soften
the focus-return P3 above. Not done here because the approved spec names the
action `Add volunteer`, and changing user-facing copy is a design call, not a
review cleanup. **Effort:** S, with a copy decision attached.

### Resolved during this ship's own review — recorded so they are not reintroduced

**Crossing `lg` mid-batch used to destroy the batch.** `Dialog` and `Drawer` are
different roots, so a resize past 1024px unmounted one subtree and mounted the
other, taking `AddVolunteerForm` and with it the running count and every
half-typed field — and because `open` now lives on the page, the replacement
shell reopened IMMEDIATELY, blank, with the footer reverted to `Cancel`. An iPad
rotating portrait→landscape (834 → 1194) crosses it, as does snapping a desktop
window. Before T25 this cost one in-flight entry over about a second; a
stay-open form made it a whole batch. **The shell is now frozen while `open` is
true** and re-read while closed.

**Updated by T27 (2026-07-31) — the "held by a comment, not a test" caveat this
entry shipped with is now only half true.** The freeze moved into
`useFrozenDesktopShell(open, query?)` (`src/lib/hooks/use-frozen-desktop-shell.ts`)
at the fourth Dialog/Drawer switch, and `shellIsDesktop` is now internal to that
hook rather than a local in `AddVolunteerDialog`. Extracting it split the two
properties: the *visual* consequence (which shell actually paints) is still
unreachable in jsdom and still not covered by the fixed-viewport e2e, but the
*resolution rule* is a pure function of `open` and the live query and has four
tests, including the iPad-rotation case. Do not "simplify" the hook back to a
bare `useMediaQuery` read, and do not call `useMediaQuery` directly in a new
modal.

**`DrawerContent` has no scroll container.** It is `max-h-[85vh] flex flex-col`
and `drawer.tsx` declares no `overflow` utility anywhere, so past the cap the
default `flex-shrink: 1` compressed children below their content size and the
form spilled outside the painted sheet with no way to reach the buttons. T25
added a row to the tallest shell and a 375×667 phone has only ~567px of budget.
The body wrapper now carries `overflow-y-auto min-h-0` — **`min-h-0` is not
optional**, a flex child will not shrink below its content without it and
`overflow-y-auto` alone does nothing.

### [P3] Closing from the empty state returns focus to the header trigger

Radix stores the trigger node in `context.triggerRef`, and only a real
`DialogTrigger`/`DrawerTrigger` sets it (vaul's `Drawer.Trigger` IS
`DialogPrimitive.Trigger`). The empty state's `AddVolunteerButton` is a plain
button calling `setAddOpen(true)`, so it never registers — and `onCloseAutoFocus`
sends focus to the header trigger no matter which button was pressed.

Only one path is actually wrong: open from the empty state, close **without**
adding anyone. Add someone and the empty state has unmounted, at which point the
header trigger is the only sensible target and Radix already picks it. The wrong
case lands the user on a different button with the *same* accessible name
("Add volunteer"), so nobody is stranded — which is why this is a P3 and not a
fix. **It is a regression against pre-T25 behaviour**, where the empty state
had its own dialog and its own real trigger.

The fix is a `returnFocusRef` on the page, set from the empty-state button's
`onClick`, consumed by an `onCloseAutoFocus` override that calls `preventDefault`
and focuses it **only when the node is still connected** — a ref to an unmounted
button focuses nothing, which is worse than the current behaviour. That
connected-check is the whole subtlety, and it is why this wants a test rather
than a quick patch. **Effort:** S.

### [P3] Escape and the overlay still close over an in-flight add

`Done`/`Cancel` are now `disabled` while `addVolunteer.isPending`, but Escape
and an overlay click still reach Radix's own close and still orphan the
mutation's `onSuccess` — no toast, no count, and no `onAdded()`, so the roster
silently omits a volunteer the server created.

Deliberately not closed by intercepting `onOpenChange`/`onEscapeKeyDown`:
trapping someone in a modal because a request is slow is a worse failure than
the one being prevented. The durable fix is to hoist the mutation to `page.tsx`
so its callbacks outlive the form — which also fixes it for the Cancel path
without disabling anything, and is worth doing if a second surface ever needs to
add a volunteer (see the entry below). **Effort:** M.

### [P3] Nothing stops a second `AddVolunteerDialog` being mounted

The single-instance rule above is a comment, not a constraint. A future surface
(the detail dialog in T27, say, or a shift-side "add someone new") that mounts
its own would get its own running count, and the two would disagree about how
many were added this session. A shared context or a page-level provider would
make it structural; at one consumer that is an abstraction with no second user.
**Revisit when a second surface wants an add form.** **Effort:** S.

---

## Opened by the roster mobile + a11y ship (2026-07-30, T28/T29)

Shipped T28 (card list below `lg`, Drawer add form), the unblocked half of T29,
T26's UI half (undo toast) and all four pages of T35.

### Caught by review in this same ship — fixed, recorded so they are not reintroduced

**T35 was nearly checked off having done a quarter of it.** The first pass fixed
`ShiftsClient`'s missing `isError` branch and marked T35 done, on the reasoning
that `applications`, `opportunities` and `settings/team` "already had one". They
did — a hand-rolled `Card` rendering `{query.error.message}` **raw**, with no
`safeErrorMessage()`, which is the internal-error leak that helper exists to
prevent. *Having* an error state and having a *safe* error state are different
properties, and the grep that was run (`isError`) answers the wrong one. All four
now render `QueryErrorCard` with `safeErrorMessage`. The general lesson matches
CLAUDE.md's disclosure rule: when checking off a migration, grep for the thing
being migrated TO, never for the symptom it happens to fix.

**`Card` silently fights `divide-y`.** `Card`'s base is
`flex flex-col gap-6 … py-6`, so the `<Card className="divide-y">` idiom cited by
the design spec (and shipped at `admin/platform/users/page.tsx:57`) draws each
hairline on a row's top edge while the 24px gap holds the rows apart — a line
floating in open space rather than separating anything. The roster card list
passes `gap-0 divide-y py-0`. **`admin/platform/users/page.tsx` still has the
un-neutralised version** and presumably renders with the same floating rules;
worth a look next time that page is touched.

**`hidden` on a `Card` is resolved by tailwind-merge, not by this codebase.**
`hidden` and Card's own `flex` are both display utilities, so one is dropped and
which survives is a detail of the merge. Visibility now sits on wrapper `div`s.
A `lg:block` that "worked" here would have silently disabled Card's flex column.

### [P2] ~~T37 — the `safeErrorMessage` migration stops after four pages~~ ✅ FIXED (2026-08-01)

**Fixed by adding the thing this entry says does not exist.** The write-up below
is preserved because its *method* note is still the rule, but its diagnosis was
half wrong: it framed this as a client-side migration, and the real hole was
that there was no `errorFormatter`, so every one of those messages had already
crossed the network and was sitting in the browser's network tab and React
Query's cache before any component chose what to render. `safeErrorMessage()`
could never have been the control; it can only decide what is *painted*.

What shipped:

- **`src/server/domain/error-disclosure.ts`** — `CLIENT_SAFE_ERROR_CODES`,
  `isClientSafeErrorCode()`, `GENERIC_ERROR_MESSAGE`. One definition, imported by
  both halves, per the disclosure-derivation rule.
- **`errorFormatter` in `server/trpc/init.ts`** — redacts the message for any
  non-allowlisted code and drops `stack`. **Not** exempted in development: `pnpm
  e2e` boots `pnpm dev`, so a dev exemption makes the control inert in the only
  automated environment that drives real HTTP.
- **`onError` in `app/api/trpc/[trpc]/route.ts`** — logs the raw error and
  reports it to Sentry. This is not optional garnish: redaction removes the last
  place an unexpected failure was legible, so landing it alone trades a
  disclosure bug for a blind one.
- The full client sweep (~75 sites), `safeCaughtErrorMessage()` for
  `mutateAsync` try/catch, and `src/app/error.tsx` no longer printing
  `error.message`.

**The expensive discovery, and the reason this took longer than "mechanical but
wide":** redaction is only correct if deliberate refusals carry an allowlisted
code, and **eighteen user-facing refusals were plain `Error`s** — which tRPC maps
to `INTERNAL_SERVER_ERROR`. Shift-time validation, every `memberService` refusal
("Cannot remove the organization owner", "Cannot change your own role"), and
`markAttendance`'s "Cannot mark attendance: signup is CANCELLED" would all have
become "Something went wrong." The hazard was already documented at
`memberService.ts:207` and tracked as the P3 below — and the throws two lines
away from that comment were still plain. All eighteen are now `TRPCError`s;
`checkinService.test.ts` asserts the **code**, because `rejects.toThrow('...')`
passes for a plain `Error` just as happily and could never have caught it.

**Rule for anything new:** a message a user is meant to READ needs an allowlisted
code. `throw new Error('Cannot remove yourself.')` now renders as generic copy,
silently, and no message-based test will tell you.

This also closed four **missing `isError` branches** found while sweeping —
`CredentialWallet` and `NotificationPreferences` on `/app/profile`,
`MarketplaceCard` and `TimezoneCard` on `/app/settings/team`. None leaked
anything; each rendered a *default* on failure, which is worse than blank
because it states something false: "No credentials yet" to a volunteer whose
background check is verified, every notification toggle switched back on, and
"UTC (default)" for an org whose shift times are not in UTC.

<details><summary>Original write-up (diagnosis partly superseded, method still current)</summary>

T35 converted `applications`, `opportunities`, `settings/team` and `shifts`. The
same leak stands everywhere else: counted after this ship, **13 files under
`src/app` render a tRPC `{error.message}` straight into JSX, and 31 touch one at
all** once mutation `onError` toasts are included. The loudest are
`settings/background-checks/page.tsx` (12 sites), `profile/page.tsx:300,862,870`,
`my-applications/page.tsx:229`, every `admin/platform/*` page,
`apply/status/status-client.tsx` and the root `app/error.tsx`. A tRPC error can
carry database text, and there is no `errorFormatter` on the server side
stripping it — `safeErrorMessage()`'s allowlist is the only thing standing
between an internal message and a coordinator's screen.

**Run the audit by grepping for `QueryErrorCard` and `safeErrorMessage` and
listing the files that lack them** — not by grepping `isError`. That is the
exact grep that let T35 nearly ship having done a quarter of the work, because
three of its four pages already had an `isError` branch that printed the raw
message. Tracked as **T37** in `docs/designs/staff-created-volunteers.md`.
**Effort:** ~1d human / ~45min CC, mechanical but wide.

</details>

### [P2] Error-copy has four voices and three apostrophes across 21 surfaces

Opened by T37's design review, which counted the `QueryErrorCard` titles now that
they are all one component: **"Couldn't load X" (10), "We couldn't load X" (6),
"Could not load X" (3), "Unable to load X" (1)** — four formulas for one failure
class. T37 added five of those titles and unified none, which is how a shared
component makes an inconsistency visible without fixing it.

Underneath it, three encodings of one character: typographic `U+2019` in 5
titles, ASCII `'` in 10, and the `&apos;` entity in `VolunteerDetailDialog.tsx`.
`my-applications/page.tsx` uses both, eight lines apart. This is an editorial
typography system (DESIGN.md), so the ASCII form is the wrong glyph, not a
stylistic tie.

And a third layer: the legacy `'Failed to X'` fallback survives in ~20 toasts
(`background-checks` alone keeps nine) beside newly-written
`'Could not VERB that NOUN.'` copy, so one page can answer three ways depending
which control the user touches.

The work is one sweep plus a guard: pick `Couldn't load NOUN` for staff and
`We couldn't load NOUN` for volunteers, normalise on `U+2019`, retire
`Failed to X`, and add a test asserting no user-facing string contains an ASCII
apostrophe — otherwise it drifts back one PR at a time. **Effort:** M.

### [P3] Four review findings deferred out of T37

Each verified, none blocking, all recorded so the next person does not re-derive
them.

1. **`backgroundCheckService.ts:318` forwards a THIRD-PARTY message.**
   `throw new TRPCError({ code: 'BAD_REQUEST', message: apiErr.message })` passes
   Checkr's or Sterling's own string straight through — and because it is an
   explicit `message`, T37's authored-vs-laundered rule counts it as ours and
   ships it. Nothing constrains what a vendor writes there, on a request whose
   payload carried SSN and date of birth. Pre-existing, but T37 made it the
   documented contract rather than an accident. Map the provider's 422 to
   first-party copy and log the original.
2. **`employerReportService`'s NOT_FOUND is now invisible twice.** Recoding it
   from a 500 means `reportTrpcError` returns early (no Sentry) AND
   `e2e/esg-dashboard.spec.ts:257` — which collects `status() >= 500` — stops
   seeing it. `generateESGReport` is only reachable through
   `companyScopedProcedure`, which already resolved a `CompanyMember` for that
   company, so a missing `Company` there is a referential-integrity fault, not a
   user error. Either put it back to INTERNAL_SERVER_ERROR (now safe, since the
   formatter redacts it) or capture explicitly at the throw site.
3. **`/app/browse` never reads `searchParams.error`.** `invite/company/[token]`
   encodes a refusal into a redirect URL that nothing renders — so the message
   lands in history and in the next referrer and is then discarded, and a user
   whose invite failed is dropped on an unrelated page with no explanation. T37
   made the URL safe; it did not make it useful. Either render it or redirect to
   a route that explains the failure server-side.
4. **`safeCaughtErrorMessage`'s call sites are untested.** The helper is covered;
   `scan/Scanner.tsx` (×2), `applications/import/page.tsx` and
   `onboarding-wizard.tsx` are not. Scanner is the one that matters — it is the
   paired half of `markAttendance`'s newly-coded refusals, and it is what a
   coordinator standing at a door reads. Skipped because Scanner needs
   `html5-qrcode`, a camera and four procedures mocked to assert one line.

Also noted and NOT acted on: `QueryErrorCard`'s retry is `size="sm"` (h-8)
against DESIGN.md's stated 44px minimum, now propagated to ~21 surfaces; and the
client `QueryClient` takes React Query's default `retry: 3`, which triples the
request volume behind every failure. Both pre-existing, both worth a decision.
**Effort:** S each.

### [P3] Malformed superjson input is still reported as a fault

Found by the Codex structured review at the end of T37 (its only finding; the P1
gate passed). `reportTrpcError` reports any allowlisted code whose `cause` is an
`Error`, because that is how a raw throw inside a Zod `.transform()` wears a safe
code — the blind-spot case the clause exists to close. A malformed superjson
payload arrives in exactly the same shape, so an unauthenticated caller can still
generate Sentry events against a `publicProcedure`.

**Accepted, not overlooked.** The two are indistinguishable without matching on
tRPC's internal message text, and narrowing the other way reopens the case where
a real fault is invisible at BOTH ends. `withinReportBudget` bounds it at 5
events per procedure+code per minute, so the volume is capped either way; the
`ZodError` skip already removes the common case.

If it ever matters: key on the deserialization error's shape at the
`resolveResponse` boundary rather than on the message, or move the throttle
window down for `publicProcedure` paths specifically. **Effort:** S.

### [P3] Route Handlers bypass `errorFormatter`, and the guard test excludes them

Opened by T37's own completion audit, which caught the guard test
(`src/server/domain/error-disclosure.guard.test.ts`) excluding `src/app/api/**`
on the grounds that Route Handlers are "a different surface with different rules
(tracked separately)" — while nothing tracked them. This is that entry, written
so the comment stops pointing at nothing.

The exclusion itself is correct: `errorFormatter` is configured on the tRPC
instance, so a Route Handler returning `NextResponse.json({ error })` never
passes through it. Folding them into the same test would make one test about two
different controls.

**Nothing is leaking today** — audited by hand during the same pass:
`api/esg-report/pdf/route.ts:62` and `csv/route.ts:62` narrow on
`instanceof CompanyAccessDeniedError` (a deliberate refusal) and rethrow
everything else; `api/case-study/consent/route.ts:104` is `console.error`-only;
`api/platform-admin/impersonation/start/route.ts:60-84` applies its own
`FORBIDDEN`/`NOT_FOUND`/`BAD_REQUEST` allowlist and falls through to a generic
500. The last of those is a **third hand-rolled copy of the allowlist** and is
deliberately NARROWER than the shared one, which is defensible per-endpoint —
converging it onto `isClientSafeErrorCode` would WIDEN disclosure on an
impersonation endpoint, so it was left alone rather than "made consistent".

The work: extend the guard to `src/app/api/**` with its own rule (a Route
Handler may return an error message only after an explicit code/type check), or
give Route Handlers a shared helper the way tRPC has one. **Effort:** S.

### [P2] ~~The app shell's top bar overflows ~22px at 375px, on EVERY authenticated page~~ ✅ FIXED (2026-07-31, with T36)

`min-w-0` on the left cluster (the fix; a flex item's default `min-width: auto`
is its content's intrinsic width, so nothing else could take effect while it was
missing), `shrink-0` on the right cluster and on the toggle and mark, the
wordmark `hidden … sm:inline`, narrower base caps on both switchers, and the
account email capped at `max-w-40 truncate` — without that last one the right
cluster consumed ~200px before the org name got any, and the switchers ended up
bare ellipses in the tablet band. `CompanySwitcher`'s zero-membership
`Add company sponsor` link is hidden below `sm`: it was the only one of that
component's four states with no width constraint at all, and it is the state
most users are in.

**The "second, smaller offender" — the sonner toaster — turned out not to be
one, and the original note below is wrong about it.** A
`--width: min(356px, calc(100vw - 2rem))` override was written, then removed
after measuring: the toast `<li>` renders at 288px inside a 320px viewport with
the override **and 288px without it**. Sonner already clamps a toast to the
viewport. The `391` figure is real but describes the `<ol>` — a
`position: fixed`, zero-height container that paints nothing and, being fixed,
does not extend `documentElement.scrollWidth` either. Caught by mutation-testing
the fix: the assertion written to guard it passed with the cap removed, which is
what prompted measuring instead of assuming. The reasoning is recorded in
`sonner.tsx` so the number does not send someone back down the same path.

**All four scoped e2e assertions are now `documentElement`-level**, via the new
shared `expectNoHorizontalOverflow` / `expectNoInternalScroll` in
`e2e/utils/layout.ts`, and the comments pointing here are deleted.
Mutation-verified: removing `min-w-0` alone turns the 800px test red at 895px,
and the failure names the offending node. The 800px assertion is the load-bearing
one — see the original note below on why a phone-only check would have called
this a rounding error.

**A document-level overflow assertion is necessary but NOT sufficient**, and
T36 found that out on `/app/opportunities`: its header actions ran 32px past the
page padding and stopped at exactly 375, so `documentElement.scrollWidth` was
still 375 and every assertion passed while the button sat flush against the
screen edge. Content can break its container and still land inside the viewport.
Where a container's bounds are the requirement, assert against the container —
see the header-actions check in `staff-tables-mobile.spec.ts`. Both limitations
are now written into `e2e/utils/layout.ts`'s docstring.

Original write-up follows.

### Archived — the original write-up above is SUPERSEDED, not open

Kept for the diagnosis, not the instructions. **Do not action anything below**;
in particular the sonner paragraph at the end is wrong, and the fix it prescribes
was written, measured and deleted. Deliberately carries no `[Pn]` tag so a
priority grep does not return it twice.

**Found by running T28's own e2e**, which asserted `documentElement.scrollWidth
<= 375` and failed at 591. None of the overflow was the roster: the offending
nodes were the app-shell `<header>` and the sonner toaster. Measured again on a
clean load with no interaction — `scrollWidth = 397`, widest node the account
initial `div` at `right=397`.

**It is much worse in the tablet band than on a phone.** The R4 e2e at 800px
measured `scrollWidth = 926` — a **126px** overhang, against 22px at 375px.
The reason is that the mobile toggle is `lg:hidden` but the wordmark text,
`OrgSwitcher` and `CompanySwitcher` are all still rendered between 768 and
1023px, so the left cluster is at its widest exactly where it has least room
to spare. Anyone testing this on a phone alone will conclude it is a rounding
error; it is not.

`app-shell.tsx:54-82` is `flex h-14 items-center justify-between px-4` with two
clusters. The left one — mobile toggle (44px), the `V` mark plus the
`VolunteerReady` wordmark, `OrgSwitcher` and `CompanySwitcher` — has no
`min-w-0`, so it never shrinks and pushes the right cluster (theme toggle,
notification bell, account button) off the right edge. Visible in the 375px
screenshot as `Riverside Anim…` and a clipped `Add company sponsor`. The
magnitude scales with org name length, so a long org name makes it worse.

This is why T28's e2e asserts against the roster region rather than the whole
document: a page-level assertion fails on this pre-existing bug and says nothing
about the roster, so it would get deleted or padded with a tolerance the first
time someone hit it. **Fix:** `min-w-0` on the left cluster plus `truncate` on
the wordmark, or hide the wordmark text below `sm` (the `V` mark alone still
identifies it). Then tighten the e2e assertion to
`documentElement.scrollWidth <= 375` and delete the comment pointing here.
**Effort:** S, but it is shared chrome — it wants a look at every staff page at
375px, not just the roster. ~~**Note the sonner toaster is a second, smaller
offender** (`ol` at width 375 with a 16px inset → 391), which no amount of
app-shell work will fix; it needs a narrow-viewport width cap on `AppToaster`.~~
**← WRONG, do not act on this.** The 391 figure describes the `position: fixed`,
zero-height `<ol>`, which paints nothing and does not extend
`documentElement.scrollWidth`. Sonner already clamps the toast `<li>` to the
viewport: it measures 288px inside a 320px viewport with a width cap and 288px
without one. See the corrected entry above and the note in `sonner.tsx`.

### [P2] ~~Three T29 obligations are still open~~ → ONE remains (T25 closed two, T27 closed the third)

Do not let a reviewer check these off against the T28 diff — the design doc's
Accessibility list reads as one unit but its items have different owners.

✅ **Closed by T25 (2026-07-31):** focus return to the name input after each add,
and the `aria-live` running count. Both needed the stay-open repeat entry to
exist before there was a count to announce or anywhere to return focus to.

✅ **Closed by T27 (2026-07-31):** `aria-label="View {name}"` on the mobile row,
which needed T27 to give the row something to open.

**T27 also had to add an obligation the Accessibility list does not contain**:
focus RETURN to the row that opened the dialog. The list omits it because it
assumed a `DialogTrigger`, which Radix restores focus to for free. There cannot
be one here — one dialog serves two always-mounted trees of rows — so Radix
restores to `<body>` instead, on every row a keyboard user opens. Anything else
that opens a shared dialog from a list will inherit exactly this, and the two
non-obvious halves are in `page.tsx`: it must run in **`onCloseAutoFocus`** (an
`onOpenChange` handler runs first and gets overwritten by Radix's own restore),
and the node to focus is not always the one clicked, since a clickable `<tr>`
cannot hold focus.

Still open: the animated header count being `aria-hidden` during transition
needs **T30**, which adds the animation. **Effort:** rides with T30.

### [P2] ~~`Remove` on the mobile card is a deliberate deviation, and T27 must undo it~~ ✅ CLOSED by T27 (2026-07-31)

The approved spec parks `Remove` in T27's detail dialog and makes the card row
itself tappable. T27 is unbuilt, and shipping the card list without a `Remove`
would have left a phone unable to remove a volunteer at all — a capability the
horizontally-scrolling table has today. The spec's stated reason for moving it
("a `Remove` button inside a full-width **tappable** row is a nested interactive
target") holds only once the row is tappable, which it is not: the card is a
plain `div` with exactly one control, pinned by a test asserting one button per
row. **When T27 lands** it must make the row the tap target, move `Remove` into
the dialog, and delete both the card's button and the e2e assertion that carries
a note pointing here.

**Done, all four parts.** The card is a `<button aria-label="View {name}">`,
`Remove` moved to the dialog footer, and both the unit assertion and the e2e one
were inverted rather than deleted — they now assert the mobile `Remove` is
ABSENT, so a reintroduction is caught rather than silently tolerated. **One
thing the original note understated:** this was not only a mis-tap argument.
Once the row is a `<button>`, a nested `<button>` is invalid interactive-content
nesting, so decision "row is the tap target" and decision "Remove leaves the
card" are the same decision, not two.

The `keeps exactly one interactive control per card row` test survived the
change **without its assertion changing** — the count was 1 before and after,
because T27 deleted one button and added another. It now names the survivor
(`View Maria Garcia`), so a reintroduced `Remove` (2), a lost trigger (0) and a
straight swap all fail. A bare count is a weak assertion when the thing it
counts is being replaced.

### [P3] A third hand-rolled Drawer/Dialog switch now exists, with no shared wrapper

`AddVolunteerDialog` joins `feedback-widget.tsx:282-308` and
`org-profile-form.tsx:399-434`. Each re-solves a subset of the same quirks, and
no two of them hit the same subset — which is the argument for a wrapper.
**Two** re-solve the footer-order quirk (`org-profile-form`, `AddVolunteerDialog`):
`DrawerFooter`'s plain `flex-col` stacks the primary action last, where the
`DialogFooter` it replaces puts it first (`flex-col-reverse` narrow, `sm:flex-row
sm:justify-end` wide). `feedback-widget` dodges it entirely — it renders no
footer component at all, keeping its buttons inside the shared form body.
**Two** re-solve the body-padding quirk — `DrawerContent` supplies none, so
callers add their own `px-4 pb-6` (`feedback-widget.tsx:303`,
`AddVolunteerDialog.tsx:125`). `org-profile-form` escapes that one because its
drawer body is a static `confirmBody` living entirely inside
`DrawerHeader`/`DrawerFooter`, which the primitive pads itself. **And a third
quirk surfaced during review:** `DrawerFooter`'s own `p-4` stacks on top of the
body wrapper's `px-4`, insetting the buttons 32px against 16px inputs —
`AddVolunteerDialog` passes `px-0 pb-0` to cancel it. A `ResponsiveModal` wrapper was considered and
rejected **for now**: adopting it in one place while leaving the two shipped,
tested consumers alone gives an abstraction with a single real consumer, and its
API already needed `breakpoint` and footer-order escape hatches to cover shapes
it would not be used for. The three also differ structurally — feedback-widget
has an external trigger and no footer slot, org-profile-form is trigger-less.
**Revisit when a fourth appears, or opportunistically the next time either
existing file is touched for an unrelated reason.** **Effort:** M.

**REVISITED at the fourth (T27, `VolunteerDetailDialog`, 2026-07-31) — the JSX
wrapper is still rejected, and the fourth consumer STRENGTHENS the case rather
than weakening it.** Its footer differs from `AddVolunteerDialog`'s more than
that one differs from the other two: it has **no footer at all on desktop**
(DialogContent's own dismiss `X` suffices, and a second control named "Close" is
a rotor reading "Close, Close") and a two-button non-form footer on mobile. It
also deliberately does NOT copy the `flex-col-reverse` override — that exists to
lift a **submit** action, and applying it here would put "Remove from your
roster" directly under the thumb. A wrapper covering both would need yet another
escape hatch.

**What WAS extracted is the shell-freeze logic**, as a hook:
`useFrozenDesktopShell(open)` in `src/lib/hooks/use-frozen-desktop-shell.ts`,
now used by both roster modals. That is the piece most likely to be miscopied —
pure stateful effect-timing logic whose own comment admitted it was untestable —
and extracting it made the distinction available: the *visual* consequence (which
shell paints) remains unreachable in jsdom, but the *resolution rule* is a pure
function of `open` and the live query, and now has four tests including the iPad
-rotation case. `DESKTOP_QUERY` lives there too, so two modals can no longer
silently disagree on the breakpoint STRING.

Still duplicated across all four: the `min-h-0 overflow-y-auto` drawer body
wrapper and its explanatory comment. **Revisit at a fifth**, and prefer
extracting the body wrapper next rather than the whole modal.

### [P3] The breakpoints on this page are not all the same kind of thing

`page.tsx` switches table↔cards with Tailwind `lg:` classes; `AddVolunteerDialog`
switches Dialog↔Drawer with `useMediaQuery('(min-width: 1024px)')`. They agree on
`lg` by intent, but nothing enforces it — changing one leaves the other, and the
failure is a band of widths where the list is cards and the form is a centred
dialog. A shared constant cannot fix it (one side is a Tailwind class name, the
other a media-query string). **Effort:** S, if a lint rule or a comment pair is
judged worth it.

**Narrowed by T27 (2026-07-31), not closed.** The page now has a THIRD switch
(`VolunteerDetailDialog`), but the two modal ones no longer state the query
independently — both call `useFrozenDesktopShell`, which owns the exported
`DESKTOP_QUERY` constant, and a hook test pins it as a string. So modal-vs-modal
drift is now impossible. **The original gap is untouched:** the Tailwind `lg:`
on the list and the media query in the hook are still two unrelated
declarations, and the failure mode is unchanged.

### [P3] `AddVolunteerDialog.test.tsx` patches `window.getComputedStyle` globally

vaul reads `style.transform || style.webkitTransform || style.mozTransform` and
calls `.match()` on the result; jsdom computes `transform` as `''` and defines
neither alias, so the chain yields `undefined` and every pointer release inside
the drawer throws. It throws **asynchronously**, so the run fails while every
test still reports green — which is how it was found. The shim shadows the one
property and is file-local, matching the pointer-capture polyfills'
already-per-file precedent (`org-profile-form.test.tsx:47-50`). If a third file
renders a Drawer, move both into `src/test-setup.ts` rather than copying them a
third time. **Effort:** S.

---

## Opened by Lane G — roster import, export, metrics (2026-07-29, v0.38.0.0)

Shipped T17 (`pnpm import:roster`), T19 (`/api/org/[orgId]/roster/csv`) and T20
(the `roster_populated` milestone across all three onboarding surfaces).

### [P2] ~~`bulk-import-service.parseCsv` still splits on commas~~ ✅ FIXED (2026-08-03, v0.41.0.0)

Migrated onto `parseCsvRecords`, keeping the `{ rows, errors }` return shape and reusing
the record's `line` for error row numbers exactly as prescribed. **There is now exactly
one CSV parser in this repo**, and `domain/csv.ts`'s own docstring says so.

Three things the swap had to decide, none of them in the fix shape below:

1. **It still NEVER THROWS.** `parseCsvRecords` raises `CsvFormatError` on an
   unterminated quote and the roster importer re-throws it, but that importer has a
   file-level handler and a terminal; this one's only caller is a tRPC mutation that
   records the outcome on a `BulkImportJob`, and `createBulkImportJob` has no try/catch.
   A job reading "unterminated quote starting on line 12" beats an uncaught 500.
2. **Trimming and lowercasing had to be re-applied by hand.** `parseCsvRecords` is a
   tokenizer and normalizes nothing; the old parser trimmed every cell and lowercased the
   email. Dropping that would have let whitespace and mixed case reach
   `submittedByEmail`, which is stored canonical.
3. **Error row numbers changed meaning, correctly.** They were an index into a
   blank-line-filtered array, so any blank line shifted every reported number — the
   number an operator uses to find the row to fix. They are now true file lines.

The module had **no tests at all**, so nothing would have gone red either way;
`src/server/services/__tests__/bulk-import-parse.test.ts` was written first and pins both
the preserved behaviour and the fixed behaviour (quoted commas, BOM, CRLF/lone-CR, true
line numbers, the never-throws contract).

### [P2] (original) `bulk-import-service.parseCsv` still splits on commas

T17 added a real RFC 4180 parser at `src/server/domain/csv.ts` and uses it. The
**applications** bulk importer (`bulk-import-service.ts:24`) still does
`line.split(',').map(c => c.trim())`, so any quoted field containing a comma
shifts every later column left. Its own column contract is narrower (`email`,
optional `opportunityId`) and an email cannot contain a comma, so today the
damage is confined to `opportunityId` being read as garbage rather than to the
identity column — which is why this is P2 and not P1.

Deliberately not converted in the Lane G diff: it is a shipped surface with
existing tests and its own error-reporting shape, and folding it into an import
ship would have put a behaviour change to the applications pipeline inside a
diff about rosters. **Fix:** swap `parseCsv` onto `parseCsvRecords`, keeping the
existing `{ rows, errors }` return shape, and reuse the `line` field for the
error row numbers it already reports. **Effort:** S.

### [P3] The dry run is a rehearsal, and two runs can disagree

`previewRosterImport` classifies each row against the database as it stands, and
nothing holds that state until the real run. A volunteer who applies, or leaves,
between the two changes the answer. The script says so in its output rather than
pretending otherwise, which is the right call for a tool a human runs twice
minutes apart — but it does mean "the dry run said 40 adds" is not a promise.
Closing it would need a snapshot or an advisory lock over the whole run, which
costs more than it buys at concierge scale. **Effort:** M if it ever matters.

### [P3] The import has no e2e, and the exported CSV has no scrolled-render check

Both were driven by hand against the dev server during the ship — the importer
run twice (idempotence), a leave-then-reimport (the block refusal), and the
export checked for a soft-deleted row, a formula-injection name and a FREE-tier
org. None of that is automated, and e2e still does not run in CI. The natural
home is a third test in `e2e/staff-created-volunteers.spec.ts`. **Effort:** M.

### [P3] `sendImportNotifications` paces at a fixed 600ms with no retry

Enough for Resend's 2 req/s default, and failures are reported rather than
swallowed — but a transient 429 still costs that volunteer their notice, and the
remedy is "re-send by hand" printed at the end of the run. A bounded retry with
backoff on 429 specifically would close it. Note the deliberate design here: the
importer owns pacing precisely because `addVolunteer`'s fire-and-forget send
would lose these silently. **Effort:** S.

### Caught by review in this same ship — fixed, recorded so they are not reintroduced

Seven specialists, a Claude adversarial pass and Codex. **Nine CRITICALs, all fixed and
mutation-verified.** Five were real defects in new code; the rest were false claims
in comments I had just written, which is its own lesson.

**`--dry-run=false --yes` performed a live production write.** Found independently by the
API-contract AND data-migration specialists. `flags.get('dry-run') === true` fails OPEN when
the switch carries a value, so `--dry-run=false`, `--dry-run=0` and `--dry-run false` (the
`--key value` branch swallows the next bare token) all yielded `dryRun: false, yes: true` —
a production write, emailing real people, from a command line that visibly reads
`--dry-run`. The file already guarded a typo'd flag NAME (`--dryrun`); it did not guard a
value on the right name. `--no-notify=true` had the same root cause and inverted to "send
the mail anyway". Fixed with a `SWITCH_FLAGS` allowlist that rejects any valued switch, plus
`--dry-run`/`--yes` now mutually exclusive rather than "dry-run wins". Six tests.

**An unterminated quote silently dropped every following row and misdiagnosed the loss.**
`parseCsvRecords` discarded `inQuotes` at EOF, so one unbalanced quote swallowed the rest of
the file into a single field. Verified: a 4-line file became 1 record with 1 field, and the
operator's report read `0 valid, 1 invalid — Email is required. ("")` for a file with three
populated email cells. `ROSTER_IMPORT_CAP` cannot catch it — the runaway quote is exactly
what makes the record count small. Now a `CsvFormatError`, rethrown as
`RosterCsvFormatError`, naming the line the quote opened on.

**Export → import was not a round trip.** `escapeCsvField` prefixes `@`/`=`/`+`/`-`-leading
values with `'` against spreadsheet formula execution, and nothing undid it on the way back
in. Verified: `+1 555 0100` re-imported and PERSISTED as `'+1 555 0100`, and
`volunteerPhoneSchema`/`displayNameSchema` both accept a leading apostrophe, so it was
silent. Every international phone number was affected. `unescapeCsvField` now inverts it,
and only where the writer could have added it — `'tis Jones` is left alone.

**A lone `\r` escaped a CSV field, bypassing the formula guard.** `escapeCsvField` quoted on
`\n` but not `\r`, while the new `parseCsvRecords` accepts a lone CR as a record terminator
— so a volunteer-controlled `displayName` of `Jane\r=cmd|…` round-tripped as TWO records
with the payload leading the second, where the `'` prefix never applies. Pre-existing
function, newly exploitable because this ship gave it a CR-terminating parser and a second
consumer that hands the file to a coordinator. `MUST_QUOTE = /[",\n\r]/`, and `FORMULA_LEAD`
now also catches a payload hidden behind leading whitespace.

**`findOrgByIdOrSlug` had no precedence between id and slug.** A `findFirst` with
`OR: [{ id }, { slug }]` and no `orderBy`. `Organization.id` is a 25-char cuid and
`ORG_SLUG_PATTERN` (`/^[a-z0-9]+(-[a-z0-9]+)*$/`) accepts exactly that shape — verified — so
an org can register another org's id as its own slug and win the race. That points a
concierge import at the squatter and 404s the victim's own export. Now two sequential
`findUnique` calls, id first.

**Four false claims in comments this ship wrote.** Worth recording because they are the
failure mode CLAUDE.md's disclosure rule exists for, and they slipped through anyway:
(1) `isRosterEnabledForOrg`'s docstring said "five callers … grep THIS when the flag
retires" while `app/(app)/app/layout.tsx` still resolved the flag inline — a SIXTH surface
the instruction missed, and CLAUDE.md repeated the instruction. Now six callers and layout
goes through the helper. (2) The export route's rate-limit comment claimed "probing many ids
from one account consumes one budget"; the key was `${userId}:${orgId}`, so every candidate
id minted a FRESH bucket. Split into a per-caller PROBE limit before the lookup and a
per-resolved-org EXPORT limit after. (3) `addVolunteer`'s docstring said "the caller fires it
after commit" — it fires it itself. (4) `roster-import.ts` documented "the two skips" when
the union has one.

Also fixed: the importer ignored `suspendedAt` (a field `findOrgByIdOrSlug` now selects);
`--actor` accepted any address in the database, so a typo resolving to a real stranger wrote
a confidently wrong audit trail and told volunteers "Added by \<that stranger\>" — now
checked with `userIsMemberOfOrg`; a mid-stream export failure produced a well-formed CSV
prefix that looked complete — now ends with an `# EXPORT FAILED … do not use it` row; the
truncation notice was a one-field row in a seven-column file, which parses as a phantom
volunteer — now padded to the header width; `ROSTER_IMPORT_CAP` refuses a mis-selected
50k-row export before it mints 50k shadow users; `sendImportNotifications` re-read the
invariant org and actor once per recipient (120 redundant queries on a 60-row run).

Design (all sourced to DESIGN.md or the approved mockup): the activation figure was
`text-2xl font-semibold`, byte-identical to the page's own `h1` and missing the `font-mono`
DESIGN.md assigns to data values; its loading skeleton was one `h-10` bar against ~70px of
content, so the card grew and pushed the table down; the Roster column dropped the pass/fail
signal its four neighbours carry while the service already computed `hasRoster`; Export CSV
was rendered at 0 rows against a spec that hides it, and sat as a non-wrapping flex sibling
that stole width from the search field below ~600px.

### [P2] `rosterActivation` has no eligible-cohort denominator

The launch metric counts orgs reaching the threshold in `STAFF_ADDED` rows within 7 days of
signup. It was rendered as `N / totalOrgs`, and `totalOrgs` is every org ever created —
including orgs that predate the `OrgVolunteer` table, orgs whose `staff_created_volunteers`
flag is off (they cannot enter the numerator at all, since `addVolunteer` is behind
`rosterProcedure`), and orgs still inside their own 7-day window. As a ratio it deflates
monotonically whether or not the concierge motion works.

Shipped as a raw count with the cohort named in prose, which is honest but less useful than
a rate. **Fix:** compute the eligible cohort — orgs created at least 7 days ago AND
flag-enabled — and report against that. Wants a second query or a widened
`countOrgsWithPopulatedRoster` that returns the cohort size with the HAVING dropped.
**Effort:** S.

### [P2] Funnel step 5 counts flag-off orgs the checklist deliberately does not

Found by the adversarial pass. Step 5 and the per-org `hasRoster` apply no flag filter,
while `computeOnboardingStatus` omits the step entirely when `rosterEnabled` is false. Since
`ensureAppliedRosterRow` mints roster rows regardless of the flag, a non-pilot org's roster
fills on its own — so the admin table can show it 5/5 complete while its own checklist has
only four steps. The service comment claims step 5 "match[es] the checklist … so the product
cannot congratulate an org it is still nudging", which is false for exactly the non-pilot
population. **Fix:** filter both on the flag, or correct the comment. **Effort:** S.

### [P2] ~~The importer has no non-local-DATABASE_URL confirmation~~ ✅ FIXED (2026-08-03, v0.41.0.0)

**Both halves shipped.** `isLocalDatabaseUrl` + `requireProductionConfirmation` in
`scripts/import-roster.ts`: a write against a non-local `DATABASE_URL` now prints the
target and requires the org's **resolved** slug typed back on stdin. `--dry-run` is
exempt (it writes nothing, and rehearsing against production is the intended first
step). A non-TTY refuses outright, with **no env-var override** — `E2E_ALLOW_REMOTE_DB`
and `INTEGRATION_ALLOW_REMOTE_DB` exist because CI genuinely needs to point at a shared
database, and this script has no automated caller, so a bypass would only reinstate the
gap. `isTTY` and `readAnswer` are parameters rather than reads of `process.stdin`, so
both branches are unit-tested; `main()` is still never invoked by a test.

`parseArgs` now refuses ANY flag given twice (`setFlag`), checked before the value is
stored and for every flag rather than only the switches — a duplicated switch is the
same class of "the command line does not say what it does" as a duplicated `--org`.

Two things worth keeping: the confirmation asks for the **resolved** slug, because
`--org` accepts an id too and asking someone to retype what they already typed confirms
nothing; and it runs **after** org resolution but **before** the file is read, so a run
aimed at the wrong database stops without touching anything.

The original write-up follows.

### [P2] (original) The importer has no non-local-DATABASE_URL confirmation

`--yes` is the entire gate on a script whose header says it is normally pointed at
production. The preamble prints the target database and org name and then writes on the next
statement — no prompt, no affirmation. This repo has the opposite convention everywhere
else: `pnpm fixture:email-collisions`, `src/test/integration-setup.ts` and `e2e/utils/db.ts`
all REFUSE a non-local `DATABASE_URL`. The one script designed to be aimed at production is
the one with no environment check. Compounding it, `parseArgs` lets `--org` appear twice with
last-write-wins, so one mistyped slug plus a habitual `--yes` writes shadow users into a
stranger's tenant and emails them.
**Fix:** when `DATABASE_URL` is non-local, require the resolved `org.slug` typed back on
stdin (the resolver already returns it for this purpose), and reject duplicate flags.
**Effort:** S.

### [P2] ~~An interrupted import can never send its notifications~~ ✅ FIXED (2026-08-03, v0.41.0.0)

`pnpm import:roster --notify-only` — re-feed the SAME file, add nobody, send what an
earlier run left owed. Broadly the shape this entry prescribed, with four decisions the
build had to make that it did not:

1. **The CSV bounds the work, the audit log decides the answer.** Matching the file's
   addresses against `AuditLog` rows carrying `metadata.via = 'CONCIERGE_IMPORT'` — via
   `findConciergeImportAuditRows` — rather than querying the audit log alone. The audit
   log alone is unbounded and would re-email an org's whole concierge history; the file
   alone cannot tell "on the roster because this import added them" from "on the roster
   since last year", and would send *"X added you to their roster"* to someone who has
   volunteered there for years.
2. **Eligibility comes from `metadata.outcome` through `shouldNotifyByEmail`**, the same
   predicate the live run uses, so a shadow/unclaimed add is `INELIGIBLE_OUTCOME` and
   never mailed. An unrecognised outcome is its OWN status (`MALFORMED_AUDIT_ROW`), not
   folded into ineligible: "never owed an email" and "we cannot tell" are different
   answers, and reporting the second as the first answers a question nothing answered.
3. **The `EmailEvent` dedupe is ADVISORY and reported, never a silent gate.** `sendEmail`
   writes the SENT row fire-and-forget and writes nothing at all on the Resend-threw
   branch, so a missing row does not prove nothing was sent — and both failure modes err
   toward "we think it was sent when it was not", which is the state this mode exists to
   repair. Also: `EmailEvent` carries no `orgId`, so two orgs with the same display name
   collide on the subject.
4. **Attribution comes from each audit row's own `actorId`**, resolved once per DISTINCT
   actor. A recovery says what the killed run would have said; one context for the batch
   would tell volunteers they were added by a coordinator who never added them.
   `--notify-only --actor` is therefore refused as contradictory, not ignored.

`--notify-only --dry-run` lists recipients without sending; without `--dry-run` it needs
`--yes` and the production confirmation like any other send. The per-send line landed on
**both** paths. Exit code is 1 for a failed send or an unreadable audit row, and
deliberately **0** for `NOT_COMMITTED` — everything past an interruption's kill point is
legitimately uncommitted, and failing on the expected shape of the expected input trains
the operator to ignore the code.

**Found while building, and it made this fix necessary rather than merely useful:**
`sendRosterAddedEmail` was discarding `sendEmail`'s boolean. See the entry below.

The original write-up follows.

### [P2] (original) An interrupted import can never send its notifications

`sendImportNotifications` runs only after `importRoster` returns the whole result set, so a
run killed at row 55 of 60 leaves 55 rows committed and zero notices sent. Re-running is the
documented remedy, but every committed row then returns `SKIPPED_ALREADY_ON_ROSTER`, which
carries no `notify` flag — so `owed` is empty and those notices can never be sent by the
tool. The rows grant an org access; the notice is the only thing carrying the link to revoke
it. The existing P3 below covers a transient 429, not this.
Compounding it: the send loop prints nothing per recipient, so 60 notices at 600ms is 36
seconds of silence — which invites exactly the Ctrl-C that creates the state.
**Fix:** a `--notify-only` mode that recomputes owed notices from `AuditLog` rows carrying
`metadata.via = 'CONCIERGE_IMPORT'`, plus one line per send. **Effort:** M.

### [P3] `--no-notify`'s only reachable effect is the harmful one

Its documented legitimate use — re-running an import whose notices already went out — is
already free, because a re-run's rows come back `SKIPPED_ALREADY_ON_ROSTER` with `notify`
unset and no notices are sent whether or not the flag is passed. So the flag's only distinct
behaviour is suppressing notices for genuinely NEW rows, which is what its own USAGE text
warns against. **Fix:** restrict it to a local `DATABASE_URL` (its real use is dev testing,
where the Resend key is live), or remove it. **Effort:** S.

### [P3] `controller.error()` may discard the failure notice it was just handed

`rosterExportService` enqueues the `# EXPORT FAILED` row and then calls
`controller.error(err)`. Per the Streams spec `error()` runs `ResetQueue`, which drops
anything still queued — the notice survives only because a read request is normally pending
inside `pull`, which fulfils the enqueue directly. Usually true, not guaranteed across
queuing strategies and runtimes, so the marker is best-effort rather than the invariant its
comment reads as. Also: no `cancel()` handler, benign today because no connection is held
between pages. **Effort:** S.

### [P3] Two latent full-table scans on the admin onboarding page

Measured with EXPLAIN against real Postgres. (1) `countOrgsWithPopulatedRoster` is called
TWICE per page load and each is an unbounded aggregate over `OrgVolunteer` with no `orgId`
predicate; one pass with conditional aggregates (`count(*) FILTER (WHERE …)`) answers both.
(2) Prisma's filtered `_count` on the org relation compiles to a LEFT JOIN against a derived
table aggregating the ENTIRE `OrgVolunteer` table BEFORE `LIMIT 20` is applied — so listing
20 orgs costs a full aggregation; a bounded `groupBy` over the 20 ids fixes it. Both are
unmeasurable today (the table is nearly empty) and admin-only. Noted because `OrgVolunteer`
is the one relation here that grows per-volunteer-per-org. **Effort:** S each.

### [P3] `previewRosterImport` issues three sequential queries per row

Up to 1,500 round trips for a 500-row dry run (~75s at 50ms RTT), 15,000 for a 5,000-row
file at the cap. The code comment defends this as "batching would be a second
implementation of the same classification" — but batching only the three READS into Maps and
leaving the per-row branch order byte-identical keeps the classification single-sourced,
which is the property the comment is protecting. Defensible at concierge scale, painful
somewhere around 300-500 rows. **Effort:** S.

### [P3] The concierge importer is invisible to the flag-retirement grep

`grep isRosterEnabledForOrg` — the enumeration CLAUDE.md now prescribes — does not match
`scripts/import-roster.ts` or `rosterImportService.ts`, because the importer checks no flag
at all. Loading a roster before flipping the pilot flag may well be the intended concierge
sequence, but nothing says so, which makes the omission indistinguishable from the miss the
rule exists to prevent. **Fix:** either check the flag, or add one sentence saying why it
deliberately does not. **Effort:** S.

### [P3] Three test-mock copies and an untested one-line predicate

The delegating `isRosterEnabledForOrg` mock is copy-pasted verbatim into four test files now
(`routers/volunteers.test.ts`, `routers/shifts.access.test.ts`, `volunteers/layout.test.tsx`,
`app/__tests__/layout.test.tsx`). Worse, they RE-IMPLEMENT the function they replace, so the
real one-line body has zero executed coverage: point production at a different flag key and
all four still pass. **Fix:** extract `src/test/roster-flag-mock.ts`, and add one direct test
in `featureFlagService.test.ts` asserting the predicate reads
`staff_created_volunteers`. **Effort:** S.

### [P3] `scripts/import-roster.ts::main()` has no tests

~55 statements on a `--yes`-gated, production-pointed, email-sending path. `parseArgs` proves
the flags PARSE; nothing proves `main` honours them — the `args.dryRun ? preview : import`
dispatch, the org/actor refusals, and the `!args.dryRun && args.notify` guard are all
uncovered. Needs the orchestration extracted behind an injectable deps object to be testable
at all. **Effort:** M.

### [P3] Funnel step 5 and `rosterActivation` count different things, and the page shows both

By design — step 5 is the checklist's predicate (any source, any time) and
`rosterActivation` is the launch metric (`STAFF_ADDED`, within 7 days). They are
rendered in separate cards with the narrower one spelled out in prose. Recorded
because two roster numbers on one admin page will read as a bug to whoever sees
it next, and the answer is in `onboardingAnalyticsService.ts`'s header comment.
No action unless the page proves confusing in use.

---

## Opened by the site-content accuracy ship (2026-07-28, v0.37.1.0)

Five specialists plus an adversarial pass reviewed a marketing-copy diff. Most
findings turned out to be about the *product*, not the copy — the copy was only
the first place the gaps became visible.

### [P1] ~~The privacy policy names Checkr as the only background-check provider; Sterling is live and receives SSN + DOB~~ ✅ FIXED (v0.37.2.0)

Fixed, and the scope was wider than this entry described. It was not four sites
on one page — it was **eleven across three legal/trust pages**, and `/terms` had
the sharper defect:

- `/terms` §6 said *"You authorize **Checkr** to conduct the check"* and *"You
  have the right to dispute the accuracy of background check results directly
  with **Checkr**."* For anyone screened through Sterling those named the wrong
  consumer reporting agency — the second being the FCRA dispute-rights sentence,
  i.e. the one telling a volunteer where to go to correct a report that could
  cost them a position. Terms also has no version history, only an effective
  date, which is now bumped with a note saying what changed.
- `/security` was under-inclusive rather than false in two places: the adverse
  action workflow is **platform-level** (verified: no `CHECKR`/`STERLING`
  branching anywhere in the FCRA path), not part of "our Checkr integration";
  and Sterling API keys get the same `encrypt()` treatment Checkr OAuth tokens
  do (`connectSterlingAccount`, `backgroundCheckService.ts:1044`).

The prose is provider-neutral where the reader does not need the vendor name and
names both where they do — with an explicit "ask the organization, or ask us,
which one holds your data", since which provider receives a given volunteer's
SSN is per-org and not something the policy can state statically.

**Regression guard added.** `src/app/(public)/privacy/page.test.ts` derives the
expectation from the `BackgroundCheckProvider` enum — the same enum
`registry.ts`'s `getAdapter()` switches on — so a third provider that reaches
production without a disclosure row is a red test, not something a human has to
notice on a re-read. Mutation-verified: deleting the Sterling row fails it with
an actionable message. This also partly closes the P3 below on version/date
being two hand-edited strings (shape and ordering are now pinned; the footer
prose itself is still hand-copied).

Original write-up follows.

Found by the post-ship cross-model doc review, not by the five specialists —
pre-existing, but this ship republished the policy as v1.1 and rewrote its
sharing section without catching it, so it now ships under a fresh effective
date. `src/app/(public)/privacy/page.tsx` names Checkr and only Checkr in four
places: the `thirdPartyServices` table row (`:54`, "PII (name, SSN, DOB)"), and
the prose at `:189`, `:382` ("Background check data (SSN, DOB) is sent directly
to Checkr"), and `:423` (retention "according to FCRA requirements and Checkr's
data retention policy").

Sterling is not hypothetical. `connectSterlingAccount`/`initiateSterlingCheck`
are live (`backgroundCheckService.ts:1038, :1103`), the adapter posts
`dateOfBirth: pii.dob` and `ssn: pii.ssn` (`adapters/background-check/sterling.ts:129-130`),
there is a production webhook at `src/app/api/sterling/webhook/route.ts`, and
`/how-it-works` already advertises both providers to the public
(`how-it-works/page.tsx:99, :196`). So the marketing site names a processor the
privacy policy does not — and it is a processor handling Social Security numbers.

Fix: add a Sterling row to `thirdPartyServices`, and make the three prose
mentions provider-neutral ("our background check provider" / "Checkr or
Sterling") rather than hardcoding one vendor, so adding a third provider does
not silently repeat this. Needs a version bump to 1.2 plus a matching
effective-date footer edit (see the P3 below on those being two hand-edited
strings). Legal-copy change — wants human sign-off, not an agent edit.
**Effort:** S to write, gated on review.

### [P2] `listMyOrgRelationships` caps at 200, and the copy nearly promised it does not

`MY_MEMBERSHIPS_CAP = 200` (`org-volunteer.ts:20`) is applied as three separate
`take: 200` reads (roster, applications, shift signups — `orgVolunteerRepo.ts:224,
237, 251`) then `.slice(0, 200)` over the merge (`:313`). A volunteer with 200+
shift signups at recent orgs silently drops older orgs off `/app/profile`
entirely. Those orgs still satisfy `findOrgVolunteerRelationship` through
`SHIFT_SIGNUP`, and the Leave button is the only self-service exit — so their
access, including `backgroundChecks.initiate`, becomes permanently unrevokable.

**Correction (post-ship doc review, 2026-07-28): the copy workaround only
covered one of the four sites.** `privacy/page.tsx:169` does avoid the absolute
("Organizations holding this access are listed on your profile page"). The other
three assert completeness outright — `privacy/page.tsx:279` ("You can see
**every** organization holding this access"), and `for/volunteers/page.tsx:108`
and `how-it-works/page.tsx:206`, both "your profile lists **every** organization
that can see you". Past the cap those three sentences are false, in a published
privacy policy and two public FAQs, and they are false precisely for the
volunteer whose access has become unrevokable. Treat the cap fix as the remedy;
if it slips, soften those three strings first. The real fix is to make the
truncation distinct-by-`orgId` rather than per-source row counts — note the
`shiftSignup` read's `distinct` is on `shiftId`, a no-op given
`@@unique([shiftId, userId])`; it needs to be on `shift.orgId`. Surface an
explicit "showing N of M" if the cap is ever hit. **Effort:** M.

### [P2] There is no admin path to revoke an org on a volunteer's behalf

Drafted privacy copy promised "email privacy@volunteerready.org and we will
remove the entry for you" before review caught that nothing implements it:
nothing under `app/admin` or `routers/admin.ts` touches `OrgVolunteer`,
`OrgVolunteerBlock`, or `leaveOrgRoster`. Fulfilling it means hand-editing the
database, and a hand-issued soft delete writes **no block** — so the org re-adds
the person via `addVolunteer` in two clicks, which is precisely what v0.37.0.0
exists to prevent. The copy now routes these users to the magic-link sign-in
path instead. To make an emailed remedy real, add a platform-admin action calling
`leaveOrgRoster` (or a wrapper writing the same block + `VOLUNTEER_LEFT` audit
row) for a named user+org. The population needing it most — staff-created shadow
users — is the one that gets no notification email at all (`shouldNotifyByEmail`
returns true only for `LINKED_ACTIVE`). **Effort:** M.

### [P3] `LocationHero` hides on the first image error; the siblings retry

`AnnotatedScreenshot` retries the raw unoptimized asset before hiding, precisely
so "a transient optimizer 5xx must degrade to an unoptimized image, not silently
delete marketing content" (`annotated-screenshot.tsx:61-64`, 5 tests).
`LocationHero` hides on error #1, so a transient `/_next/image` 5xx still blanks
the hero on all six lead-capture pages — the same silent-degradation class this
ship fixed, moved from "404 forever" to "transient error". Either render the hero
through `AnnotatedScreenshot` or extract the retry. **Effort:** S.

### [P3] The `Organizations` stat card contradicts the marketing screenshot

Already recorded as a P3 from the T32 ship (the card counts
`OrganizationMember`, the section below counts roster relationships). It is now
**visible in a shipped marketing asset**: `public/marketing/profile.png` shows
"0 Organizations" directly above "Organizations you volunteer with: Riverside
Animal Shelter", and the new annotation marker points the reader at that region.
Fix at the next recapture — either give the `volunteer` capture actor a staff
membership, or rename the card to "Staff roles". **Effort:** S.

### [P3] `/for/volunteers` annotations are unasserted

`ANNOTATED_PAGES` in `e2e/public-pages.spec.ts` covers only `/how-it-works` and
`/screening`, and hardcodes `toHaveCount(3)`. `/for/volunteers` now has four
markers and nothing checks markers and legend entries stay 1:1. Drive the count
from the page's annotations array rather than adding another literal.
**Effort:** S.

### [P3] Privacy policy version and effective date are two hand-edited strings

`versionHistory[0]` and the footer literal must agree and nothing asserts it. A
bump touching only one publishes a legal document contradicting its own
changelog. Derive the footer from `versionHistory[0]`. **Effort:** S.

---

## Deferred from the T32 volunteer-exit ship (2026-07-28, v0.36.0.0)

Shipped: `leaveOrgRoster()` + the "Organizations you volunteer with" card on
`/app/profile`, the exit `sendRosterAddedEmail` has promised since T12.

### [P1] ~~Leaving a roster does not close the `SHIFT_SIGNUP` authorization edge~~ ✅ FIXED (v0.37.0.0)

Fixed by `OrgVolunteerBlock` — neither of the two options below, and the reason
is worth keeping. **Option (a) does not hold.** Cancelling the signups and
tightening the probe closes the chain as written, but `addVolunteer` takes an
email address and needs no consent, so staff re-add the volunteer and re-assign
them in two clicks and the edge is back. The T32 confirm copy said so out loud
— *"and they can add you again"* — which made (a) a fix whose own limitation was
printed on the button that triggered it. A consent mechanism the other party can
undo unilaterally is not one.

So the fix is (b): a `OrgVolunteerBlock` row written by `leaveOrgRoster` in the
same transaction as the soft delete, checked by `findOrgVolunteerRelationship`
after the probes, and refused by FOUR paths: the three that create a roster row
(`addVolunteer`, `ensureAppliedRosterRow`, `restoreVolunteer`) plus
`assignVolunteerToShift`, which creates none but reads one directly. It is the
only state in the org↔volunteer relationship staff cannot clear. Lifted **only**
by the volunteer re-engaging — applying **while signed in**, claiming an
application, or signing up for a shift — via `liftOrgVolunteerBlock()` in
`orgVolunteerAccessService.ts`. The signed-in condition is load-bearing:
`screener.submit` is a `publicProcedure` carrying an attacker-supplied address.

Three design notes that are easy to get wrong later:
- **`ORG_MEMBER` is exempt**, and the suppression path RE-PROBES for it rather
  than returning null. A coordinator who is also on their own org's volunteer
  roster would otherwise lock themselves out of their own organization by
  leaving that roster — and only when they also happened to have applied, since
  the probe short-circuits at `APPLICATION` and never reaches the member check.
- **`EXISTING_CREDENTIAL` is exempt too.** Suppressing it recreated the dead
  end `acceptExistingCredential` exists to prevent: `listOrgCredentials` filters
  on `orgId` alone, so the credential stayed visible and permanently
  unrevokable. Revocation is strictly narrowing, so a block has nothing to
  protect against there.
- **The block check runs after the probes, not before.** Blocks are rare;
  checking first adds a query to every call to save one on almost none. The
  rejection path is unchanged and the accept path pays one indexed lookup.

This also changed what the Leave button *means*, which was the actual decision:
from "drop the roster row" to "revoke this org's access." Copy on `/app/profile`
and in `sendRosterAddedEmail` was rewritten to match — see the design doc §2.

Original write-up follows.

### Archived — the original write-up above is SUPERSEDED, not open

Kept for the attack chain, which is the part worth being able to re-read. **Do
not action the fix options below** — neither was taken, and the entry above
explains why option (a) does not hold. Deliberately carries no `[Pn]` tag so a
priority grep does not return this as a live P1.

Found by the security specialist during this ship's review. `leaveOrgRoster`
soft-deletes the `OrgVolunteer` row, but `findOrgVolunteerRelationship`
(`orgVolunteerRepo.ts`) probes **four** kinds, and `SHIFT_SIGNUP` is one of them
with **no status filter**:

```
prisma.shiftSignup.findFirst({ where: { userId, shift: { orgId } } })
```

Staff can mint that row unilaterally — `assignVolunteerToShift` takes an
`OrgVolunteer.id` for anyone on their roster, and the roster itself can be
populated with any address without consent. So the full chain is:

1. Staff add a stranger's email (no consent required, by design).
2. Staff assign them to a shift.
3. The stranger receives the T12 email, follows it, and uses the new Leave button.
4. `ORG_VOLUNTEER` is gone — but `SHIFT_SIGNUP` survives forever. Cancelling the
   signup does not help; `CANCELLED` still matches the predicate.

That surviving edge keeps satisfying `requireOrgVolunteerRelationship`, which is
the **sole** guard on `profile.getOrgVisibleProfile`, `credentials.issue`, and
`backgroundChecks.initiate`. The last one accepts staff-supplied `pii: { dob, ssn }`
and makes a paid third-party call to Checkr/Sterling. So the person who just
exercised their only recourse still has an org able to order a background check
on them.

**Fix options.** (a) Have `leaveOrgRoster` also cancel the caller's future
CONFIRMED/WAITLISTED signups for that org inside the same transaction, AND tighten
the `SHIFT_SIGNUP` probe to exclude `CANCELLED` — note (a) is only coherent with
both halves, since cancelling without tightening the probe changes nothing.
(b) Add an explicit `OrgBlock` edge that `requireOrgVolunteerRelationship` checks
first and refuses on, which is the real "revoke this org's access" primitive and
is what the surface reads like it does.

Deliberately NOT fixed in the T32 diff: it changes the meaning of an existing
authorization predicate that four callsites depend on, and folding that into a
UI ship would have buried it. The confirm copy and design doc §2 were corrected
instead to stop over-claiming while it is open. **Effort:** M.

---

## Opened by the OrgVolunteerBlock ship (2026-07-28, v0.37.0.0)

### Caught by review in this same ship — fixed, recorded so they are not reintroduced

**`restoreVolunteer` had no block check.** Found independently by FIVE review
specialists; the testing specialist wrote the test and watched it fail before
reporting it. `restoreOrgVolunteer`'s `where` is
`{ id, orgId, deletedAt: { not: null } }` and nothing on `OrgVolunteer` records WHO
soft-deleted a row, so a volunteer's own departure is indistinguishable from a staff
removal — staff could undo a departure using an id their roster page handed them
before the volunteer left. It is the fourth roster-creating path and the one that
does not look like a create. Fixed with `findRemovedOrgVolunteer` + the same refusal
`addVolunteer` got, and mutation-verified.

**A block suppressed `EXISTING_CREDENTIAL`.** That recreated the exact dead end
`acceptExistingCredential` exists to prevent: `listOrgCredentials` filters on `orgId`
alone, so the credential stayed visible and permanently unrevokable, and only the
volunteer can lift a block. That kind is opt-in and reached by `revokeCredential`
alone, which is strictly narrowing — it cannot mint privilege or disclose anything,
so a block has nothing to protect against there. Now exempt alongside `ORG_MEMBER`.

**Three stale docstrings**, the worst being `leaveOrgRoster`'s own: it still read
*"It is also not a block — nothing stops the org re-adding the same address, and the
UI says so"*, twelve lines above the `createOrgVolunteerBlock` call this ship added
to that same function.

**No backfill for volunteers who already left under v0.36.0.0.** Their exit revoked
nothing and their surviving edges still authorized. The migration now backfills from
`AuditLog` `VOLUNTEER_LEFT` rows, keyed on `action` (NOT `entityType`, which is
`OrgVolunteer` there), excluding any pair with a LIVE roster row today — an org that
legitimately re-added someone after they left, which the old confirm copy openly
permitted, must not be retro-blocked into the zombie state this feature prevents.
Verified against real Postgres with fixtures for all three branches.

**The confirm promised an absolute the mechanism could not keep** — three ordinary
volunteer actions lift a block, and the marketplace is cross-org, so someone could
hand access back months later without registering whose listing they answered. The
copy now says so. Separately, the card's capability list omitted background checks
to avoid alarm; review showed that inverted WHO got the disclosure (the card is the
stay-or-go decision, the confirm is reachable only by people already leaving), so it
is named on both, loss-framed.

### [P2] Leaving does not cancel upcoming shift signups, and staff can still mark attendance

Found by a doc-accuracy audit *after* the PR was open — no review specialist
caught it, because every one of them was reading the diff and this is a fact
about what the diff does NOT touch.

`leaveOrgRoster` writes nothing to `ShiftSignup`. So after revoking an org:
- the volunteer is still `CONFIRMED` on next Saturday's shift,
- the org still sees them in that shift's signup list,
- and staff can still `markAttendance` them ATTENDED or NO_SHOW, because
  `requireAttendanceAccess` authorizes through `requireOrgShift` (shift-scoped)
  rather than `requireOrgVolunteerRelationship` (org-volunteer-scoped), so the
  block is never consulted on that path.

This is the residue of the rejected option (a): cancelling signups was never
implemented because the block made it unnecessary *for authorization*. It is
still necessary for **expectation** — a volunteer who revokes an org and is then
marked a no-show for a shift they never meant to attend is worse off than before
they left.

The confirm copy now discloses it (*"Shifts you're already booked on stay
booked"*) and volunteers can cancel their own signups (`cancelSignup` is a
`protectedProcedure` on their own id), so nobody is trapped. The open question is
behavioural: should leaving auto-cancel future CONFIRMED / WAITLISTED signups at
that org? Arguments both ways — auto-cancelling is what people expect, but it
silently drops an org from a shift it was counting on, with no notice to the
coordinator. Probably wants a "cancel my upcoming shifts too" checkbox on the
confirm rather than an implicit behaviour. **Effort:** M.

Related P3: the disclosure is shown unconditionally, but most volunteers have no
upcoming shifts at the org they are leaving. Gate the clause on a real count
(`listMyOrgRelationships` already queries `ShiftSignup` and could aggregate it)
so the sentence only appears when it is true of that reader. **Effort:** S.

### [P3] `TxClient` has escaped the repository layer

The alias (already a known P3, "copy-pasted across repositories") gained a 23rd copy
and, for only the second time, one outside `server/repositories/**` — in
`orgVolunteerAccessService.ts`, which drags a `PrismaClient` type import into a
layer CLAUDE.md scopes to business logic. Export it once from
`repositories/prisma.ts` and import everywhere. **Effort:** S.

### [P3] The block read-then-insert has an accepted TOCTOU window

`addVolunteer` and `ensureAppliedRosterRow` check the block and then insert, under
READ COMMITTED with no lock on the pair, so a leave committing in between produces a
live roster row beside a block. Accepted, not closed: the row is inert
(`findOrgVolunteerRelationship` suppresses it, `assignVolunteerToShift` re-checks),
so the failure mode is a confusing roster entry rather than regained access. Closing
it needs `INSERT ... WHERE NOT EXISTS` or a row lock. No integration test interleaves
two real transactions to pin the current behaviour either way. **Effort:** M.

### [P3] `VOLUNTEER_LEFT` and `ORG_ACCESS_RESTORED` file under different entityTypes

So no single `[entityType, entityId]` query reconstructs one block's lifecycle. The
departure writes `OrgVolunteer`/rowId (or `OrgVolunteerBlock`/userId when there was
no roster row), the restore writes `OrgVolunteerBlock`/userId. Joining requires
`orgId` + `actorId`. **Effort:** S.

### [P3] No e2e for leave → staff re-add refused

`e2e/staff-created-volunteers.spec.ts` covers add → assign → attend → hours but not
the exit, and now not the refusal either. e2e is still not in CI. **Effort:** M.

### [P2] ~~The never-consented case is untouched — an org can background-check a stranger it rostered~~ ✅ ADDRESSED BY DISCLOSURE (2026-08-02, v0.40.0.0)

**Resolved as notify, not refuse.** The counter-argument below won: the
coordinator must already hold the SSN and DOB to fill the form in, so an in-app
consent edge adds nothing they do not already have, while blocking the concierge
case outright — a spreadsheet of existing volunteers is entirely people who have
never logged in. `ORG_VOLUNTEER` stays in the accepted set.

What the counter-argument did NOT cover, and what actually shipped: the platform
had **no witness**. The subject of a check was the only party never told it
happened — the sole background-check email went to org STAFF on a CONSIDER
result, and the volunteer heard from us only on the FCRA pre-adverse path, i.e.
only if the report came back bad AND the coordinator chose to act on it. A clean
check run on someone who never agreed to one was invisible to them forever. The
subject is also the only party who *can* detect an unauthorized check, which is
what makes disclosure the fix rather than a stricter edge.

Shipped:
- `sendBackgroundCheckInitiatedEmail` — the subject is emailed at initiation,
  naming the org and the provider, with a dispute right and a contact path. Sent
  from `initiateProviderCheck` so both providers are covered. **Recipient is
  resolved from `userId` via `findEmailByUserId`, NEVER from `pii.email`** — the
  PII block is staff-supplied free text, so sending to it would hand the
  subject's only disclosure back to whoever is running the check. Mutation-tested.
- Guard 0 — a required FCRA consent attestation, refused in the service (not as
  `z.literal(true)`, which `errorFormatter` would redact) and persisted as
  `consentAttestedAt`/`consentAttestedBy` on `BackgroundCheckRequest`. Verifies
  nothing; converts /terms §4's assignment of the obligation into a per-check
  record with a named actor.
- `/terms` §6 discloses the notification.

**Deliberately NOT shipped — the shadow-user refusal.** Refusing when the roster
row is `STAFF_ADDED` and the user is `UNCLAIMED` was considered and rejected in
the same decision: that population is exactly the concierge case, and `sendEmail`'s
unclaimed guard is **opt-in**, so the notice reaches them by default anyway. What
they still cannot do is *act* — see the `Unclaimed volunteers cannot reach the
Leave control` P3 below, which this makes more consequential, not less. The email
names a human contact path for precisely that reason. Revisit only with
`VolunteerActivationInvite` (v1b), which would give them a real self-serve remedy.

Original entry, kept for the reasoning:

The block fixes *"I left and they still can."* It does nothing about *"they added
me off a spreadsheet, I never knew, and they can order a background check on me."*
`requireOrgVolunteerRelationship` accepts `ORG_VOLUNTEER`, which staff mint from
an email address alone, and that is the sole gate on `backgroundChecks.initiate`
— a paid third-party call carrying staff-supplied SSN and date of birth.

The fix shape is already named in `orgVolunteerAccessService.ts`'s own docstring:
tier the accepted set by action sensitivity, so high-stakes writes
(`credentials.issue`, `backgroundChecks.initiate`) require a consent-bearing edge
(`APPLICATION`, `ORG_MEMBER`, or a volunteer-confirmed roster row) while profile
reads keep the full set.

Counter-argument worth resolving before building it: to initiate a check staff
must already hold the person's SSN and DOB, which they got from that person on
paper. An in-app edge requirement may add no consent that is not already there,
in which case the real fix is notifying the volunteer rather than refusing the
org. Kept out of the block diff deliberately — different bug, different blast
radius. **Effort:** M.

### [P3] Unclaimed volunteers cannot reach the Leave control at all

`sendRosterAddedEmail` only fires for existing **ACTIVE** users — the
unclaimed-suppression guard blocks the other two add branches. A shadow user
created from a spreadsheet gets no email and has no account, so the population
with the weakest consent has no access to the remedy. Nothing about the block
changes this; it is v1b's `VolunteerActivationInvite` territory. Recorded here so
it is not rediscovered as a surprise. **Effort:** part of v1b.

### [P3] A block does not stop shift reminders or cross-org discovery

Both live outside `requireOrgVolunteerRelationship`, so neither is affected by a
block. Reminders are already suppressed for UNCLAIMED users but not for a
claimed volunteer who left, and `volunteerDiscoveryRepo` filters on profile
visibility rather than on any org relationship. Scoped out of this ship to keep
the diff to one authorization predicate. **Effort:** S each.

### [P2] `qc.invalidateQueries()` with no arguments on the profile page

Pre-existing (`profile/page.tsx`, the `updateMyProfile` `onSuccess`), not
introduced here, but this ship adds a second query to its blast radius. Saving a
bio now also refetches the roster-membership list, plus every other mounted query
app-wide. The new code is already the good citizen — it scopes to
`utils.profile.listMyOrgMemberships.invalidate()`. Fix is to make the old call
site match. **Effort:** S.

### [P3] `form.watch('bio')` re-renders the whole profile page per keystroke

Also pre-existing. `React.memo` on the new section was tried and reverted: it
blocks the parent-driven re-render the component tests rely on, and it treats one
child while the rest of the page still re-renders. The root fix is to extract the
bio character counter into its own component that owns the subscription.
**Effort:** S.

### [P3] Two `Organizations` labels on `/app/profile` disagree

The stat card counts `OrganizationMember` (staff membership) and reads
`Organizations`; the new section counts roster rows and reads `Organizations you
volunteer with`. A pure volunteer on two rosters sees "0 Organizations" in the
larger, higher stat card and two named orgs below it. The new section was named
defensively, but the stat card is the one that is wrong for volunteers — it
should read `Staff roles`. Not renamed here because that card predates this work
and is read by other roles. **Effort:** S.

### [P3] No e2e coverage of the leave flow

`e2e/staff-created-volunteers.spec.ts` covers add → assign → attend → hours but
not the volunteer's exit. Two flows worth a spec: two-tab concurrency (leave in
one, click Leave in the other), and roster email → `/app/profile` → leave → row
gone from the staff roster page. Manually driven during this ship against the dev
server; not automated. **Effort:** M.

---

## Deferred from the T15 identity-e2e ship (2026-07-28, v0.35.1.0)

Shipped: `e2e/staff-created-volunteers.spec.ts` (2 tests), `mintMagicLinkUrl()` in
`e2e/utils/db.ts`, and `src/server/auth-account-linking.integration.test.ts`
(8 tests driving next-auth's real `callbackHandler`).

### [P2] `/for/nonprofits` renders a marketing image the browser never decodes

**Pre-existing, unrelated to this ship** — reproduced on a clean checkout of `main`
with the T15 changes stashed. `e2e/public-pages.spec.ts:163` ("all marketing images
on /for/nonprofits render with natural size") fails: image 0 passes `toBeVisible()`
but `naturalWidth` stays `0` for the full 15s budget. Not a cold-compile flake — it
reproduces with a warm optimizer cache, and the **dark-mode counterpart on the same
page passes**, as do the light-mode assertions on every other page in
`SCREENSHOT_PAGES`.

Ruled out: the asset exists (`public/marketing/applications-queue.png`, 122KB) and
`/_next/image?url=%2Fmarketing%2Fapplications-queue.png&w=3840&q=75` returns
`200 image/png`, 35KB. So the bytes are served and something on the page side stops
the decode. Worth checking whether the light/dark pair on this page is wired the
opposite way round from the others (`dark:hidden` vs `hidden dark:block`), which
would make the *hidden* variant image 0 and give exactly this signature.

If it is a real rendering bug it is user-facing on a public marketing page. Left out
of the T15 diff deliberately — folding an unrelated marketing fix into a
test-coverage ship would have obscured both. **Effort:** S to diagnose.

### [P3] e2e still does not run in CI, so the identity spec is a manual gate

The Google half of T15 was deliberately routed to the integration suite partly
because that suite *does* run in CI. The magic-link half cannot be: it needs a booted
dev server, a browser, and `pnpm seed:dev`. So the one test that proves the real
NextAuth callback chain works only runs when someone types `pnpm e2e`. Same
constraint noted in the v0.34.0.0 CI entry. **Effort:** M.

### [P3] `signUpForShift` / `cancelSignup` / the waitlist pair still have no direct service tests

T14's remaining half, unchanged by this ship and explicitly left out of it. They are
covered only indirectly via `shiftSignupDisclosure.test.ts` and
`shiftOrgScoping.test.ts`. **Effort:** M.

---

## Deferred from the E1a roster-convergence ship (2026-07-28, v0.34.0.0)

Shipped: E1a (roster rows on approval + on claim), the four correctness-debt
items from the application-claim ship, and the CI workflow. See those entries
below, now struck through.

### Caught by review in this same ship — fixed, recorded so they are not reintroduced

Three reviewers ran over the diff. Two findings were real defects in the new code
and one disproved a claim the migration made.

- **Declining was terminal for the LISTING but not for the MUTATION.**
  `declinedAt: null` went into `listClaimableApplicationsByEmail` but not into
  `claimApplicationForUser`'s `where`. With `/app/my-applications` open in two
  tabs, a user could decline in one and then claim the same id from the other's
  stale cache — binding, and minting the `APPLICATION` authorization edge for, the
  exact application they had just refused, and leaving the row with both
  `declinedAt` and `submittedByUserId` set. All three reviewers found this
  independently. Fixed; pinned by `SECURITY: a declined application can no longer
  be CLAIMED` in `applicationClaim.integration.test.ts`, which was
  mutation-verified (exactly one failure with the predicate removed).

- **`CREATE INDEX` would have blocked writes for the whole index build.** The
  migration claimed CONCURRENTLY was unnecessary because the `ADD COLUMN`s "already
  take ACCESS EXCLUSIVE in the same transaction". **Prisma does not wrap a
  migration file in a transaction** — proved by `20260421151557`, which combines
  `ALTER TYPE ... ADD VALUE` with `CREATE INDEX CONCURRENTLY`, both illegal inside
  a transaction block, and applies cleanly (this repo even has a `-- DropTransaction`
  comment convention for it). So the lock is released per statement and a plain
  `CREATE INDEX` takes a fresh SHARE lock, blocking every new application and
  every staff status change on `VolunteerApplication` for the build. Split into
  `20260727210100_add_claimable_index_concurrently`, and the FK is now added
  `NOT VALID` then `VALIDATE`d there, since a validated FK triggers a full
  `RI_Initial_Check` scan that all-NULL values do not exempt it from.

- **`isUniqueViolationOn`'s `modelName` parameter made the `constraint` argument
  dead.** It short-circuited on a model match before consulting the constraint, so
  both call sites passed a constraint that was never read — making the function's
  own docstring false. Safe only because each model owns exactly one unique index
  today. Signature is now two-arg with the constraint authoritative; `modelName`
  survives only as a coarse fallback derived from the constraint's own prefix, so
  the two cannot drift. New `src/server/lib/__tests__/prisma-errors.test.ts` covers
  the case that was wrong — two constraints on the *same* model — which no
  existing test did.

Also from review, smaller: `memberService.acceptInvitation` now throws
`TRPCError PRECONDITION_FAILED` rather than a plain `Error` (tRPC maps plain
Errors to INTERNAL_SERVER_ERROR, reporting a fact about the caller's own account
as a server fault and getting it redacted by `safeErrorMessage`); the decline
confirm row asks "Remove this from your list?" instead of asserting "We won't
offer this one again." while the alert beside it might be reporting failure; the
`impersonatedBy` ternary in `routers/company.ts` is now the shared helper at all
four call sites — where a local `const effectiveUserId` had also been shadowing
the imported function; and the P2002 test fixture is shared from
`src/test/prisma-error-fixtures.ts` rather than existing as two divergent copies
of an empirically-discovered shape.

### [P2] CI has no `pnpm build` step
Raised in review and worth acting on: this repo has a documented history of
Turbopack-dev-only bugs, and nothing in CI compiles the app, so a build break
reaches Vercel unchallenged. Not added here because `pnpm build` runs
`scripts/vercel-build.sh`, which also seeds — a CI build job wants
`pnpm next build` against the service container plus whatever env the build reads,
and adding an unverified job would land CI red on its first run. **Effort:** S.

### The design doc's prescribed E1a shape does not work — corrected in code
`docs/designs/staff-created-volunteers.md` §5 and this file both specified
`findFirst({ orgId, userId, deletedAt: null })` then `create` with a **P2002
catch**, inside the approval/claim transaction. That cannot work, and it is worth
recording why so it is not "restored" later.

**Verified against this database:** swallowing a P2002 inside
`prisma.$transaction` and issuing any further statement fails with `current
transaction is aborted, commands ignored until end of transaction block`. In
Postgres a failed statement poisons the whole transaction. Since the enclosing
transaction must COMMIT — it carries the application approval, or the claim and its
audit row — a concurrent roster race would have rolled the approval back.

`createMany({ skipDuplicates: true })` compiles to `ON CONFLICT DO NOTHING`, which
the server resolves without raising, so the transaction survives. Also verified
that it honours the hand-written PARTIAL index, so a soft-deleted row does not
suppress a fresh insert. Both facts are pinned by
`repositories/appliedRoster.integration.test.ts`, including a test that
deliberately reproduces the abort.

`addVolunteer` keeps its catch-outside-the-transaction shape, correctly: there the
duplicate IS the answer the coordinator needs ("Already on your roster").

### Roster creation is gated on the TRANSITION into APPROVED, not the status
`updateOrgApplicationStatus` is **not idempotent** — re-saving an already-APPROVED
application re-runs the update and re-writes `STATUS_CHANGED`. Gating on
`status === 'APPROVED'` alone would therefore resurrect a volunteer a coordinator
had deliberately removed, because the soft-deleted roster row does not block a
fresh insert. The gate is `previousStatus !== 'APPROVED'`, matching the guard
`notifyApplicationStatusChange` already uses three lines away. A genuine
REJECTED→APPROVED or REVIEW→APPROVED transition *does* re-add, because that is an
affirmative act. Pinned by `screener-queries.approvalRoster.test.ts`.

### [P3] `company.ts` still inlines the `impersonatedBy` ternary at three call sites
`src/server/trpc/audit-actor.ts` now holds `effectiveUserId()` / `impersonatedBy()`,
extracted because a third copy was about to be written. `routers/volunteers.ts`
and `routers/screener.ts` use it; `routers/company.ts` still has the expression
inlined at its other call sites (`switchCompany`, `linkNonprofit`, `unlinkNonprofit`,
`invite`) and was left alone to keep this diff focused. Getting that ternary
subtly wrong is **silent** — omitting the `!== effective` comparison marks every
audit row as impersonated and makes `queryAuditLog`'s `impersonatedOnly` filter
useless — so it should exist once. **Fix:** replace those four with the shared
helper. **Effort:** S.

### [P3] `VolunteerApplication` has no `createdAt`/`updatedAt`
Noticed while adding `declinedAt`. The model has `submittedAt` only, against
CLAUDE.md's "every table gets createdAt, updatedAt, and if relevant deletedAt".
Pre-existing and out of scope here; a backfill would have to decide what
`createdAt` means for historical rows (presumably `submittedAt`). **Effort:** S.

### [P2] E1a is not yet covered end to end by an automated test
Both paths were verified against a real database by a throwaway script during the
ship — 17 assertions covering approval, the transition gate, removal
non-resurrection, claim of a pre-approved orphan, the `User.name === null`
displayName fallback, decline suppression, and cross-user decline refusal — but
that script was deleted rather than committed, because it drove services directly
rather than going through HTTP. The unit and integration layers cover the pieces;
nothing covers "approve in the UI, see them on `/app/volunteers`". Natural
companion to the T15 e2e spec. **Effort:** M.

**Narrowed by T15 (v0.35.1.0)**, not closed. `e2e/staff-created-volunteers.spec.ts`
now covers the *staff-added* entry to the roster through the UI (add → assign →
attend → hours). The **approval** entry — E1a's actual subject,
`ensureAppliedRosterRow()` firing from `updateOrgApplicationStatus()` — is still
uncovered end to end, as is the claim path. Adding them is a third test in that same
file rather than new scaffolding.

---

## Deferred from the application-claim ship (`/ship`, 2026-07-27)

Found by the 7-specialist review of the `linkApplicationsToUser()` fix. The two
CRITICALs that review caught (an `ILIKE` wildcard hole and an impersonation
identity split) were fixed in that diff; these are what was left.

**The headline lesson, worth reading before touching any email predicate:**
`mode: 'insensitive'` in Prisma compiles to `ILIKE $1` with the value
interpolated **unescaped**. `_` and `%` become wildcards, and `_` is legal in an
address `zod.email()` accepts. Used on an authorization predicate that is a
hole — verified in Postgres: `'jason.shultz@x' ILIKE 'jason_shultz@x'` is TRUE.
Never use it to compare identities. Three regression tests in
`applicationClaim.integration.test.ts` pin this; all three go red if the
`insensitive` mode is reintroduced.

### [P2] ~~`volunteerDashboardService` still email-matches orphan applications~~
✅ **FIXED (v0.34.0.0).** Both sites now filter on `submittedByUserId: userId`
alone, and the `email` parameter is **gone from the signature** — while it
existed, every call site was one `session.user.email` away from restoring the
leak.

**The report understated it.** It described spoofing/phishing only. The `email`
argument was `session.user?.email` (`routers/volunteer.ts:14`), which under
impersonation is the **real admin's** while `userId` is the target's — so this was
also an impersonation identity split of exactly the class fixed in the claim path,
leaking the admin's own unlinked applications into the target's dashboard.
Covered by two tests in `volunteerDashboardService.test.ts`, one asserting the
function's arity so the parameter cannot quietly come back.

### [P2] ~~The consent card has no decline path~~ ✅ FIXED (v0.34.0.0)
`declinedByUserId` / `declinedAt` on `VolunteerApplication` (migration
`20260727210000`), `declineApplicationForUser()` enforcing the same email
predicate **inside the `where`** as the claim, a `declineApplication()` service
writing an `APPLICATION_CLAIM_DECLINED` audit row, `screener.declineApplication`
at the same rate limit as the claim, and an equal-weight "Not mine" with inline
confirmation.

Decisions worth not re-litigating:
- **Two columns, not a join table.** `User.email` is unique and canonicalized and
  claimability is email equality, so for any given orphan row there is exactly
  ONE user who could ever claim it. A join table models a many-to-many that
  cannot exist.
- **Equal visual weight, pinned by a test** comparing the two buttons'
  `className`. Declining is the SAFE action on this card, so it must not read as
  weaker or more dangerous than accepting — which is also why it is not
  `variant="destructive"` until the confirm step.
- **Inline confirmation, not a modal.** There is no `AlertDialog` primitive or
  radix dep for one, and inline keeps the org name — the entire basis for the
  decision — on screen.
- Declining also frees a slot in the `CLAIMABLE_LIST_CAP` starvation window that
  `listClaimableApplicationsByEmail` documents as needing exactly this.

The same migration adds a partial index `VolunteerApplication_claimable`: there
was **no index on `submittedByEmail` at all**, so the claimable lookup — run by
any signed-in user on every `/app/my-applications` load — scanned the whole table.
Pre-existing; found while adding `declinedAt` to that predicate.

### [P2] ~~`claimApplication` does not handle P2002 on the partial unique index~~ ✅ FIXED (v0.34.0.0)
**Mapped to CONFLICT, not the NOT_FOUND this entry prescribed** — deliberately,
with sign-off. To reach the P2002 the caller must already have passed the email
predicate in the repository's `where`, so the row IS theirs and the collision is
with their **own** other active application for the same opportunity. Nothing
about a third party is disclosed, so the indistinguishability argument does not
apply here; it still governs the `!row` branch, which is the one an id probe
reaches. NOT_FOUND would have been a dead end the user cannot act on.

Narrowed by constraint name via a new shared `isUniqueViolationOn()` in
`src/server/lib/prisma-errors.ts`, which also absorbed the duplicated detector
from `staffVolunteerService.isRosterDuplicate` (the PrismaPg adapter does not
populate `meta.target`; see that file's comment).

### [P2] ~~Integration tests are the only proof of the email predicate, and nothing runs them~~ ✅ FIXED (v0.34.0.0)
`.github/workflows/ci.yml`: a `static` job (`pnpm lint`, `pnpm typecheck`) and a
`test` job running `pnpm test`, `pnpm test:scripts` and `pnpm test:integration`
against a `postgres:16-alpine` service container, on PRs to `main` and pushes to
`main`. `prisma migrate deploy`, never `db push` — several migrations are
hand-written SQL (triggers, functional and partial indexes) that a schema diff
would silently omit, and those are exactly what the integration specs assert.

e2e is deliberately **not** included: it needs Playwright browsers, a booted dev
server and `seed:dev` data. It belongs with the T15 spec.

Two things surfaced while wiring this up:
- **`pnpm lint` had never been green.** It runs `biome check .` across the whole
  repo while `check`/`format` scope to `src docs prisma/schema.prisma`, so
  `package.json` had been failing the formatter indefinitely. Formatted
  (whitespace only) so the CI gate actually means something.
- **The integration suite had no local-database guard**, unlike `e2e/utils/db.ts`.
  It cleans up with prefix-scoped `deleteMany` sweeps, so a misconfigured
  `DATABASE_URL` would delete matching rows in whatever it pointed at. Guard added
  at module scope in `src/test/integration-setup.ts` (so it fails before any
  `beforeAll` can write), overridable with `INTEGRATION_ALLOW_REMOTE_DB=1`. This
  mattered more once CI began supplying `DATABASE_URL` from the environment rather
  than from a developer's `.env.local`.

### [P3] One more case-sensitivity divergence — and this entry was wrong twice
**Corrected 2026-07-27 by the red-team re-review.** The original text said the
remaining divergences were `volunteerStatusRepo.ts:7` and
`bulk-import-service.ts:126`, fixable by a one-time row backfill. Both halves
were wrong:

- `bulk-import-service.ts` is **fine** — `parseCsv` already lowercases at line 57.
- The problem is **input-side, not row-side**, so backfilling historical rows
  fixes nothing: every future mixed-case request still misses. The reader
  compares a raw user-typed address against canonical storage.

Still open: `volunteerStatusRepo.ts:7`, fed the raw `StatusToken.email` from
`publicStatusService.ts:19` — the public `/apply/status` lookup returns "no
applications" for anyone who typed their address with capitals. **Fix:**
normalize at the input boundary (`.transform(normalizeEmail)` on the token
request), not with a backfill. **Effort:** S.

(The third divergence, `checkAnonymousApplication`, was found and fixed in this
same ship — it had been actively regressed by adding `.transform` to `submit`
without adding it to the sibling reader.)

### [P2] ~~Two pre-existing procedures have the same id/email split just fixed here~~ ✅ FIXED (v0.34.0.0)
Both `acceptInvitation` (`memberService.ts`) and `acceptCompanyInvite`
(`companyService.ts`) **dropped the `userEmail` parameter entirely** and resolve
the address with `findEmailByUserId(userId)`, so the id and the address cannot
describe two people. Comparison is `normalizeEmail()` on both sides, not the
previous bare `.toLowerCase()`, so a legacy non-canonicalized invitation row still
matches. Both refuse with a specific error when the accepting account has no
address on file, rather than falling through to a comparison against `''`.

`company.acceptInvite` also now passes `impersonatedBy` — the service already
supported it and wrote it to the audit metadata; the router simply never wired it
up for accept, unlike `invite`.

**One correction to the report:** the Server Component at
`src/app/invite/company/[token]/page.tsx` was already doing this correctly, and
was the only caller that did. It looked the address up from the effective user id
by hand — which also put a Prisma call in `app/**`. That block is now dead code
and deleted. The live bug was reachable through the tRPC procedure only.

Covered by `services/__tests__/inviteAcceptIdentity.test.ts` (11 tests, both
invitation types). The page's own security test was rewritten rather than deleted:
it now asserts the page passes the TARGET id and **no** email at all, which is
what stops the by-hand lookup being reintroduced alongside the service's.

<details><summary>Original report</summary>
Out of this diff, but the identical bug class. `members.ts:77` passes
`ctx.session?.user?.email` alongside `ctx.session?.user?.id` into
`acceptInvitation`, which authorizes on the **email**
(`memberService.ts:98`) but creates the row for the **id**
(`memberService.ts:120`). `company.ts:140` does the same in `acceptInvite`
(`companyService.ts:308`). Under impersonation the email is the real admin's and
the id is the target's, so an admin holding an invitation addressed to
themselves can mint an `OrganizationMember` row for the impersonated victim —
and `ORG_MEMBER` is one of the kinds `requireOrgVolunteerRelationship()` accepts
as authorization. Notable that `company.ts` already knows about impersonation
(it stamps `impersonatedBy` at line 127) and still pairs the two identities
here. **Fix:** resolve the address with `findEmailByUserId(userId)`, exactly as
the claim path now does. **Effort:** S each.
</details>

### [P2] The claimable list is still starvable — ordering only narrowed it
**Corrected 2026-07-28.** An earlier version of this entry said oldest-first
ordering meant "a flood cannot bury a genuine row." That overstated it, and the
overstatement is the dangerous part: it reads as closed.

A cap over an attacker-controllable list is starvable from whichever end gets
dropped; ordering only picks the end. `desc` dropped the oldest row, so an
attacker could bury an application that already existed. `asc` drops the newest,
so the attacker must **pre-plant** `CLAIMABLE_LIST_CAP` rows against an address
*before* its owner applies — costlier (needs foreknowledge, ~17 min at
`screener.submit`'s 3/min/IP limit) but not prevented. The
`(submittedByUserId, opportunityId)` partial unique index does not dedupe these,
because NULLs never conflict. A dropped row is unclaimable: deleting
`linkApplicationsToUser()` removed the only other bind path.

The integration test pins only the post-planting direction ("a flood of newer
rows cannot bury an older genuine one"); the pre-plant case is uncovered.

**Fix (ordering cannot do it):** ship the deferred decline path so declining
frees a slot, and/or bound per `(email, orgId)` so one org cannot consume every
slot. Also surface truncation — past the cap a user sees a partial list
presented as complete; return `total`/`hasMore` and render "showing 50 of N".
**Effort:** M.

### [P3] Index `submittedByEmail` before ~250k rows
Now that the query is plain equality it is finally indexable. Measured on a
500k-row synthetic clone: seq scan 16 ms, exact-equality-with-btree 0.043 ms.
Comfortable under ~250k rows, noticeable at 500k. **Fix:** partial index matching
the predicate — `CREATE INDEX CONCURRENTLY "VolunteerApplication_submittedByEmail_unclaimed_idx" ON "VolunteerApplication" ("submittedByEmail") WHERE "submittedByUserId" IS NULL;`
Hand-write it (CONCURRENTLY is the P3006 that breaks `prisma migrate dev` here).
**Effort:** S.

### [P3] `APPLICATION_CLAIMED` carries no `impersonatedBy`
A claim taken while impersonating is attributed solely to the impersonated user.
Every other identity-binding mutation stamps the real admin — `volunteers.ts:69`
has the house helper. Note `ctx.realUserId` is set on EVERY logged-in request, so
it must be compared, not truth-tested. **Effort:** S.

### [P3] Design/a11y polish on the consent card
Deferred from the design specialist: focus is dropped to `<body>` when a claimed
row unmounts; no `aria-live` success announcement; `disabled={claim.isPending}`
greys every row at once with no per-row spinner; `size="sm"` is 32px against a
44px touch target on a phone-first surface; a plain `<Card>` gives a consent
decision the same visual weight as the Status legend (the repo's `warning`
register would fit); and the copy could name what "your volunteer profile"
discloses and that the action has no undo. **Effort:** M total.

### [P3] Small cleanups in the claim path
`listClaimableApplications`'s `.map()` is a no-op identity mapper over the repo's
own `select`. `claimApplicationForUser`'s `tx` defaults to `prisma`, which
undercuts the atomicity invariant its own docstring asserts — a future 3-arg
caller would bind with no audit row and no type error; make it required and have
the integration test pass `prisma` explicitly. **Effort:** S.

---

## Deferred from the unclaimed-identity ship (Lane C, 2026-07-27, v0.33.0.0)

### [P3] A never-claiming volunteer accumulates one `SUPPRESSED_UNCLAIMED` row per cron run

Three of the four opted-in senders — `digest-service.ts`, `reengagement-service.ts`,
`opportunityDigestService.ts` — gate their "mark as sent" bookkeeping on `sendEmail`'s
boolean, and the unclaimed guard returns `false`. The record therefore stays eligible,
which is **deliberate and correct**: the moment the volunteer claims their account, the
digest or nudge they were owed goes out. The cost is that a volunteer who never claims is
re-attempted on every run forever, writing a fresh `SUPPRESSED_UNCLAIMED` row each time.

Two reviewers split on this: one read it as unbounded row growth to fix, the other as the
right retry semantics. Both are right about their half. The retry behaviour should stay;
what's missing is a bound on the observability rows.

`shift-reminder-service.ts` is deliberately different — it stamps `reminderSentAt`
unconditionally (pre-existing), because a reminder is tied to one shift at one time and is
worthless later.

Note this is not new: bounce-suppressed addresses have had the same unbounded retry since
that guard shipped, minus the rows (bounce suppression writes no `EmailEvent`).

**Fix when it matters:** collapse repeats — either skip the write when an identical
`(to, subject, SUPPRESSED_UNCLAIMED)` row already exists within some window, or add a
retention sweep to the existing cleanup cron (`EmailEvent` has `@@index([createdAt])`
already, and nothing prunes that table today — pre-existing). Do **not** "fix" it by
stamping the senders' bookkeeping on suppression; that trades a cheap row for a volunteer
silently never receiving mail they became eligible for. The clean fix is a discriminated
result from `sendEmail` (`sent | suppressed | failed`) so callers can tell "decided not to"
from "try again". **Effort:** S.

**Currently latent, which is why this is P3 and not P2.** `UserDigestPreference` rows are
only created by a user-initiated upsert, and re-engagement iterates `OrganizationMember` —
neither is reachable by a staff-created volunteer, whose edge is an `OrgVolunteer` row. The
one live path is shift reminders, which stamps `reminderSentAt` unconditionally and so
writes exactly one row per suppression. This becomes active the moment a roster volunteer
gains a digest preference or an org membership.

### [P3] `sendEmail` re-fetches a `User` the four cron senders already hold

The unclaimed guard looks the recipient up by email inside `sendEmail`, but all four
opted-in senders already load that user through an included relation. Roughly 15k extra
single-row indexed lookups/day (~0.2 qps), and the `Promise.all` means the added wall-clock
is near zero against the Resend HTTP call that dominates each iteration — so this is a
tidiness item, not a hot spot. Deliberately centralized so a sender cannot forget to guard.

**Fix when it matters:** add an optional `recipientAccountState` hint to `sendEmail` and
have the four senders widen their existing `user: { select: ... }`. Keep the lookup as the
fallback — a sender that omits the hint must still be guarded, not silently unguarded.
Confirmed indexed: the query is a bare column equality against `User_email_key`, not the
functional `lower(btrim(email))` index. **Effort:** S.

### [P2] Sign-in-chain behaviour is asserted against source-reading, not execution

T5/T6 rest on two claims about next-auth 4.24.14 internals: that `events.signIn` fires on
the Google linking path where `events.updateUser` does not, and that
`allowDangerousEmailAccountLinking` links rather than throwing. Both were verified by
reading `node_modules`, and the tests assert our *config object* — so a next-auth upgrade
that changes either would ship green. T15 (`e2e/staff-created-volunteers.spec.ts`) is the
task that closes this; the repo has zero e2e coverage of the real callback chain today
(`e2e/utils/db.ts` mints `Session` rows directly). **Effort:** M, owned by T15.

---

## Deferred from the shift org-scoping ship (`/ship`, 2026-07-27, v0.32.2.0)

Found by five specialists plus a Codex adversarial pass while reviewing the
eleven-IDOR fix. None were in that diff's blast radius; all three are the same
bug class.

**Status: all four are FIXED.** The two shift items and the vitest config
shipped in v0.32.3.0 (#160); the `inviteToApply` race shipped separately in
v0.32.4.0 (#161), because it introduces an advisory lock and warranted its own
review. Two of the four turned out to be wider or more severe than reported —
see the note on each. Original reports are kept in `<details>` blocks rather
than deleted.

- **[P1] ~~`shifts.create` accepts a foreign `opportunityId`~~** ✅ **FIXED** —
  closed by `requireOrgOpportunity()` in `shiftAccessService.ts`, wired into
  `createNewShift`, `updateExistingShift`, `createNewTemplate` and
  `updateExistingTemplate`. Scope was wider than this entry described: the
  relation is also included by `listUpcomingShiftsForOrg`, and
  `updateShiftTemplateSchema` is `createShiftTemplateSchema.partial()`, so
  template **update** carried the same hole on a template the caller genuinely
  owns. `shifts.update` gained a nullable `opportunityId` (previously the link
  was set-once at create and could never be changed or cleared). Covered by
  `services/__tests__/shiftOpportunityScoping.test.ts`.

  <details><summary>Original report</summary>
  `src/server/trpc/routers/shifts.ts:73` takes `opportunityId` from client input
  and `createNewShift` passes it to `createShift` with only `orgId: ctx.orgId`
  stamped. Nothing checks the opportunity belongs to the caller's org. Because
  `listShiftsByOrg` and `getShiftWithSignups` both
  `include: { opportunity: { select: { id: true, title: true } } }`, staff at
  org A can create a shift pointing at org B's opportunity and read B's
  opportunity title back through their own (legitimately scoped) shift list —
  so the v0.32.2.0 guard does not help, because the leaked row is reached by
  relation, not by id. `createShiftTemplateSchema`
  (`src/server/domain/shift.ts:236`) has the same hole, and
  `listTemplatesByOrg` includes the same relation. **Fix:** the same
  `where: { id: opportunityId, orgId }` check `inviteToApply` now uses — or
  `getOpportunity(id, orgId)` from `opportunityRepo`. **Effort:** S.
  </details>

- **[P2] ~~`getCheckinToken` and `selfCheckin` leak shift existence and
  status~~** ✅ **FIXED** — `getCheckinToken` now calls a new
  `requireOwnSignup()` guard before reading any shift state. `selfCheckin` got
  no guard: its check-in token is an HMAC over `(shiftId, userId, window)`, so
  validating it *is* the authorization, and moving that validation ahead of the
  shift lookup closes the leak with zero extra queries. The two procedures are
  authorized by different mechanisms and deliberately do not share a guard.
  `signUpForShift`/`joinWaitlist` were handled differently again — they stay
  open to any authenticated user by product decision, so the fix is an error
  mapping (`mapSignupFailure`) that collapses administrative facts
  (CANCELLED/COMPLETED) into the missing-shift NOT_FOUND while keeping capacity
  and caller-self facts specific, plus a `rateLimitByUser` throttle.
  `cancelSignup`/`leaveWaitlist` had the same ordering bug and were reordered
  too. **Known trade-off:** a legitimate volunteer whose shift is cancelled now
  sees "Shift not found." — unobservable today (no UI calls these), but the
  future self-serve flow should re-derive that message from data the caller is
  already entitled to rather than un-collapsing the mapping. Covered by
  `services/__tests__/shiftSignupDisclosure.test.ts` and new ordering tests in
  `routers/shifts.access.test.ts`.

  <details><summary>Original report</summary>

  `routers/shifts.ts:224` and `:320` load the shift
  by raw client id and branch on status *before* checking the caller has a
  signup, returning distinct messages: NOT_FOUND if missing, then
  `` `Shift is ${status}.` ``, then "QR code is available 24 hours before the
  shift", and only then FORBIDDEN for no signup. Any logged-in volunteer can
  learn, for an arbitrary shift id at an arbitrary org, that it exists, its
  exact status, and whether it starts within 24h. This directly contradicts the
  indistinguishability invariant v0.32.2.0 establishes on the same router.
  `signUpForShift` (`shiftSignupService.ts:76`) leaks the same way and is an
  unrate-limited write that puts the caller's name and email on an arbitrary
  org's roster. **Fix:** move the signup check ahead of the status/timing
  branches. **Effort:** S.
  </details>

- **[P2] ~~`inviteToApply`'s rate limit is not actually atomic~~** ✅ **FIXED** —
  closed by `lockOrgForInviteRateLimit()` in the new
  `repositories/volunteerInvitationRepo.ts`, a per-org
  `pg_advisory_xact_lock` taken as the first statement inside the existing
  transaction. No migration, no retry loop, and the rolling-24h semantics are
  unchanged.

  **The severity was understated.** The report predicted "the 10th and 11th
  invitations". Measured against a real database, five callers racing for one
  remaining slot from a seeded 9 produced **14 invitations against a 10/day
  cap** — every racer read 9 and every racer committed. The integration test
  fails 5 runs out of 5 with the lock removed.

  Two alternatives were considered and rejected, recorded so they are not
  rediscovered: `SERIALIZABLE` needs retry-on-40001 machinery that exists
  nowhere in this repo and can abort invitations that are not over quota at
  all, on predicate overlap alone. A counter table would silently convert the
  rolling 24h window into a calendar-day bucket, gameable with 10 invitations
  at 23:59 and 10 more at 00:01 — there is now a test pinning the rolling
  semantics specifically so that swap cannot be made silently.

  The Upstash limiter is **not** usable for this and never was:
  `src/server/lib/rate-limit.ts` fails **open** when `UPSTASH_REDIS_REST_URL`
  is unset, so it disables itself in dev, CI, and any deploy missing the env
  var. It stays appropriate for burst throttling, which is a different job.

- **[P3] ~~`vitest.integration.config.mts` serialization is silently dead~~**
  ✅ **FIXED** — `poolOptions: { forks: { singleFork: true } }` (removed in
  Vitest 4, so silently ignored) replaced with `fileParallelism: false`.
  Integration files now serialize by construction rather than by every file
  happening to use a distinct table prefix.

---

## Specialist review findings (`/ship`, 2026-07-27, branch thehashrocket/staff-created-volunteers-review)

Five specialists ran against the staff-created-volunteers foundation PR (v0.32.0.0).
Five CRITICALs were found and **all fixed in that PR**; the items below are the
deferred INFORMATIONAL findings, kept because each touches files outside that PR.

### [P2] Nav layout resolves the feature flag against the wrong org on impersonation failure
**Priority:** P2
**Tracked as:** [#157](https://github.com/thehashrocket/volunteerready.org/issues/157)
`app/(app)/app/volunteers/layout.tsx` was fixed in v0.32.0.0 to check
`impersonation.resolutionFailed` before deriving the effective user. Its sibling
`app/(app)/app/layout.tsx` was NOT — on a failed impersonation
`getImpersonationContext()` returns `isImpersonating: false` with
`resolutionFailed: true`, so the layout falls through to `session.user.id` (the
REAL admin), resolves `activeOrgId` from the admin's memberships, and evaluates
`staff_created_volunteers` against the admin's own org.

**Impact is cosmetic, not a leak:** the route guard fails closed independently,
so the nav item may appear but clicking it redirects to `/app`. No cross-tenant
data is served.

**Why it was left:** CLAUDE.md states that read-only nav/banner rendering via
`getImpersonationContext()` may ignore `resolutionFailed`, and `hasOrg` /
`hasCompany` in that same layout already fall through the same way (documented
in the v0.31.0.0 note). v0.32.0.0 added a *feature-flag lookup* to that layout,
which is arguably more than nav rendering — hence this item.

**Fix:** extract the shared `getActiveOrgContext()` helper already filed below
and have it return `resolutionFailed`, so both layouts make one decision instead
of two. Doing it as part of that extraction avoids touching the impersonation
fallback twice.

### [P2] Six hand-rolled copies of the same timing-safe comparison
**Priority:** P2
`timingSafeCompare` now exists, character-for-character, in six places:
`api/resend/webhook/route.ts`, `adapters/background-check/checkr.ts`,
`adapters/background-check/sterling.ts`, `lib/case-study-token.ts`,
`lib/digest-unsubscribe-token.ts`, and `lib/checkin-token.ts`. Six copies of a
security primitive is six chances to omit the length pre-check, and omitting it
makes `timingSafeEqual` **throw** instead of returning false. Extract to
`src/server/lib/crypto-compare.ts` and have all six call it.

### [P2] Active-org resolution now exists in three places with different rules
**Priority:** P2
`auth.ts` (session callback), `trpc/init.ts` (tRPC context) and the new pure
`domain/active-org.ts` each decide "which org is this user acting as". The first
two assign `currentOrgId` unconditionally; the new one additionally verifies the
membership still exists. That divergence is deliberate and documented — it gates
an access decision — but three copies of one rule will drift. Have `init.ts` and
`auth.ts` call `resolveActiveOrgId()`.

### [P2] The two SSR layouts duplicate the whole active-org block
**Priority:** P2
`app/(app)/app/layout.tsx` and `app/(app)/app/volunteers/layout.tsx` repeat the
same ~10 lines (resolve effective user → load membership ids → resolve active
org). One drives nav visibility and the other the route guard, so drift produces
a nav item linking to a page that redirects. Extract
`getActiveOrgContext()` returning `{ effectiveUserId, membershipOrgIds, activeOrgId, resolutionFailed }`.

### [P3] `STAFF_CREATED_VOLUNTEERS_FLAG` is a second literal, not a derivation
**Priority:** P3
The constant exists so the app shell "cannot drift from the registry by typo",
but it is itself a hand-written copy of the same string and typed as plain
`string`. Rename the registry key and it still compiles while `isFeatureEnabled`
silently returns the default. Derive a `FeatureFlagKey` union from
`FEATURE_FLAG_REGISTRY` and type the constant against it.

### [P3] `getAuditActors` duplication and a hand-rolled ctx type
**Priority:** P3
`routers/volunteers.ts` re-implements the `impersonatedBy` expression from
`routers/company.ts` and declares a structural `AuditCtx` instead of the
inferred tRPC ctx, so a ctx shape change would leave it compiling against a
shape that no longer exists. Extract `getAuditActors(ctx)` into `trpc/init.ts`.

### [P3] `membershipRepo.ts` overlaps `orgRepo.ts`
**Priority:** P3
`orgRepo.getFirstOrgForUser()` already queries `OrganizationMember` with the same
`orderBy`. Two repositories now answer "what orgs does this user belong to".
Move `listMembershipOrgIds` into `orgRepo.ts` and delete `membershipRepo.ts`.

### [P3] `TxClient` type alias copy-pasted across repositories
**Priority:** P3
The same non-obvious conditional type over Prisma internals is declared in
`orgRepo.ts`, `orgVolunteerRepo.ts` and others. Declare it once in
`repositories/prisma.ts` so a Prisma major upgrade is a one-line change.

### [P3] Direct Prisma access inside `staffVolunteerService`
**Priority:** P3
CLAUDE.md says repositories own Prisma access, but the service calls
`tx.user.findUnique`, `tx.user.create`, `prisma.organization.findUnique` and
`prisma.user.findUnique` directly while routing everything else through
`orgVolunteerRepo`. ~20 existing services do the same, so this is established
(if non-conforming) practice — the sharper problem is the inconsistency *within
one new file*. Add a `userRepo.ts` accepting `TxClient`.

### [P3] Cross-file comments pin line numbers that will rot
**Priority:** P3
Several new comments reference `file.ts:40-75`-style ranges; at least one was
already off by one when written. Replace with symbol names, which survive edits
and are greppable.

### [P3] `EmailBounceStatus.email` is not canonicalized
**Priority:** P3
Deliberately excluded from the v0.32.0.0 backfill because it is UNIQUE (so
lowercasing needs a merge policy) and because `sendEmail` already looks it up as
`to.toLowerCase()` — mixed-case rows are invisible today either way. Worth doing
with an explicit merge rule (keep the highest `bounceCount`).

### [P3] Roster page: remove-flow and Load-more interactions untested
**Priority:** P3
`page.test.tsx` stubs the remove mutation with a throwaway `mutate` and never
captures `onSuccess`/`onError`, so the Remove click payload, the success toast +
`invalidate()`, the error branch, and the `Load more` click are all uncovered.
Use the callback-capture pattern from `AddVolunteerDialog.test.tsx`.

### [P3] `getRoster` / `getRosterCount` have no direct test
**Priority:** P3
Neither is imported by the service test, and the router test mocks them, so the
row mapping — including the `?? 0` default that makes the Shifts column render
`0` rather than blank — is unproven.

### [P3] `pickSurvivor` untested when 2+ rows are verified
**Priority:** P3
`verified.length === 1 ? verified : group` means a group with two verified rows
falls back to the whole group, so an *unverified* row can win on `createdAt` —
the opposite of the documented rule. Either add the case or document the
behaviour.

## Animal-shelters screenshot copy — found during `/document-release` (2026-07-14)

- **[P4] `/for/animal-shelters`'s first annotation label claims the captured
  screenshot shows an "approved" application status** (`src/app/(public)/for/animal-shelters/page.tsx`,
  the marker at x:72/y:46: `'Every application carries a clear status —
  approved, in review, or rejected — and why.'`), but the 3 applications
  seeded for that capture (`prisma/seed-dev.ts`, linked to `rasDogWalking`)
  are `SUBMITTED`/PASS, `REVIEW`/2 flags, and `REJECTED`/FAIL — no
  `APPROVED`-status row exists, so the badge visible at that marker position
  reads "Submitted", not "Approved" (`ApplicationStatusBadge`'s
  `statusConfig`, `src/components/my-applications/ApplicationStatusBadge.tsx`).
  Found by the Codex cross-model doc review while verifying this release's
  CHANGELOG entry, which had the same inaccuracy — the CHANGELOG wording was
  corrected in v0.29.0.0 (0.29.0.0 doc-sync commit) to say "submitted,
  flagged, and rejected" to match; the page copy itself is unchanged pending
  a product-copy fix (out of scope for a docs-only pass). **Start:** change
  the marker label to "submitted, in review, or rejected" (or recapture with
  a 4th application seeded at `APPROVED` status if showing all four states
  is preferred). **Effort:** XS | **Priority:** P4 | **Depends on:** None.

---

## ~~ESG Dashboard — regression found during `/ship` (2026-07-14)~~ ✅ Root-caused and fixed (2026-07-15, `/investigate`)

- ~~**[P0] BUG: `/app/company/[companyId]/esg` renders the generic volunteer
  app shell instead of the ESG report**~~ — **not an application bug.**
  Root cause: `e2e/esg-dashboard.spec.ts`'s `cleanup()` matched rows by the
  shared literal `__esg_e2e__` prefix and ran unscoped in `afterAll`.
  Playwright's `fullyParallel: true` runs this file's two tests in separate
  worker processes, each with its own `beforeAll`/`afterAll`. When the fast
  "non-member redirected" worker finished first, its `afterAll` cleanup swept
  *every* row matching the prefix — including the slower "loads real
  aggregates" worker's still-in-use session/company/user rows, deleted out
  from under it mid-test. That worker's subsequent requests resolved to an
  unauthenticated/company-less context, which is what rendered as the
  generic volunteer shell. Confirmed via `pid`-tagged logging in `cleanup()`:
  one worker's `afterAll` logged "about to delete 4 users" — 2 more than
  *its own* `beforeAll` had created — proving the cross-worker deletion.
  Reproduced deterministically (5/5) with default parallel workers, 0/5 with
  `--workers=1`, and 0/5 after the fix even at full default parallelism (also
  confirmed clean across all 48 e2e specs in the same run). This also
  explains why earlier sightings (2026-07-12 client-null-crash, 2026-07-13
  "wrong page rendered") looked like different bugs — same race, different
  point mid-render where the yanked session/company data got dereferenced.
  **Fix:** `e2e/esg-dashboard.spec.ts` now tracks the exact
  user/company/org IDs each worker's `beforeAll` creates and scopes
  `afterAll` cleanup to just those IDs (`cleanupIds()`); the shared-prefix
  sweep (`cleanupByPrefix()`) is now used only in `beforeAll`, before this
  run has created anything of its own, and is hardened with a 30-minute
  `createdAt` age cutoff (`STALE_LEFTOVER_MS`) so a late-starting
  `beforeAll` can't match a sibling's freshly created (seconds-old) rows —
  see the residual-risk note below for the narrow case this doesn't fully
  close.
  Validated with 16 consecutive passing runs at default parallel workers
  post-fix (vs. deterministic 3/3 failure pre-fix). **Effort:** S |
  **Priority:** P0 | **Depends on:** None.
  **Residual (accepted risk, adversarial review):** the 30-minute age gate
  narrows the original race to "practically impossible" rather than
  structurally eliminating it — a worker whose `beforeAll → test → afterAll`
  lifecycle somehow exceeded 30 minutes could still theoretically collide
  with `cleanupByPrefix()`. Playwright's default 30s per-test/hook timeout
  (no override in `playwright.config.ts`) already bounds this well below the
  30-minute window, and this race is local-only — `playwright.config.ts` sets
  `workers: 1` in CI, so cross-worker collision is structurally impossible
  there. Not actioned further; would need a per-run marker (e.g. a `runId`
  column) to close completely, which is disproportionate to the near-zero
  residual likelihood.

---

## Screenshot pipeline — test coverage gaps found during `/ship` (2026-07-14)

`/ship`'s test coverage audit (81% — above the 80% target) added the one cheap,
high-value regression test (FINDING-001's fix, in `screenshot-section.test.tsx`)
inline. These remaining gaps were lower-severity or non-trivial to test
correctly, so deferred rather than rushed:

- **[P3] `useVariantState`'s priority-gated pre-hydration check is untested**
  — `src/components/annotated-screenshot.tsx`'s `useEffect` that detects an
  image already broken before hydration (`el.complete && naturalWidth === 0`)
  has zero coverage for either branch (fires when `priority` + already-broken;
  stays silent when `!priority`). Non-trivial to test cleanly: by the time
  `render()` returns, the effect has already run, so simulating "broken
  before React attached listeners" needs either a custom ref/mock or
  `Object.defineProperty` tricks on the `<img>` node before commit. Worth
  doing carefully, not rushing.
- **[P3] `/for/animal-shelters` has no dedicated legend/marker e2e assertion**
  — its sibling pages (`/how-it-works`, `/screening`) get a targeted "exactly
  1 visible legend, 3 items" check in `e2e/public-pages.spec.ts`; the
  animal-shelters page only gets the generic image-count check from
  `SCREENSHOT_PAGES`. Mechanical addition, same pattern as the existing
  `how-it-works / screening annotations` describe block.
- **[P4] `seed-dev.ts`'s devOrg rename + new shelter opportunities have no
  automated assertion** outside the manual `pnpm screenshots` pipeline —
  consistent with this repo's existing convention of not unit-testing seed
  scripts, so low priority, but flagging since a future seed refactor could
  silently break the shelter screenshot's content without any test failing.
- **[P4] `/screening`'s alt/caption copy-accuracy fix has no test** — static
  marketing copy, not logic; very low severity.
- **[P4] `e2e/capture.spec.ts`'s variant/manifest-mismatch runtime guard is
  untested** — the `throw new Error(...)` when a scenario declares a `dark`
  variant but the manifest entry has no `darkSrc` is only indirectly
  protected by a static assertion in `marketing-screenshots.test.ts` (found
  by `/ship`'s testing specialist, confidence 5.5/10). Low priority — if the
  static test is ever weakened this is the last line of defense, but
  extracting the src/darkSrc selection into a testable pure helper is a
  larger refactor than the gap justifies today.

---

## Adversarial review findings (`/ship`, 2026-07-21, branch thehashrocket/oauth-logout-opportunities-bug)

Cross-model pass (Claude adversarial subagent + Codex `exec` + Codex structured
`review`, GATE: PASS — no P1s) on the qualification-match-filter feature and the
company/organization redirect fix. One finding fixed immediately; three deferred
as pre-existing or out-of-scope for this PR.

- ~~**Qualification filter failed open on a missing `matchResults` entry**~~ ✅
  **Fixed same-branch (2026-07-21)** — Claude's subagent found that
  `matchResults?.[o.id]?.matchType !== 'NONE'` evaluates `true` (shown, not
  hidden) if an entry is ever missing for an opportunity id. Not currently
  reachable — both server pages (`browse/page.tsx`,
  `opportunities/[orgSlug]/page.tsx`) build `matchResults` from the exact same
  `opportunities` array passed to the component, so every id is guaranteed
  present whenever `hasMatching` is true — but the filter had no defense if
  that invariant is ever broken (pagination, partial re-scoring, a future
  refactor with separate queries). Hardened both `OpportunitiesListing.tsx`
  and `BrowseOpportunities.tsx` to treat a missing entry as unqualified
  (hidden) rather than shown.
- **[P2] Marketplace browse page can show a false "no opportunities match your
  skills" empty state past 200 published opportunities** — Codex adversarial.
  `listAllPublishedOpportunities` (`publicOpportunityRepo.ts`) hard-caps at
  200 rows ("Capped at 200 to prevent SSR OOM... Long-term: move skill-match
  ranking server-side"); `browse/page.tsx` computes matches only for that
  truncated set, and the new default-hide qualification filter then drops
  every `NONE` result client-side. Once the marketplace exceeds 200 published
  opportunities, a volunteer could see an empty state even though older
  qualifying opportunities exist outside the first 200 rows — silent result
  loss, not just a ranking quirk. Root cause predates this PR (the cap
  itself); this PR's filter is what makes the truncation user-visible as a
  wrong "you're not qualified for anything" message instead of just a
  reordering quirk. **Fix:** move skill-match ranking server-side (already
  flagged in-code as the long-term direction) so filtering happens before the
  200-row limit, not after.
- **[P2] `matchResults`/the qualification filter apply to any authenticated
  user with a saved skill profile, not just volunteers** — Codex structured
  review. Staff and company users who also happen to have personal
  `VolunteerSkill` entries (e.g., they're also a volunteer elsewhere) can hit
  `/app/browse` directly (no server-side role gate on that route, only a nav
  visibility check) and see published opportunities disappear based on their
  own irrelevant skill profile. Pre-existing: `matchResults` was already
  computed for any signed-in user with skills before this PR (shown as a
  cosmetic "Skills needed" badge); this PR escalates that to actually hiding
  listings. Properly scoping "volunteer intent" needs a role-model decision
  (there's no clean `isVolunteer` flag distinct from org/company membership)
  — out of scope for this PR. **Fix:** decide whether match-based filtering
  should require the user to have zero org/company memberships (pure
  volunteer), or add an explicit opt-in, before this becomes a bigger problem.
- **Deferred, no change** — Claude's subagent noted that `layout.tsx`'s
  no-org redirect target now depends on `hasCompany`, which — during the
  pre-existing impersonation `resolutionFailed` fallback (a transient DB
  error resolving an impersonation cookie) — reflects the real admin's own
  memberships, not the impersonated target's, since `effectiveUserId` falls
  back to `session.user.id` in that branch. Before this PR the redirect
  target was always `/app/welcome` regardless, so this fallback identity
  quirk was inert; now it can send an impersonating admin to their own
  `/app/company` instead of the target's `/app/welcome`. No data leak or
  cross-tenant exposure (`company/page.tsx` independently fails closed on
  `resolutionFailed`) — worst case is a confusing redirect target for the
  admin, only in the narrow window of a transient resolution failure.
  `resolutionFailed` is documented as ignorable for "pure read-only/nav"
  consumers; this redirect decision sits right at that boundary. Recorded so
  a future pass on `layout.tsx`'s impersonation handling has the context
  rather than re-discovering it.

**Effort:** S–M (per item) | **Priority:** see above | **Depends on:** None.

---

## Adversarial review findings (`/ship`, 2026-07-14)

Cross-model pass (Claude adversarial subagent + Codex `exec`) after PR1-3
landed. One finding fixed immediately (multi-specialist confirmed); one
scope disagreement resolved by explicit user decision; one deferred as low
severity.

- ~~**[P2] `/how-it-works`'s dashboard shot had no dark variant**~~ ✅
  **Completed v0.29.0.0 (2026-07-14)** — both Claude's subagent and Codex independently found
  this. `MARKETING_SCREENSHOTS.dashboard` gained a `darkSrc`
  (`dashboard-dark.png`, captured via the existing scenario pipeline); only
  the `/how-it-works` call site passes it, since the homepage's `priority`
  hero deliberately omits `darkSrc` (Tension 1, eager preload of a hidden
  sibling would double the fetch). Confirmed the manifest-holds-both /
  call-site-opts-in split isn't a structural limitation — Codex's framing
  ("the manifest stores variant data per asset key, not per usage site")
  overstated it; the fix was two lines.
- **Resolved, no change** — Codex flagged (High) that gating the
  pre-hydration "broken before hydration" check on `priority`
  (`annotated-screenshot.tsx`'s `useVariantState`) removed recovery
  protection for the non-priority images that make up most marketing pages.
  User reviewed the tradeoff and chose to keep the `priority` gate: the
  check's `complete && naturalWidth === 0` signature can't distinguish
  "hasn't loaded yet because it's lazy/off-screen" from "attempted and
  failed" for any non-priority image — broadening it would trade a rare,
  narrow-window failure (a lazy image failing between SSR paint and
  hydration) for a common one (ordinary below-the-fold images misreported
  as broken). Recorded here so a future pass doesn't re-litigate this
  without the context.
- **[P4] `createApplicationIfNotExists`'s backfill match has no uniqueness
  guarantee** — `prisma/seed-helpers.ts`'s `findFirst({ orgId,
  submittedByEmail })` has no `orderBy`; if a seeded org ever gets two
  applications from the same email, a rerun of `pnpm seed:dev` could
  backfill `opportunityId` onto the wrong row nondeterministically (Codex,
  Low). Pre-existing lookup shape, not introduced by this fix — no current
  seed caller passes a duplicate `(orgId, email)` pair, so dormant today.
  Fix if a future seed scenario needs multiple applications per email per
  org: add a distinguishing filter (e.g. `opportunityId: null` first, or an
  explicit `orderBy: { createdAt: 'asc' }`).

**Effort:** S (per item) | **Priority:** see above | **Depends on:** None.

---

## Platform Admin Console — follow-ups from Tier 1 ship (2026-04-17)

Deferred from the Tier 1 adversarial review. None block the Tier 1 ship; all
are quality-of-life improvements for admins or observability.

- ~~**[P2] Banner error surfacing**~~ ✅ **Completed v0.23.2.0 (2026-04-21)** — `impersonation-banner.tsx` now branches on `res.ok`; on failure, shows the error text inline and re-enables the button so admins can retry without losing context.
- ~~**[P2] `handleImpersonate` error parsing**~~ ✅ **Completed v0.23.2.0 (2026-04-21)** — `platform/users/[id]/page.tsx` now checks `Content-Type` and extracts the Zod `issues` array (JSON) or reads the plain-text body so admins see why impersonation start failed.
- ~~**[P2] Audit page error state**~~ ✅ **Completed v0.23.2.0 (2026-04-21)** — `platform/audit/page.tsx` now has an `isError` branch rendering a destructive card with the error message.
- ~~**[P2] Org detail error state**~~ ✅ **Completed v0.23.2.0 (2026-04-21)** — `platform/orgs/[id]/page.tsx` now differentiates `isError` (failed load, destructive) from `!data` (not found, muted).
- ~~**[P3] `UserAuditList` shows actor-only rows**~~ ✅ **Completed v0.23.2.1 (2026-04-21)** — `users/[id]/page.tsx` now passes `subjectId: userId` to get bidirectional rows; `auditRepo.ts` uses `OR: [actorId, entityId]`; two new DB indexes added; tRPC Zod schema updated.
- ~~**[P3] Banner reload-on-expiry guard**~~ ✅ **Completed v0.23.2.1 (2026-04-21)** — one-shot `useRef` guard navigates to `/app/admin/platform/users` exactly once on expiry instead of calling `reload()`.
- ~~**[P3] Sensitive-key audit detection → Sentry**~~ ✅ **Completed v0.23.2.1 (2026-04-21)** — `auditQueryService.ts` now calls `Sentry.captureMessage` instead of `console.warn`.
- ~~**[P3] Structured error logging on `resolveImpersonation`**~~ ✅ **Completed v0.23.2.1 (2026-04-21)** — both `init.ts` and `impersonation-context.ts` wrap `resolveImpersonation()` in try/catch, report to Sentry with `IMPERSONATION_RESOLVE_FAILED` tag, and fail open. **Superseded by v0.29.3.0** — the two independent try/catch blocks were consolidated into the shared `resolveEffectiveUserId()` in `impersonation-context.ts`, and the fail-open contract was changed to fail **closed** (`resolutionFailed: true`) since the resolver is now reused by mutation paths. See the P1 item above.
- ~~**[P3] Self-demotion guard**~~ ✅ **Completed v0.23.2.1 (2026-04-21)** — `platformUserService.setPlatformAdmin` throws `BAD_REQUEST` when actor === target and `value` is `false`; UI button is disabled with tooltip.
- **[P3] Require second admin before demotion** —
  `platformUserService.setPlatformAdmin` hard-blocks self-demotion (shipped in
  P3 PR), but an admin can still demote the only other platform admin, leaving the
  platform unmanageable. Before allowing any demotion (self or other), verify at
  least one other `isPlatformAdmin=true` user remains. Query `prisma.user.count({
  where: { isPlatformAdmin: true, id: { not: input.id } } })` and reject with
  `'Cannot revoke the last platform admin. Promote another admin first.'` if zero.

  **Why:** Prevents accidental lockout from any path, not just self-demotion.
  **Effort:** S | **Priority:** P3 | **Depends on:** Self-demotion hard block (P3 PR)

- **[P3] Move sensitive-key audit detection to write sites** —
  `auditQueryService.redactAuditMetadata` currently fires `Sentry.captureMessage`
  on the READ path. Old bad rows in the DB re-alert on every admin browse and on
  every deploy (the `warnedKeys` Set only dedupes per process). The correct fix
  is to validate audit metadata at every `writeAuditLog` / `writeAuditLogTx` call
  site so the signal fires once, at the producer. The `warnedKeys` de-dup on the
  read path can then be removed.

  **Why:** Accurate, low-noise Sentry signals. Current read-path implementation
  acceptable short-term (per-process dedup with documented caveat).
  **Effort:** S | **Priority:** P3 | **Depends on:** Sentry captureMessage shipped (P3 PR)

- **[P3] `PlatformConfig.catalogRevision` singleton** — deferred from Tier 2
  design review. A revision counter bumped on every skill/screener-default
  edit would let clients cache-bust the catalog. Not needed until we see
  actual stale-data bugs in admin UIs or opportunity-matching. Revisit if
  admins report "I edited a skill but the opportunity form still shows the
  old name." Current boot-guard merge-on-version-bump stays untouched.

---

## Platform Admin Console — Tier 2 (Catalog Editors) ✅ Shipped

**Completed:** 2026-04-17

Platform admin UI for editing skill families, skills, and default screener
question templates from the browser — replaces the "edit TS constant →
redeploy" loop. Routes under `/app/admin/platform/catalog/`:

- `/catalog/skills` — skill family + skill CRUD (add, rename, deactivate/reactivate)
- `/catalog/screener-defaults` — default screener question template CRUD

Key design choices:
- **`isTemplate` flag on `ScreenerQuestion`** — templates stored as
  `isTemplate=true` rows on the platform org. All regular screener
  repository functions (`listQuestions`, `getQuestion`, `updateQuestion`,
  `deleteQuestion`, `swapOrders`, …) explicitly scope to
  `isTemplate: false` so platform-org admins cannot edit templates via
  non-catalog routes (bypassing audit).
- **Create-only boot-guard semantics** — `seedCatalog()` +
  `seedPlatformTemplateQuestions()` use `findUnique`/`create` patterns (no
  upserts that overwrite). Admin edits survive version bumps.
- **`seedDefaultQuestions()` reads from DB templates**, not the TS constant.
  The constant (`DEFAULT_SCREENER_QUESTIONS`) is only used by the boot guard
  to seed first-time templates.
- **No retro-push** — editing a template never mutates any existing org's
  screener. Templates apply only when a new org is created.

Follow-ups (all P3):
- Drag-and-drop reordering (currently order is edited numerically).
- Diff view in AuditLog entries for catalog edits (currently `before`/`after`
  JSON blobs; could render side-by-side).
- "Revert to platform default" action on org screener questions when a
  template changes — deferred until admins ask for it.

---

## Background Check Integration (Phase 6B)

### ~~[P1] FCRA Adverse Action Notices~~ ✅ Complete

**Completed:** v0.2.3 (2026-03-16)

Implemented in-app FCRA adverse action workflow: `FcraStatus` enum
(NONE → PRE_ADVERSE_SENT → ADVERSE_ACTION_SENT / RESOLVED), domain guards,
service methods (`sendPreAdverseNotice`, `finalizeAdverseAction`, `resolveFcra`),
volunteer-facing email templates with FCRA-required content, 5-day waiting period
enforcement, and staff UI buttons on CONSIDER rows.

---

### ~~[P2] CONSIDER State Review UI Action~~ ✅ Done

Replaced the generic "Issue Credential" dialog on CONSIDER rows with a dedicated
"Review & Issue" dialog (`ReviewIssueDialog`) that shows the volunteer's name, locks
type to BACKGROUND_CHECK / VERIFIED, and calls the new atomic
`backgroundChecks.issueAndResolve` tRPC procedure. This eliminates the partial-success
trap where credential issuance could succeed but FCRA resolution could fail as separate
client-side mutations. Both operations now run in a single DB transaction.

---

### [P3] Checkr Candidate ID Storage for Re-Screening

**What:** Store encrypted Checkr candidate ID on `BackgroundCheckRequest` to enable re-screening
without re-collecting SSN/DOB.

**Why:** Annual background check renewal is common for ongoing volunteers. Currently, each renewal
requires staff to re-collect PII. Storing the candidate ID (not PII itself) enables one-click
re-screening.

**Context:** In Phase 6B, `candidateId` is discarded after `initiateCheck()` in
`src/server/lib/adapters/background-check/checkr.ts` (see the NOTE in that file's header).
Storing it requires encrypted storage (AES-256 at application layer, or Postgres pgcrypto).
The `BackgroundCheckRequest` entity gains a `candidateIdEncrypted` field. A new
`recheckVolunteer(requestId)` service function calls `POST /v1/reports` with the stored
candidate ID — no PII re-entry. Also needs a Sterling adapter implementation for that provider.

**Effort:** M | **Priority:** P3 | **Depends on:** ✅ Phase 6B shipped, encryption infrastructure decision

---

### [P2] Encrypt Checkr OAuth Access Tokens at Rest

**What:** Encrypt `Organization.checkrAccessToken` before writing to DB and decrypt on read.

**Why:** OAuth access tokens are secrets with API-level permissions. Storing them in plaintext
means a DB dump or SQL injection exposes all per-org Checkr access. Defense-in-depth best practice
is to encrypt secrets at the application layer.

**Context:** `checkrAccessToken` was added in the `20260316050000_phase_6b_checkr_partner_oauth`
migration. Currently stored as plaintext `String?`. The encryption/decryption logic should live in
a new `src/server/lib/crypto.ts` utility (AES-256-GCM with a `CHECKR_TOKEN_ENCRYPTION_KEY` env var).
The two DB access points are `connectCheckrAccount` (write) and `getOrgCheckrToken` (read) in
`src/server/services/backgroundCheckService.ts` — add encrypt/decrypt calls at those sites only.
Do NOT encrypt `checkrAccountId` — it is a non-secret identifier.

**Pros:** Eliminates plaintext token exposure from DB breach or log leak.
**Cons:** Adds key rotation complexity; losing `CHECKR_TOKEN_ENCRYPTION_KEY` renders all tokens
unreadable (requires re-connect flow for all orgs).

**Effort:** ~~S~~ | **Priority:** ~~P2~~ | ✅ **Completed:** v0.2.3 (2026-03-16)

Token encryption implemented using AES-256-GCM in `src/server/lib/crypto.ts`.
`connectCheckrAccount` encrypts on write; `getOrgCheckrToken` decrypts on read via
`tryDecrypt` (graceful fallback for pre-existing plaintext tokens).

---

### ~~[P3] Encryption Key Rotation for Checkr Tokens~~ ✅ Complete

**Completed:** v0.15.0 (2026-03-20)

Dual-key decryption in `src/server/lib/crypto.ts` with `CHECKR_TOKEN_ENCRYPTION_KEY_NEW`
env var. `decrypt()` tries primary key first, falls back to rotation key. `reEncrypt()`
with roundtrip verification. Batch migration script at `scripts/reencrypt-tokens.ts`.
7 new tests covering dual-key fallback, primary preference, and reEncrypt roundtrip.

**Effort:** ~~M~~ | **Priority:** ~~P3~~

---

### [P3] FCRA Waiting Period Configuration

**What:** Make the 5-day FCRA waiting period configurable per-org or per-state.

**Why:** Some US states require different waiting periods (e.g., California requires 5 business
days, which differs from 5 calendar days). As orgs in different jurisdictions onboard, the
hardcoded 5 calendar days may need adjustment.

**Context:** `FCRA_WAITING_PERIOD_DAYS = 5` is a constant in `src/server/domain/background-check.ts`.
To make it configurable: (1) add a `fcraWaitingPeriodDays` field to `Organization`, (2) pass it
into `isWaitingPeriodElapsed` and `waitingPeriodDaysRemaining`, (3) add an admin setting UI.
Consider also a "business days" mode that excludes weekends.

**Effort:** S | **Priority:** P3 | **Depends on:** ✅ FCRA workflow shipped

---

## Billing & Payments

### ~~[P2] Plan Upgrade Confirmation Email~~ ✅ Complete

**Completed:** v0.9.0 (2026-03-18)

Implemented upgrade, payment failed, and cancellation billing emails in
`src/server/repositories/send-billing-emails.ts`. All three use the branded
`buildEmailHtml` template system. Dispatched via `trySendBillingEmail` helper
in `billingService.ts` (fire-and-forget, never crashes webhook). Supports both
org and company entities. Upgrade email fires only on `subscription.created`
(not `updated`).

---

### ~~[P2] Plan-Gated Feature UI Hints~~ ✅ Complete

**Completed:** v0.11.1 (2026-03-19)

Self-contained `<PlanGate>` component at `src/components/plan-gate.tsx` queries
`billing.getBillingStatus`, compares `TIER_RANK`, and renders children or an upgrade
prompt with lock icon + "Upgrade to {tier}" CTA. Applied to analytics (PRO) and
shift templates (STARTER). Replaces inline upgrade prompts.

---

### ~~[P2] Stripe Webhook Event Reconciliation~~ ✅ Complete

**Completed:** v0.15.0 (2026-03-20)

Admin `stripeReconcile` mutation in `src/server/trpc/routers/admin.ts` replays
missed Stripe webhook events within a configurable time window (1–720 hours).
Uses `reconcileStripeEvents()` from `billingService.ts`. Accessible via the
platform admin health dashboard at `/app/admin/health`.

**Effort:** ~~M~~ | **Priority:** ~~P2~~

---

## Credentialing

### ~~[P2] CredentialShareToken Expiry Notification Email~~ ✅ Complete

**Completed:** v0.12.0 (2026-03-19)

Implemented in `share-token-expiry-service.ts`. Queries ACTIVE tokens expiring within
7 days where `notifiedAt IS NULL`, sends branded email with days-left count, sets
`notifiedAt` for idempotency. Runs as part of the daily `/api/cron/expire-credentials`
cron job (03:00 UTC). Per-record try/catch with P2025 race handling.

### ~~[P2] Sterling Background Check Provider Integration~~ ✅ Complete

**Completed:** v0.16.0 (2026-03-21)

Full `SterlingAdapter` implementing `BackgroundCheckAdapter` interface. 7 named error
classes, HMAC-SHA256 webhook signature verification, API key auth (not OAuth). Prisma
schema: `sterlingApiKey` + `sterlingAccountId` on Organization. Adapter registry at
`src/server/lib/adapters/background-check/registry.ts`. Service functions:
`connectSterlingAccount`, `disconnectSterlingAccount`, `getSterlingConnectionStatus`,
`initiateSterlingCheck`, `handleSterlingWebhookEvent`. Webhook route at
`/api/sterling/webhook`. 22 adapter tests covering all error classes + happy path.

**Effort:** ~~M~~ | **Priority:** ~~P2~~

---

## Volunteer Identity

### ~~[P1] Volunteer Impact Public Page (`/v/[userId]`)~~ ✅ Complete

**Completed:** Phase 7 PR1+PR2 (2026-03-17)

Implemented `/v/[userId]` public identity page (PUBLIC visibility only), OG share card at
`/api/share-card/[userId]` with Fraunces font, `volunteerIdentityService` with
`getPublicProfile` (PUBLIC) and `getOrgVisibleProfile` (PUBLIC + ORGS_ONLY for screeners),
`computeTenure` + `computeReliabilityScore` domain functions, tenure badge display,
`VolunteerIdentityPanel` on application screener page. No PII exposed.

### [P3] LinkedIn "Add to Profile" Deep Link for Verified Credentials

**What:** "Add to LinkedIn" button on volunteer credential badges that deep-links
to LinkedIn's "Add certification" flow with pre-filled credential data.

**Why:** Volunteers are motivated to earn credentials they can display publicly.
LinkedIn integration makes VolunteerReady credentials feel real and valuable.

**Context:** LinkedIn provides a URL scheme for adding certifications:
`https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME&name=...&organizationId=...`
This requires a LinkedIn Partner Organization ID. The credential data maps to:
certification name, issuing org, issue date, expiry date, credential URL.

**Pros:** High viral/network value; low implementation effort once LinkedIn Partner ID is obtained.
**Cons:** Requires LinkedIn Partner application; credential URL needs a stable public page first.

**Effort:** S | **Priority:** P3 | **Depends on:** /v/[userId] public page, LinkedIn Partner status

### ~~[P3] Volunteer Tenure Badge Auto-Issuance Service~~ ✅ Complete

**What:** Service that automatically issues a `VolunteerCredential` of type
`TENURE_1YR/3YR/5YR` when a volunteer crosses a milestone.

**Why:** The enum values and `computeTenure()` domain function are done (Phase 7 PR1).
The public profile page already displays tenure badges from existing credentials.
The missing piece is the service that actually mints and issues those credentials.

**Context:** `TENURE_1YR/3YR/5YR` enum values are in `CredentialType`. `computeTenure()`
in `src/server/domain/volunteer-profile.ts` computes the current level. The platform org
(`slug: platform`) is seeded and will be the issuer. The service (`tenureBadgeService.ts`)
should: (1) call `computeTenure()` for the user's activity records, (2) check which
milestones they've crossed, (3) upsert VERIFIED credentials for earned levels (idempotent),
(4) be triggered from `shiftSignupService` on ATTENDED status and from
`volunteerApplicationService` on approval. Edge case: milestone reset on account
re-join is out of scope — tenure is additive from earliest activity.

**Pros:** Completes the tenure gamification loop; credentials appear on public profile immediately.
**Cons:** Need trigger points in 3 services; platform org must always exist (seeded).

**Effort:** M | **Priority:** ~~P3~~ | **Depends on:** ✅ Phase 7 PR1 (enum + computeTenure + platform org seeded) | **Completed:** v0.7.0 (2026-03-17)

### ~~[P3] Auto-Share Credentials on Apply ("Bring My Credentials" Checkbox)~~ ✅ Complete

**Completed:** v0.3.0 (2026-03-17) — Phase 6C

Implemented as part of Phase 6C credential sharing. Checkbox on apply form triggers
`shareAllOnApply(userId, orgId)` in `credentialShareService.ts`. Creates share tokens +
immediately claims them in a single transaction for audit trail. Skips credentials
already in the target org.

### ~~[P2] Platform-Wide Rate Limiting~~ ✅ Complete

**Completed:** v0.8.0 (2026-03-18)

Implemented Upstash Redis-based rate limiting via `@upstash/ratelimit` with sliding window.
Three tRPC middleware factories (`rateLimitByOrg`, `rateLimitByUser`, `rateLimitByIp`) in
`src/server/trpc/rate-limit-middleware.ts`. Applied to: `credentialSharing.generate` (5/min
per user), `credentialSharing.claim` (10/min per org), `screener.submit` (3/min per IP),
`credentialSharing.getTokenInfo` (30/min per IP). Fails open when Redis is unavailable.

### ~~[P3] Share Token Cleanup Cron~~ ✅ Complete

**Completed:** v0.9.0 (2026-03-18)

Combined with credential expiry below into a single daily Vercel Cron job at
`/api/cron/expire-credentials` (runs 03:00 UTC). Marks ACTIVE tokens with
`expiresAt` in the past as EXPIRED. Per-record transactions with P2025 handling.
Audit log entries with `actorId: null` for each transition.

### ~~[P2] Credential Expiry Auto-Transition Cron~~ ✅ Complete

**Completed:** v0.9.0 (2026-03-18)

Implemented in `credential-expiry-service.ts` as part of the daily cron job.
Transitions VERIFIED credentials with `expiresAt` in the past to EXPIRED.
Per-record transactions with audit logging (`CREDENTIAL_AUTO_EXPIRED`).
Limit of 500 per run prevents unbounded processing.

---

## Corporate CSR

### ~~[P2] Context-Switch UI (Org ↔ Company Dashboard)~~ ✅ Complete

**Completed:** v0.15.0 (2026-03-20)

`CompanySwitcher` component at `src/components/company/CompanySwitcher.tsx` mirrors
`OrgSwitcher` pattern. `company.switchCompany` tRPC mutation sets `Session.currentCompanyId`.
Integrated into `app-shell.tsx` navbar. Users with both org and company memberships
can switch contexts without logout.

**Effort:** ~~M~~ | **Priority:** ~~P2~~

### ~~[P1] ESG Report PDF Export~~ ✅ Complete

**Completed:** 2026-03-17

Implemented using `@react-pdf/renderer` 4.3.2 with branded PDF layout matching
DESIGN.md (forest green header, sand stat boxes, warm neutral table). API route
at `/api/esg-report/pdf` mirrors CSV route auth pattern. Dynamic import keeps
`@react-pdf/renderer` out of the main bundle. Fonts (Fraunces Bold, Geist
Regular/SemiBold/Bold) bundled as TTF in `public/fonts/`.

---

### [P3] Shared ESG Export Auth Helper

**What:** Extract repeated auth/validation logic from CSV and PDF API routes into
a shared helper function.

**Why:** Both `/api/esg-report/csv/route.ts` and `/api/esg-report/pdf/route.ts`
duplicate the same auth flow: session check → param validation → membership check →
role check → plan tier check. If a third export format is added, the duplication
becomes a maintenance burden.

**Context:** Currently acceptable at 2 call sites. Extract when a third format
(e.g., XLSX, branded HTML) is added. The helper would live in
`src/server/lib/esg-auth.ts` and return either the validated params + userId or
a NextResponse error.

**Effort:** S | **Priority:** P3 | **Depends on:** A third ESG export format being added

### ~~[P2] QR Code Volunteer Check-In (Mobile PWA)~~ ✅ Complete

**Completed:** v0.13.0 (2026-03-20)

Implemented as Phase 6E with HMAC-SHA256 stateless tokens, staff scanner page
(`/app/scan`) with camera + search-by-name fallback, volunteer QR display on
my-shifts, PWA manifest + service worker, geo-fenced auto check-in, real-time
dashboard, thank-you notifications, check-in analytics, and QR color customization.
28 new tests covering all check-in paths.

---

## Corporate ESG Reporting (Phase 6D)

### ~~[P2] ESG Report Integration Tests (Raw SQL)~~ ✅ Complete

**Completed:** v0.15.0 (2026-03-20)

13 integration tests in `src/server/services/employerReportService.integration.test.ts`
covering `getESGShiftAggregates`, `getESGCredentialCounts`, and
`getESGDistinctEmployeeCount`. Tests cover: multi-org companies, date range filtering
(from-only, to-only, both, neither), credential-only orgs, empty results, and
bigint→number conversion. Uses real DB with `vitest.integration.config.mts` and
dotenv config for forked workers.

**Effort:** ~~M~~ | **Priority:** ~~P2~~

---

## Phase 9 — Production-Ready + Activation

### ~~[P2] Timezone-Aware Notification Delivery~~ ✅ Complete

**Completed:** v0.14.0 (2026-03-20)

Added `Organization.timezone` (nullable IANA string, NULL = UTC). Shift reminders
fire at local 6am, digests at local 8am. Cron schedules changed to hourly.
`getTimezonesMatchingHour()` utility in `src/server/lib/timezone.ts`. Timezone
picker on `/app/settings/team`. `updateTimezone` tRPC mutation (staff-only).

---

### ~~[P1] Digest Cron Pagination with Cursor Tracking~~ ✅ Complete

**Completed:** v0.14.0 (2026-03-20)

Cursor-based pagination (100 per batch) with `CronJobRun.resultSummary.nextCursor`.
`lastDigestSentAt` idempotency prevents double-sends on cursor reset. Per-type
email preference filter also added (excludes types where `NotificationPreference.email=false`).

---

### ~~[P1] Cron Failure Alerting — 3 Consecutive Failures Trigger Admin Email~~ ✅ Complete

**Completed:** v0.12.0 (2026-03-19)

Implemented as part of the cron health dashboard in `admin.ts`. The `cronHealth`
query counts consecutive failures per job from `CronJobRun` records (newest-first).
Jobs with 3+ consecutive failures surface in the `alerts` array. Visible on the
admin health dashboard at `/app/admin/health`. Email alerting deferred — dashboard
visibility is the initial mechanism.

---

### ~~[P2] AuditLog Index — Use CONCURRENT Creation for Large Tables~~ ✅ Complete

**Completed:** v0.13.4 (2026-03-20)

Both `AuditLog(orgId, createdAt)` and `Shift(status, endTime)` indexes created with
`CREATE INDEX CONCURRENTLY IF NOT EXISTS` in a `-- DropTransaction` migration. Zero
table locks during deploy.

**Effort:** S | **Priority:** ~~P2~~

---

## Public Site

### ~~[P2] Product Screenshots for Marketing Pages~~ ✅ Complete

**Completed:** v0.12.0 (2026-03-19)

Added 6 PNG screenshots in `public/marketing/`: dashboard, screener, shifts,
credentials, ESG report, and profile. Captured from demo org with realistic
seed data. Ready for integration into public landing pages. *(Set has since
changed — current source of truth is `src/lib/marketing-screenshots.ts`:
shifts.png retired, applications-queue.png added, impact-report.png added and
credentials recaptured in v0.28.0.0 (issue #139), which also made regeneration
deterministic via `pnpm screenshots`.)*

---

### ~~[P2] Public Stories Index Page (/stories)~~ ✅ Completed v0.23.2.0 (2026-04-21)

`src/app/(public)/stories/page.tsx` ships. Queries `listConsentedOrgSummaries()` (single query with `_count` for application volume), renders a grid of org cards with logo/name/count, JSON-LD breadcrumb, empty state, and CTA banner. Route registered in `public-pages.ts` with sitemap config.

**Effort:** S | **Priority:** P2 | **Completed:** v0.23.2.0 (2026-04-21)

---

## Volunteer Discovery

### ~~[P1] HTTP Rate Limiting for volunteer search endpoint~~ ✅ Complete

**Completed:** v0.8.0 (2026-03-18)

Implemented `rateLimitByOrg` middleware (60 req/min per org) on `discovery.searchVolunteers`
using `@upstash/ratelimit` with Upstash Redis. Sliding window algorithm prevents burst abuse.
Removed the `VOLUNTEER_DISCOVERY_ENABLED` env var gate from `src/app/(app)/app/discover/page.tsx`
— volunteer discovery is now available to all staff users with rate limiting enforced.

---

### ~~[P3] Analytics — Make "Top Volunteers" respect the selected date range~~ ✅ Complete

**Completed:** v0.11.1 (2026-03-19)

Added `fromDate: Date` parameter to `getTopVolunteers` in `orgAnalyticsRepo.ts`,
passed through from `orgAnalyticsService.ts`. Updated heading from "Top Volunteers
— All Time" to "Top Volunteers". All 7 integration test call sites updated.

---

### ~~[P3] Consolidate CREDENTIAL_TYPE_LABELS into shared domain constant~~ ✅ Complete

**Completed:** v0.9.0 (2026-03-18)

Deleted local `CREDENTIAL_TYPE_LABELS` from `discover-client.tsx` — now imports
`CREDENTIAL_LABELS` from `@/server/domain/volunteer-profile`. Also consolidated
`CREDENTIAL_META` (labels + icons) into `src/lib/credential-meta.ts`, replacing
duplicate maps in `profile/page.tsx` and `ClaimClient.tsx`. All 8 credential types
(including TENURE) now have a single source of truth.

---

## Phase 8 — Volunteer Operations Platform

### ~~[P3] Migrate Existing Email Send Files to `sendEmail()` Helper~~ ✅ Complete

**Completed:** v0.11.1 (2026-03-19)

Migrated 7 of 8 email files to `sendEmail()` helper: `sendInviteEmail.ts`,
`sendStatusLinkEmail.ts`, `sendCredentialRequestEmail.ts`, `sendCredentialClaimedEmail.ts`,
`sendBackgroundCheckEmail.ts`, `sendInviteToApplyEmail.ts`, `send-billing-emails.ts`.
`sendFcraEmails.ts` intentionally excluded — FCRA legal compliance requires throw on failure.

---

### ~~[P3] Notification Cleanup Cron — Purge Old Dismissed Notifications~~ ✅ Complete

**Completed:** v0.11.1 (2026-03-19)

`purgeOldDismissedNotifications()` in `credential-expiry-service.ts` hard-deletes
notifications with `deletedAt < 90 days ago`. Runs in parallel alongside credential
expiry in the existing `/api/cron/expire-credentials` daily cron (03:00 UTC).

---

### ~~[P2] Accessibility Audit — Phase 8 Pages and Components~~ ✅ Complete

**Completed:** v0.11.1 (2026-03-19)

Added `aria-label` to icon-only buttons (shifts page: complete, cancel, delete;
shift templates: delete), `aria-hidden="true"` on decorative icons (notification bell,
shift action icons), `aria-pressed` on analytics date range toggle buttons, converted
analytics date range from `div[role=group]` to semantic `<fieldset>`.

---

### ~~[P2] Bulk Import Durability — Replace Fire-and-Forget with Queue~~ ✅ Complete

**Completed:** v0.13.4 (2026-03-20)

Replaced `void processImportJob()` with `waitUntil(processImportJob(...))` from
`@vercel/functions`. Keeps the serverless function alive until import processing
completes. Full queue-based solution (Inngest) tracked separately in Phase 10 TODOs.

**Effort:** ~~M~~ S | **Priority:** ~~P2~~

---

### ~~[P3] Digest Service — Honor Per-Type Email Preferences~~ ✅ Complete

**Completed:** v0.14.0 (2026-03-20)

Bundled with digest cursor pagination. `getOptedOutTypes(userId, orgId)` queries
`NotificationPreference` where `email=false` and adds `type: { notIn: [...] }` to
the notification query.

---

## Phase 11 — Volunteer Marketplace & API Platform (Deferred Items)

### [P3] Timezone-Aware Opportunity Digest Delivery

**What:** Switch the weekly marketplace opportunity digest from fixed Monday 8am UTC
to per-user local-time delivery (e.g., Monday 8am in the volunteer's timezone).

**Why:** The 11C Foundation digest ships with a fixed UTC send window because
`UserMarketplacePreference` has no timezone reference (cross-org model, unlike
`UserDigestPreference` which uses `Organization.timezone`). A volunteer in Sydney
currently receives the digest at 6pm Sunday local time, not Monday morning.

**Context:** Depends on Volunteer Profiles (Phase 3/4) landing a `User.timezone`
field. When that ships, add `timezone` to `UserMarketplacePreference` (migration),
populate it from the volunteer's profile on upsert, and update `opportunityDigestService.ts`
to use the same `getTimezonesMatchingHour()` pattern as `digest-service.ts`.

**Pros:** Better delivery timing → higher open rates. Consistent UX with the org digest.
**Cons:** Requires Volunteer Profiles work first; migration to backfill existing rows.

**Effort:** S | **Priority:** P3 | **Depends on:** Volunteer Profiles (Phase 3/4), `User.timezone` field

---

### [P3] Algolia Migration Monitoring for Marketplace Search

**What:** Monitor PostgreSQL tsvector full-text search performance and establish
a trigger point for migrating to Algolia.

**Why:** Phase 11 launches with PostgreSQL tsvector + GIN index for marketplace
search. This is sufficient for the initial launch, but as the opportunity catalog
grows past ~10K published opportunities or p95 search latency exceeds 200ms,
dedicated search infrastructure (Algolia) becomes necessary.

**Context:** Marketplace search uses `$queryRaw` with `to_tsvector('english', ...)` and
`ts_rank()` for relevance scoring. A generated tsvector column with GIN index handles
the indexing. Monitor via: (1) Vercel function duration logs for the search endpoint,
(2) `pg_stat_user_indexes` for GIN index size, (3) periodic `EXPLAIN ANALYZE` on the
search query with representative data. Trigger migration when: >10K published opps OR
>200ms p95 search latency OR faceted search requirements emerge.

**Pros:** Prevents reactive scramble when search gets slow; Algolia migration is well-understood.
**Cons:** Monitoring overhead; Algolia adds monthly cost ($1/1K records + search ops).

**Effort:** S (monitoring) → M (migration) | **Priority:** P3 | **Depends on:** Phase 11 PR3 (marketplace search) shipped

---

### [P3] Full Marketplace Moderation Suite

**What:** Comprehensive moderation system beyond the basic report/flag mechanism
shipped in Phase 11 PR2.

**Why:** Phase 11 PR2 ships a minimal report button + admin flag review. As the marketplace
grows, more sophisticated moderation is needed: auto-detection of inappropriate content,
tiered response (warning → temporary hide → permanent removal), org reputation scoring,
appeal workflow, and cross-org pattern detection.

**Context:** The initial moderation mechanism is an `OpportunityReport` entity with
`status: OPEN | REVIEWED | DISMISSED | ACTIONED` and a staff review UI on the admin dashboard.
The full suite would add: (1) keyword/pattern scanning on opportunity creation (pre-publish),
(2) report volume thresholds for auto-hide (e.g., 3 reports in 24h → auto-hide pending review),
(3) org reputation score based on report history, (4) appeal workflow for flagged orgs,
(5) cross-org report aggregation for platform-level trends.

**Pros:** Essential for marketplace trust and safety at scale; prevents bad actors.
**Cons:** Significant complexity; premature before marketplace reaches critical mass.

**Effort:** L | **Priority:** P3 | **Depends on:** Phase 11 PR2 (basic moderation) shipped, marketplace reaching ~50 active orgs

---

### Folded in from the deleted root `TODOS.md` (2026-08-01)

These five were deferred around v0.25–v0.26 and lived in a second `TODOS.md` at the
repo root, which nothing linked to and which had not been written to in twelve minor
releases. Opening it to check the backlog and concluding the project was nearly done
was a real trap — it was deleted and its open items moved here, which is the file
`CLAUDE.md` and `docs/AGENT_RULES.md` actually point at. All five are still open.

#### [P3] Member count privacy on org discovery

`/organizations` shows `{org._count.members} member(s)`. Small orgs (1–2 members) may
not want this exposed. Needs platform product sign-off on whether to show, hide, or
threshold the count. Deferred from v0.25.0.0 (Phase 11A).

#### [P3] "This Weekend" uses server UTC, not org/user time zone

`getThisWeekendOpportunities` computes "next 3 days" in server UTC, so events starting
Friday evening local time may or may not appear depending on the reader's offset.
Fixing it properly requires storing opportunity time zones. Same root cause as the
digest-delivery item above — both are blocked on the platform having no time-zone
reference for a cross-org user. Deferred from v0.25.0.0 (Phase 11A).

#### [P3] Rate limiter IP fallback shares one bucket

When `ctx.ip` is null (Vercel edge/proxy cases), the marketplace browse rate limiter
keys on the literal string `'unknown'`, so all null-IP traffic shares a single bucket.
Investigate whether Vercel always populates X-Forwarded-For in the tRPC context.
Deferred from v0.25.0.0 (Phase 11A).

#### [P3] Digest service issues N+1 per-user queries

In `opportunityDigestService.ts` each user in the 100-user batch triggers 3 DB queries
(applied ids, interested ids, opportunities fetch) — 300 queries per Monday cron batch.
Fix when active digest users approach 500+: batch-fetch applied + interested ids for the
whole batch at once and join in memory. Deferred from v0.26.0.0 (Phase 11C).

#### [P3] `/app/browse` full pagination migration

`listAllPublishedOpportunities` is capped at 200 rows as an OOM guard, but the
authenticated browse page still loads every result server-side so it can rank by
skill match on the client. Full fix: move skill-match ranking into the
`searchMarketplaceOpportunities` tRPC procedure (accept `userId`, look up skills, rank
server-side), then paginate. Until then the 200-row cap prevents memory spikes — and
note it is the same cap behind the qualification-filter false-empty-state gap recorded
under the Phase 11 filter rules in `CLAUDE.md`. Deferred from v0.26.0.0 (Phase 11C review).

**Completed items carried over for the record:** the composite `@@index([status, createdAt])`
on `VolunteerOpportunity` (P2, shipped in the Phase 11C migration, v0.26.0.0) and the
marketplace service-layer extraction — `getMyInterests`/`toggleInterest` to
`marketplaceService.ts`, `updateMarketplaceSettings` to `orgMarketplaceService.ts`
(P3, v0.26.1.0).

---

## Phase 10 — Scale & Enterprise Readiness (Deferred Items)

### ~~[P3] Volunteer Re-Engagement Emails~~ ✅ Complete

**Completed:** v0.14.0 (2026-03-20)

Three-segment (30d/60d/90d) re-engagement emails scoped to `OrganizationMember`.
`lastActivityAt` tracked on shift signup + application submission. `lastReengagementSegment`
prevents perpetual spam (each segment fires once, resets on activity). 60d template
includes org-scoped published opportunities. Cursor-based pagination for scale.
Cron at `/api/cron/volunteer-reengagement` (daily 3pm UTC). Respects `REENGAGEMENT`
email opt-out via `NotificationPreference`. Backfill script: `pnpm backfill:activity`.

---

### [P3] Bulk Credential Issuance

**What:** Admin UI to issue the same credential type to multiple volunteers at once
(e.g., after a group training session).

**Why:** Orgs that run group trainings currently issue credentials one at a time.
Bulk issuance is operational polish that reduces admin friction for high-volume orgs.

**Context:** Would need a multi-select UI on the background checks page
(`/app/settings/background-checks`, formerly the credentials page), a batch
`credentials.bulkIssue` tRPC mutation, and progress tracking similar to bulk
import. Reuse the `BulkImportJob` pattern for async processing. Should audit-log
each credential individually.

**Pros:** Significant time savings for orgs with group trainings.
**Cons:** Operational polish, not a blocking gap; single-issue works today.

**Effort:** M | **Priority:** P3 | **Depends on:** Phase 10 shipped

---

### [P3] Inngest/Real Queue for Bulk Import

**What:** Replace the `waitUntil()` stopgap in bulk import with a proper job queue
(Inngest or similar) for truly durable execution.

**Why:** `waitUntil()` extends function lifetime but is still limited by Vercel's
function timeout. For imports >500 rows with email sending, a real queue with
retry semantics is the proper solution. Phase 10 uses `waitUntil()` as a quick
fix; this TODO tracks the full solution.

**Context:** `src/server/services/bulk-import-service.ts` currently uses
`void processImportJob()` (fire-and-forget). Phase 10 upgrades to `waitUntil()`.
Inngest provides step functions, retries, and observability. Alternative: Vercel
background functions or a self-hosted worker.

**Pros:** True durability; retry semantics; observability dashboard.
**Cons:** New dependency (Inngest); monthly cost; architecture change.

**Effort:** L | **Priority:** P3 | **Depends on:** Phase 10 bulk import waitUntil() shipped

---

## Concierge Activation Engine (Phase 12)

### [P3] HMAC Survey Tokens for Feedback Form Authentication

**What:** Replace unauthenticated feedback survey with HMAC-signed tokens embedded in
the email link, so responses are attributable without requiring login.

**Why:** The initial feedback form (Phase 12) skips auth for simplicity with 3 concierge
orgs. As the platform scales beyond concierge, unauthenticated feedback is exploitable
(anyone with the URL can submit fake responses). HMAC tokens tie each response to a
specific org + time window without requiring the org admin to have a VolunteerReady account.

**Context:** Token format: `HMAC-SHA256(orgId + timestamp, SECRET)`. Embed in email link
as query param. Validate on form submission. Expire after 7 days. Reuse pattern from
`src/server/lib/checkin-token.ts` (QR check-in already uses HMAC tokens). The feedback
cron (`/api/cron/org-feedback`) would generate tokens when sending emails. The survey
route (`/screening/feedback`) would validate before accepting submissions.

**Pros:** Attributable responses; prevents spam/fake submissions; no login friction.
**Cons:** Token management complexity; need to handle expired token UX gracefully.

**Effort:** S | **Priority:** P3 | **Depends on:** Concierge feedback cron shipped

---

### ~~[P2] Content Flywheel — Structured Case Study Generation from Concierge Data~~ ✅ Complete

**Completed:** v0.17.1 (2026-03-21)

Full content flywheel: `caseStudyService.ts` aggregates org usage data (applications,
background checks, retention, fill rates, top volunteers, feedback pull quotes) into
`CaseStudyData`. Admin UI at `/app/admin/case-studies` with consent toggle, approval
email, PDF download, markdown copy. Public stories at `/stories/[orgSlug]`. Two-step
HMAC consent flow (GET confirmation page + POST mutation). Testimonial components on
screening landing page. 25 unit tests covering token and domain logic. 7 security
fixes applied during review (consent-on-GET, auto-consent from feedback, XSS, HTML
injection, timingSafeEqual crash, missing env var).

**Effort:** ~~M~~ | **Priority:** ~~P2~~

---

### [P2] Self-Serve Org Signup Flow

**What:** Public signup page where nonprofit admins can create their own org account
without concierge onboarding — the transition from concierge-first to self-serve growth.

**Why:** The concierge model validates demand and refines onboarding, but doesn't scale.
Once the concierge playbook is proven (3 orgs successfully activated), a self-serve
flow unlocks organic growth. The landing page (`/screening`) already attracts traffic;
converting visitors to signups is the next step.

**Context:** Would need: (1) `/signup` route with org name, admin email, org type fields,
(2) email verification flow, (3) automated org provisioning (create Organization + first
OrganizationMember with ADMIN role), (4) guided onboarding wizard (reuse OrgHealthWidget
activation steps), (5) free tier with upgrade path. The concierge onboarding checklist
becomes the self-serve onboarding wizard. Key decision: whether to require email
verification before org creation or after.

**Pros:** Unlocks organic growth; removes founder bottleneck from onboarding.
**Cons:** Requires trust & safety (spam orgs, abuse); support burden increases.

**Effort:** L | **Priority:** P2 | **Depends on:** Concierge playbook validated (3 orgs active), billing integration

---

### [P3] Feedback Form Server-Side Length Validation

**What:** Add max-length validation on the server side for feedback form responses
(currently only client-side `maxLength` on `<Textarea>`).

**Why:** The `submitFeedback` server action in `src/app/(public)/screening/feedback/actions.ts`
accepts arbitrary-length strings. A malicious or accidental submission could store 1MB+ of
text in the `OrgFeedback.responses` JSON field. Safe during concierge (3 trusted orgs) but
must be fixed before self-serve signup or public traffic.

**Context:** Add a `MAX_RESPONSE_LENGTH = 2000` constant. In `actions.ts`, truncate or
reject responses exceeding the limit. The client-side `<Textarea>` already has no explicit
`maxLength` prop — add one to match. Consider Zod schema validation in the server action
for consistency with repo conventions.

**Pros:** Prevents oversized payloads; consistent with Zod-everywhere convention.
**Cons:** Minimal — trivial change.

**Effort:** S | **Priority:** P3 | **Depends on:** Feedback form shipped (done)

---

### [P3] Cron Concurrency Guard — Claim-Based Processing

**What:** Add optimistic locking or claim-based processing to digest and re-engagement
cron services to prevent duplicate emails from concurrent runs.

**Why:** Current flow is read→send→update with no claim/lock. While Vercel cron runs
are serialized by schedule, manual curl triggers during an active run could cause
duplicate email sends.

**Context:** The `lastDigestSentAt` and `lastReengagementSegment` fields provide
after-the-fact idempotency, but a concurrent run could read the same batch before
updates are written. Fix options: (1) SELECT FOR UPDATE SKIP LOCKED on the batch
query, (2) a "processing" flag on CronJobRun that blocks concurrent starts,
(3) accept the risk since Vercel serializes cron triggers.

**Pros:** Eliminates theoretical duplicate emails under concurrent manual triggers.
**Cons:** Low probability scenario; adds query complexity; Vercel already serializes.

**Effort:** S | **Priority:** P3 | **Depends on:** Digest + re-engagement crons shipped

---

### [P3] User-Level Timezone Override

**What:** Allow individual users to set their own timezone, overriding the
organization-level default.

**Why:** Phase 10 adds organization-level timezone (IANA string on Organization
model, NULL = UTC). This handles 95% of cases, but volunteers in different
timezones than their org will receive notifications at suboptimal times.

**Context:** Would add a `timezone String?` field to `User` or `VolunteerProfile`.
Notification delivery logic would check user timezone first, fall back to org
timezone, then UTC. The org settings timezone dropdown pattern can be reused
on the profile page.

**Pros:** Precise notification delivery for distributed volunteer bases.
**Cons:** Additional complexity in cron grouping logic; edge case for now.

**Effort:** S | **Priority:** P3 | **Depends on:** Phase 10 org-level timezone shipped

---

### ~~[P3] Email Delivery Tracking Dashboard~~ ✅ Complete

**Completed:** v0.15.0 (2026-03-20)

Full email delivery tracking system: `EmailEvent` + `EmailBounceStatus` Prisma models,
Resend webhook handler at `/api/resend/webhook` (HMAC-SHA256 signature verification),
bounce suppression in `sendEmail()` with 3-bounce cap, unified webhook health dashboard
on `/app/admin/health` (Stripe + Checkr + Resend event counts), email bounce management
UI with per-address re-enable + platform admin "Reset All" override. 14 new tests
(6 email + 8 webhook).

**Effort:** ~~M~~ | **Priority:** ~~P3~~

---

## Dedupe Volunteer Applications

### [P3] Email-Based Dedup for Anonymous Applicants

**What:** Check by email whether an anonymous (unauthenticated) visitor has already applied
to the same opportunity, and show a warning if so.

**Why:** The auth-only dedup (v1) covers most cases since authenticated volunteers have
a `submittedByUserId`. But anonymous visitors can submit duplicate applications with the
same email address, creating extra work for org admins reviewing applications.

**Context:** Deferred from the dedupe-volunteer-apply PR because auth-only dedup covers
the primary use case. Email matching introduces complexity: typos, aliases (user+tag@),
shared emails, and privacy implications (confirming an email exists in the system).
The backend unique constraint is on `(submittedByUserId, opportunityId)` where userId
is NOT NULL, so anonymous duplicates are not blocked at the DB level.

**Pros:** Catches duplicate submissions from unauthenticated repeat visitors.
**Cons:** Privacy risk (email existence confirmation); complexity of email normalization;
edge cases with shared/family email addresses.

**Effort:** S | **Priority:** P3 | **Depends on:** Auth-only dedup implementation (this PR)

---

### ~~[P2] Application Withdrawal / Cancel Flow~~ ✅ Completed v0.23.2.0 (2026-04-21)

Full withdrawal flow shipped: `WITHDRAWN` enum value added, partial unique index updated to exclude both REJECTED and WITHDRAWN, `withdrawVolunteerApplication()` service with status guard (SUBMITTED/REVIEW only), audit log, volunteer email, and org admin in-app notification. `screener.withdrawApplication` tRPC procedure. Withdrawal button + confirmation dialog on My Applications detail page. 17 tests (service unit + component).

**Effort:** S | **Priority:** P2 | **Completed:** v0.23.2.0 (2026-04-21)

---

## Reference Data & Skill Catalog

### [P3] Admin-Extensible Skill Catalog

**What:** Admin UI + API for orgs to create custom skills scoped to their org, extending
the platform-wide skill catalog.

**Why:** Different nonprofits need domain-specific skills (e.g., "Equine Therapy" doesn't
exist in the platform catalog of 13 families / 62 skills). Custom skills unlock org-specific
matching and make the platform feel tailored to each org's domain.

**Context:** The `Skill` model currently has no `orgId` — all skills are platform-global.
Custom skills would need either an `orgId` field on `Skill` (nullable, NULL = platform-wide)
or a separate `OrgSkill` model. The data model decision depends on Phase 3 Matching Engine
design — the engine will heavily consume skills, and the wrong model forces workarounds.
The boot guard PR (`thehashrocket/fix-missing-seed-data`) extracts `SKILL_CATALOG` to
`src/server/domain/reference-data.ts` and adds version tracking via `ReferenceDataMeta`,
which provides the foundation for catalog extensibility.

**Pros:** Higher matching accuracy; orgs feel the platform fits their domain.
**Cons:** Complexity in matching engine (org-scoped vs platform skills); moderation concerns
(inappropriate custom skills); data model decision is blocked by Phase 3 design.

**Effort:** M | **Priority:** P3 | **Depends on:** Phase 3 Matching Engine design decisions

---

## SEO & Discoverability

### [P2] Content Hub / Blog Infrastructure

**What:** A `/blog` or `/resources` section for SEO content targeting searches like "how to
screen volunteers," "volunteer management best practices," and "background check requirements
for nonprofits." This is the standard SaaS playbook for building organic traffic through
topic authority — Google and AI assistants favor sites with a full content ecosystem over
one-off landing pages.

**Why:** VolunteerReady's current public pages are transactional (apply, browse opportunities,
pricing). There's no content that captures top-of-funnel searches — nonprofit staff researching
how to improve their volunteer program. A content hub would position VolunteerReady as the
authoritative source, driving organic traffic that converts to signups.

**Context:** Would need MDX or CMS-backed pages, a listing page with categories, RSS feed,
and an editorial workflow. Consider starting with MDX (static markdown files in the repo)
for simplicity, then migrating to a CMS when volume justifies it.

**Pros:** High long-term organic traffic value; builds topic authority; supports AI discoverability
(GEO); content can be repurposed for social media and email.
**Cons:** Requires ongoing content creation (not just engineering); needs an editorial owner;
initial infrastructure is a product feature, not just an SEO fix.

**Effort:** L | **Priority:** P2 | **Depends on:** Content strategy, editorial owner identified

---

### [P3] Programmatic City/Region Landing Pages

**What:** Location-specific pages like `/volunteer/dallas` or `/volunteer/austin` targeting
"volunteer opportunities in [city]" searches. These would pull from opportunity data to show
location-filtered volunteer listings with city-specific metadata and structured data.

**Why:** Volunteers overwhelmingly search by location ("volunteer opportunities near me",
"volunteer in Dallas"). These searches have high intent and low competition for a platform
like VolunteerReady. Programmatic landing pages capture this long-tail traffic at scale.

**Context:** Requires geographic data on opportunities (city/region fields), enough org
coverage per city to produce useful pages (thin content pages hurt SEO), and a route
structure like `src/app/volunteer/[city]/page.tsx` with `generateStaticParams` from
the opportunity database.

**Pros:** High organic traffic potential; captures volunteer-side searches (currently weak);
scales automatically as more orgs join in each city.
**Cons:** Premature without sufficient data density — pages with <3 opportunities look empty
and may be penalized by Google as thin content; requires geographic normalization.

**Effort:** L | **Priority:** P3 | **Depends on:** >50 orgs across multiple cities; geographic
data on opportunities

---

### [P3] WebSite JSON-LD with SearchAction

**What:** Add `WebSite` JSON-LD schema to the root layout with a `SearchAction` pointing to
a public search endpoint (e.g., `/search?q={query}`).

**Why:** Google uses WebSite schema with SearchAction to power sitelinks search boxes in
search results. This improves discoverability and provides a direct search experience from
Google.

**Blocked by:** No public search endpoint exists yet. Implement this after building a public
search feature (e.g., opportunity search across all orgs).

**Effort:** S | **Priority:** P3 | **Depends on:** Public search endpoint

---

### [P3] Sitemap Index Splitting & Tenant Scoping

**What:** The current sitemap queries all organizations and emits all routes in a single
response. At scale (16k+ orgs), this exceeds the 50,000-URL sitemap limit and risks
timeouts. Additionally, all org slugs are publicly enumerable via the sitemap.

**When to address:** When org count exceeds ~5,000 or when tenant privacy becomes a concern.

**Fix:** Implement sitemap index (`/sitemap.xml` → `/sitemap-static.xml` + `/sitemap-orgs-1.xml`
etc.) with pagination. Consider filtering to orgs with published content only.

**Effort:** S | **Priority:** P3 | **Depends on:** Org count growth

---

## Marketing & Conversion (v0.18+)

### [P2] Founder Demo Video on /screening and Homepage

**What:** Record a 60-90 second Loom-style walkthrough (create org, post opportunity, run
background check) and embed on `/screening` and the homepage. The video placeholder was
removed from `/screening` in the marketing page update PR — re-add the section with the
real embed when the recording is ready.

**Why:** SaaS conversion research (2026) shows founder video is the #1 conversion tool —
80%+ lift on landing pages. A raw, direct-to-camera walkthrough builds trust faster than
any amount of copy.

**Context:** The `/screening` page previously had a video placeholder section (lines 137-151)
showing "Founder demo video — embed URL here." It was removed for being unprofessional.
When a real video exists, re-add the section using the same layout (aspect-video container,
caption below). The homepage could use a similar section after the hero or after the
competitive positioning section.

**Effort:** S (30 min to record, 5 min to embed) | **Priority:** P2 | **Depends on:** Founder recording the video

---

### [P3] G2 and Capterra Review Listings

**What:** Get VolunteerReady listed on G2 and Capterra. Once listed with initial reviews,
embed live review badges on the homepage and `/screening` page.

**Why:** Third-party review platforms are the strongest trust signal for B2B SaaS buyers.
Live review feeds from G2/Capterra embedded on landing pages are a top conversion driver
in 2026.

**Context:** VolunteerReady is not currently listed on any review platform. Getting listed
requires: (1) creating a vendor profile on G2 and Capterra, (2) getting 5-10 initial reviews
from real users, (3) embedding the review badge widget on marketing pages. Both platforms
offer free listing tiers. The embed is typically a `<script>` tag or React component.

**Effort:** M (1 week for listing + first reviews, 5 min to embed) | **Priority:** P3 | **Depends on:** Having real customers to provide reviews

---

## Phase 11 — Deferred Items (from /autoplan review 2026-03-22)

Items deferred from Phase 11 during CEO + Eng review. Original scope was 13 items / 12 PRs.
Revised scope: 7 items / 6 PRs (marketplace foundation + key volunteer experience).
Deferred items become Phase 11B when there are API consumers and PRO customers.

### [P2] Public REST API v1

**What:** REST API with SHA-256 hashed API keys, scoped permissions, 100 req/min rate limit.
Endpoints: opportunities, applications, credentials, shifts, webhooks.
OpenAPI spec via `zod-to-openapi`, Swagger UI at `/api/v1/docs`.

**Why deferred:** No identified API consumers. High maintenance commitment (versioning,
backward compat, docs) for a solo operator. Premature until there's customer demand.

**Codex note:** Write endpoints need idempotency keys or hard conflict semantics to prevent
duplicate side effects from client retries.

**Effort:** L | **Priority:** P2 | **Depends on:** Customer demand for API access

---

### [P2] Outbound Webhooks

**What:** HMAC-SHA256 signed events, initial delivery + retry via waitUntil() + cron sweep.
Admin UI at `/app/settings/webhooks` with delivery health table.

**Why deferred:** Depends on API. High maintenance (delivery monitoring, retry infrastructure).
`waitUntil()` context issue: only available in request context, not arbitrary services.
Retry state machine not fully coherent (1 fast + 4 cron attempts, but 5 intervals specified).

**Effort:** M | **Priority:** P2 | **Depends on:** API v1

---

### ~~[P3] Grant/Funding Tracker~~ — PERMANENTLY REMOVED (2026-03-22)

**Why removed:** Founder has direct experience building a grant matching application.
Grant program APIs vary wildly by state and funder; integrating outside California or
federal programs is prohibitively difficult. Not a fit for this platform. Do not
re-propose without evidence of a standardized grant API ecosystem.

---

### [P3] Volunteer Streaks & Gamification

**What:** `VolunteerStreak` tracking (consecutive weeks with ATTENDED), milestone badge
computation, display on profile and dashboard.

**Why deferred:** Gamification before marketplace critical mass is premature.

**Effort:** S | **Priority:** P3 | **Depends on:** Active volunteer base

---

### [P3] "Bring a Friend" Referral System

**What:** `ReferralLink` with short token, 30-day expiry, landing page, rate limit.

**Why deferred:** Phase 12 already has referral system (`/apply/refer` + referral prompt).
Duplicating with a slightly different model is unnecessary.

**Effort:** S | **Priority:** P3 | **Depends on:** Evaluate if Phase 12 referral is sufficient

---

### [P3] Google Calendar Sync

**What:** "Add to Calendar" links (Google URL + .ics), subscribable `.ics` feed with
hashed token auth.

**Why deferred:** Nice-to-have, not adoption-driving.

**Effort:** S | **Priority:** P3 | **Depends on:** Active volunteer base using shifts

---

## Geo-Targeted Landing Pages (Deferred from CEO Review 2026-04-11)

### ~~[P2] Lead Analytics Dashboard~~ **Completed:** v0.19.0 (2026-04-11)

Built as `/app/admin/leads` with location filtering, total count, and lead detail cards.
Platform admin gated via `platformAdminProcedure`.

---

### [P3] Email Retry Queue for Lead Notifications

**What:** Dead letter table or scheduled reprocess for failed lead notification emails
(both instant response to lead and founder notification).

**Why deferred:** Fire-and-forget with logging is acceptable at zero traffic. Retry
mechanism matters once lead volume makes silent failures costly.

**Context:** Lead capture service uses Nodemailer fire-and-forget. Failures are logged
but not retried. A `FailedEmail` table with a cron reprocess (similar to existing
`org-feedback` cron pattern) would close the gap.

**Effort:** S | **Priority:** P3 | **Depends on:** Lead capture pipeline shipped, observed email failures

---

### [P3] Automated Nonprofit Count Refresh

**What:** Periodic refresh of county nonprofit counts from IRS NTEE data or Census API.
Update `locations.ts` registry or move counts to a DB table with a refresh cron.

**Why deferred:** Hardcoded counts from manual research are fine for 6 pages. Automation
matters if location pages scale beyond Central Valley.

**Context:** Current design uses a TypeScript registry (`src/lib/locations.ts`) with
hardcoded `nonprofitCount` per location. IRS Exempt Organizations Business Master File
(BMF) is the canonical source. Refresh cadence: quarterly would be sufficient.

**Effort:** M | **Priority:** P3 | **Depends on:** Initial location pages validated, decision to scale beyond 6 pages

---

## Design review follow-ups (/design-review, 2026-06-11, branch thehashrocket/design-review)

Nine findings were fixed atomically on the branch (Geist body font, pricing
contrast, undefined token classes, 44px touch targets, Fraunces on apply flow,
slideInLeft keyframes, marketplace empty-state CTA, off-palette colors,
curly quotes). The following were deferred — too broad or needing an owner call:

- **[P2] Arbitrary type sizes** — ~46 instances of `text-[32px]` plus 10px/11px
  one-offs on public pages. 32px isn't in the DESIGN.md scale (nearest: 30/36).
  Sweep to the defined scale tokens.
- **[P2] Card-led app UI** — volunteer dashboard, `/app/welcome`, and platform
  admin compose as stacked/tiled cards instead of layout regions (flagged by
  both Codex and Claude outside voices as the "stacked cards instead of layout"
  rejection). Structural redesign of app entry points.
- **[P3] Fixed-width panels** — admin feedback split view hardcodes 360px
  panels (`admin/feedback/page.tsx`), my-skills hardcodes a 400px popover; not
  mobile-safe.
- **[P3] Hardcoded content widths** — `w-[1040px]` and bespoke max-widths drift
  from the 1120px DESIGN.md content width; consolidate to one container token.
- **[P3] Login copy claim** — "Join thousands of volunteers" on `/login` is an
  unbacked claim at current scale; founder copy decision.

Full report: `~/.gstack/projects/thehashrocket-volunteerready.org/designs/design-audit-20260611/`

## Design review follow-ups (/design-review, 2026-07-12, branch thehashrocket/design-review-v1)

Eleven findings fixed atomically on the branch (five of six marketing product
screenshots recaptured with realistic data — esg.png recaptured as a clean
zero-state pending the ESG query bugfix below — the old ones showed skeleton
states, empty states, a locked paywall, and dev emails; missing
applications-queue.png created; dark-mode calculator card; `<main>` landmarks
on all public pages; Playfair font drift removed; apply-page duplicate
heading; About/Security hero CTAs; stats-bar Fraunces numbers). Deferred:

- ~~**[P0] BUG: ESG dashboard client crash — "Cannot read properties of null
  (reading 'id')"**~~ ✅ **Same root cause as the ESG Dashboard entry above
  (TODOS:~30), fixed 2026-07-15 via `/investigate`.** Not an application
  bug — `e2e/esg-dashboard.spec.ts`'s `afterAll` cleanup matched rows by a
  shared literal prefix and ran unscoped, so a faster parallel worker's
  cleanup could delete a slower worker's still-in-use session/company mid-test.
  This "client null.id crash" and the later "wrong page rendered" sighting
  (2026-07-13/07-14) were the same race manifesting at different points in
  the render depending on exactly when the yank happened — not two separate
  bugs. Fix: cleanup is now scoped to each worker's own created IDs.
- ~~**[P1] BUG: ESG summary query 500s, UI shows it as empty state**~~ ✅
  Fixed (issue #126). Root cause confirmed: `Prisma.join()`/`Prisma.sql`
  fragments interpolated into `$queryRaw` templates lose `Sql` class
  identity across Turbopack dev module graphs and get sent as one literal
  parameter. Both ESG queries rewritten as static NULL-checked templates;
  same latent pattern fixed in `publicOpportunityRepo.searchWithTsvector`.
  Page got real error states (esgQ + companyQ) with retry; exports disabled
  on error. `to` dates now normalized to end-of-day. Verified NOT broken in
  production builds (dev-server-only bug) via authenticated Playwright e2e
  (`e2e/esg-dashboard.spec.ts` — new auth harness seeds a DB session).
  `public/marketing/esg.png` recaptured with real seeded aggregates.
  **Completed:** v0.26.4.0 (2026-07-12)
- **[P2] Nav misroutes in app sidebar** — "ESG Report" pointed to
  `/app/company/[id]/team` (route named "team" rendered the ESG page);
  "Settings" pointed to `/app/credentials`; Company + ESG Report both
  highlighted active (prefix-match). Fixed: route renamed to `/esg`,
  credentials moved to `/app/settings/background-checks`, new settings hub,
  longest-match single-highlight nav. **Completed:** v0.27.0.0 (2026-07-13)
- **[P3] Two-column settings shell when /app/settings outgrows stacked panels** —
  (from /plan-design-review of issue #127, 2026-07-12.) The settings hub ships
  as two stacked panels (Organization profile form + "Access & setup" nav rows)
  per the approved mockup — Codex's outside-voice review argued for a two-column
  shell (form workspace + settings nav rail), overruled because today's content
  is one form and three links. Revisit when the hub exceeds ~6 sections
  (webhooks admin at TODOS:~1064 and notification/billing settings are likely
  growth). Start: `src/app/(app)/app/settings/page.tsx`, approved mockups at
  `~/.gstack/projects/thehashrocket-volunteerready.org/designs/settings-hub-20260712/`.
  **Effort:** M | **Priority:** P3 | **Depends on:** settings hub shipping (issue #127).
- **[P1] Local `pnpm build` fails prerender with React useContext null** (#136) —
  BLOCKED ON UPSTREAM, filed as [vercel/next.js#95741](https://github.com/vercel/next.js/issues/95741)
  (2026-07-13, /investigate). Root cause confirmed: an upstream Next.js 16.x
  Turbopack bug prerendering the internal `/_global-error` page (matches
  vercel/next.js #86178, #84994, #87719 — all closed only for lacking a
  repro, not fixed). The recurring "unique key prop... `<html>`" warning on
  every build is the tell — Turbopack batches routes' root elements
  (including global-error's self-contained `<html>`) into one render pass
  without keys, and the crash lands on whichever route gets scheduled
  adjacent to the broken batch (why the victim page varies by run/branch).
  Ruled out via elimination (each verified with a fresh `pnpm build`): the
  orphaned root-level `instrumentation.ts`/`instrumentation.client.ts`/
  `sentry.client.config.ts` files, `@sentry/nextjs`/`withSentryConfig`
  entirely, stale `.next` cache, Node version mismatch (22.23.1 vs pinned
  24.11), our custom `global-error.tsx`, and a bump to `next@16.2.10`
  (latest 16.2.x). `experimental.cpus: 1` doesn't fix it either — it just
  relocates the crash directly onto `/_global-error`, confirming the bug
  is intrinsic to Next's own error-page prerender. `--webpack` isn't a
  viable workaround: it fails immediately on an unrelated pre-existing bug
  (see the new P3 item below). Vercel builds are unaffected, so this blocks
  only local production-build verification (`/ship`'s build gate runs
  blind). No further action on our side until upstream responds — recheck
  vercel/next.js#95741 periodically. **Effort:** — (upstream) | **Priority:** P1 | **Depends on:** vercel/next.js#95741.
- **[P3] Orphaned root-level Sentry instrumentation files** — (found during
  #136 investigation, 2026-07-13.) `instrumentation.ts`, `instrumentation.client.ts`,
  and `sentry.client.config.ts` at repo root are dead code, leftover from an
  earlier Sentry wizard run — superseded by `src/instrumentation.ts` and
  `src/instrumentation-client.ts`, which are the versions Next actually
  resolves under the project's `src/` layout. Safe to delete; confirmed via
  build testing that removing them changes nothing. **Effort:** S | **Priority:** P3 | **Depends on:** —
- **[P3] `node:crypto` reachable from a client bundle** — (found during #136
  investigation, 2026-07-13, testing `next build --webpack` as a workaround.)
  `src/server/lib/checkin-token.ts` (uses Node's `crypto`) is reachable from
  a client component graph via `src/components/app/qr-checkin-code.tsx` →
  `src/app/(app)/app/my-shifts/page.tsx`. Only surfaces as a hard failure
  under webpack today (Turbopack tolerates it), but it's a real server-only
  boundary violation that should be fixed regardless — e.g. mark
  `checkin-token.ts` with `import 'server-only'` and move token generation
  behind a server action/tRPC call instead of importing it directly into a
  client component's module graph. **Effort:** S | **Priority:** P3 | **Depends on:** —
- **[P3] No `engines.node` pin in package.json** — (found during #136
  investigation, 2026-07-13.) Local shell drifted to Node v22.23.1 despite
  `.nvmrc` pinning `24.11`, with nothing catching the mismatch. Add an
  `engines.node` field (and consider a `preinstall` check) so a version
  drift like this fails loudly instead of silently. **Effort:** S | **Priority:** P3 | **Depends on:** —
- **[P3] OrgSlugHistory permanent namespace lock needs an admin release tool** —
  (from /ship adversarial review of issue #127, 2026-07-13.) Slug history rows
  persist forever and now block BOTH new-org creation (`slugExistsInHistory`)
  and other orgs' renames (foreign-history check) — correct anti-squatting
  defaults, but a malicious org can still permanently retire 3 slugs/day
  (rate limit caps velocity, not accumulation), and platform admins have no
  release/purge tool. Options: history TTL, per-org history cap, or a platform
  admin "release slug" action that deletes history rows. Start:
  `src/server/services/orgService.ts` (checks), `OrgSlugHistory` model.
  **Effort:** M | **Priority:** P3 | **Depends on:** issue #127 shipping.
- **[P3] ESG date filters use UTC day boundaries** — (from /ship red-team
  review of issue #126, 2026-07-12.) Date-only `from`/`to` values parse as
  UTC midnight on every path (page date inputs, CSV/PDF query params), and
  `normalizeESGDateRange` bumps `to` to UTC end-of-day. For a UTC-8 user,
  "To: Jan 31" covers through 3:59pm local Jan 31 — evening local shifts on
  the chosen end day are excluded. Every test pins UTC so nothing catches
  it. Fix: send the raw `YYYY-MM-DD` plus an IANA timezone to the server
  and compute day bounds there, or label the filters/exports as UTC in the
  UI. **Effort:** M | **Priority:** P3 | **Depends on:** deciding whose
  timezone governs a company-wide report (company setting vs viewer).
- ~~**[P2] Company pages: URL scoping vs session scoping mismatch**~~ ✅
  **Completed (2026-07-15)** — new `requireCompanyAccess()` service
  (`src/server/services/companyAccessService.ts`) is the single source of
  truth for company membership/role/plan-tier checks, always keyed off a
  caller-supplied `companyId` (never session state). New input-driven
  `companyScopedProcedure` factory in `src/server/trpc/init.ts` replaced
  the deleted session-based `companyProcedure`/`companyAdminProcedure`/
  `companyPlanTierProcedure`. All 5 `company.ts` router procedures and
  `esgReport.getSummary` migrated to take `companyId` from input; both
  client pages (`company/[companyId]/page.tsx`,
  `company/[companyId]/esg/page.tsx`) read `companyId` via `useParams()`
  and thread it through every query/mutation/export-URL. CSV/PDF export
  routes deduped onto the shared service. `CompanySwitcher.tsx` now
  navigates to the new company's URL on switch (preserving subpath), with
  two additional bugs caught and fixed by adversarial review before ship:
  (1) the switch-navigation regex also matched the bare `/app/company/{id}`
  route incorrectly (`undefined` capture group looked like "no match") and
  (2) the regex separately false-matched the static `/app/company/new`
  route, treating the literal segment "new" as a companyId — both fixed
  with a shared `matchCompanyRoute()` helper and mirrored in
  `app-sidebar.tsx`'s identical `urlCompanyId` pattern. `company/[companyId]/page.tsx`
  also gained `isLoading`/`isError` handling for its two queries (previously
  near-infallible session reads, now real auth-checked network calls that
  can 403) via a new shared `QueryErrorCard`/`safeErrorMessage`
  (`src/components/app/query-error-card.tsx`, extracted from the ESG page's
  existing pattern). Full test coverage added: `companyAccessService.test.ts`,
  `CompanySwitcher.test.tsx`, `company/[companyId]/__tests__/page.test.tsx`,
  `esg/__tests__/page.test.tsx` extended, `app-sidebar.test.tsx` extended,
  and a new multi-company e2e case in `e2e/esg-dashboard.spec.ts`.

- ~~**[P1] Impersonation context doesn't propagate to raw Next.js route
  handlers or the company layout guard**~~ ✅ **Completed v0.29.3.0
  (2026-07-20)** — extracted `resolveEffectiveUserId(realUserId, cookieValue)`
  as a pure function in `impersonation-context.ts` (no `getServerSession`/
  `cookies()` inside it) and threaded it through `createTRPCContext`
  (replacing its inline `resolveImpersonation()` call) plus every raw call
  site: `esg-report/{csv,pdf}/route.ts`, `company/[companyId]/layout.tsx`,
  `company/page.tsx` (also fixes a redirect loop for an impersonated
  non-member — Codex outside-voice finding), `invite/company/[token]/page.tsx`
  (was unconditionally FORBIDDEN under impersonation — checked the real
  admin's email against the invite instead of the target's), and
  `checkr/oauth/callback/route.ts` (CSRF `state` check now resolves the
  target's org, not the admin's). ESG audit logs
  (`employerReportService.ts` + `esg-report.ts` router), the Checkr
  `CHECKR_CONNECTED` audit action, and company-invite-acceptance audit logs
  all gained `impersonatedBy` metadata matching the `org.ts`/`orgService.ts`
  convention (Checkr + invite-accept found missing by a Claude adversarial
  pass and a `codex review` pass during `/ship`, respectively).
  **Also found and fixed during `/ship`'s adversarial review (`codex
  review`, 2 rounds):** `resolveEffectiveUserId()` originally preserved the
  pre-existing (v0.23.2.1) fail-*open* behavior — falling back to the real
  admin's identity when `resolveImpersonation()` throws. That was safe for
  the old read-only consumers but unsafe once reused by mutation paths
  (Checkr connect, invite accept) and read-then-write SSR pages
  (`settings/page.tsx` renders org data, then a separate tRPC mutation
  saves it) — a transient resolution error could seed a save that writes
  to the wrong tenant. Changed to fail **closed**: `resolveEffectiveUserId()`
  now returns `effectiveUserId: null` + `resolutionFailed: true` on a
  thrown resolution error; `getImpersonationContext()` propagates
  `resolutionFailed`; `company/page.tsx` and `settings/page.tsx` explicitly
  check it and refuse to fall back to the admin's own session data.
  `app/layout.tsx`'s banner/nav rendering was deliberately left on the old
  fail-open behavior — no mutation is seeded from its rendered state, so
  read-only degradation is an acceptable, previously-accepted tradeoff.
  44+ new/updated unit tests across `impersonation-context.test.ts` and
  every touched call site's colocated test.
- **[P2] Impersonated actions on a multi-org/multi-company target always
  resolve to the target's *oldest* membership, with no way for the admin
  to pick another one** — (found by both an internal red-team pass and
  `codex exec` adversarial review during the impersonation-context fix
  above, 2026-07-20; NOT introduced by that fix — mirrors a heuristic
  already in `app/layout.tsx` before this change, now extended to two
  additional, more consequential surfaces.) `checkr/oauth/callback/route.ts`
  and `company/page.tsx` resolve the impersonated target's org/company via
  `organizationMember`/`companyMember.findFirst({ orderBy: { createdAt:
  'asc' } })` since there's no session-token-derived "current" org/company
  for a user who isn't actually signed in. Verified this is internally
  consistent (both the OAuth `state` embedding via `ctx.orgId` and the
  callback's verification use the identical heuristic, so the round-trip
  doesn't silently break) and doesn't leak cross-tenant data — but for a
  target who belongs to 2+ orgs/companies, the impersonating admin has no
  way to act on any org/company besides the target's oldest one. Fix would
  need an explicit org/company selector surfaced to the impersonating admin
  (mirroring how ESG export routes take `companyId` from the URL, never
  session state) rather than an implicit "first membership" guess.
  **Effort:** M | **Priority:** P2 | **Depends on:** None.
  **Split via `/plan-eng-review` (2026-07-20):** the `company/page.tsx` +
  `app/(app)/app/layout.tsx` sidebar-link half is ✅ **fixed in this PR** —
  explicit picker via the shared `LinkRowList` component when 2+ company
  memberships exist, plus routing the sidebar's "Company" link to the bare
  `/app/company` picker instead of a guessed company when ambiguous. The
  `checkr/oauth/callback/route.ts`
  half is deferred to its own item below — it touches CSRF `state` validation
  and a DB write (Checkr token persistence), which warrants isolated
  adversarial review rather than riding along with an unrelated UX fix.
- **[P2] Checkr OAuth org-selection for multi-org impersonated targets** —
  (split off the item above via `/plan-eng-review`, 2026-07-20.)
  `src/app/api/checkr/oauth/callback/route.ts:75-101` resolves the
  impersonated target's org via the same "oldest membership"
  `organizationMember.findFirst({ orderBy: { createdAt: 'asc' } })` heuristic,
  but here the guessed org feeds a CSRF `state` validation *and* a subsequent
  DB write (`connectCheckrAccount()` persists the Checkr access token onto
  that `Organization` row). An admin impersonating a target in 2+ orgs can
  never connect Checkr for any org but the target's oldest one. The OAuth
  `state` param is set to `ctx.orgId` at URL-generation time
  (`getCheckrOAuthUrl` tRPC procedure) using the identical heuristic, so the
  round-trip is internally consistent today (doesn't break, doesn't leak
  cross-tenant data) — it's just permanently pinned to one org. **Fix
  direction:** surface an explicit org selection at OAuth-initiation time
  (mirroring how ESG export routes take `companyId` from the URL, never
  session state), validated the same way `state` is today. **Effort:** M |
  **Priority:** P2 | **Depends on:** None — independent of the company-page
  half above.
- **[P3] Generalize `impersonatedBy` audit metadata into `writeAuditLog()`
  itself** — (spun off from the impersonation-context fix above,
  `/plan-eng-review` 2026-07-20.) `org.ts`/`orgService.ts`,
  `employerReportService.ts`, `backgroundCheckService.ts`, and
  `companyService.ts` each now hand-roll `impersonatedBy` into their own
  `metadata` shape independently — four copies of the same
  `...(impersonatedBy ? { impersonatedBy } : {})` pattern as of v0.29.3.0.
  Add `impersonatedBy?: string | null` to `AuditLogInput`
  (`src/server/repositories/auditRepo.ts:17`) and fold it into `metadata`
  once inside `writeAuditLog`/`writeAuditLogTx`, instead of every call site
  reimplementing the same shape. Optional — every existing caller works
  fine without it; this just removes a copy-paste-miss risk for the next
  one. **Effort:** S | **Priority:** P3 | **Depends on:** None.
- ~~**[P2] Banned grid patterns on public pages**~~ ✅ **Completed v0.27.1.0
  (2026-07-13)** — homepage `pillars` + `differentiators` sections
  consolidate into a shared `EditorialList` component (icons dropped from
  pillars); `/for` `audiences` section mirrors the existing
  `locations/page.tsx` link-row pattern (divide-y, alternating stripe,
  hover, ArrowRight) instead of a grid. Design doc:
  `docs/designs/banned-grid-patterns.md`. See below for spun-off follow-ups.
- ~~**[P3] Annotated product imagery for homepage/`/for`**~~ ✅ **Completed
  v0.28.0.0 (2026-07-13)** (issue #139) — homepage `pillars` replaced with 3 annotated
  screenshot rows (numbered gold markers + HTML legend via new
  `src/components/annotated-screenshot.tsx`); `/for/nonprofits`,
  `/for/volunteers`, `/for/employers` screenshots annotated via a new
  `annotations` prop on `ScreenshotSection`. The `/for` index deliberately
  keeps `LinkRowList` (navigation index ≠ content surface — won't-do, per
  eng review). Assets are wired through `src/lib/marketing-screenshots.ts`
  (single source of truth) and regenerated deterministically by
  `pnpm screenshots` (e2e Playwright `capture` project +
  `e2e/capture-scenarios.ts`; 2 new captures: credentials wallet, impact
  report). CI guards: manifest-driven asset-existence test + scrolled
  naturalWidth e2e assertions + 375px mobile pillar test. Spun-off
  follow-ups tracked above (animal-shelters screenshot, dark-mode variants,
  how-it-works/screening annotations).
- ~~**[P3] Annotated screenshots for `/how-it-works` + `/screening`**~~ ✅
  **Completed 2026-07-14** — the two remaining plain `ScreenshotSection`
  callers after #139 got 3 marker/label pairs each, drawn from their own
  screenshot's real UI. `/screening`'s screener.png shares the homepage
  "Background checks" pillar's underlying image but uses distinct copy (FCRA
  workflow framing vs the homepage's broader compliance framing) — no
  conflict, since marker data lives per-page, not baked into the PNG. Also
  fixed `/screening`'s stale alt/caption, which described an "application
  review queue" — screener.png actually shows the Screener Questions config
  UI. `/design-review` ran first (its own blocking precondition) and also
  caught and fixed a real bug in the same component family: the homepage's
  `priority` `dashboard.png` hero shot was invisible on any viewport under
  ~820px tall (`FadeInOnScroll` started it at `opacity:0` and the reveal
  threshold never fired) — fixed by skipping the fade-in wrapper for
  `priority` images. `e2e/public-pages.spec.ts` gained legend/marker
  assertions for both pages.
- ~~**[P3] Dark-mode marketing screenshot variants**~~ ✅ **Completed
  v0.29.0.0 (2026-07-14)** — CSS-only swap (not `<picture>`, not `useTheme()`):
  `AnnotatedScreenshot` renders two `<Image>` elements toggled via Tailwind
  `dark:hidden`/`hidden dark:block`, matching the pre-paint `.dark` class
  `next-themes` already sets — the first `dark:` utility usage in
  `src/app/(public)/**` (which otherwise carries dark mode via CSS tokens
  only, per open issue #131). `MARKETING_SCREENSHOTS` entries gained an
  optional `darkSrc` field; `capture-scenarios.ts` gained a
  `variants: ('light'|'dark')[]` field; the capture runner now calls
  `page.emulateMedia({ colorScheme })` before `page.goto()` per variant.
  Every entry except `dashboard.png`'s homepage usage got a dark variant (the
  `priority`-loaded hero call site stays light-only; `dashboard.png` itself
  later gained a `darkSrc` for its non-priority `/how-it-works` reuse — see
  "Adversarial review findings" below). Error handling: per-variant
  state, hides only the variant whose image fails — achieved by having each
  variant's own wrapper (image + legend together) null itself independently,
  with zero JS theme detection. **Two real bugs caught and fixed during
  implementation, both verified live in a real browser (not just unit
  tests):** (1) the pre-hydration "broken before hydration" check
  (`el.complete && naturalWidth===0`) false-positived on every hidden dark
  variant, since a `display:none` image that never attempted to load reports
  the identical signature as a genuinely broken one — fixed by gating that
  check on `priority` (its only real use case). (2) the CSS visibility class
  was originally applied only to the image frame, not the legend below it —
  both variants' legends rendered simultaneously regardless of theme; fixed
  by moving the class to the shared outer wrapper. `pnpm screenshots`
  regenerated all 7 light+dark pairs against a freshly reset local dev DB
  (a stale DB had accumulated duplicate boot-guard + seed-dev.ts screener
  questions, dirtying the first capture attempt). `e2e/public-pages.spec.ts`
  gained a dark-mode counterpart of the existing image-loaded suite.
- ~~**[P3] Screenshot for `/for/animal-shelters`**~~ ✅ **Completed
  v0.29.0.0 (2026-07-14)** — the last `/for` sub-page without a `ScreenshotSection`.
  Reused `devOrg` instead of seeding a new org from scratch: it already had
  shelter-flavored screener questions (`comfort_reactive_animals`,
  `attest_no_abuse`) and sample applications, just zero opportunities and an
  unusable public-facing name. Renamed its display name (slug unchanged) to
  "Riverside Animal Shelter" and added 2 shelter-flavored opportunities ("Dog
  Walking & Enrichment", "Front Desk & Adoption Support"), linking the 3
  existing sample applications to the first so the captured applications
  queue shows real status/screening variety (Rejected/Fail/1 flag, In
  review/Needs review/2 flags, Submitted/Pass) instead of the opportunity
  column's "—" empty-fallback. New capture scenario + `shelterAdmin` actor
  (`admin@volunteermatch.local`, the only seeded account scoped to a single
  org — no org-switcher clutter in the screenshot) added alongside the other
  7 in the existing light+dark pipeline. 3 markers added to the page,
  positioned to avoid overlapping table text. Added to
  `e2e/public-pages.spec.ts`'s `SCREENSHOT_PAGES` (covered automatically by
  both the light and dark-mode describe blocks). **Known pre-existing,
  unrelated test failure surfaced during verification (resolved 2026-07-15,
  see TODOS:~30):** `e2e/esg-dashboard.spec.ts`'s "loads real aggregates"
  test failed here — the page rendered the generic volunteer app shell
  instead of the company ESG view. Confirmed unrelated to this PR: that spec
  seeds its own fully isolated `__esg_e2e__`-prefixed data and doesn't touch
  `devOrg`/Acme Corp; the failure symptom (wrong page rendered) also didn't
  match the `esgReport.getSummary` 500 the spec was written to catch (issue
  #126, closed). Root cause was a test-isolation race in the spec's own
  cleanup, not application code — see the resolved P0 entry above for the
  full root cause and fix.
- ~~**[P3] Shared link-row component for `/for` + `/locations`**~~ ✅
  **Completed v0.27.3.0 (2026-07-13)** (issue #140) — extracted
  `src/components/link-row-list.tsx` (`LinkRowList`, fixed prop shape,
  `<h2>` headings, `href` as key), consumed by both `for/page.tsx` and
  `locations/page.tsx`. Also added e2e coverage for the `/locations` index
  page's navigation (previously untested) and expanded slug-level smoke
  coverage from 1 to all 6 locations. Raised by Codex during the issue #128
  outside-voice review; deliberately deferred from that PR since
  `/locations` wasn't in scope for a P2 fix.
- ~~**[P2] Eyebrow/kicker inconsistency**~~ ✅ **Completed v0.27.2.0
  (2026-07-13)** — extracted `src/components/eyebrow.tsx` (`as` prop for
  p/h2/dt, `tone` prop for primary/muted) with 30 direct call sites across
  13 files (public pages, apply flow, footer); pages that render through
  `PublicHero`/`LocationHero` (homepage, about, pricing, screening,
  security, search, how-it-works, `/for` + sub-pages, privacy, terms, all
  6 location pages) inherit it automatically (issue #129).
- **[P3] Two hero systems** — PublicHero vs LocationHero (different grids,
  breakpoints, alignment) plus hand-rolled centered heroes on
  stories/locations/opportunities index pages.
- **[P3] Dark-mode coverage on public pages** — theme toggle is exposed
  publicly but public pages have no `dark:` classes; tokens carry most
  surfaces (verified), but hardcoded whites are a per-page risk. Either
  sweep or hide the toggle on public routes.
- **[P3] Pill-radius policy** — `rounded-full px-8` CTAs contradict
  DESIGN.md "md: 8px buttons"; the pills look intentional — recommend
  amending DESIGN.md instead of the buttons.
- **[P3] JSON-LD script-tag console warning** on public pages (FAQ/breadcrumb
  components render `<script>` inside React trees).

Full report: `~/.gstack/projects/thehashrocket-volunteerready.org/designs/design-audit-20260712/`

## Deferred from the staff-created-volunteers eng review (2026-07-26)

Raised during `/plan-eng-review` of `docs/designs/staff-created-volunteers.md`.
That plan was split into v1a (roster + staff shift assignment + email guard)
and v1b (invite email, `/welcome/[token]`, token lib, claim/decline). Items
below were deliberately kept out of the v1a diff.

- ~~**[P1] `linkApplicationsToUser()` auto-links applications across all orgs
  with no scope**~~ ✅ **FIXED (2026-07-27)** — took the "explicit confirmation"
  branch of the two options below rather than org-scoping, because scoping by
  org breaks the legitimate anonymous-apply-then-sign-up path that
  `screener.submit` exists to serve, and that path is load-bearing for the
  public marketplace. `linkApplicationsToUser()` is deleted; nothing binds an
  orphan application implicitly any more.

  Replaced by `listClaimableApplications()` / `claimApplication()` in
  `my-applications.ts`, backed by `listClaimableApplicationsByEmail()` /
  `claimApplicationForUser()` in `volunteer-applications.ts`, surfaced as an
  "Is this you?" card on `/app/my-applications`. The email predicate lives in
  the repository's `where` clause, not in a caller-side comparison, so passing
  another user's application id matches zero rows instead of binding it;
  `claimApplication` throws `NOT_FOUND` for all three of "already claimed",
  "not yours", and "does not exist" so an id probe learns nothing. Claims write
  an `APPLICATION_CLAIMED` audit row (no migration — `AuditLog.action` is a
  plain `String`).

  Two things fixed in passing: the case mismatch, and the writing read path.

  ⚠️ Corrected — an earlier draft of this entry said "the lookup is now
  case-insensitive." **It is not, and must not be.** That was the intermediate
  version, and making it `mode: 'insensitive'` is the ILIKE wildcard CRITICAL
  described at the top of this file. What actually shipped is **plain equality
  against the canonical form**, made correct from both ends: T1's migration
  backfilled `VolunteerApplication.submittedByEmail` to `lower(btrim(...))`, and
  `screener.submit` / `screener.checkAnonymousApplication` now
  `.transform(normalizeEmail)` on input so no new row can be written dirty. The
  original problem was real — T1's trigger covered `User.email` but not this
  column, so a bare equality would have missed mixed-case submissions — but the
  fix was to canonicalize both sides, not to loosen the predicate.

  And the read path no longer writes: the old code ran an `updateMany` on every
  `/app/my-applications` load.

  Coverage — four files (counts deliberately omitted; they rot on every added
  case): `src/server/services/__tests__/my-applications.claim.test.ts`,
  `src/server/trpc/routers/screener.claim.test.ts` (the suite that pins the
  authorization boundary — that the address is resolved from the session user id
  and never from procedure input),
  `src/app/(app)/app/my-applications/__tests__/claimable-applications.test.tsx`,
  and `src/server/repositories/applicationClaim.integration.test.ts` (real DB —
  the security property is a `where` clause, which mocks cannot prove).

  **Correction to the severity claim below:** the "authorizes a paid background
  check" line was overstated. `backgroundChecks.initiate` requires the *caller*
  to supply the SSN/DOB — see the `pii` object in its zod input
  (`src/server/trpc/routers/background-checks.ts`, cited by symbol rather than
  line so the reference does not rot) — so an attacker without the victim's SSN
  could never reach the Checkr/Sterling call.
  The real escalation was `profile.getOrgVisibleProfile` (a stranger's
  staff-visible volunteer profile) and `credentials.issue`. Still P1, still
  fixed — but noting it so the next audit isn't calibrated off an inflated
  example. Original entry follows.

  - **[P1] `linkApplicationsToUser()` auto-links applications across all orgs
  with no scope** — Codex outside voice. `src/server/services/my-applications.ts:96-107`
  runs `updateMany({ where: { submittedByUserId: null, submittedByEmail: email } })`
  on every sign-in with no `orgId` filter, so any orphaned application matching
  the signing-in address is silently attached, regardless of which org created
  it. Live today, independent of the roster feature. Does not bite v1a because
  the review moved roster membership onto a dedicated `OrgVolunteer` join table
  instead of `VolunteerApplication`, so staff-add no longer produces orphan
  applications. It becomes load-bearing for **v1b**: a coordinator typo plus an
  ordinary magic-link login is exactly the wrong-email scenario Security §1 of
  the design doc worries about, and it happens with no invite involved.
  **Fix:** scope the auto-link to the org whose invite/roster row the user is
  claiming, or require an explicit confirmation step before attaching.
  **Blocks:** v1b. **Effort:** M.

  **SECOND CONSEQUENCE (2026-07-27, found by `/ship` security specialist):** this
  is no longer only a v1b blocker — it is now a live bypass of the
  `requireOrgVolunteerRelationship` guard. `APPLICATION` is an accepted
  relationship, and an application can be forged by someone who is not even
  authenticated: `screener.submit` is a `publicProcedure`
  (`src/server/trpc/routers/screener.ts:111`) accepting an arbitrary
  `submittedByEmail` and storing `submittedByUserId: null`. This unscoped
  `updateMany` then binds that row to whoever owns the address the next time
  they open `/app/my-applications`. So a staff user can plant a public
  application carrying a victim's email against their OWN org, wait, and their
  org acquires an `APPLICATION` edge to that victim — which authorizes a paid
  background check on them.

  Shipped knowingly: the guard is still a strict improvement (these procedures
  had NO check before), the attack needs an insider plus a victim action, and
  the correct fix is here at the root rather than in the guard's relationship
  set. **Do not close this ticket by narrowing the guard** — dropping
  `APPLICATION` would break the applications detail page and every org's real
  volunteers. **Fix:** distinguish "applied while authenticated" from "email
  matched later" (e.g. a `linkedAt` column set by this function, with the
  relationship probe requiring `linkedAt IS NULL`), which closes both this and
  the original v1b blocker.

- ~~**[P1] `shifts.markAttendance` and `shifts.getSignups` are unguarded
  cross-tenant IDORs**~~ ✅ **FIXED v0.32.2.0** — shipped wider than specified.
  The three named procedures were fixed, plus five more of the same class found
  while reading the file: `getById` (leaked the signup roster with names and
  emails) and the four mutations `update` / `cancel` / `complete` / `remove`,
  which accepted `orgId` and spent it only on the audit row — so the write hit
  the victim and was filed under the attacker. `remove` cascades to
  `ShiftSignup`, so it destroyed attendance history. Two more found by the
  `/ship` reviewers in `shiftTemplateService`: `update` and `remove` had the
  identical shape. Eleven total, all now through `requireOrgShift` /
  `requireOrgTemplate` in `src/server/services/shiftAccessService.ts`.
  Router-level `shifts.access.test.ts` pins that `ctx.orgId` (not an
  input-supplied org) reaches each service. Original entry follows.

  - **[P1] `shifts.markAttendance` and `shifts.getSignups` are unguarded
  cross-tenant IDORs** — found by the `/ship` security specialist while
  reviewing the guard fix; the first concrete findings of the systematic sweep
  called for below. Both take a client-supplied `shiftId` and never compare it
  to `ctx.orgId`:
  `getSignups` (`src/server/trpc/routers/shifts.ts:139`) reads another org's
  signup roster; `markAttendance` (`:144`) *writes* ATTENDED/NO_SHOW to another
  org's `ShiftSignup` and stamps the audit row with the victim org's `orgId` but
  the attacker's `actorId`. `shiftSignupService.ts:307` loads the shift and
  checks only that it exists. The sibling `checkinByQr` in the same router DOES
  check `shift.orgId !== ctx.orgId`, so this is an oversight, not a design
  choice. `getWaitlist` (`:211`) likely has the same shape — check it.
  **Fix:** pass `ctx.orgId` into `markAttendance`/`getShiftSignups`/`getWaitlist`
  and throw NOT_FOUND when `shift.orgId !== orgId`, mirroring `checkinByQr`.
  Deliberately kept out of the guard PR to keep one security fix per diff.
  **Effort:** S.

- **[P1] Audit every `staffProcedure` that accepts a naked `userId`** — eng
  review X3. Three procedures were found to take a user id with no check that
  the target has any relationship to the caller's org:
  `profile.getOrgVisibleProfile` (`src/server/trpc/routers/profile.ts:73`),
  `credentials.issue` (`src/server/trpc/routers/credentials.ts:47`), and
  background-check initiate (`src/server/trpc/routers/background-checks.ts:45`).

  **CORRECTION (2026-07-27):** this entry previously read "All three are being
  fixed in the v1a PR via a shared `requireOrgVolunteerRelationship()` helper."
  **They were not.** v0.32.0.0 shipped the roster foundation only; the helper
  did not exist in the tree and all three procedures stayed open. A security
  item recorded as fixed while live is worse than one recorded as open — noting
  the failure mode here so the next audit distrusts "being fixed in" phrasing
  about an unmerged PR. The three named procedures are now genuinely fixed (see
  `orgVolunteerAccessService.ts`), plus a fourth the original entry missed:
  `credentials.revoke`, which routes through the same `upsertCredential` as
  `issue` and so *creates* a REVOKED credential row when none matches — a
  cross-tenant write, visible to the victim because `getCredentialsByUserId` has
  no org filter. `credentials.remove` was checked and is safe by construction
  (`delete` on the compound key including `orgId` → P2025 on a foreign id).
  The systematic sweep below is still open.

  Both reviewers found the original three by grep, not by systematic sweep. Same
  bug class as the v0.29.2.0 company URL-scoping fix and the v0.29.3.0
  impersonation fix, both of which were found reactively. **Fix:** enumerate
  every `staffProcedure` in `src/server/trpc/routers/` whose input contains a
  user/volunteer id and confirm each authorizes against `ctx.orgId` — most
  should now just call `requireOrgVolunteerRelationship()`. **Effort:** M.

- **[P2] Both background-check/credential dialogs take a free-text "Volunteer
  User ID"** — found while fixing the P1 above.
  `src/app/(app)/app/settings/background-checks/page.tsx:211` and `:513` are raw
  `<Input placeholder="cuid…">` fields validated only by `z.string().min(1)`,
  with no org-scoped picker behind them. `requireOrgVolunteerRelationship()` now
  rejects a foreign id server-side, so this is no longer a vulnerability — but
  it is still a form that invites the mistake and whose only failure feedback is
  "Volunteer not found in this organization." **Fix:** replace both with a
  volunteer picker sourced from an org-scoped query. **Depends on:** the
  `/app/volunteers` roster work, which supplies the component to reuse — doing
  it before that means inventing a picker twice. **Effort:** M.

- ~~**[P1] `discovery.inviteToApply` does not scope `opportunityId`**~~
  ✅ **FIXED v0.32.2.0** — `inviteToApply` now resolves the opportunity with
  `where: { id, orgId }` before the rate-limit transaction, throwing NOT_FOUND.
  The guard selects the same fields step 4 needed, so it replaced that fetch
  rather than adding one. `volunteerId` remains deliberately unscoped — the
  cross-org directory is the feature. Original entry follows.

  - **[P1] `discovery.inviteToApply` does not scope `opportunityId` to the
  caller's org** — found by adversarial review of the guard fix.
  `src/server/trpc/routers/discovery.ts:32` is a plain `staffProcedure` taking
  `{ volunteerId, opportunityId }`, and `inviteToApply()`
  (`volunteerDiscoveryService.ts:36`) validates neither against `ctx.orgId`, so
  staff at org A can send an invitation naming org B's opportunity. Separately
  `discovery.searchVolunteers` → `searchPublicProfiles(filters)` takes no
  `orgId` at all — a deliberate cross-org recruiting directory, but it means
  `volunteerId` is an arbitrary stranger by design.

  This was very nearly an escalation path into the new access guard: creating a
  `VolunteerInvitation` would have minted a relationship authorizing a paid
  background check on the invited stranger. Closed from the guard's side by
  excluding `INVITATION` from the relationship set (an invitation is an
  outbound solicitation, not a relationship — the volunteer has not answered
  it). **The `opportunityId` scoping bug is still live and independent of
  that.** **Fix:** validate `opportunityId` belongs to `ctx.orgId`.
  **Effort:** S.

- **[P2] `ORG_VOLUNTEER` is a staff-mintable relationship** — accepted risk,
  recorded so it stays a decision rather than becoming an oversight.
  `volunteers.add` takes an *email*, so staff can roster anyone whose address
  they know and thereby authorize themselves to issue that person credentials or
  run a background check on them. Kept in the relationship set anyway, because
  the roster IS the org's assertion of a relationship — that is the premise of
  the staff-created-volunteer feature, and removing it would make staff-added
  volunteers unschedulable, defeating v1a. Gated per-org behind
  `staff_created_volunteers` today; the exposure arrives when that flag flips.
  **Revisit if:** a stricter, volunteer-initiated-only set (`APPLICATION` /
  `SHIFT_SIGNUP`) is ever warranted specifically for the background-check path,
  whose cost and PII exposure justify more than the profile-read path does.
  **Effort:** M.

- **[P2] No blast-radius audit for rows created before the guard landed** —
  `issueCredentialAndResolveFcra` and the webhook auto-issue path correctly skip
  the guard (both are scoped by `request.orgId` off an existing
  `BackgroundCheckRequest`, which going forward can only be created through the
  guarded `initiateProviderCheck`). But `BackgroundCheckRequest` and
  `VolunteerCredential` rows created during the vulnerable window against
  unrelated users still exist, and those paths will mint a VERIFIED credential
  on them today. **Fix:** a read-only query joining both tables against
  `findOrgVolunteerRelationship`'s criteria to list rows with no authorizing
  edge, then triage. **Effort:** S.

- **[P3] Smaller findings deferred from the `/ship` review of the access guard**
  (2026-07-27). None are security issues; grouped to keep them out of the guard
  PR.
  - `VolunteerApplication` has `@@index([submittedByUserId])` and
    `@@index([orgId, status])` but no `@@index([orgId, submittedByUserId])`.
    That is the guard's first probe and it runs on *every* guarded call, so
    Postgres re-checks `orgId` on each heap tuple. Highly selective already;
    a composite index would make it index-only.
  - `credentials.remove` surfaces a raw Prisma P2025 as INTERNAL_SERVER_ERROR
    for an unrelated `userId`, while its `issue`/`revoke` siblings on the same
    UI now return a clean NOT_FOUND. Catch P2025 and rethrow so all three
    mutations speak one error language.
  - `issueCredentialAndResolveFcra` (`backgroundCheckService.ts:959`) writes a
    CREDENTIAL_ISSUED audit row via `upsertCredential` directly, so that action
    now carries `relationship` on one path and not the other. Stamp it (the
    requestId→orgId check already establishes the edge) or route through
    `issueCredential`.
  - Probe ORDER in `findOrgVolunteerRelationship` puts `APPLICATION` first,
    which is right today but self-invalidating: a staff-created roster volunteer
    has no application by definition, so every guarded call against one pays two
    queries. Re-evaluate swapping `ORG_VOLUNTEER` first once roster adoption
    lands. The sequential-with-short-circuit shape itself is correct — do NOT
    convert to `Promise.all`, which would make every legitimate 1-query accept
    pay 4x to speed up the rejection path.
  - `findOrgVolunteerRelationship` re-implements the live-roster predicate that
    `findLiveOrgVolunteer` already owns in the same file. If liveness ever gains
    a condition, the security guard is the copy that gets missed.
  - CLAUDE.md's Testing Guidelines say unit tests are "colocated with source",
    but ~32 service tests live in `src/server/services/__tests__/`. Record the
    actual rule (services → `__tests__/`, repositories and routers → colocated)
    so it stops being inferred by counting files.
  **Effort:** S each.

- **[P3] The volunteer identity panel swallows query errors** —
  `src/app/(app)/app/applications/[id]/page.tsx:328-345` handles `isLoading` and
  `!profile` but never `isError`; both collapse to `return null`, so a 500 or a
  network failure is indistinguishable from "this volunteer's profile is
  private", and nothing is logged. The comment at `:344` is now stale too — it
  enumerates three null cases and the guard added a fourth. Not a regression
  (the `APPLICATION` probe always matches on this page, which only renders when
  `app.submittedByUserId` is set on an org-scoped application), but this is now
  one of the few places a guard rejection could surface. **Fix:** render
  `QueryErrorCard`. **Effort:** S.

- **[P2] Eight email senders interpolate org-controlled values into HTML
  without escaping; three files carry private `escapeHtml` copies** — eng
  review Q3. Unescaped: `sendInviteToApplyEmail.ts:15-18` (`volunteerName`,
  `orgName`, `opportunityTitle`), `sendInviteEmail.ts:13` (`orgName`, `role`),
  `sendCredentialClaimedEmail.ts:16-23`, `sendCredentialRequestEmail.ts:14-21`,
  `send-billing-emails.ts:23`, `companyService.ts:268`, and both senders in
  `sendFcraEmails.ts`. Duplicate local helpers at `leadCaptureService.ts:6`,
  `share-token-expiry-service.ts:3`, and an inline chain at
  `shiftService.ts:232`, alongside the shared `src/server/lib/html.ts`. Org
  names are org-controlled input, so this is HTML injection into a third
  party's inbox. Deliberately excluded from the v1a diff (eleven unrelated
  files); the new roster-notification sender uses the shared helper so the pile
  does not grow. **Fix:** route every sender through `lib/html.ts`, delete the
  three copies. **Effort:** M.

- **[P3] Suppress notifications at creation for unclaimed users, not only at
  transport** — Codex outside voice. The v1a email guard blocks inside
  `sendEmail()` (`src/server/lib/email.ts:20`), which is the transport layer.
  `Notification` rows are created upstream (`notificationService.ts:42`) and
  the digest cron later mails every row with `emailSentAt = null`
  (`digest-service.ts:85`), so in principle notifications could queue for an
  unclaimed user and be dumped on them after activation. **Verified not
  reachable in v1a:** `digest-service` selects `UserDigestPreference` rows and
  nothing creates one for a shadow user. Becomes reachable the moment v1b or
  any later feature enrols them. **Fix:** gate `Notification` creation on
  `accountState`, or stamp rows created for unclaimed users as intentionally
  skipped. **Depends on:** v1b or any feature giving shadow users a digest
  preference. **Effort:** S.

- **[P3] `shiftSignupService` still lacks tests for `signUpForShift`,
  `cancelSignup`, and waitlist promotion** — eng review T1. The module has no
  test file; `shiftWaitlistService`, `shiftCompletionService`, and
  `checkinService` all have one, making this the outlier. The v1a PR adds tests
  for `assignVolunteerToShift` and backfills `markAttendance` (the two
  functions the roster feature depends on), leaving three untested — including
  waitlist auto-promotion on cancel (`shiftSignupService.ts:194-213`), the
  subtlest logic in the file. **Fix:** finish the module in
  `src/server/services/__tests__/shiftSignupService.test.ts`. **Depends on:**
  the v1a test file existing. **Effort:** S.

## Deferred from the staff-created-volunteers CEO review (2026-07-26)

Raised during `/plan-ceo-review` (SELECTIVE EXPANSION) of the same design doc,
after two adversarial spec-review passes and a second Codex outside voice.

- **[P2] Bulk-select assign volunteers to a shift from the roster** — CEO review
  E2, accepted then cut. Twelve people for a Saturday adoption event is twelve
  trips through the single-assign dialog, which is the ergonomics gap the whole
  roster feature exists to close. Cut because Codex established it is not the
  thin UI wrapper it looked like: `validateSignup` (`src/server/domain/shift.ts:99`)
  only rejects over-capacity signups and never yields a waitlist outcome, and
  `signUpForShift` (`src/server/services/shiftSignupService.ts:59`) only creates
  `CONFIRMED` rows before flipping the shift to `FULL`. Waitlisting is a separate
  explicit user action (`joinWaitlist`). So the promised "9 confirmed, 3
  waitlisted" batch result and a per-batch `allowOverCapacity` flag both require
  new domain behavior, roughly doubling the estimate. The adversarial reviewer
  had independently flagged E2 as the weakest accepted item — an unevidenced
  workflow at five pilot shelters and the only accepted item needing a new UI
  interaction pattern. **Fix:** add a waitlist outcome to the domain layer, then
  build the batch mutation and multi-select UI on top. **Depends on:** v1a's
  `assignVolunteerToShift` (T8). **Effort:** M-L.

- **[P2] Volunteer roster is knowingly partial until v1b** — CEO review D4. E1a
  creates an `OrgVolunteer` row when an approved application already has a
  linked user, and in the sign-in link path. It does **not** create rows for
  anonymous applications (`submittedByUserId = null`), which are the majority
  path: the column is nullable (`prisma/schema.prisma:253`) and
  `bulk-import-service.ts:149` creates email-only rows. Doing so would mean
  minting a shadow `User` from `submittedByEmail` on every approval — a change
  to the semantics of every public application, with no source for
  `displayName` (anonymous applications carry only an email, and
  `DEFAULT_SCREENER_QUESTIONS` has no name question). Split out as E1b.
  **Consequence:** an org with anonymous applicants sees a roster that does not
  include all of its volunteers. Do not describe the roster as complete in UI
  copy or marketing until this closes. **Fix:** ship E1b with v1b, and decide
  whether `displayName` becomes nullable with a render fallback or the default
  screener gains a name question. **Depends on:** v1b. **Effort:** M.

- **[P3] Cross-org name leak accepted via first-writer-wins** — CEO review T1
  reversal. `User.email` is unique, so two orgs adding the same person share one
  `User` row, and `User.name` is a single global field. v1a writes it only when
  currently null, so org B sees whatever org A typed. The stronger fix (never
  write `User.name`; render an org-scoped `OrgVolunteer.displayName` everywhere)
  was scoped three times and grew each time: one surface, then three
  (`shiftSignupRepo.ts:10`, `scan/Scanner.tsx:150`, `orgAnalyticsRepo.ts:192`),
  then eight-plus once Codex added `volunteerCredentialRepo.ts:53`,
  `backgroundCheckRepo.ts:57`, `settings/background-checks/page.tsx:955,1202`,
  and the background-check emails at `backgroundCheckService.ts:615,696`.
  Abandoned on the third widening because the estimate would not converge.
  **Fix, if a customer ever reports it:** add the display-name overlay
  surface-by-surface, starting with the shift roster and the Scanner check-in
  confirmation (the two a coordinator sees daily). **Effort:** L.

## Deferred from the staff-created-volunteers design review (2026-07-26)

`/plan-design-review` on `docs/designs/staff-created-volunteers.md`, 20 decisions,
design completeness 3/10 → 9/10. Two further items (QueryErrorCard migration,
mobile card lists for the four existing staff tables) were elected into the PR
itself as T35 and T36 rather than deferred here.

- ~~**[P2] `shifts/page.tsx` renders raw enum values as user-facing labels**~~ —
  ✅ **RESOLVED v0.35.0.0**, folded into T24 as planned since it edited the same
  lines. The inline `STATUS_VARIANTS` and `ATTENDANCE_VARIANTS` maps are gone,
  replaced by `ShiftStatusBadge` / `SignupStatusBadge` in
  `src/components/shifts/shift-status-badge.tsx`, following
  `VolunteerStatusBadge`. The human copy already existed — `SHIFT_STATUS_LABELS`
  and `SIGNUP_STATUS_LABELS` had been in `domain/shift.ts` since that module was
  written and were imported nowhere — so the fix reuses them rather than
  retyping the strings, and the labels cannot drift from the domain's
  vocabulary. Both maps are now total `Record`s over their enum, so a new status
  is a type error rather than a silent fallthrough to `neutral` with a raw enum
  label, which is how the old `?? 'neutral'` shape hid this. 16 tests including
  a no-hex source scan.

- **[P2] No staff-side waitlist when assigning to a full shift** — design
  decision D11 gave staff an over-capacity override but no third option, because
  `signUpForShift` hardcodes `status: 'CONFIRMED'` (`shiftSignupRepo.ts:156`).
  Meanwhile `shiftWaitlistService` and `validateWaitlistJoin` already exist and
  are tested, so a coordinator facing a full shift can break the cap or give up
  while the sensible answer sits unused. Same root cause that cut bulk assign
  (NOT in scope #3). **Fix:** add "Add to waitlist" to the D11 confirm strip,
  which needs a position-ordering decision against volunteer-initiated waitlist
  entries and coverage in the `shiftSignupService` tests. ~~**Depends on:** T8,
  T24.~~ **UNBLOCKED v0.35.0.0** — both landed. Note the confirm strip is now
  `OverCapacityConfirm` in `AssignVolunteerPicker.tsx`, and
  `assignVolunteerToShift` already promotes a WAITLISTED volunteer to CONFIRMED,
  so "Add to waitlist" is the only missing direction. **Effort:** M.

- **[P3] `signUpForShift` has the same latent P2002 that `assignVolunteerToShift`
  was fixed for** — `validateSignup`'s duplicate check matches `CONFIRMED` only,
  and `createSignup` only ever creates, so a volunteer who cancelled and then
  signs up again for the same shift collides on
  `ShiftSignup @@unique([shiftId, userId])` and gets an unhandled 500 rather
  than a signup. Identical root cause to the staff path, fixed there in
  v0.35.0.0 by resolving the existing row before writing; deliberately not
  changed here in the same PR because it is the volunteer-facing flow and wants
  its own thought about whether a cancelled-then-resigned-up volunteer should
  land CONFIRMED or WAITLISTED on a shift that filled in between. **Fix:** the
  same `getSignupByShiftAndUser` branch `assignVolunteerToShift` uses.
  **Effort:** S.

- **[P3] Volunteer detail is a dialog, not a deep-linkable route** — design
  decision D4 chose a dialog matching `ShiftDetailDialog`, which is the right
  call for v1a but cannot be shared between two coordinators, does not survive a
  refresh, and has nowhere to grow when credentials, background-check state and
  notes need a home. `getActiveHref()` already handles child routes correctly, so
  nav highlighting for `/app/volunteers/[id]` is free
  (`app-sidebar.tsx:80-95`). **Fix:** promote the dialog body to a route with
  loading, error and not-found states. **Trigger:** the first time a coordinator
  asks to send someone a link to a volunteer. **Depends on:** T27.
  **Effort:** M.
