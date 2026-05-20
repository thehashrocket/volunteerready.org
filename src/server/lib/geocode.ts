type GeocodeResult =
	| { geocodeStatus: 'SUCCESS'; lat: number; lng: number }
	| { geocodeStatus: 'SKIPPED' | 'FAILED' };

const SUITE_FLOOR_PATTERN =
	/\b(suite|ste|floor|fl|room|rm|apt|unit|#)\s*[\w-]+[,\s]*/gi;

export function getGeocodeApiKey(): string | null {
	return process.env.OPENCAGE_API_KEY ?? null;
}

function cleanLocation(location: string): string {
	return location.replace(SUITE_FLOOR_PATTERN, '').trim().replace(/,\s*$/, '');
}

export async function geocodeLocation(
	location: string,
): Promise<GeocodeResult> {
	const key = getGeocodeApiKey();
	if (!key) return { geocodeStatus: 'SKIPPED' };

	const cleaned = cleanLocation(location);
	if (!cleaned) return { geocodeStatus: 'SKIPPED' };

	const url = `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(cleaned)}&key=${key}&countrycode=us&limit=1&no_annotations=1`;

	try {
		const res = await fetch(url);
		if (!res.ok) return { geocodeStatus: 'FAILED' };

		const data = (await res.json()) as {
			results: { geometry: { lat: number; lng: number } }[];
			status: { code: number };
		};

		if (data.status.code !== 200 || data.results.length === 0) {
			return { geocodeStatus: 'FAILED' };
		}

		const { lat, lng } = data.results[0].geometry;
		return { geocodeStatus: 'SUCCESS', lat, lng };
	} catch {
		return { geocodeStatus: 'FAILED' };
	}
}
