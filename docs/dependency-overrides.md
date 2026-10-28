# Dependency overrides

Every entry under `overrides:` in `pnpm-workspace.yaml` must have a section
here. `scripts/pnpm-overrides.test.ts` fails if one does not, so this file
cannot drift out of sync with the thing it documents.

## Where they live, and why that moved

Until the pnpm 12 upgrade these were `pnpm.overrides` in `package.json`. pnpm
11 stopped reading that key and says nothing about it, so any pnpm ≥ 11
resolves the tree as if no override existed. Dependabot runs pnpm 11, and on
2026-10-28 it opened #269 and #270 with lockfiles that had no `overrides:`
block at all: vite 5.4.21, esbuild 0.21.5 and zod 4.1.11 were back in the tree,
and mysql2 / deepmerge-ts were back on their vulnerable pins. Vercel's frozen
install refused both (`ERR_PNPM_LOCKFILE_CONFIG_MISMATCH`), which is the only
reason neither shipped.

Now the overrides live in `pnpm-workspace.yaml`, where every pnpm from 9 to 12
reads them, `packageManager` pins the exact pnpm, and the guard test fails if
`package.json` grows a `pnpm` key again or if the lockfile's `overrides:` block
differs from the workspace file. That last check names the cause at the PR
instead of leaving it to whichever install runs first.

## Why this file exists

An override is a standing instruction to resolve some transitive package at a
version other than the one its parent asked for. Nothing in the toolchain
records **why**, and without that an override can be neither safely changed nor
safely deleted — you cannot tell whether you are removing a workaround that is
still load-bearing or a fossil from a problem that no longer exists.

That is not hypothetical here. `@hono/node-server` was overridden `^1.19.13`,
which is the fix for one advisory (GHSA-92pp-h63x-v22m). A **second** advisory,
GHSA-frvp-7c67-39w9, has no 1.x backport at all and fixes only in **2.0.5** —
which a `^1` range can never reach. So an override written to keep a package
safe became the reason it could not be patched, and nothing about reading
`"^1.19.13"` reveals that. It survived every review until the package left the
tree entirely in v0.41.5.0.

## How to read the "binds" column

