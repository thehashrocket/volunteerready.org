import { describe, expect, it } from 'vitest';
import {
	feedbackFilterSchema,
	feedbackSubmitSchema,
	resolvePageName,
} from '@/server/domain/user-feedback';

describe('feedbackSubmitSchema', () => {
	it('validates valid input', () => {
		const result = feedbackSubmitSchema.safeParse({
			mood: 'HAPPY',
			message: 'Love this feature!',
			pageUrl: '/app/shifts',
		});
		expect(result.success).toBe(true);
	});

	it('rejects empty message', () => {
		const result = feedbackSubmitSchema.safeParse({
			mood: 'HAPPY',
			message: '',
			pageUrl: '/app',
		});
		expect(result.success).toBe(false);
	});

	it('rejects message over 2000 chars', () => {
		const result = feedbackSubmitSchema.safeParse({
			mood: 'NEUTRAL',
			message: 'x'.repeat(2001),
			pageUrl: '/app',
		});
		expect(result.success).toBe(false);
	});

	it('rejects invalid mood', () => {
		const result = feedbackSubmitSchema.safeParse({
			mood: 'ANGRY',
			message: 'Some feedback',
			pageUrl: '/app',
		});
		expect(result.success).toBe(false);
	});
});

describe('feedbackFilterSchema', () => {
	it('validates valid filters', () => {
		const result = feedbackFilterSchema.safeParse({
			status: 'NEW',
			mood: 'BUG',
			page: 2,
			pageSize: 50,
		});
		expect(result.success).toBe(true);
	});

	it('rejects pageSize > 100', () => {
		const result = feedbackFilterSchema.safeParse({
			pageSize: 101,
		});
		expect(result.success).toBe(false);
	});

	it('allows empty object', () => {
		const result = feedbackFilterSchema.safeParse({});
		expect(result.success).toBe(true);
	});
});

describe('resolvePageName', () => {
	it('returns known route name', () => {
		expect(resolvePageName('/app/shifts')).toBe('Shift Management');
	});

	it('strips dynamic segments', () => {
		expect(resolvePageName('/app/opportunities/abc123')).toBe('Opportunities');
	});

	it('falls back to title-cased segment for unknown routes', () => {
		expect(resolvePageName('/unknown-section/some-unknown-page')).toBe(
			'Some Unknown Page',
		);
	});

	it('handles empty/malformed URL input', () => {
		expect(resolvePageName('')).toBe('Unknown page');
	});
});
