/**
 * Guards the `TZ` pin in `vitest.config.mts`.
 *
 * WHY A CONFIG FILE NEEDS A TEST. `credential-expiry.test.ts` has a mutation
 * guard proving `credentialExpiryWindowEnd` uses fixed-span arithmetic
 * (`now + 30 * 86_400_000`) and not calendar days (`setDate(getDate() + 30)`).
 * Those two produce the IDENTICAL instant under UTC, which is what CI runners
 * use — so under UTC that guard passes against both implementations and proves
 * nothing. It only works because vitest runs in a DST-observing zone.
 *
 * That makes the one-line `env: { TZ: ... }` in vitest.config.mts load-bearing
 * for a test in a different file, with nothing connecting them: delete it and
 * the whole suite stays green while the DST divergence quietly returns. Same
 * class as `scripts/lint-gate.test.ts` and `scripts/ci-build-gate.test.ts` —
 * config the tool cannot check itself.
 *
 * Lives under `src/` rather than in `scripts/` with those two, deliberately:
 * they only READ files, while this one also asserts the TZ the process is
 * actually running in — so it has to run under the very config it guards.
 * `vitest.scripts.config.ts` has no TZ pin, so in `scripts/` this would pass on
 * a developer's machine and fail on a UTC CI runner.
 *
 * Comments are stripped before matching, because a docstring quoting the
 * setting would otherwise satisfy the assertion on its own. Line comments
 * first, then block comments: a `//` comment containing `/*` swallows the
 * following real lines if the order is reversed (the ordering
 * `error-disclosure.guard.test.ts` had to learn).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const CONFIG_PATH = join(process.cwd(), 'vitest.config.mts');

/** Zones with no DST would make the pin inert. */
const DST_OBSERVING = [
	'America/Los_Angeles',
	'America/New_York',
	'America/Chicago',
	'America/Denver',
	'Europe/London',
	'Europe/Berlin',
	'Europe/Paris',
	'Australia/Sydney',
];

function stripComments(source: string): string {
	return source.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
}

function readConfig(): string {
	return stripComments(readFileSync(CONFIG_PATH, 'utf8'));
}

describe('vitest TZ pin', () => {
	it('sets a TZ for the test environment', () => {
		expect(readConfig()).toMatch(/env:\s*\{[^}]*TZ:/);
	});

	it('pins a zone that actually observes DST', () => {
		const tz = readConfig().match(/TZ:\s*["']([^"']+)["']/)?.[1];
		expect(tz).toBeDefined();
		expect(DST_OBSERVING).toContain(tz);
	});

	it('is the zone the process is actually running in', () => {
		// Reading the file proves the config says it; this proves vitest applied
		// it. A `TZ` set in the wrong config block would pass the checks above
		// and change nothing at runtime.
		const tz = readConfig().match(/TZ:\s*["']([^"']+)["']/)?.[1];
		expect(process.env.TZ).toBe(tz);
	});

	it('makes calendar-day and fixed-span arithmetic distinguishable', () => {
		// The property the pin exists for, asserted directly rather than trusted.
		// Under UTC both branches produce the same instant and this is equal.
		const now = new Date('2026-10-20T12:00:00Z');
		const fixedSpan = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
		const calendarDays = new Date(now);
		calendarDays.setDate(calendarDays.getDate() + 30);

		expect(calendarDays.getTime()).not.toBe(fixedSpan.getTime());
	});
});
