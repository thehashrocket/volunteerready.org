import { describe, expect, it } from 'vitest';
import {
	assessLastScan,
	isWorkflowRun,
	SCAN_MAX_AGE_HOURS,
	type WorkflowRun,
} from '@/server/domain/advisory-scan-result';

const NOW = new Date('2026-10-13T14:00:00Z');
const RUN_URL =
	'https://github.com/thehashrocket/volunteerready.org/actions/runs/1';

function run(overrides: Partial<WorkflowRun> = {}): WorkflowRun {
	return {
		conclusion: 'success',
		html_url: RUN_URL,
		updated_at: '2026-10-13T13:05:00Z',
		...overrides,
	};
}

function hoursBefore(hours: number): string {
	return new Date(NOW.getTime() - hours * 3_600_000).toISOString();
}

describe('assessLastScan', () => {
	it('passes a recent successful run', () => {
		expect(assessLastScan(run(), NOW)).toEqual({
			ok: true,
			runUrl: RUN_URL,
			completedAt: '2026-10-13T13:05:00Z',
		});
	});

	it('reports missing when there is no completed run', () => {
		expect(assessLastScan(undefined, NOW)).toMatchObject({
			ok: false,
			problem: 'missing',
			runUrl: null,
		});
	});

	// `failure` is the 2026-10-12 run whose check found the advisories;
	// `cancelled` is the 2026-10-05 run GitHub cancelled before any step ran.
	// Neither passed, but only the first one checked anything, so only it may
	// be reported as "an advisory may be open".
	it.each([
		['failure', 'failed', '"failure"'],
		['cancelled', 'inconclusive', '"cancelled"'],
		['timed_out', 'inconclusive', '"timed_out"'],
		['skipped', 'inconclusive', '"skipped"'],
		['neutral', 'inconclusive', '"neutral"'],
		['action_required', 'inconclusive', '"action_required"'],
		['startup_failure', 'inconclusive', '"startup_failure"'],
		[null, 'inconclusive', '"none"'],
	] as const)(
		'treats conclusion %s as %s, naming it in the details',
		(conclusion, problem, named) => {
			const result = assessLastScan(run({ conclusion }), NOW);
			expect(result).toMatchObject({ ok: false, problem, runUrl: RUN_URL });
			expect(!result.ok && result.details).toContain(named);
		},
	);

	// A red run days old means nothing has finished since: the alert must
	// say the scan is stuck, not only send the reader to the old advisory.
	it('says scans may have stopped when a failed run is also older than the limit', () => {
		const result = assessLastScan(
			run({
				conclusion: 'failure',
				updated_at: hoursBefore(SCAN_MAX_AGE_HOURS + 1),
			}),
			NOW,
		);
		expect(result).toMatchObject({ ok: false, problem: 'failed' });
		expect(!result.ok && result.details).toContain(
			'No scan has completed since',
		);
	});

	it('does not say scans stopped for a recent failed run', () => {
		const result = assessLastScan(run({ conclusion: 'failure' }), NOW);
		expect(!result.ok && result.details).not.toContain('completed since');
	});

	it('passes a successful run exactly at the age limit', () => {
		expect(
			assessLastScan(run({ updated_at: hoursBefore(SCAN_MAX_AGE_HOURS) }), NOW)
				.ok,
		).toBe(true);
	});

	it('reports stale when the last success is older than the limit', () => {
		expect(
			assessLastScan(
				run({ updated_at: hoursBefore(SCAN_MAX_AGE_HOURS + 1) }),
				NOW,
			),
		).toMatchObject({ ok: false, problem: 'stale', runUrl: RUN_URL });
	});

	it('reports stale rather than passing an unparseable timestamp', () => {
		expect(
			assessLastScan(run({ updated_at: 'not-a-date' }), NOW),
		).toMatchObject({ ok: false, problem: 'stale' });
	});
});

describe('isWorkflowRun', () => {
	it.each([
		['a completed run', run()],
		['a run with a null conclusion', run({ conclusion: null })],
	])('accepts %s', (_, value) => {
		expect(isWorkflowRun(value)).toBe(true);
	});

	it.each([
		['null', null],
		['an empty object', {}],
		['a run with no html_url', { conclusion: 'success', updated_at: 'x' }],
		// Each row is a valid run except for the one field it names, so it
		// fails on that field and not on the html_url check before it.
		['a run with no updated_at', { conclusion: 'success', html_url: RUN_URL }],
		[
			'a run with a numeric conclusion',
			{ conclusion: 1, html_url: RUN_URL, updated_at: 'x' },
		],
		['a string', 'success'],
		[
			'a run whose html_url is not on github.com',
			{
				conclusion: 'success',
				html_url: 'https://example.com/runs/1',
				updated_at: 'x',
			},
		],
	])('rejects %s', (_, value) => {
		expect(isWorkflowRun(value)).toBe(false);
	});
});
