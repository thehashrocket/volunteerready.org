import { describe, expect, it } from 'vitest';
import {
	computeOrgHealth,
	type OrgHealthInput,
} from '@/server/domain/org-health';

const empty: OrgHealthInput = {
	screenerQuestionCount: 0,
	publishedOpportunityCount: 0,
	shiftsWithSignupsCount: 0,
	credentialsIssuedCount: 0,
};

describe('computeOrgHealth', () => {
	it('returns 0 with screener tip when nothing is configured', () => {
		const result = computeOrgHealth(empty);
		expect(result.score).toBe(0);
		expect(result.tip).toBe('Add a screener question to reach 25');
	});

	it('returns 25 when only screener questions exist', () => {
		const result = computeOrgHealth({ ...empty, screenerQuestionCount: 3 });
		expect(result.score).toBe(25);
		expect(result.tip).toBe('Publish an opportunity to reach 50');
	});

	it('returns 50 when screener + opportunity are configured', () => {
		const result = computeOrgHealth({
			...empty,
			screenerQuestionCount: 1,
			publishedOpportunityCount: 2,
		});
		expect(result.score).toBe(50);
		expect(result.tip).toBe(
			'Get a volunteer signup on a shift to reach 75',
		);
	});

	it('returns 75 when screener + opportunity + shift signups exist', () => {
		const result = computeOrgHealth({
			...empty,
			screenerQuestionCount: 1,
			publishedOpportunityCount: 1,
			shiftsWithSignupsCount: 1,
		});
		expect(result.score).toBe(75);
		expect(result.tip).toBe('Issue a credential to reach 100');
	});

	it('returns 100 with no tip when all metrics are met', () => {
		const result = computeOrgHealth({
			screenerQuestionCount: 5,
			publishedOpportunityCount: 3,
			shiftsWithSignupsCount: 2,
			credentialsIssuedCount: 1,
		});
		expect(result.score).toBe(100);
		expect(result.tip).toBeNull();
	});

	it('follows priority order: shows screener tip even if other metrics are met', () => {
		const result = computeOrgHealth({
			...empty,
			publishedOpportunityCount: 1,
			credentialsIssuedCount: 1,
		});
		expect(result.score).toBe(50);
		expect(result.tip).toBe('Add a screener question to reach 75');
	});

	it('shows opportunity tip when only screener is missing from first two', () => {
		const result = computeOrgHealth({
			...empty,
			screenerQuestionCount: 1,
			shiftsWithSignupsCount: 1,
			credentialsIssuedCount: 1,
		});
		expect(result.score).toBe(75);
		expect(result.tip).toBe('Publish an opportunity to reach 100');
	});

	it('treats count > 1 the same as count = 1 (binary scoring)', () => {
		const result = computeOrgHealth({
			screenerQuestionCount: 100,
			publishedOpportunityCount: 50,
			shiftsWithSignupsCount: 25,
			credentialsIssuedCount: 10,
		});
		expect(result.score).toBe(100);
		expect(result.tip).toBeNull();
	});
});
