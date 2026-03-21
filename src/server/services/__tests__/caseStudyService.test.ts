/**
 * Unit tests for caseStudyService.
 *
 * Prisma + external dependencies are mocked.
 * Tests verify composition logic, edge cases, and helper behaviour.
 */

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const mockPrisma = vi.hoisted(() => ({
	organization: {
		findUnique: vi.fn(),
		findMany: vi.fn(),
		update: vi.fn(),
	},
	orgFeedback: {
		findMany: vi.fn(),
	},
}));

const mockAnalytics = vi.hoisted(() => ({
	getRetentionStats: vi.fn(),
	getAvgFillRate: vi.fn(),
	getTopVolunteers: vi.fn(),
}));

const mockScreener = vi.hoisted(() => ({
	getImpactReport: vi.fn(),
}));

const mockEmail = vi.hoisted(() => ({
	sendEmail: vi.fn(),
}));

const mockToken = vi.hoisted(() => ({
	createConsentToken: vi.fn(),
}));

const mockPdf = vi.hoisted(() => ({
	formatCaseStudyPdf: vi.fn(),
}));

vi.mock('@/server/repositories/prisma', () => ({
	prisma: mockPrisma,
}));

vi.mock('@/server/repositories/orgAnalyticsRepo', () => ({
	getRetentionStats: mockAnalytics.getRetentionStats,
	getAvgFillRate: mockAnalytics.getAvgFillRate,
	getTopVolunteers: mockAnalytics.getTopVolunteers,
}));

vi.mock('@/server/services/screener-queries', () => ({
	getImpactReport: mockScreener.getImpactReport,
	listOrgApplications: vi.fn(),
	getOrgApplicationDetail: vi.fn(),
	getOrgApplicationDetailEnriched: vi.fn(),
	updateOrgApplicationStatus: vi.fn(),
	getPublicScreenerForm: vi.fn(),
	getOrgDashboardStats: vi.fn(),
	getOrgActivityFeed: vi.fn(),
	dismissOnboardingChecklist: vi.fn(),
	getOnboardingBaseline: vi.fn(),
	saveOnboardingBaseline: vi.fn(),
}));

vi.mock('@/server/lib/email', () => ({
	sendEmail: mockEmail.sendEmail,
}));

vi.mock('@/server/lib/case-study-token', () => ({
	createConsentToken: mockToken.createConsentToken,
}));

vi.mock('@/server/lib/html', () => ({
	escapeHtml: (s: string) => s, // passthrough
}));

vi.mock('@/prisma/generated/client', () => ({
	Prisma: { DbNull: 'DbNull' },
}));

vi.mock('@/server/domain/case-study-pdf', () => ({
	formatCaseStudyPdf: mockPdf.formatCaseStudyPdf,
}));

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	generateCaseStudyPdf,
	getAllOrgsForCaseStudies,
	getCaseStudy,
	getConsentedCaseStudies,
	getTestimonials,
	sendApprovalEmail,
	setOrgConsent,
} from '../caseStudyService';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ORG_ID = 'org-case-1';
const NOW = new Date('2026-03-21T00:00:00Z');

function makeOrg(overrides: Record<string, unknown> = {}) {
	return {
		id: ORG_ID,
		name: 'Helping Hands',
		slug: 'helping-hands',
		createdAt: new Date('2025-06-01T00:00:00Z'), // ~293 days ago, > 90 days
		onboardingBaseline: {
			volunteerCount: 50,
			hoursPerWeek: 10,
			currentProcess: 'spreadsheets',
		},
		consentToPublicize: true,
		logoUrl: 'https://example.com/logo.png',
		...overrides,
	};
}

const DEFAULT_SUMMARY = {
	totalVolunteers: 25,
	backgroundChecksCompleted: 20,
	shiftsCreated: 15,
	credentialsIssued: 10,
	applicationsSubmitted: 30,
	applicationsApproved: 22,
};

const DEFAULT_RETENTION = {
	activeVolunteers: 20,
	returningVolunteers: 15,
};

