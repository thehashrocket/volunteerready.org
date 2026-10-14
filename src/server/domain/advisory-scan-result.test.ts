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

	// `failure` is the 2026-10-12 run that found the advisories; `cancelled`
	// is the 2026-10-05 run GitHub cancelled before any step ran. Neither is
	// a scan that passed.
	it.each([
		['failure', '"failure"'],
		['cancelled', '"cancelled"'],
		['timed_out', '"timed_out"'],
		['skipped', '"skipped"'],
		['neutral', '"neutral"'],
		['action_required', '"action_required"'],
		[null, '"none"'],
	])(
		'treats conclusion %s as failed, naming it in the details',
		(conclusion, named) => {
			const result = assessLastScan(run({ conclusion }), NOW);
			expect(result).toMatchObject({
				ok: false,
				problem: 'failed',
				runUrl: RUN_URL,
			});
			expect(!result.ok && result.details).toContain(named);
		},
	);

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
		['a run with no updated_at', { conclusion: 'success', html_url: 'x' }],
		[
			'a run with a numeric conclusion',
			{ conclusion: 1, html_url: 'x', updated_at: 'x' },
		],
		['a string', 'success'],
	])('rejects %s', (_, value) => {
		expect(isWorkflowRun(value)).toBe(false);
	});
});