"Binds" means every installed copy of the package satisfies the override range.
Every entry currently binds — see [Partially bound](#partially-bound) for the
history of the ones that did not.

## How to tell whether an override still does anything

Not by reading it. The check is empirical and takes about a minute:

```sh
cp pnpm-workspace.yaml /tmp/ws.bak.yaml && cp pnpm-lock.yaml /tmp/lock.bak.yaml
sed -i.tmp '/^overrides:/,$d' pnpm-workspace.yaml && rm -f pnpm-workspace.yaml.tmp
rm -f pnpm-lock.yaml && pnpm install --lockfile-only --ignore-scripts && pnpm audit
cp /tmp/ws.bak.yaml pnpm-workspace.yaml && cp /tmp/lock.bak.yaml pnpm-lock.yaml
```

(`overrides:` is the last block in the file, so deleting from it to the end
removes exactly that block.)

**Deleting the lockfile is the load-bearing step.** `pnpm install --lockfile-only`
keeps any already-locked version that still satisfies the declared ranges, so
removing an override and relocking in place mostly reports "no change" —
stickiness, not evidence. Only a resolution from nothing shows what the tree
would naturally pick.

Run against v0.42.0.0 this produced a clean split: **`vite` and `esbuild` change
the tree and closing them is what keeps `pnpm audit` at zero; nothing else moved
at all.** That does *not* make the rest deletable — see
[Floors that currently look redundant](#floors-that-currently-look-redundant).
`@types/pg` was the one entry the run retired, because it was the one entry that
was not a floor.

**What neither this check nor the guard test can see: whether an override
satisfies its DEPENDENTS.** Both answer "does every installed copy satisfy the
override?", which is the opposite direction from "does the override satisfy what
the packages asking for it declared?". `@types/pg` is the worked example — it sat
at `8.11.11` to *match* `@prisma/adapter-pg`, long after the adapter had moved to
declaring `@types/pg: ^8.16.0`, so the override was holding the types five minors
**below** what its own stated reason demanded. Nothing was broken and typecheck
was green either way; the reason had simply become false, and only reading the
dependent's `package.json` showed it. Worth automating if a second instance
appears; one is not enough to design against.

## The overrides

### `fast-uri` — `^3.1.9`

Alerts #97, #98, #118 (**high**). Closed in [#189](https://github.com/thehashrocket/volunteerready.org/pull/189)
(then `^3.1.5`); raised to `^3.1.6` for alerts #122, #123, #125, #126 (**high**)
— host confusion / SSRF via percent-encoding and IPv6 normalization bugs, all
fixed in 3.1.6. Raised to `^3.1.8` for GHSA-hrr3-gc8f-f4qj (moderate,
inconsistent host case normalization via percent-encoded octets), found by
`pnpm audit` before GitHub raised a Dependabot alert for it. Raised to `^3.1.9`
in the pnpm 12 upgrade for GHSA-w74x-v6f9-j3xg and GHSA-wjr9-j795-jxcr
(moderate) and GHSA-xhq7-xmqj-769h and GHSA-333x-w4r6-6crp (low), all fixed in
3.1.9, found by `pnpm audit` during the override review: the `^3.1.8` floor was
holding the lockfile at 3.1.8 while a fresh resolve picked 3.1.9.

Needed an override of its own rather than riding along with the Prisma upgrade,
because it arrives by **two independent paths** — `@prisma/streams-local` and
webpack's `schema-utils` via `@sentry/nextjs` — and upgrading Prisma removed
only the first. `ajv@8.x` declares `fast-uri: ^3.0.1`, so the range permits the
fix without forcing anything.

### `postcss` — `^8.5.23`

Alert #72 in [#124](https://github.com/thehashrocket/volunteerready.org/pull/124)
(then `^8.5.10`); raised to `^8.5.23` in
[#189](https://github.com/thehashrocket/volunteerready.org/pull/189) for alerts
#113 (**high**) and #117.

### `@babel/core` — `^7.29.6`

Alert #92. Closed in [#124](https://github.com/thehashrocket/volunteerready.org/pull/124).

Pinned **within the current major on purpose**. An open `>=` floated to Babel 8
for no added security benefit — see [Partially bound](#partially-bound).

### `vite` — `^7.3.7`

Alerts #37, #38, #39 (**high**), #47, #80, #81, #93, #94 (**high**) — the
largest single group. Closed in [#124](https://github.com/thehashrocket/volunteerready.org/pull/124).
Raised to `^7.3.7` for GHSA-587h-7wmj-h5pm (**high**, `launch-editor`
existence-check bypass on Windows; fixed in 7.3.7 / 8.1.6), found by the
scheduled advisory scan.

`vite` is also a **direct devDependency** (`^7.3.7`). The override alone did
not reach peer-dependency resolutions: `@storybook/react-vite` and `vitest`
both accept `^8`, and pnpm kept resolving their `vite` peer to a separate
`vite@8.1.0`, which this advisory hits. With a direct 7.x copy in the root,
every peer edge resolves to it, so the tree has exactly one vite and the
override binds. Both peers accept 7 (`vitest@5`: `^6.4.0 || ^7.0.0 || ^8.0.0`).
Remove the devDependency only together with a decision to move to Vite 8.

Pinned within the current major on purpose; an open range floated to Vite 8.
Reached through `vitepress` and `@storybook/react-vite`, i.e. docs and
build tooling, never the application bundle.

**`vitepress` is the binding constraint, and it cannot currently be upgraded
past it.** `vitepress@1.6.4` depends on `vite: ^5.4.14`, so with this override
removed the docs toolchain resolves **vite 5.4.21** and drags **esbuild 0.21.5**
down with it — this override is what forces vitepress onto vite 7 instead. And
1.6.4 **is** the latest stable: vitepress 2 exists only as `2.0.0-alpha.19` on
the `next` tag. So this entry and `esbuild` below are effectively **permanent
until vitepress 2 ships**, rather than workarounds awaiting a routine bump.
Re-check both the day vitepress 2 goes stable; there is nothing to do before
then.

### `esbuild` — `^0.28.1`

Alerts #4, #75. Closed in [#124](https://github.com/thehashrocket/volunteerready.org/pull/124).

Note this is the repo's only **0.x** override, so `^0.28.1` means
`>=0.28.1 <0.29.0` — npm bounds a 0.x caret by *minor*, not major. The guard
test encodes that; treating it as "any 0.x" was a real bug in an early draft.

**Arrives underneath `vite`, so it is the same constraint as the entry above**
— `vite@5.4.21` depends on `esbuild@0.21.5`, which is below the `>=0.25.0` fix
for GHSA-67mh-4wv8-2f99. Retiring it depends on vitepress 2, not on esbuild.

### `brace-expansion` — `^5.0.12`

Introduced `^5.0.7` in [#151](https://github.com/thehashrocket/volunteerready.org/pull/151)
(**high**, DoS via exponential-time `{}` expansion); raised to `^5.0.9` in
[#189](https://github.com/thehashrocket/volunteerready.org/pull/189) for alerts
#115 and #116. Raised to `^5.0.12` for GHSA-6j4f-fj2g-mc7p and
GHSA-qhr7-859c-m2p7 (**high**, stack exhaustion via recursive brace groups) and
GHSA-q2hr-2g5m-vwhr (moderate, quadratic-time rewrite), found by `pnpm audit`
before GitHub raised Dependabot alerts for them. Reached via `minimatch` → `glob`, used by
`@storybook/react-vite` and `@sentry/bundler-plugins` (`@sentry/bundler-plugin-core`
before the `@sentry/nextjs` 11 upgrade).

### `ws` — `^8.21.0`

**High** — memory exhaustion from crafted WebSocket frames. Closed in
[#151](https://github.com/thehashrocket/volunteerready.org/pull/151). Reached
via `jsdom` (vitest) and `storybook`; dev and build tooling only.

### `zod` — `^4.6.6`

GHSA-mrhx-c7xc-m3w5 (**high**) — memory exhaustion while validating oversized
constrained collections. Fixed in 4.6.6. Found by the scheduled advisory scan.

The app's own `zod` dependency was simply bumped (`^4.6.7`); the override
exists for the copy it cannot reach. **An exact pin, not a range** (the shape
`mysql2` and `deepmerge-ts` had before they were retired).
`@vercel/cli-config` (via `@vercel/functions` → `@vercel/oidc`) declares
`"zod": "4.1.11"` verbatim, still true in its latest release (0.3.4), so
nothing can resolve the fix without forcing it. Forcing 4.1.11 → 4.6.x stays
inside the major. Re-check whether this override is still needed when
`@vercel/cli-config` widens its range.

**Reachability is low.** That copy validates Vercel's own config and OIDC
token shapes, not request input. It is fixed rather than ignored because a
patched version exists and costs nothing.

## Retired in the pnpm 12 upgrade

Three overrides came out on 2026-10-28, each because its **reason expired**:
the dependent that pulled the package started declaring a patched version
itself. A from-scratch resolve with no overrides at all (method above, under
pnpm 12.16.1) confirmed each one lands at or above its fix without help.

- **`deepmerge-ts`** (was `^8.0.1`; alert #120, GHSA-ggr8-5vv4-36mx, fixed in
  8.0.0). `@prisma/config@7.10.1` now pins `"deepmerge-ts": "8.0.2"` exactly,
  where 7.9.1 pinned the vulnerable 7.1.5. This was the one override that forced
  a major past its dependent's declared range, which is why it was guarded by
  `PINNED_DEPENDENTS`; that list is now empty.
- **`mysql2`** (was `^3.22.0`; alert #121, GHSA-3f6p-5ww8-9rcr, fixed in
  3.22.0). `prisma@7.10.1` now pins `"mysql2": "3.24.4"`, where it used to pin
  3.15.3. Never reachable here (Postgres only) in any case.
- **`uuid`** (was `^11.1.1`; alert #74, GHSA-w5hq-g745-h8pq, fixed in 11.1.1).
  `next-auth@4.24.15`, its only consumer, now declares `uuid: ^11.1.1` itself.

Retiring an override hands its floor to someone else's `package.json`, so the
floor stays under test: `RETIRED_FLOORS` in `scripts/pnpm-overrides.test.ts`
fails if any installed copy drops below the fix. If one goes red, an upstream
release has regressed the pin; put the override (and its section here) back.

**Checked and kept**, with the dependents' declared ranges as of this audit:
`vite` / `esbuild` (vitepress 1.6.4 is still the latest stable and still asks
for vite `^5.4.14`; without the override the tree gets vite 5.4.21 and esbuild
0.21.5), `zod` (`@vercel/cli-config@0.3.4`, still latest, still pins 4.1.11),
`postcss` (`vite` declares `^8.5.6`, `vitepress` `^8`), `fast-uri` (`ajv`
declares `^3.0.1`), `brace-expansion` (`minimatch` declares `^5.0.8` against a
5.0.12 fix), `ws` (`storybook` declares `^8.21.1` but `@vercel/functions`
declares `>=8`), `@babel/core` (dependents declare as low as `^7.0.0`). All of
those are the "looks redundant, isn't" case described next.

## Floors that currently look redundant

Run the [check above](#how-to-tell-whether-an-override-still-does-anything) and
every override except `vite` and `esbuild` reports "no change" — the tree
resolves identically with it deleted. **That is not a list of things to delete.**

They resolve to patched versions only because a caret takes the newest match,
and the ranges underneath them reach a long way down: `ajv` asks for `fast-uri:
^3.0.1` against a 3.1.8 fix, `@babel/core` is requested as low as `^7.9.0`, and
`postcss` as low as `^8.3.11`. Nothing in the tree *requires* a patched version;
today's resolution is a coincidence of what happens to be newest, and the next
lockfile churn is free to land elsewhere. The override is what converts that
coincidence into a guarantee.

This is the same shape as `@hono/node-server`, in the mirror. There, a range
that *looked* protective was the reason a package could not be patched. Here,
overrides that *look* inert are the only thing holding a floor. **Neither can be
judged by reading the version string** — which is why removal needs the advisory
history in this file, not just a clean diff.

The cost of keeping one is a line of JSON. **Dropping one is never silent** —
mutation-verified: deleting ANY entry from `overrides` turns
`scripts/pnpm-overrides.test.ts` red, because the doc-sync check finds a
`### \`name\`` section describing policy that is no longer in force, and the
section-count self-check disagrees with the override count. The three carrying a
`SECURITY_FLOORS` entry (`fast-uri`, `postcss`, `brace-expansion`) fail a third
assertion on top, and that assertion also
goes red if the override's range is *lowered* below the advisory floor while the
lockfile still holds a patched copy.

So the guard makes removal a **deliberate, multi-file act** — override, doc
section, and the floor entry where one exists — rather than a one-line diff that
slips through review. What it cannot do is judge whether the removal is
*justified*; three coordinated deletions are exactly as green as one. That
judgement is what the written reason in each section is for, and it is why an
override is retired when its **reason** expires (the package leaves the tree, or
its dependents' declared ranges rise above the fix), never because a resolve
came back unchanged.

**Two security overrides carry no `SECURITY_FLOORS` entry** — `@babel/core`
and `ws` — because they predate the rule in
[Adding an override](#adding-an-override). They are still guarded in the two
ways above; what they lack is the assertion that pins the *advisory's* first
patched version, so a later range change could drop below the fix while staying
green. Adding them needs each advisory's patched version looked up rather than
guessed; tracked rather than done here.

`@opentelemetry/core` (alert #77, closed in
[#124](https://github.com/thehashrocket/volunteerready.org/pull/124)) was
retired in the `@sentry/nextjs` 11 upgrade for the plainer of the two reasons:
it left the tree. Sentry 11 no longer depends on `@opentelemetry/core` (it keeps
only `@opentelemetry/api`), and Sentry was the only thing that installed it, and the guard's "still present in the
dependency tree" check went red as designed.

`@types/pg` was retired under exactly that rule — not because the tree came back
unchanged, but because it was never a security floor and its stated reason had
expired: `@prisma/adapter-pg@7.9.1` declares `@types/pg: ^8.16.0` as an ordinary
dependency, which the `devDependencies` range already satisfies, so the override
had nothing left to reconcile.

To be precise about what that did and did not change: **two constraints remain**
— our `devDependencies` `^8.21.0` and the adapter's own `^8.16.0` — and they
agree, so pnpm resolves a single installed copy either way (verified on a
from-scratch resolve). What went away is the *third* constraint, which restated
the other two from a position that could not see them, and had already drifted
once because of it.

## Partially bound

Nothing is partially bound right now; `PARTIALLY_BOUND` in
`scripts/pnpm-overrides.test.ts` is empty but kept, so a **new** escape under
any override still fails the build.

History, so the next escape is recognisable:

- `@babel/core` carried `8.0.1` (a peer resolution through `next`) until a
  routine relock resolved that peer edge onto the same `7.29.7` copy the
  override already pins.
- `vite` carried `8.1.0`, a peer resolution through `@storybook/react-vite`
  and `vitest`, which accept `^5 || ^6 || ^7 || ^8`. #124 accepted it
  deliberately while that copy was itself above every patched threshold.
  GHSA-587h-7wmj-h5pm (fixed in 8.1.6) ended that, and the fix was a direct
  `vite` devDependency, so peers resolve to the single 7.x copy (see the `vite`
  entry above).

**Do not "fix" a future escape by widening a range to the next major.** That
abandons the within-major policy. Moving to Babel 8 / Vite 8 wholesale is a
separate decision on its own merits.

## Ignored advisories

`auditConfig.ignoreGhsas` in `pnpm-workspace.yaml` is where an advisory goes when
the CI gate (`scripts/check-advisories.ts`) should deliberately not fail on it.
The key is absent while the list is empty. Every entry needs a
`### \`GHSA-…\`` section here; the guard test enforces it in both directions.

An ignore lives in the repo rather than as a GitHub-UI dismissal because CI
reads this file, and because a version-controlled ignore is diffed and argued
about in review. (The GitHub alert may be dismissed too — that keeps the
security tab quiet — but the repo entry is the one with teeth.)

No advisory is ignored today. The last one, `GHSA-f88m-g3jw-g9cj` (sharp's
bundled libvips, fixed in sharp 0.35.0), was dropped once `next` resolved sharp
0.35.5 and `pnpm audit` came back clean without it. The test that held its
"not reachable" argument in place, `scripts/next-config-images.test.ts`, still
guards the image config, because the same argument covers any future libvips
advisory.

## Adding an override

1. Add it under `overrides:` in `pnpm-workspace.yaml` (never under a `pnpm`
   key in `package.json`: pnpm 11+ ignores that), then run `pnpm install` and
   commit the lockfile.
2. Add a `### \`package-name\`` section here — the test matches on that heading.
3. If it closes an advisory, add it to `SECURITY_FLOORS` in
   `scripts/pnpm-overrides.test.ts` with the advisory's first patched version,
   so a later range change cannot silently drop below the fix. Write the
   override as `^x.y.z`, `~x.y.z` or an exact version with a lower bound at or
   above that floor: the test checks the range itself as well as the installed
   versions, and refuses range forms it cannot read a floor from.

## Removing an override

An override whose package has left the tree is not harmless — it reads as
active policy while constraining nothing. `scripts/pnpm-overrides.test.ts`
fails on that case; delete the entry and its section here together.
