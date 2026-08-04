import { describe, expect, it } from 'vitest';
import {
	type AuditReport,
	BLOCKING_SEVERITIES,
	decideAdvisoryGate,
	NO_PATCH,
} from './check-advisories';

/**
 * The gate's value is that it distinguishes three states that look alike from
 * outside: "nothing to fix", "something to fix", and "could not tell". These
 * pin the middle one as the ONLY one that fails the build.
 *
 * The fail-open paths live in `main()` and call `process.exit`, so they are
 * exercised by the CI run itself. What is testable — and what decides the
 * outcome — is the classification below.
 */

function report(...advisories: Record<string, unknown>[]): AuditReport {
	return {
		advisories: Object.fromEntries(
			advisories.map((a, i) => [
				String(1000 + i),
				{
					severity: 'high',
					module_name: 'some-pkg',
					patched_versions: '>=1.2.3',
					github_advisory_id: `GHSA-test-${i}`,
					title: 'Something bad',
					...a,
				},
			]),
		),
	};
}

describe('decideAdvisoryGate', () => {
	it('blocks a high advisory that has a patch', () => {
		const { blocking } = decideAdvisoryGate(report({}));

		expect(blocking).toHaveLength(1);
		expect(blocking[0]).toMatchObject({
			id: 'GHSA-test-0',
			severity: 'high',
			packageName: 'some-pkg',
			patchedVersions: '>=1.2.3',
		});
	});

	it('blocks a critical advisory that has a patch', () => {
		const { blocking } = decideAdvisoryGate(report({ severity: 'critical' }));

		expect(blocking).toHaveLength(1);
	});

	it.each(['moderate', 'low', 'info', ''])(
		'does not block %s severity',
		(severity) => {
			const { blocking, ignored } = decideAdvisoryGate(report({ severity }));

			expect(blocking).toHaveLength(0);
			expect(ignored).toBe(1);
		},
	);

	it('is case-insensitive about severity', () => {
		// The registry returns lowercase today. Relying on that silently would
		// make the gate inert if it changed, and inert looks exactly like green.
		const { blocking } = decideAdvisoryGate(report({ severity: 'CRITICAL' }));

		expect(blocking).toHaveLength(1);
	});

	it(`does NOT block when patched_versions is npm's ${NO_PATCH} sentinel`, () => {
		// Nothing to upgrade to. Blocking here would stop every build until an
		// upstream maintainer acted, which is how gates get switched off.
		const { blocking, unpatched } = decideAdvisoryGate(
			report({ patched_versions: NO_PATCH }),
		);

		expect(blocking).toHaveLength(0);
		expect(unpatched).toEqual(['GHSA-test-0 some-pkg (high)']);
	});

	it('treats a missing patched_versions as unpatched, not as patched', () => {
		const { blocking, unpatched } = decideAdvisoryGate(
			report({ patched_versions: undefined }),
		);

		expect(blocking).toHaveLength(0);
		expect(unpatched).toHaveLength(1);
	});

	it('passes cleanly on an empty report', () => {
		expect(decideAdvisoryGate({ advisories: {} })).toEqual({
			blocking: [],
			unpatched: [],
			ignored: 0,
		});
	});

	it('passes cleanly when the advisories key is absent entirely', () => {
		expect(decideAdvisoryGate({})).toEqual({
			blocking: [],
			unpatched: [],
			ignored: 0,
		});
	});

	it('separates a mixed batch correctly', () => {
		const { blocking, unpatched, ignored } = decideAdvisoryGate(
			report(
				{}, // high + patch        → block
				{ severity: 'critical', patched_versions: NO_PATCH }, // → report
				{ severity: 'moderate' }, // → ignore
			),
		);

		expect(blocking).toHaveLength(1);
		expect(unpatched).toHaveLength(1);
		expect(ignored).toBe(1);
	});

	it('falls back to the numeric id when github_advisory_id is absent', () => {
		const { blocking } = decideAdvisoryGate(
			report({ github_advisory_id: undefined }),
		);

		expect(blocking[0].id).toBe('1000');
	});

	it('survives an advisory with no module name rather than throwing', () => {
		const { blocking } = decideAdvisoryGate(report({ module_name: undefined }));

		expect(blocking[0].packageName).toBe('unknown');
	});

	it('only ever blocks on high and critical', () => {
		// Pins the constant — widening it to `moderate` would make the gate fire
		// on the long tail, and that is a decision rather than a tweak.
		expect([...BLOCKING_SEVERITIES]).toEqual(['high', 'critical']);
	});

	it('an ignored GHSA never reaches this function at all', () => {
		// `pnpm.auditConfig.ignoreGhsas` is applied by pnpm before the report is
		// produced — verified by running it: with sharp's GHSA listed, `pnpm
		// audit --json` reports `advisories: {}`, not a populated `muted` array.
		// So this function needs no ignore handling of its own, and adding any
		// would be a second, divergent source of truth.
		expect(decideAdvisoryGate({ advisories: {} }).blocking).toHaveLength(0);
	});
});
