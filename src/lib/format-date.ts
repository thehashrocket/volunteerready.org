export function formatDate(value: Date | string): string {
	const date = value instanceof Date ? value : new Date(value);
	return new Intl.DateTimeFormat('en-US', {
		month: 'long',
		day: 'numeric',
		year: 'numeric',
		hour: 'numeric',
		minute: '2-digit',
	}).format(date);
}

export function formatRelative(value: Date | string): string {
	const date = value instanceof Date ? value : new Date(value);
	const diff = Math.round((date.getTime() - Date.now()) / 1000);
	const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
	const abs = Math.abs(diff);
	if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
	if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
	if (abs < 2592000) return rtf.format(Math.round(diff / 86400), 'day');
	return rtf.format(Math.round(diff / 2592000), 'month');
}

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
