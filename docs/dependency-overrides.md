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

## The overrides

### `@types/pg` — `^8.20.4`

**Type compatibility.** The reason is recorded in commit `83a4dc5` (11 Mar
2026): *"Pinned `@types/pg` to `8.11.11` to match `@prisma/adapter-pg` peer
dep."* The same range is declared in `devDependencies`, so one `pg` type
surface is used everywhere rather than two conflicting ones.

**It was `8.11.11` exactly until v0.41.7.0, and by then it pointed the wrong
way.** `@prisma/adapter-pg@7.9.1` — which v0.41.5.0 upgraded to — declares
`@types/pg: ^8.16.0` as an ordinary dependency, and `8.11.11` does not satisfy
that. So an override written to *match* the adapter was holding the types five
minors **below** what the adapter asked for. Nothing was broken (types never
affect runtime, and typecheck was green either way), but the stated reason had
quietly become false.

Raised to `^8.20.4`, which satisfies `^8.16.0` and tracks the runtime `pg`
`^8.22.0`. Typecheck verified green.

**The guard test cannot catch this class** — it checks that installed versions
satisfy the *override*, not that the override satisfies its *dependents*. Worth
building if a second instance appears; one is not enough to design against.

**Not a security override.**

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

### `esbuild` — `^0.28.1`

Alerts #4, #75. Closed in [#124](https://github.com/thehashrocket/volunteerready.org/pull/124).

Note this is the repo's only **0.x** override, so `^0.28.1` means
`>=0.28.1 <0.29.0` — npm bounds a 0.x caret by *minor*, not major. The guard
test encodes that; treating it as "any 0.x" was a real bug in an early draft.

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
