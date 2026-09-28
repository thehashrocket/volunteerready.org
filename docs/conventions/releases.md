# Releases: severity and release notes — full notes

Moved verbatim from `CLAUDE.md` (2026-09-28). `CLAUDE.md` keeps the short version.

**Bumping `VERSION` also means deciding `RELEASE_SEVERITY`, in the same commit.**
`src/server/domain/release.ts` holds two constants: whether this release is
worth interrupting a coordinator over (`silent` | `notice`) and the version that
answer was decided FOR. `scripts/release-severity-gate.test.ts` fails when the
stamp does not equal `VERSION`, so the bump and the decision cannot drift.
Propose the value from the commit type — `feat:` → `notice`,
`chore:`/`ci:`/`docs:` → `silent` — and confirm or override it; **`silent` is
the usual and correct answer**, the point is that it is answered rather than
defaulted. Two things this is NOT: it is not a check that the severity is
*right* (no test can judge that — see the file's own docstring), and it is not
derivable from the version number, because `/ship` bumps a segment on nearly
every PR while "does a coordinator care" is a fact about the content. Note the
ordering trap: `/ship` runs tests *before* bumping `VERSION`, so a forgotten
stamp goes green locally and red in CI on the PR — fix it there, don't
"simplify" the guard to a prefix match to make it quiet.

**And a `notice` release must say WHAT changed, in
`src/server/domain/release-notes.ts`.** `RELEASE_SEVERITY` answers "do we
interrupt a coordinator?"; a note answers "what changed?" — two questions, and
conflating them is what made the old prompt say "New version available" and
nothing else, giving nobody a reason to act. `scripts/release-notes-gate.test.ts`
fails when `RELEASE_SEVERITY` is `notice` and no entry is keyed to `VERSION`.
Five rules: (1) **A `silent` release MAY carry a note and usually should not** —
most releases here are dependency bumps, CI and docs. But when one does, that
note still surfaces later: `/api/version` takes the caller's own release as
`?since=` and returns everything in the range, so a coordinator interrupted at
0.41.20.0 sees the quiet releases in between too. "Latest note only" would be
wrong, which is why the range exists. (2) **Write it, never paste the CHANGELOG
line.** `CHANGELOG.md` is 2,000+ lines of "the type checker", "the assembly
step" — our vocabulary, not a coordinator's. The gate rejects a summary starting
with a conventional-commit prefix because that is the reliable tell it was
pasted, but it cannot judge the prose; if you cannot write one plain sentence
about what someone can now do, the release is `silent`. (3) **One sentence,
≤120 chars, ending in a full stop.** DESIGN.md's ambient notice strip is one
line with no title, so a long summary turns a 48px band into a paragraph, and
the strip concatenates `{summary} Reload when you're ready — …`, so a missing
full stop renders one run-on sentence. (4) **Newest entry at the TOP**; the
array is sorted newest-first and the gate enforces it. (5) **The module is
server-only as a VALUE** — a client importing `RELEASE_NOTES` would render its
own older build's notes, the same provenance trap as `RELEASE_SEVERITY`. The
client receives them over the wire and nowhere else; `import type` is allowed
and the gate distinguishes the two. **But "server-only" is about provenance,
not secrecy, and conflating the two is the dangerous read**: `/api/version` is
unauthenticated by design, and because it answers a RANGE, walking `?since=`
backwards recovers the entire history — the wire cap bounds one response, not
exposure. The strip being `isStaff`-gated makes these look internal while they
are world-readable, so **write nothing here you would not put on a public
changelog page**, and never describe a security fix by naming what was
vulnerable — say what is true now, or ship `silent`. Two asymmetries worth
knowing before you call one a bug: detection is BUILD-keyed (commit SHA) while
notes are VERSION-keyed, so a new build carrying an unchanged semver (env-only
redeploy, promote of the same release) correctly renders the strip with the
generic sentence and no summary; and a rollback yields no notes for the same
reason. Both were raised by an adversarial cross-model pass and both are the
intended answer.
