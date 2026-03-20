import { describe, expect, it } from 'vitest';
import { haversineDistance, isWithinRadius } from './geo';

describe('haversineDistance', () => {
	it('computes known distance (NYC to LA ~3,944 km)', () => {
		// NYC: 40.7128, -74.0060  LA: 34.0522, -118.2437
		const distance = haversineDistance(40.7128, -74.006, 34.0522, -118.2437);
		// Known distance is ~3,944 km, allow 1% tolerance
		expect(distance).toBeGreaterThan(3_900_000);
		expect(distance).toBeLessThan(4_000_000);
	});

	it('returns 0 for the same point', () => {
		const distance = haversineDistance(51.5074, -0.1278, 51.5074, -0.1278);
		expect(distance).toBe(0);
	});
});

describe('isWithinRadius', () => {
	it('returns true for points within 100m', () => {
		// Two points ~50m apart (roughly 0.0005 degrees latitude)
		const result = isWithinRadius(37.7749, -122.4194, 37.77535, -122.4194, 100);
		expect(result).toBe(true);
	});

	it('returns false for points beyond 100m', () => {
		// Two points ~500m apart
		const result = isWithinRadius(37.7749, -122.4194, 37.7794, -122.4194, 100);
		expect(result).toBe(false);
	});
});
