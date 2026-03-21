import { describe, expect, it } from 'vitest';
import {
	type CaseStudyData,
	isAffirmativeConsent,
	renderMarkdown,
} from '../case-study';

const baseCaseStudy: CaseStudyData = {
	orgId: 'org_1',
	orgSlug: 'test-org',
	orgName: 'Test Organization',
	logoUrl: null,
	createdAt: new Date('2025-01-01'),
	daysOnPlatform: 365,
	baseline: null,
	summary: {
		totalVolunteers: 50,
		backgroundChecksCompleted: 40,
		shiftsCreated: 100,
		credentialsIssued: 30,
		applicationsSubmitted: 60,
		applicationsApproved: 45,
	},
	retention: null,
	avgFillRate: 0,
	topVolunteers: [],
	pullQuote: null,
	consentToPublicize: true,
};

describe('renderMarkdown', () => {
	it('renders org name and days in heading', () => {
		const md = renderMarkdown(baseCaseStudy);
		expect(md).toContain('# Test Organization — 365 days with VolunteerReady');
	});

	it('includes pull quote when present', () => {
		const data = { ...baseCaseStudy, pullQuote: 'Great platform!' };
		const md = renderMarkdown(data);
		expect(md).toContain('> "Great platform!"');
		expect(md).toContain('> — Test Organization');
	});

	it('omits pull quote section when null', () => {
		const md = renderMarkdown(baseCaseStudy);
		expect(md).not.toContain('> "');
	});

	it('renders baseline section when present', () => {
		const data = {
			...baseCaseStudy,
			baseline: {
				volunteerCount: 20,
				hoursPerWeek: 15,
				currentProcess: 'Spreadsheets',
			},
		};
		const md = renderMarkdown(data);
		expect(md).toContain('## Before VolunteerReady');
		expect(md).toContain('**Volunteers managed:** 20');
		expect(md).toContain('**Admin hours/week:** 15');
		expect(md).toContain('**Process:** Spreadsheets');
	});

	it('calculates estimated hours saved from baseline', () => {
		const data = {
			...baseCaseStudy,
			baseline: { hoursPerWeek: 20 },
		};
		const md = renderMarkdown(data);
		expect(md).toContain('**Estimated hours saved/week:** 12'); // 20 * 0.6 = 12
	});

	it('renders retention percentage when provided', () => {
		const data = {
			...baseCaseStudy,
			retention: { activeVolunteers: 100, returningVolunteers: 75 },
		};
		const md = renderMarkdown(data);
		expect(md).toContain('**Volunteer retention:** 75%');
	});

	it('handles zero active volunteers in retention', () => {
		const data = {
			...baseCaseStudy,
			retention: { activeVolunteers: 0, returningVolunteers: 0 },
		};
		const md = renderMarkdown(data);
		expect(md).toContain('**Volunteer retention:** 0%');
	});

	it('renders fill rate when positive', () => {
		const data = { ...baseCaseStudy, avgFillRate: 85 };
		const md = renderMarkdown(data);
		expect(md).toContain('**Average shift fill rate:** 85%');
	});

	it('omits fill rate when zero', () => {
		const md = renderMarkdown(baseCaseStudy);
		expect(md).not.toContain('fill rate');
	});

	it('includes summary stats', () => {
		const md = renderMarkdown(baseCaseStudy);
		expect(md).toContain('**Applications processed:** 60');
		expect(md).toContain('**Volunteers approved:** 45');
		expect(md).toContain('**Background checks completed:** 40');
	});
});

describe('isAffirmativeConsent', () => {
	it('returns true for affirmative strings', () => {
		expect(isAffirmativeConsent('yes')).toBe(true);
		expect(isAffirmativeConsent('Yep')).toBe(true);
		expect(isAffirmativeConsent('SURE')).toBe(true);
		expect(isAffirmativeConsent('absolutely')).toBe(true);
		expect(isAffirmativeConsent('y')).toBe(true);
	});

	it('returns false for negative strings', () => {
		expect(isAffirmativeConsent('no')).toBe(false);
		expect(isAffirmativeConsent('nope')).toBe(false);
		expect(isAffirmativeConsent('maybe')).toBe(false);
	});

	it('returns false for non-string values', () => {
		expect(isAffirmativeConsent(null)).toBe(false);
		expect(isAffirmativeConsent(undefined)).toBe(false);
		expect(isAffirmativeConsent(42)).toBe(false);
		expect(isAffirmativeConsent(true)).toBe(false);
	});

	it('trims whitespace before matching', () => {
		expect(isAffirmativeConsent('  yes  ')).toBe(true);
		expect(isAffirmativeConsent('\tok\t')).toBe(true);
	});
});
