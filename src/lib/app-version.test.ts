import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * These constants are inlined at BUILD time, so under vitest they resolve from
 * whatever `process.env` holds. That makes the fallback chain — the part
 * decision 50 hinges on — directly testable, which is the part worth testing.
 *
 * Each case re-imports the module after stubbing, because the values are
 * captured at module evaluation. `vi.resetModules()` is what makes that work;
 * without it every case would see the first import's frozen values and pass
 * for the wrong reason.
 */

async function loadWith(env: Record<string, string | undefined>) {
	vi.resetModules();
	for (const [key, value] of Object.entries(env)) {
		if (value === undefined) {
			vi.stubEnv(key, undefined as unknown as string);
		} else {
			vi.stubEnv(key, value);
		}
	}
	return import('./app-version');
}

afterEach(() => {
	vi.unstubAllEnvs();
	vi.resetModules();
});

describe('APP_VERSION', () => {
	it('is the wired release string', async () => {
		const { APP_VERSION } = await loadWith({
			NEXT_PUBLIC_APP_VERSION: '0.41.12.0',
		});
		expect(APP_VERSION).toBe('0.41.12.0');
	});

	it('is empty rather than undefined when the wiring is missing', async () => {
		// An empty string is a falsy value BUILD_ID's fallback chain can reason
		// about; `undefined` would leak into the payload as a missing key.
		const { APP_VERSION } = await loadWith({
			NEXT_PUBLIC_APP_VERSION: undefined,
		});
		expect(APP_VERSION).toBe('');
	});
});

describe('BUILD_ID', () => {
	it('prefers the Vercel commit SHA when Vercel built this', async () => {
		const { BUILD_ID } = await loadWith({
			NEXT_PUBLIC_APP_VERSION: '0.41.12.0',
			NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA: 'abc123def456',
		});
		expect(BUILD_ID).toBe('abc123def456');
	});

	it('falls back to the release string off Vercel (local, CI)', async () => {
		const { BUILD_ID } = await loadWith({
			NEXT_PUBLIC_APP_VERSION: '0.41.12.0',
			NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA: undefined,
		});
		expect(BUILD_ID).toBe('0.41.12.0');
	});

	it('falls back on an EMPTY SHA, not just an absent one', async () => {
		// This is why the operator is `||` and not `??`. An env var that is
		// present-but-empty is an ordinary CI outcome, and `??` would accept ''
		// as a legitimate build id — which never equals the server's, so every
		// user would be prompted forever. Swapping the operator turns this red;
		// nothing else in the suite notices.
		const { BUILD_ID } = await loadWith({
			NEXT_PUBLIC_APP_VERSION: '0.41.12.0',
			NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA: '',
		});
		expect(BUILD_ID).toBe('0.41.12.0');
	});

	it('is never empty when either source is present', async () => {
		const { BUILD_ID } = await loadWith({
			NEXT_PUBLIC_APP_VERSION: '',
			NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA: 'abc123',
		});
		expect(BUILD_ID).toBe('abc123');
	});
});
