/**
 * The two version strings this app needs, which are NOT the same string and
 * answer different questions.
 *
 * Both are baked at build time, so on the client they describe *this client's
 * own build* — which is exactly what a staleness check needs. `/api/version`
 * imports the same constants, so the deployed server reports *its* build, and
 * a difference means the tab is behind.
 */

/**
 * The human-readable release, e.g. `0.41.12.0`. Display only.
 *
 * Shown in the account menu (plan decisions 23, 30) so it is quotable in a
 * support conversation. Never used for the staleness comparison: `/ship` bumps
 * it on nearly every PR, but a rollback, a preview promote or an env-only
 * redeploy can ship a different build under the same number.
 *
 * Wired in `next.config.ts` from `package.json`; `scripts/next-config-version.test.ts`
 * fails if that wiring is removed.
 */
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? '';

/**
 * The staleness comparison value. `NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA` when
 * Vercel built this, falling back to the semver everywhere else.
 *
 * WHY THE COMMIT SHA. T0 established that this project's
 * "Automatically expose System Environment Variables" setting is ON, but that
 * `NEXT_PUBLIC_VERCEL_DEPLOYMENT_ID` **does not exist** — Vercel auto-prefixes
 * sixteen system vars for Next.js and the deployment id is not one of them.
 * The commit SHA is, it is documented, and it needs no build wiring at all. It
 * closes rollbacks and preview promotes, which the semver missed. (Decision 48.)
 *
 * WHAT IT STILL MISSES: a redeploy of an identical commit with only env vars
 * changed. The complete fix is the real deployment id, which Vercel does not
 * hand to the client. Do not describe this as deploy-exact.
 *
 * REJECTED: `<html data-dpl-id>`, which Next 16.3 does stamp with the true
 * deployment id — verified in production and in `next/dist/pages/_document.js`.
 * Perfect identity, zero config, and an undocumented internal that a Next bump
 * can remove silently. Not worth building the feature's core signal on.
 *
 * ============================ READ BEFORE EDITING ============================
 * `/api/version` MUST import this constant rather than reading `process.env`
 * itself (decision 50). `NEXT_PUBLIC_*` values are inlined at BUILD time, so a
 * client built where the SHA is absent bakes the `?? APP_VERSION` fallback —
 * while a route handler reading `process.env.VERCEL_GIT_COMMIT_SHA` at RUNTIME
 * on Vercel would get a real SHA. The two fallbacks then disagree permanently
 * and every user is prompted forever. Not hypothetical: `vercel deploy
 * --prebuilt` builds off-platform and runs on it, and Vercel's own docs name
 * prebuilt as the case where build-time and deploy-time ids diverge.
 *
 * One expression, evaluated once, imported by both halves: they degrade
 * together or not at all.
 * =============================================================================
 */
export const BUILD_ID =
	process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || APP_VERSION;
