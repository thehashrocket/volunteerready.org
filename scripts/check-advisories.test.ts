import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// `node:fs` is a namespace whose exports aren't configurable in ESM —
// `vi.spyOn(fs, 'appendFileSync')` throws "Module namespace is not
// configurable". `vi.mock` replaces the whole module instead, which is the
// documented way to stub a Node builtin under Vitest.
vi.mock('node:fs', () => ({ appendFileSync: vi.fn() }));

import { appendFileSync } from 'node:fs';
import {
	type AuditReport,
	BLOCKING_SEVERITIES,
	buildFailOpenReport,
	decideAdvisoryGate,
	NO_PATCH,
	writeStepSummary,
} from './check-advisories';

/**
 * The gate's value is that it distinguishes three states that look alike from
 * outside: "nothing to fix", "something to fix", and "could not tell". These
 * pin the middle one as the ONLY one that fails the build.
 *
 * `failOpen()`'s own orchestration (calling `buildFailOpenReport` +
 * `annotate` + `writeStepSummary` + `process.exit`) still lives in `main()`
 * and is exercised by the CI run itself, same as before. What changed:
 * the two functions it used to hide inline — what to SAY, and how to WRITE
 * it — are now extracted and directly tested below, which is what a green
 * `::warning`-only fail-open used to leave completely uncovered. What is
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

describe('buildFailOpenReport', () => {
	it.each([
		'`pnpm audit` produced no output (spawn ENOENT)',
		'`pnpm audit --json` returned output that is not JSON',
		'`pnpm audit --json` returned an unexpected shape',
	])('every reason produces a non-empty warning and summary: %s', (reason) => {
		const { warningLine, summaryMarkdown } = buildFailOpenReport(reason);

		expect(warningLine.length).toBeGreaterThan(0);
		expect(summaryMarkdown.length).toBeGreaterThan(0);
	});

	it('the warning line names the reason verbatim', () => {
		const { warningLine } = buildFailOpenReport('a specific reason');

		expect(warningLine).toContain('a specific reason');
	});

	it('the summary names the reason verbatim', () => {
		const { summaryMarkdown } = buildFailOpenReport('a specific reason');

		expect(summaryMarkdown).toContain('a specific reason');
	});

	it('the summary states plainly that this is NOT a pass', () => {
		// The whole reason this exists: a green check and a "did not run" state
		// are otherwise indistinguishable from the PR's top-level checks list.
		// A future edit softening this sentence would silently reopen that gap
		// with no test failing to say so — so pin the sentence itself.
		const { summaryMarkdown } = buildFailOpenReport('anything');

		expect(summaryMarkdown).toContain('This is not a pass');
	});

	it('the warning line also states this is not a pass', () => {
		const { warningLine } = buildFailOpenReport('anything');

		expect(warningLine).toContain('This is not a pass');
	});
});

describe('writeStepSummary', () => {
	// `clearMocks: false` is deliberate repo-wide config (see
	// vitest.scripts.config.ts) — clear explicitly rather than relying on it.
	beforeEach(() => {
		vi.mocked(appendFileSync).mockClear();
		vi.mocked(appendFileSync).mockImplementation(() => undefined);
	});

	afterEach(() => {
		delete process.env.GITHUB_STEP_SUMMARY;
	});

	it('does nothing when GITHUB_STEP_SUMMARY is unset', () => {
		delete process.env.GITHUB_STEP_SUMMARY;

		writeStepSummary('some markdown');

		expect(appendFileSync).not.toHaveBeenCalled();
	});

	it('appends to the named file when GITHUB_STEP_SUMMARY is set', () => {
		process.env.GITHUB_STEP_SUMMARY = '/tmp/fake-step-summary.md';

		writeStepSummary('some markdown');

		expect(appendFileSync).toHaveBeenCalledTimes(1);
		expect(appendFileSync).toHaveBeenCalledWith(
			'/tmp/fake-step-summary.md',
			'some markdown',
		);
	});

	it('swallows a write failure rather than throwing', () => {
		process.env.GITHUB_STEP_SUMMARY = '/tmp/fake-step-summary.md';
		vi.mocked(appendFileSync).mockImplementation(() => {
			throw new Error('ENOSPC: no space left on device');
		});

		// The whole point: this must never propagate. `failOpen()`'s entire
		// design intent is "never block on infrastructure issues" — a thrown
		// error here would give it a brand-new way to fail loudly instead of
		// exiting 0, on top of the one this file exists to fix.
		expect(() => writeStepSummary('some markdown')).not.toThrow();
	});
});
