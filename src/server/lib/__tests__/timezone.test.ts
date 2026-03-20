import { describe, expect, it } from 'vitest';
import {
	getCurrentHourInTimezone,
	getTimezonesMatchingHour,
} from '@/server/lib/timezone';

describe('getCurrentHourInTimezone', () => {
	it('returns the correct hour for a valid IANA timezone', () => {
		// We can't predict the exact hour, but it should be 0-23
		const hour = getCurrentHourInTimezone('America/New_York');
		expect(hour).toBeGreaterThanOrEqual(0);
		expect(hour).toBeLessThanOrEqual(23);
	});

	it('returns UTC hour when timezone is null', () => {
		const utcHour = getCurrentHourInTimezone(null);
		const directUtc = getCurrentHourInTimezone('UTC');
		expect(utcHour).toBe(directUtc);
	});

	it('falls back to UTC for invalid timezone string (no throw)', () => {
		const utcHour = getCurrentHourInTimezone('UTC');
		const invalidHour = getCurrentHourInTimezone('Not/A/Real/Timezone');
		expect(invalidHour).toBe(utcHour);
	});

	it('handles DST-aware timezones without error', () => {
		// Just verify it doesn't throw for DST-sensitive zones
		const hour = getCurrentHourInTimezone('America/New_York');
		expect(typeof hour).toBe('number');
		expect(Number.isInteger(hour)).toBe(true);
	});
});

describe('getTimezonesMatchingHour', () => {
	it('filters timezones to those matching the target hour', () => {
		// Get the current UTC hour, then filter for it
		const utcHour = getCurrentHourInTimezone('UTC');
		const timezones: (string | null)[] = [
			'UTC',
			'America/New_York',
			'Asia/Tokyo',
			null,
		];

		const matching = getTimezonesMatchingHour(timezones, utcHour);

		// UTC and null should always match (they're the same)
		expect(matching).toContain('UTC');
		expect(matching).toContain(null);
	});

	it('returns empty array when no timezones match', () => {
		// Use an impossible hour
		const matching = getTimezonesMatchingHour(['UTC'], 99);
		expect(matching).toEqual([]);
	});

	it('includes null entries when UTC matches target hour', () => {
		const utcHour = getCurrentHourInTimezone(null);
		const matching = getTimezonesMatchingHour([null], utcHour);
		expect(matching).toContain(null);
	});
});
