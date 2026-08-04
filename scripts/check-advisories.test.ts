import { describe, expect, it } from 'vitest';
import {
	type Alert,
	BLOCKING_SEVERITIES,
	decideAdvisoryGate,
} from './check-advisories';

/**
 * The gate's whole value is that it distinguishes three states that all look
 * alike from outside: "nothing to fix", "something to fix", and "could not
 * tell". These tests pin the middle one as the ONLY one that fails the build.
 *
 * The fail-open paths (missing token, API error, unexpected shape) live in
 * `main()` and call `process.exit`, so they are exercised by the CI run itself
 * rather than here. What is testable — and what actually decides the outcome —
 * is the pure classification below.
 */

function alert(over: Partial<Alert> & { number: number }): Alert {
	return {
		state: 'open',
		security_advisory: { severity: 'high', summary: 'Something bad' },
		security_vulnerability: { first_patched_version: { identifier: '1.2.3' } },
		dependency: { package: { name: 'some-pkg' } },
		...over,
	};
}

describe('decideAdvisoryGate', () => {
	it('blocks a high alert that has a patch', () => {
		const { blocking } = decideAdvisoryGate([alert({ number: 1 })]);

		expect(blocking).toHaveLength(1);
		expect(blocking[0]).toMatchObject({
			number: 1,
			severity: 'high',
			packageName: 'some-pkg',
			patchedVersion: '1.2.3',
		});
	});

	it('blocks a critical alert that has a patch', () => {
		const { blocking } = decideAdvisoryGate([
			alert({ number: 2, security_advisory: { severity: 'critical' } }),
		]);

		expect(blocking).toHaveLength(1);
	});

	it.each([
		'medium',
		'low',
		'moderate',
		'',
	])('does not block %s severity', (severity) => {
		const { blocking, ignored } = decideAdvisoryGate([
			alert({ number: 3, security_advisory: { severity } }),
		]);

		expect(blocking).toHaveLength(0);
		expect(ignored).toBe(1);
	});

	it('is case-insensitive about severity', () => {
		// The API returns lowercase today. Relying on that silently would make
		// the gate inert if it ever changed, and inert looks exactly like green.
		const { blocking } = decideAdvisoryGate([
			alert({ number: 4, security_advisory: { severity: 'CRITICAL' } }),
		]);

		expect(blocking).toHaveLength(1);
	});

	it('does NOT block a high alert with no patch available — it reports it', () => {
		// Nothing to upgrade to. Blocking here would stop every build until an
		// upstream maintainer acted, which is how gates get switched off.
		const { blocking, unpatched } = decideAdvisoryGate([
			alert({
				number: 5,
				security_vulnerability: { first_patched_version: null },
			}),
		]);

		expect(blocking).toHaveLength(0);
		expect(unpatched).toEqual(['#5 some-pkg (high)']);
	});

	it('treats a missing security_vulnerability block as unpatched, not as patched', () => {
		// Fails toward "report, do not block" rather than throwing.
		const { blocking, unpatched } = decideAdvisoryGate([
			alert({ number: 6, security_vulnerability: null }),
		]);

		expect(blocking).toHaveLength(0);
		expect(unpatched).toHaveLength(1);
	});

	it('ignores alerts that are not open, even if the query asked for open ones', () => {
		// The state filter is re-applied locally on purpose: a dismissed alert
		// must never fail a build, and trusting the query string alone makes
		// that a property of the URL rather than of this function.
		const { blocking, ignored } = decideAdvisoryGate([
			alert({ number: 7, state: 'dismissed' }),
			alert({ number: 8, state: 'fixed' }),
			alert({ number: 9, state: 'auto_dismissed' }),
		]);

		expect(blocking).toHaveLength(0);
		expect(ignored).toBe(0); // filtered before counting, not counted as ignored
	});

	it('passes cleanly on an empty alert list', () => {
		expect(decideAdvisoryGate([])).toEqual({
			blocking: [],
			unpatched: [],
			ignored: 0,
		});
	});

	it('separates a mixed batch correctly', () => {
		const { blocking, unpatched, ignored } = decideAdvisoryGate([
			alert({ number: 10 }), // high + patch      → block
			alert({
				number: 11,
				security_advisory: { severity: 'critical' },
				security_vulnerability: { first_patched_version: null },
			}), // critical, no patch → report
			alert({ number: 12, security_advisory: { severity: 'medium' } }), // → ignore
			alert({ number: 13, state: 'dismissed' }), // → invisible
		]);

		expect(blocking.map((b) => b.number)).toEqual([10]);
		expect(unpatched).toHaveLength(1);
		expect(ignored).toBe(1);
	});

	it('survives an alert with no package name rather than throwing', () => {
		const { blocking } = decideAdvisoryGate([
			alert({ number: 14, dependency: {} }),
		]);

		expect(blocking[0].packageName).toBe('unknown');
	});

	it('only ever blocks on high and critical', () => {
		// Pins the constant itself — widening it to `medium` would make the gate
		// fire on the long tail and is a decision, not a tweak.
		expect([...BLOCKING_SEVERITIES]).toEqual(['high', 'critical']);
	});
});
