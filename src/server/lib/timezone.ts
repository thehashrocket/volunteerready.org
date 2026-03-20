/**
 * Returns the current hour (0-23) in the given IANA timezone.
 * Falls back to UTC for null, undefined, or invalid timezone strings.
 */
export function getCurrentHourInTimezone(
	tz: string | null | undefined,
): number {
	try {
		const formatter = new Intl.DateTimeFormat('en-US', {
			timeZone: tz ?? 'UTC',
			hour: 'numeric',
			hour12: false,
		});
		const parts = formatter.formatToParts(new Date());
		const hourPart = parts.find((p) => p.type === 'hour');
		return Number.parseInt(hourPart?.value ?? '0', 10);
	} catch {
		// Invalid timezone string → fall back to UTC
		return getCurrentHourInTimezone(null);
	}
}

/**
 * Filters a list of timezone strings to those where the current local hour
 * matches the target hour (0-23). Includes null entries (UTC) when UTC
 * hour matches the target.
 */
export function getTimezonesMatchingHour(
	timezones: (string | null)[],
	targetHour: number,
): (string | null)[] {
	return timezones.filter((tz) => getCurrentHourInTimezone(tz) === targetHour);
}
