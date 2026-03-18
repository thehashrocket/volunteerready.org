import { describe, expect, it } from 'vitest';
import {
	createNotificationSchema,
	formatNotificationAge,
	notificationTypeSchema,
	updatePreferenceSchema,
} from '@/server/domain/notification';

// ---------------------------------------------------------------------------
// formatNotificationAge — pure function with time-based branches
// ---------------------------------------------------------------------------

describe('formatNotificationAge', () => {
	it('returns "just now" for times less than a minute ago', () => {
		const now = new Date();
		expect(formatNotificationAge(now)).toBe('just now');
	});

	it('returns minutes for times between 1-59 minutes ago', () => {
		const fiveMinAgo = new Date(Date.now() - 5 * 60_000);
		expect(formatNotificationAge(fiveMinAgo)).toBe('5m ago');
	});

	it('returns hours for times between 1-23 hours ago', () => {
		const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60_000);
		expect(formatNotificationAge(threeHoursAgo)).toBe('3h ago');
	});

	it('returns days for times between 1-6 days ago', () => {
		const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60_000);
		expect(formatNotificationAge(twoDaysAgo)).toBe('2d ago');
	});

	it('returns formatted date for times 7+ days ago', () => {
		const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60_000);
		const result = formatNotificationAge(tenDaysAgo);
		// Should be a locale date string, not "Xd ago"
		expect(result).not.toContain('ago');
		expect(result).toMatch(/\d/); // contains at least a digit (date)
	});

	it('handles boundary: exactly 1 minute ago', () => {
		const oneMinAgo = new Date(Date.now() - 60_000);
		expect(formatNotificationAge(oneMinAgo)).toBe('1m ago');
	});

	it('handles boundary: exactly 1 hour ago', () => {
		const oneHourAgo = new Date(Date.now() - 60 * 60_000);
		expect(formatNotificationAge(oneHourAgo)).toBe('1h ago');
	});

	it('handles boundary: exactly 1 day ago', () => {
		const oneDayAgo = new Date(Date.now() - 24 * 60 * 60_000);
		expect(formatNotificationAge(oneDayAgo)).toBe('1d ago');
	});
});

// ---------------------------------------------------------------------------
// Zod schemas — validation boundaries
// ---------------------------------------------------------------------------

describe('notificationTypeSchema', () => {
	it('accepts valid notification types', () => {
		expect(notificationTypeSchema.parse('SHIFT_REMINDER')).toBe(
			'SHIFT_REMINDER',
		);
		expect(notificationTypeSchema.parse('BADGE_EARNED')).toBe('BADGE_EARNED');
	});

	it('rejects invalid types', () => {
		expect(() => notificationTypeSchema.parse('INVALID')).toThrow();
		expect(() => notificationTypeSchema.parse('')).toThrow();
	});
});

describe('createNotificationSchema', () => {
	const valid = {
		userId: 'clxxxxxxxxxxxxxxxxxxxxxxxxx',
		orgId: 'clyyyyyyyyyyyyyyyyyyyyyyyyy',
		type: 'SHIFT_REMINDER' as const,
		title: 'Your shift starts soon',
		body: 'Your shift at City Park starts in 1 hour.',
	};

	it('accepts valid input', () => {
		expect(createNotificationSchema.parse(valid)).toEqual(valid);
	});

	it('accepts optional href', () => {
		const withHref = { ...valid, href: '/app/shifts/123' };
		expect(createNotificationSchema.parse(withHref).href).toBe(
			'/app/shifts/123',
		);
	});

	it('rejects empty title', () => {
		expect(() =>
			createNotificationSchema.parse({ ...valid, title: '' }),
		).toThrow();
	});

	it('rejects title over 200 chars', () => {
		expect(() =>
			createNotificationSchema.parse({ ...valid, title: 'x'.repeat(201) }),
		).toThrow();
	});

	it('rejects body over 1000 chars', () => {
		expect(() =>
			createNotificationSchema.parse({ ...valid, body: 'x'.repeat(1001) }),
		).toThrow();
	});

	it('rejects invalid userId format', () => {
		expect(() =>
			createNotificationSchema.parse({ ...valid, userId: 'not-a-cuid' }),
		).toThrow();
	});
});

describe('updatePreferenceSchema', () => {
	it('accepts valid input', () => {
		const input = { type: 'SHIFT_REMINDER' as const, inApp: true, email: false };
		expect(updatePreferenceSchema.parse(input)).toEqual(input);
	});

	it('rejects missing boolean fields', () => {
		expect(() =>
			updatePreferenceSchema.parse({ type: 'SHIFT_REMINDER' }),
		).toThrow();
	});
});
