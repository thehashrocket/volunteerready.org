export function formatDateRange(
	start: Date | string | null,
	end: Date | string | null,
): string | null {
	const fmt = (d: Date | string) =>
		new Intl.DateTimeFormat('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
		}).format(d instanceof Date ? d : new Date(d));
	if (start && end) return `${fmt(start)} \u2013 ${fmt(end)}`;
	if (start) return `From ${fmt(start)}`;
	if (end) return `Until ${fmt(end)}`;
	return null;
}
