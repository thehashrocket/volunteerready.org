import { describe, expect, it } from 'vitest';
import { getLocation, getLocationSlugs, LOCATIONS } from '../locations';

describe('LOCATIONS', () => {
	it('contains 6 locations', () => {
		expect(LOCATIONS).toHaveLength(6);
	});

	it('has unique slugs', () => {
		const slugs = LOCATIONS.map((l) => l.slug);
		expect(new Set(slugs).size).toBe(slugs.length);
	});

	it('each location has required fields', () => {
		for (const loc of LOCATIONS) {
			expect(loc.slug).toBeTruthy();
			expect(loc.name).toBeTruthy();
			expect(loc.metaTitle).toBeTruthy();
			expect(loc.metaDescription).toBeTruthy();
			expect(loc.heroHeadline).toBeTruthy();
			expect(loc.heroDescription).toBeTruthy();
			expect(loc.painPoints.length).toBeGreaterThan(0);
			expect(loc.comparisonItems.length).toBeGreaterThan(0);
			expect(loc.faqs.length).toBeGreaterThan(0);
			expect(loc.og.heading).toBeTruthy();
			expect(loc.og.subheading).toBeTruthy();
		}
	});
});

describe('getLocation', () => {
	it('returns location data for a valid slug', () => {
		const loc = getLocation('stockton');
		expect(loc).toBeDefined();
		expect(loc?.name).toBe('Stockton, CA');
	});

	it('returns undefined for an invalid slug', () => {
		expect(getLocation('nonexistent')).toBeUndefined();
	});
});

describe('getLocationSlugs', () => {
	it('returns all slugs', () => {
		const slugs = getLocationSlugs();
		expect(slugs).toHaveLength(LOCATIONS.length);
		expect(slugs).toContain('stockton');
		expect(slugs).toContain('modesto');
		expect(slugs).toContain('sacramento');
	});
});
