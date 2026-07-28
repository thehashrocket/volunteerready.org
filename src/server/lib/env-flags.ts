/**
 * Environment kill switches.
 *
 * These are NOT feature flags. A feature flag turns something on for a subset
 * of orgs and lives in `domain/feature-flags.ts` backed by the `FeatureFlag`
 * table. A kill switch turns a *shipped, platform-wide* behavior back off
 * without a revert-and-deploy, and so it must:
 *
 *   1. default to ENABLED when the variable is unset — an unconfigured
 *      environment (local dev, CI, a preview deploy, a Vercel project where
 *      nobody added the var) must behave like production, or the thing being
 *      guarded is only ever exercised in production;
 *   2. require the exact string `'false'` to disable, so a typo'd value
 *      (`'0'`, `'no'`, `''`) fails toward the shipped behavior rather than
 *      silently disabling a privacy control.
 *
 * Point 1 is the opposite of `lib/rate-limit.ts`, which fails OPEN when its
 * Upstash env vars are missing and therefore disables itself in dev, CI, and
 * any deploy that forgot the var. That is the right call for burst throttling
 * and the wrong call here: `UNCLAIMED_EMAIL_GUARD_ENABLED` protects people who
 * never asked to hear from us, and must not be off by accident.
 *
 * Read at call time, never cached at module scope — tests set and unset these
 * per-case, and a module-scope read would freeze whichever value happened to
 * be present at import.
 */
export function isEnabled(name: string): boolean {
	return process.env[name] !== 'false';
}
