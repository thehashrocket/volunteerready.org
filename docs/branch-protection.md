# Branch protection

`main` requires the following status checks to pass before a PR can merge.
These are the workflow **`name:`** strings from `.github/workflows/ci.yml`,
matched exactly — not the job ids:

- `Security advisories`
- `Lint + typecheck`
- `Tests (unit, scripts, integration)`
- `Build (deploy path)`
- `E2E (Playwright)`

`.github/workflows/security-advisories-scheduled.yml`'s job (`Security
advisories (scheduled)`) deliberately contributes nothing to this list — it
only triggers on `schedule:`/`workflow_dispatch:`, never on `pull_request:`,
so it can never satisfy a required PR check and isn't one.

## Why this exists

Opened by `docs/TODOS.md`'s `[P2] The Security advisories CI gate can
silently stop running, and nothing says so` (2026-09-14 retro). This repo had
**no** branch protection at all before that TODO — `main` sat with two
CRITICAL unauthenticated Next.js RCEs unpatched for four weeks, and nothing
forced anyone to look at CI before merging, regardless of what any CI check
said. A gate test can guard the *config*; it cannot force a human to look
before clicking merge. Required status checks do.

## Renaming a job breaks this

GitHub only accepts a status-check name as a valid required context after it
has reported under that name at least once. Each job in `ci.yml` carries a
comment above its `name:` field pointing back here — **renaming a job
without updating this list (and the branch-protection setting itself) leaves
every future PR permanently stuck** ("Expected — waiting for status"),
because the required context GitHub is watching for will never report again.

This is intentionally a comment-and-doc pairing, not an automated guard:
GitHub's branch protection state isn't readable from inside a `pnpm test`
run, so there's nothing in-repo to assert against. The four sibling
`*-gate.test.ts` files guard config the tool itself can't check; this is the
one property in that family that has no in-repo equivalent at all.

## Reproducing this setting

```sh
gh api --method PUT repos/thehashrocket/volunteerready.org/branches/main/protection \
  --input - <<'EOF'
{
  "required_status_checks": {
    "strict": false,
    "checks": [
      { "context": "Security advisories" },
      { "context": "Lint + typecheck" },
      { "context": "Tests (unit, scripts, integration)" },
      { "context": "Build (deploy path)" },
      { "context": "E2E (Playwright)" }
    ]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": null,
  "restrictions": null
}
EOF
```

(A JSON body via `--input -`, not chained `-f`/`-F` flags: `gh api`'s documented
field syntax — `key[subkey]=value` for nesting, `key[]=value` for arrays of
scalars — doesn't cover an array of OBJECTS like `checks`, and this command
has never been run against the real API. A JSON heredoc is unambiguous and
matches what `gh api --help` documents for "pre-constructed JSON." Verify the
shape once against a real run before trusting this doc blindly — see the
sequencing note below first.)

Verify with:

```sh
gh api repos/thehashrocket/volunteerready.org/branches/main/protection
```

**`enforce_admins: true` is not optional here — it was the first draft's own
mistake, caught by an adversarial review pass.** In a solo-maintainer repo
the admin is the ONLY person who ever merges anything, so `enforce_admins:
false` doesn't exempt some other role — it exempts the one person this
setting exists to slow down. Leaving it `false` would have reproduced the
exact failure this whole page exists to close: nothing stopping a merge past
a red or still-running check.

**Deliberately not set:** required PR reviews. That part genuinely is a
solo-repo call — the only thing worth forcing is "don't merge past a red or
still-in-progress check," not a second-reviewer gate. Revisit if a second
maintainer joins.

**Sequencing note:** if you're setting this up fresh (not just re-applying
it), land and merge the code that makes a job report under a given `name:`
FIRST, let it run successfully once, THEN run the `gh api` call above. Doing
it in the other order risks the API call being rejected or silently
accepting a context GitHub has never seen report.

## Known limitations

**A required check only blocks on a nonzero exit.** `scripts/check-
advisories.ts`'s deliberate fail-open path (see that file's own header
comment) still exits 0 when `pnpm audit` can't produce a usable report — so
a degraded-but-"passing" `Security advisories` check still won't block a
merge, even with this setting in place. `writeStepSummary()` in that file
makes a degraded run visible one click from the Checks tab (instead of
buried in a job log), but nothing here forces a reviewer to actually open
it before clicking merge. The real backstop for an unattended `main` is the
scheduled scan in `security-advisories-scheduled.yml` plus the
`advisory-scan-heartbeat` Vercel cron (`src/app/api/cron/advisory-scan-heartbeat/`),
which checks whether GitHub has auto-disabled the workflow for 60 days of
repo inactivity and re-enables it before dispatching, rather than merely
alerting that it's disabled.

**The scheduled scan inherits the SAME fail-open policy, but has a weaker
backstop for it than a PR does.** A PR has a human looking at it who might
open the Summary tab; a scheduled run has nobody. GitHub's own
scheduled-workflow-failure notification email only fires on an actual
FAILURE conclusion — a fail-open exit 0 is a "success" as far as that
notification is concerned. So a persistently broken `pnpm audit` (not a
one-time registry hiccup, an actually-stuck tool) would report green every
week indefinitely, with zero signal to anyone — reproducing the original
incident on a weekly clock instead of a one-time gap. Raised by an
adversarial review pass and deliberately NOT fixed here: giving scheduled
runs different failure semantics than PR runs is a real design change to
`check-advisories.ts`'s trigger-agnostic gate, not a mechanical fix. Tracked
as a follow-up in `docs/TODOS.md`.
