const EARTH_RADIUS_METERS = 6_371_000;

/**
 * Haversine distance between two lat/lng points in meters.
 */
export function haversineDistance(
	lat1: number,
	lon1: number,
	lat2: number,
	lon2: number,
): number {
	const toRad = (deg: number) => (deg * Math.PI) / 180;

	const dLat = toRad(lat2 - lat1);
	const dLon = toRad(lon2 - lon1);
	const a =
		Math.sin(dLat / 2) ** 2 +
		Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

	return EARTH_RADIUS_METERS * c;
}

/**
 * Check if a point is within a given radius (meters) of another point.
 */
export function isWithinRadius(
	lat1: number,
	lon1: number,
	lat2: number,
	lon2: number,
	radiusMeters: number,
): boolean {
	return haversineDistance(lat1, lon1, lat2, lon2) <= radiusMeters;
}
