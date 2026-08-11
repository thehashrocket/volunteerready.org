# Dependency overrides

Every entry in `pnpm.overrides` (`package.json`) must have a section here.
`scripts/pnpm-overrides.test.ts` fails if one does not, so this file cannot
drift out of sync with the thing it documents.

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
Two entries do not fully bind — see [Partially bound](#partially-bound).

## How to tell whether an override still does anything

Not by reading it. The check is empirical and takes about a minute:

```sh
cp package.json /tmp/pkg.bak.json && cp pnpm-lock.yaml /tmp/lock.bak.yaml
node -e "const p=require('./package.json');delete p.pnpm.overrides;require('fs').writeFileSync('package.json',JSON.stringify(p,null,'\t')+'\n')"
rm -f pnpm-lock.yaml && pnpm install --lockfile-only --ignore-scripts && pnpm audit
cp /tmp/pkg.bak.json package.json && cp /tmp/lock.bak.yaml pnpm-lock.yaml
```

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

### `fast-uri` — `^3.1.5`

Alerts #97, #98, #118 (**high**). Closed in [#189](https://github.com/thehashrocket/volunteerready.org/pull/189).

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

### `vite` — `^7.3.5`

Alerts #37, #38, #39 (**high**), #47, #80, #81, #93, #94 (**high**) — the
largest single group. Closed in [#124](https://github.com/thehashrocket/volunteerready.org/pull/124).

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

### `@opentelemetry/core` — `^2.8.0`

Alert #77. Closed in [#124](https://github.com/thehashrocket/volunteerready.org/pull/124),
in combination with a `@sentry/nextjs` bump to `^10.62.0` — the override alone
would not have moved it, since the version comes in through Sentry's OTel stack.

### `brace-expansion` — `^5.0.9`

Introduced `^5.0.7` in [#151](https://github.com/thehashrocket/volunteerready.org/pull/151)
(**high**, DoS via exponential-time `{}` expansion); raised to `^5.0.9` in
[#189](https://github.com/thehashrocket/volunteerready.org/pull/189) for alerts
#115 and #116. Reached via `minimatch` → `glob`, used by
`@storybook/react-vite` and `@sentry/bundler-plugin-core`.

### `ws` — `^8.21.0`

**High** — memory exhaustion from crafted WebSocket frames. Closed in
[#151](https://github.com/thehashrocket/volunteerready.org/pull/151). Reached
via `jsdom` (vitest) and `storybook`; dev and build tooling only.

### `uuid` — `^11.1.1`

Alert #74 (medium) — missing buffer bounds check in `v3`/`v5`/`v6` when a `buf`
argument is supplied. Closed in [#151](https://github.com/thehashrocket/volunteerready.org/pull/151).

Reached via `next-auth` → `@next-auth/prisma-adapter`. It was originally
proposed for dismissal as not-affected — next-auth's only call site
(`jwt/index.ts`) uses `uuid.v4()` with no arguments, and the vulnerable path
requires an explicit `buf` on `v3`/`v5`/`v6` — but the 8→11 bump turned out to
be safe (the `v4()` named export is unchanged from v8 through v11), so it was
fixed rather than dismissed.

## Floors that currently look redundant

Run the [check above](#how-to-tell-whether-an-override-still-does-anything) and
every override except `vite` and `esbuild` reports "no change" — the tree
resolves identically with it deleted. **That is not a list of things to delete.**

They resolve to patched versions only because a caret takes the newest match,
and the ranges underneath them reach a long way down: `ajv` asks for `fast-uri:
^3.0.1` against a 3.1.5 fix, `@babel/core` is requested as low as `^7.9.0`, and
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
mutation-verified: deleting ANY entry from `pnpm.overrides` turns
`scripts/pnpm-overrides.test.ts` red, because the doc-sync check finds a
`### \`name\`` section describing policy that is no longer in force, and the
section-count self-check disagrees with the override count. The three carrying a
`SECURITY_FLOORS` entry (`fast-uri`, `postcss`, `brace-expansion`) fail a third
assertion on top.

So the guard makes removal a **deliberate, multi-file act** — override, doc
section, and the floor entry where one exists — rather than a one-line diff that
slips through review. What it cannot do is judge whether the removal is
*justified*; three coordinated deletions are exactly as green as one. That
judgement is what the written reason in each section is for, and it is why an
override is retired when its **reason** expires (the package leaves the tree, or
its dependents' declared ranges rise above the fix), never because a resolve
came back unchanged.

**Four overrides carry no `SECURITY_FLOORS` entry** — `@babel/core`,
`@opentelemetry/core`, `ws`, `uuid` — because they predate the rule in
[Adding an override](#adding-an-override). They are still guarded in the two
ways above; what they lack is the assertion that pins the *advisory's* first
patched version, so a later range change could drop below the fix while staying
green. Adding them needs each advisory's patched version looked up rather than
guessed; tracked rather than done here.

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

`@babel/core` and `vite` each have a **second** copy installed that their
override does not cover: `@babel/core@8.0.1` and `vite@8.1.0`, both physically
present under `node_modules/.pnpm/`. They arrive as peer-dependency resolutions
(`next@…(@babel/core@8.0.1)`, `@storybook/react-vite@…(vite@8.1.0…)`) rather
than ordinary dependency edges, and `@storybook/react-vite` accepts
`^5 || ^6 || ^7 || ^8`.

**This is known and was accepted deliberately, not an oversight.** #124 pinned
each package inside its current major rather than using an open `>=` precisely
to avoid dragging the whole build onto Babel 8 / Vite 8 for no security gain,
and it verified at the time that the lingering 8.x peer copies are themselves
**above** the patched threshold. So the tree is safe; the override text simply
describes less than the whole picture.

They are budgeted in `PARTIALLY_BOUND` in `scripts/pnpm-overrides.test.ts`, so
a **new** escape under either package still fails the build.

**Do not "fix" this by widening the ranges to `^8`.** That would abandon the
deliberate within-major policy above. The open question is only whether moving
to Babel 8 / Vite 8 wholesale is now desirable on its own merits.

## Ignored advisories

`pnpm.auditConfig.ignoreGhsas` in `package.json` is the list of advisories the
CI gate (`scripts/check-advisories.ts`) deliberately does not fail on. Every
entry needs a `### \`GHSA-…\`` section here; the guard test enforces it in both
directions.

An ignore lives in the repo rather than as a GitHub-UI dismissal because CI
reads this file, and because a version-controlled ignore is diffed and argued
about in review. (The GitHub alert may be dismissed too — that keeps the
security tab quiet — but the repo entry is the one with teeth.)

### `GHSA-f88m-g3jw-g9cj`

**sharp — inherited libvips vulnerabilities** (CVE-2026-33327, CVE-2026-33328,
CVE-2026-35590, CVE-2026-35591). High. Fixed in sharp 0.35.0; we are below that
via `next`.

**Not reachable.** sharp is invoked only by the Next.js Image Optimization API,
and that API only processes bytes we did not author when `images.remotePatterns`
or `images.domains` grants a remote origin. `next.config.ts` declares no
`images` block at all, so every image served is a local file under `public/`
and sharp never receives attacker-supplied input. All four CVEs require
processing a hostile image.

**Held in place by a test**, not by this paragraph:
`scripts/next-config-images.test.ts` fails if an `images` block,
`remotePatterns`, `domains`, `dangerouslyAllowSVG` or `unoptimized` is ever
added — and its failure message names this GHSA as the thing to reconsider.

**Revisit when:** that test changes, or `next` ships a sharp ≥ 0.35.0 (at which
point delete this entry rather than carrying a dead ignore).

## Adding an override

1. Add it to `pnpm.overrides` in `package.json`.
2. Add a `### \`package-name\`` section here — the test matches on that heading.
3. If it closes an advisory, add it to `SECURITY_FLOORS` in
   `scripts/pnpm-overrides.test.ts` with the advisory's first patched version,
   so a later range change cannot silently drop below the fix.

## Removing an override

An override whose package has left the tree is not harmless — it reads as
active policy while constraining nothing. `scripts/pnpm-overrides.test.ts`
fails on that case; delete the entry and its section here together.
