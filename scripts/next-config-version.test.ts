import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import nextConfig from '../next.config';

/**
 * `NEXT_PUBLIC_APP_VERSION` is wired in `next.config.ts` from `package.json`,
 * and losing that wiring does not fail anything on its own — it prints an
 * empty string where the account menu should show a release number, which
 * looks like a styling bug rather than a missing build variable.
 *
 * Same class as `scripts/next-config-images.test.ts` and
 * `scripts/lint-gate.test.ts`: a guard for root config the tool it configures
 * cannot check itself. It asserts against the RESOLVED config (post
 * `withSentryConfig`), which is what Next actually consumes, so a wrapper
 * dropping or overwriting the `env` block is caught too.
 *
 * Note what is deliberately NOT asserted here: the staleness comparison value.
 * That is `NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA`, which Vercel exposes on its own
 * with no wiring in this file (decision 48), so there is nothing here to guard.
 * If someone ever "helpfully" adds it to this `env` block they will pin it to
 * whatever the value was when the config was evaluated — add an assertion
 * against that if it happens.
 */

const REPO_ROOT = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	'..',
);

const config = nextConfig as Record<string, unknown>;
const env = config.env as Record<string, string> | undefined;

const packageVersion = JSON.parse(
	readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8'),
).version as string;

const versionFile = readFileSync(
	path.join(REPO_ROOT, 'VERSION'),
	'utf8',
).trim();

describe('next.config.ts version wiring', () => {
	it('exposes NEXT_PUBLIC_APP_VERSION to the client', () => {
		expect(env?.NEXT_PUBLIC_APP_VERSION).toBeDefined();
		expect(env?.NEXT_PUBLIC_APP_VERSION).not.toBe('');
	});

	it('sources it from package.json rather than a hardcoded literal', () => {
		// A literal would be correct exactly once and silently stale after the
		// next `/ship`, which is the failure this whole feature exists to
		// surface — reported by the thing meant to report it.
		expect(env?.NEXT_PUBLIC_APP_VERSION).toBe(packageVersion);
	});

	it('keeps package.json and VERSION in step', () => {
		// Not strictly about the wiring, but this is the file that turns those
		// two into one client-visible string, so a drift between them shows up
		// here rather than as a wrong number in the account menu.
		expect(packageVersion).toBe(versionFile);
	});

	it('reads a four-part release string', () => {
		// Self-check: an empty or malformed package.json version would satisfy
		// the equality assertion above by matching itself.
		expect(packageVersion).toMatch(/^\d+\.\d+\.\d+\.\d+$/);
	});
});