function setupDefaults(org = makeOrg()) {
	mockPrisma.organization.findUnique.mockResolvedValue(org);
	mockScreener.getImpactReport.mockResolvedValue({ summary: DEFAULT_SUMMARY });
	mockAnalytics.getRetentionStats.mockResolvedValue(DEFAULT_RETENTION);
	mockAnalytics.getAvgFillRate.mockResolvedValue(85);
	mockAnalytics.getTopVolunteers.mockResolvedValue([]);
	mockPrisma.orgFeedback.findMany.mockResolvedValue([]);
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
	vi.clearAllMocks();
	vi.useFakeTimers();
	vi.setSystemTime(NOW);
});

afterEach(() => {
	vi.useRealTimers();
});

import { afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// getCaseStudy
// ---------------------------------------------------------------------------

describe('getCaseStudy', () => {
	it('returns composed CaseStudyData for a valid org', async () => {
		setupDefaults();

		const result = await getCaseStudy(ORG_ID);

		expect(result).not.toBeNull();
		expect(result?.orgId).toBe(ORG_ID);
		expect(result?.orgName).toBe('Helping Hands');
		expect(result?.orgSlug).toBe('helping-hands');
		expect(result?.summary).toEqual(DEFAULT_SUMMARY);
		expect(result?.retention).toEqual(DEFAULT_RETENTION);
		expect(result?.avgFillRate).toBe(85);
		expect(result?.consentToPublicize).toBe(true);
		expect(result?.daysOnPlatform).toBeGreaterThan(0);
	});

	it('returns null when org is not found', async () => {
		mockPrisma.organization.findUnique.mockResolvedValue(null);

		const result = await getCaseStudy(ORG_ID);

		expect(result).toBeNull();
	});

	it('skips retention stats when org is less than 90 days old', async () => {
		const youngOrg = makeOrg({ createdAt: new Date('2026-03-01T00:00:00Z') }); // 20 days ago
		setupDefaults(youngOrg);

		const result = await getCaseStudy(ORG_ID);

		expect(result).not.toBeNull();
		expect(result?.retention).toBeNull();
		expect(mockAnalytics.getRetentionStats).not.toHaveBeenCalled();
	});

	it('handles null onboardingBaseline', async () => {
		setupDefaults(makeOrg({ onboardingBaseline: null }));

		const result = await getCaseStudy(ORG_ID);

		expect(result).not.toBeNull();
		expect(result?.baseline).toBeNull();
	});

	it('handles non-object onboardingBaseline (e.g., string)', async () => {
		setupDefaults(makeOrg({ onboardingBaseline: 'not an object' }));

		const result = await getCaseStudy(ORG_ID);

		expect(result?.baseline).toBeNull();
	});

	it('handles partial baseline fields', async () => {
		setupDefaults(makeOrg({ onboardingBaseline: { volunteerCount: 10 } }));

		const result = await getCaseStudy(ORG_ID);

		expect(result?.baseline).toEqual({
			volunteerCount: 10,
			hoursPerWeek: undefined,
			currentProcess: undefined,
		});
	});

	it('returns default summary when impactReport is null', async () => {
		setupDefaults();
		mockScreener.getImpactReport.mockResolvedValue(null);

		const result = await getCaseStudy(ORG_ID);

		expect(result?.summary).toEqual({
			totalVolunteers: 0,
			backgroundChecksCompleted: 0,
			shiftsCreated: 0,
			credentialsIssued: 0,
			applicationsSubmitted: 0,
			applicationsApproved: 0,
		});
	});

	it('returns pullQuote from DAY_30 feedback preferring it over DAY_7', async () => {
		setupDefaults();
		mockPrisma.orgFeedback.findMany.mockResolvedValue([
			// DAY_30 sorts after DAY_7 in desc order, so it comes first
			{ type: 'DAY_30', responses: { working_well: 'Great platform!' } },
			{ type: 'DAY_7', responses: { working_well: 'Pretty good so far' } },
		]);

		const result = await getCaseStudy(ORG_ID);

		expect(result?.pullQuote).toBe('Great platform!');
	});

	it('falls back to DAY_7 feedback when DAY_30 has no working_well', async () => {
		setupDefaults();
		mockPrisma.orgFeedback.findMany.mockResolvedValue([
			{ type: 'DAY_30', responses: { other_field: 'no quote here' } },
			{
				type: 'DAY_7',
				responses: { working_well: 'Early impressions are good' },
			},
		]);

		const result = await getCaseStudy(ORG_ID);

		expect(result?.pullQuote).toBe('Early impressions are good');
	});

	it('returns null pullQuote when no feedback has working_well', async () => {
		setupDefaults();
		mockPrisma.orgFeedback.findMany.mockResolvedValue([
			{ type: 'DAY_7', responses: { other: 'stuff' } },
		]);

		const result = await getCaseStudy(ORG_ID);

		expect(result?.pullQuote).toBeNull();
	});

	it('handles malformed feedback responses (non-object)', async () => {
		setupDefaults();
		mockPrisma.orgFeedback.findMany.mockResolvedValue([
			{ type: 'DAY_7', responses: 'just a string' },
		]);

		const result = await getCaseStudy(ORG_ID);

		expect(result?.pullQuote).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// getConsentedCaseStudies
// ---------------------------------------------------------------------------

describe('getConsentedCaseStudies', () => {
	it('returns case studies only for consented orgs', async () => {
		mockPrisma.organization.findMany.mockResolvedValue([{ id: ORG_ID }]);
		setupDefaults();

		const results = await getConsentedCaseStudies();

		expect(results).toHaveLength(1);
		expect(results[0].orgId).toBe(ORG_ID);
		expect(mockPrisma.organization.findMany).toHaveBeenCalledWith(
			expect.objectContaining({ where: { consentToPublicize: true } }),
		);
	});

	it('returns empty array when no orgs have consented', async () => {
		mockPrisma.organization.findMany.mockResolvedValue([]);

		const results = await getConsentedCaseStudies();

		expect(results).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// getAllOrgsForCaseStudies
// ---------------------------------------------------------------------------

describe('getAllOrgsForCaseStudies', () => {
	it('returns case studies for all orgs', async () => {
		mockPrisma.organization.findMany.mockResolvedValue([
			{ id: 'org-1' },
			{ id: 'org-2' },
		]);
		// Both orgs resolve to the same fixture for simplicity
		mockPrisma.organization.findUnique.mockResolvedValue(makeOrg());
		mockScreener.getImpactReport.mockResolvedValue({
			summary: DEFAULT_SUMMARY,
		});
		mockAnalytics.getRetentionStats.mockResolvedValue(DEFAULT_RETENTION);
		mockAnalytics.getAvgFillRate.mockResolvedValue(85);
		mockAnalytics.getTopVolunteers.mockResolvedValue([]);
		mockPrisma.orgFeedback.findMany.mockResolvedValue([]);

		const results = await getAllOrgsForCaseStudies();

		expect(results).toHaveLength(2);
	});
});

// ---------------------------------------------------------------------------
// getTestimonials
// ---------------------------------------------------------------------------

describe('getTestimonials', () => {
	it('returns testimonials with pull quotes and baseline hours', async () => {
		mockPrisma.organization.findMany.mockResolvedValue([
			{
				id: ORG_ID,
				name: 'Helping Hands',
				slug: 'helping-hands',
				onboardingBaseline: { hoursPerWeek: 10 },
			},
		]);
		mockPrisma.orgFeedback.findMany.mockResolvedValue([
			{ type: 'DAY_30', responses: { working_well: 'Love it!' } },
		]);

		const results = await getTestimonials();

		expect(results).toHaveLength(1);
		expect(results[0]).toEqual({
			orgName: 'Helping Hands',
			orgSlug: 'helping-hands',
			pullQuote: 'Love it!',
			hoursPerWeek: 10,
		});
	});

	it('skips orgs without a pull quote', async () => {
		mockPrisma.organization.findMany.mockResolvedValue([
			{
				id: 'org-no-quote',
				name: 'Silent Org',
				slug: 'silent-org',
				onboardingBaseline: null,
			},
		]);
		mockPrisma.orgFeedback.findMany.mockResolvedValue([]);

		const results = await getTestimonials();

		expect(results).toEqual([]);
	});

	it('returns null hoursPerWeek when baseline is null', async () => {
		mockPrisma.organization.findMany.mockResolvedValue([
			{
				id: ORG_ID,
				name: 'No Baseline Org',
				slug: 'no-baseline',
				onboardingBaseline: null,
			},
		]);
		mockPrisma.orgFeedback.findMany.mockResolvedValue([
			{ type: 'DAY_7', responses: { working_well: 'Works great' } },
		]);

		const results = await getTestimonials();

		expect(results).toHaveLength(1);
		expect(results[0].hoursPerWeek).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// sendApprovalEmail
// ---------------------------------------------------------------------------

describe('sendApprovalEmail', () => {
	it('sends email to admin and returns success', async () => {
		mockPrisma.organization.findUnique
			.mockResolvedValueOnce({
				id: ORG_ID,
				name: 'Helping Hands',
				members: [{ user: { email: 'admin@example.com' } }],
			})
			// Second call from getCaseStudy inside sendApprovalEmail
			.mockResolvedValueOnce(makeOrg());

		mockScreener.getImpactReport.mockResolvedValue({
			summary: DEFAULT_SUMMARY,
		});
		mockAnalytics.getRetentionStats.mockResolvedValue(DEFAULT_RETENTION);
		mockAnalytics.getAvgFillRate.mockResolvedValue(85);
		mockAnalytics.getTopVolunteers.mockResolvedValue([]);
		mockPrisma.orgFeedback.findMany.mockResolvedValue([]);
		mockToken.createConsentToken.mockReturnValue('test-token');
		mockEmail.sendEmail.mockResolvedValue(true);

		const result = await sendApprovalEmail(ORG_ID);

		expect(result).toEqual({ sent: true, to: 'admin@example.com' });
		expect(mockEmail.sendEmail).toHaveBeenCalledOnce();
		expect(mockEmail.sendEmail).toHaveBeenCalledWith(
			'admin@example.com',
			expect.stringContaining('Helping Hands'),
			expect.stringContaining('Approve'),
		);
	});

	it('returns sent: false when org is not found', async () => {
		mockPrisma.organization.findUnique.mockResolvedValue(null);

		const result = await sendApprovalEmail(ORG_ID);

		expect(result).toEqual({ sent: false, to: null });
		expect(mockEmail.sendEmail).not.toHaveBeenCalled();
	});

	it('returns sent: false when no admin email exists', async () => {
		mockPrisma.organization.findUnique.mockResolvedValue({
			id: ORG_ID,
			name: 'Helping Hands',
			members: [],
		});

		const result = await sendApprovalEmail(ORG_ID);

		expect(result).toEqual({ sent: false, to: null });
		expect(mockEmail.sendEmail).not.toHaveBeenCalled();
	});

	it('returns sent: false when case study data is unavailable', async () => {
		mockPrisma.organization.findUnique
			.mockResolvedValueOnce({
				id: ORG_ID,
				name: 'Helping Hands',
				members: [{ user: { email: 'admin@example.com' } }],
			})
			// getCaseStudy returns null because org not found on second lookup
			.mockResolvedValueOnce(null);

		const result = await sendApprovalEmail(ORG_ID);

		expect(result).toEqual({ sent: false, to: null });
		expect(mockEmail.sendEmail).not.toHaveBeenCalled();
	});
});

// ---------------------------------------------------------------------------
// setOrgConsent
// ---------------------------------------------------------------------------

describe('setOrgConsent', () => {
	it('calls prisma update with correct params', async () => {
		mockPrisma.organization.update.mockResolvedValue({});

		await setOrgConsent(ORG_ID, true);

		expect(mockPrisma.organization.update).toHaveBeenCalledWith({
			where: { id: ORG_ID },
			data: { consentToPublicize: true },
		});
	});

	it('passes false consent correctly', async () => {
		mockPrisma.organization.update.mockResolvedValue({});

		await setOrgConsent(ORG_ID, false);

		expect(mockPrisma.organization.update).toHaveBeenCalledWith({
			where: { id: ORG_ID },
			data: { consentToPublicize: false },
		});
	});
});

// ---------------------------------------------------------------------------
// generateCaseStudyPdf
// ---------------------------------------------------------------------------

describe('generateCaseStudyPdf', () => {
	it('returns a buffer when org exists', async () => {
		setupDefaults();
		const fakeBuffer = Buffer.from('pdf-content');
		mockPdf.formatCaseStudyPdf.mockResolvedValue(fakeBuffer);

		const result = await generateCaseStudyPdf(ORG_ID);

		expect(result).toEqual(fakeBuffer);
		expect(mockPdf.formatCaseStudyPdf).toHaveBeenCalledOnce();
	});

	it('returns null when org is not found', async () => {
		mockPrisma.organization.findUnique.mockResolvedValue(null);

		const result = await generateCaseStudyPdf(ORG_ID);

		expect(result).toBeNull();
		expect(mockPdf.formatCaseStudyPdf).not.toHaveBeenCalled();
	});
});
