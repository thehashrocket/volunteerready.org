/**
 * Integration tests for ESG report generation.
 *
 * Tests the full pipeline: repository queries → service → domain logic
 * against real Postgres.
 *
 * Run with: pnpm test:integration
 */

import { afterEach, describe, expect, it } from 'vitest';
import {
	getESGCredentialCounts,
	getESGDistinctEmployeeCount,
	getESGShiftAggregates,
} from '@/server/repositories/companyRepo';
import { prisma } from '@/server/repositories/prisma';
import { generateESGReport } from './employerReportService';

const PREFIX = '__esg_integration_test__';

// ---------------------------------------------------------------------------
// Seeding helpers
// ---------------------------------------------------------------------------

async function seedUser(suffix: string) {
	return prisma.user.create({
		data: {
			name: `${PREFIX}user-${suffix}`,
			email: `${PREFIX}${suffix}@test.local`,
		},
	});
}

async function seedOrg(suffix: string) {
	return prisma.organization.create({
		data: {
			name: `${PREFIX}org-${suffix}`,
			slug: `${PREFIX}org-${suffix}`.toLowerCase().replace(/[^a-z0-9]/g, '-'),
		},
	});
}

async function seedCompany(suffix: string) {
	return prisma.companyAccount.create({
		data: {
			name: `${PREFIX}company-${suffix}`,
			slug: `${PREFIX}company-${suffix}`
				.toLowerCase()
				.replace(/[^a-z0-9]/g, '-'),
		},
	});
}

async function seedCompanyMember(companyId: string, userId: string) {
	return prisma.companyMember.create({
		data: { companyId, userId, role: 'MEMBER' },
	});
}

async function seedNonprofitLink(companyId: string, orgId: string) {
	return prisma.companyNonprofitLink.create({
		data: { companyId, orgId, status: 'ACTIVE' },
	});
}

async function seedShift(
	orgId: string,
	opts: { startTime: Date; endTime: Date },
) {
	return prisma.shift.create({
		data: {
			orgId,
			title: `${PREFIX}shift`,
			startTime: opts.startTime,
			endTime: opts.endTime,
			capacity: 10,
		},
	});
}

async function seedShiftSignup(
	shiftId: string,
	userId: string,
	status: 'CONFIRMED' | 'ATTENDED' | 'NO_SHOW' | 'CANCELLED' = 'ATTENDED',
) {
	return prisma.shiftSignup.create({
		data: { shiftId, userId, status },
	});
}

let credentialCounter = 0;
const CREDENTIAL_TYPES = [
	'BACKGROUND_CHECK',
	'TRAINING_COMPLETE',
	'ID_VERIFIED',
	'REFERENCE_CHECK',
	'ORIENTATION_COMPLETE',
] as const;

async function seedCredential(
	userId: string,
	orgId: string,
	status: 'PENDING' | 'VERIFIED' | 'REJECTED' = 'VERIFIED',
) {
	const type =
		CREDENTIAL_TYPES[credentialCounter % CREDENTIAL_TYPES.length] ??
		'BACKGROUND_CHECK';
	credentialCounter++;
	return prisma.volunteerCredential.create({
		data: { userId, orgId, type, status },
	});
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

afterEach(async () => {
	credentialCounter = 0;
	// Delete in dependency order
	const companies = await prisma.companyAccount.findMany({
		where: { name: { startsWith: PREFIX } },
		select: { id: true },
	});
	const companyIds = companies.map((c) => c.id);

	const orgs = await prisma.organization.findMany({
		where: { name: { startsWith: PREFIX } },
		select: { id: true },
	});
	const orgIds = orgs.map((o) => o.id);

	const users = await prisma.user.findMany({
		where: { name: { startsWith: PREFIX } },
		select: { id: true },
	});
	const userIds = users.map((u) => u.id);

	// Leaf records first
	if (userIds.length > 0) {
		await prisma.shiftSignup.deleteMany({
			where: { userId: { in: userIds } },
		});
		await prisma.volunteerCredential.deleteMany({
			where: { userId: { in: userIds } },
		});
	}
	if (orgIds.length > 0) {
		await prisma.shift.deleteMany({ where: { orgId: { in: orgIds } } });
	}
	if (companyIds.length > 0) {
		await prisma.companyMember.deleteMany({
			where: { companyId: { in: companyIds } },
		});
		await prisma.companyNonprofitLink.deleteMany({
			where: { companyId: { in: companyIds } },
		});
		await prisma.auditLog.deleteMany({
			where: { companyId: { in: companyIds } },
		});
		await prisma.companyAccount.deleteMany({
			where: { id: { in: companyIds } },
		});
	}
	if (orgIds.length > 0) {
		await prisma.organization.deleteMany({ where: { id: { in: orgIds } } });
	}
	if (userIds.length > 0) {
		await prisma.user.deleteMany({ where: { id: { in: userIds } } });
	}
});

// ---------------------------------------------------------------------------
// Repository-level tests
// ---------------------------------------------------------------------------

describe('getESGShiftAggregates', () => {
	it('aggregates shifts for company employees at linked nonprofits', async () => {
		const company = await seedCompany('shifts');
		const org = await seedOrg('nonprofit-a');
		const user = await seedUser('emp-1');
		await seedCompanyMember(company.id, user.id);
		await seedNonprofitLink(company.id, org.id);

		const shift = await seedShift(org.id, {
			startTime: new Date('2026-01-15T09:00:00Z'),
			endTime: new Date('2026-01-15T13:00:00Z'),
		});
		await seedShiftSignup(shift.id, user.id, 'ATTENDED');

		const rows = await getESGShiftAggregates(company.id, {});
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({
			orgId: org.id,
			employeeCount: 1,
			shiftCount: 1,
			totalHours: 4,
		});
	});

	it('excludes non-ATTENDED signups', async () => {
		const company = await seedCompany('non-attended');
		const org = await seedOrg('nonprofit-b');
		const user = await seedUser('emp-2');
		await seedCompanyMember(company.id, user.id);
		await seedNonprofitLink(company.id, org.id);

		const shift = await seedShift(org.id, {
			startTime: new Date('2026-02-01T10:00:00Z'),
			endTime: new Date('2026-02-01T14:00:00Z'),
		});
		await seedShiftSignup(shift.id, user.id, 'CONFIRMED');

		const rows = await getESGShiftAggregates(company.id, {});
		expect(rows).toHaveLength(0);
	});

	it('excludes users who are not company members', async () => {
		const company = await seedCompany('non-member');
		const org = await seedOrg('nonprofit-c');
		const outsider = await seedUser('outsider');
		// outsider is NOT a company member
		await seedNonprofitLink(company.id, org.id);

		const shift = await seedShift(org.id, {
			startTime: new Date('2026-03-01T09:00:00Z'),
			endTime: new Date('2026-03-01T12:00:00Z'),
		});
		await seedShiftSignup(shift.id, outsider.id, 'ATTENDED');

		const rows = await getESGShiftAggregates(company.id, {});
		expect(rows).toHaveLength(0);
	});

	it('respects date range filters', async () => {
		const company = await seedCompany('daterange');
		const org = await seedOrg('nonprofit-d');
		const user = await seedUser('emp-3');
		await seedCompanyMember(company.id, user.id);
		await seedNonprofitLink(company.id, org.id);

		// Shift inside range
		const shiftIn = await seedShift(org.id, {
			startTime: new Date('2026-02-15T09:00:00Z'),
			endTime: new Date('2026-02-15T12:00:00Z'),
		});
		await seedShiftSignup(shiftIn.id, user.id, 'ATTENDED');

		// Shift outside range (before)
		const shiftOut = await seedShift(org.id, {
			startTime: new Date('2026-01-01T09:00:00Z'),
			endTime: new Date('2026-01-01T12:00:00Z'),
		});
		await seedShiftSignup(shiftOut.id, user.id, 'ATTENDED');

		const rows = await getESGShiftAggregates(company.id, {
			from: new Date('2026-02-01T00:00:00Z'),
			to: new Date('2026-03-01T00:00:00Z'),
		});

		expect(rows).toHaveLength(1);
		expect(rows[0]?.shiftCount).toBe(1);
		expect(rows[0]?.totalHours).toBe(3);
	});

	it('excludes PAUSED nonprofit links', async () => {
		const company = await seedCompany('paused-link');
		const org = await seedOrg('nonprofit-paused');
		const user = await seedUser('emp-paused');
		await seedCompanyMember(company.id, user.id);

		// Create a PAUSED link
		await prisma.companyNonprofitLink.create({
			data: { companyId: company.id, orgId: org.id, status: 'PAUSED' },
		});

		const shift = await seedShift(org.id, {
			startTime: new Date('2026-02-15T09:00:00Z'),
			endTime: new Date('2026-02-15T13:00:00Z'),
		});
		await seedShiftSignup(shift.id, user.id, 'ATTENDED');

		const rows = await getESGShiftAggregates(company.id, {});
		expect(rows).toHaveLength(0);
	});
});

describe('getESGCredentialCounts', () => {
	it('counts verified credentials per linked nonprofit', async () => {
		const company = await seedCompany('creds');
		const org = await seedOrg('nonprofit-cred');
		const user = await seedUser('emp-cred');
		await seedCompanyMember(company.id, user.id);
		await seedNonprofitLink(company.id, org.id);

		await seedCredential(user.id, org.id, 'VERIFIED');
		await seedCredential(user.id, org.id, 'PENDING'); // should be excluded

		const rows = await getESGCredentialCounts(company.id);
		expect(rows).toHaveLength(1);
		expect(rows[0]?.verifiedCredentialCount).toBe(1);
	});

	it('excludes credentials from non-company-members', async () => {
		const company = await seedCompany('creds-outsider');
		const org = await seedOrg('nonprofit-cred-2');
		const outsider = await seedUser('outsider-cred');
		await seedNonprofitLink(company.id, org.id);

		await seedCredential(outsider.id, org.id, 'VERIFIED');

		const rows = await getESGCredentialCounts(company.id);
		expect(rows).toHaveLength(0);
	});
});

describe('getESGDistinctEmployeeCount', () => {
	it('deduplicates employees across multiple orgs', async () => {
		const company = await seedCompany('distinct');
		const orgA = await seedOrg('np-distinct-a');
		const orgB = await seedOrg('np-distinct-b');
		const user = await seedUser('emp-distinct');
		await seedCompanyMember(company.id, user.id);
		await seedNonprofitLink(company.id, orgA.id);
		await seedNonprofitLink(company.id, orgB.id);

		// Same user attends shifts at both orgs
		const shiftA = await seedShift(orgA.id, {
			startTime: new Date('2026-01-15T09:00:00Z'),
			endTime: new Date('2026-01-15T12:00:00Z'),
		});
		const shiftB = await seedShift(orgB.id, {
			startTime: new Date('2026-01-16T09:00:00Z'),
			endTime: new Date('2026-01-16T12:00:00Z'),
		});
		await seedShiftSignup(shiftA.id, user.id, 'ATTENDED');
		await seedShiftSignup(shiftB.id, user.id, 'ATTENDED');

		const count = await getESGDistinctEmployeeCount(company.id, {});
		expect(count).toBe(1); // Same user counted once
	});
});

// ---------------------------------------------------------------------------
// Service-level tests (full pipeline)
// ---------------------------------------------------------------------------

describe('generateESGReport', () => {
	it('produces a complete ESG report with shifts and credentials', async () => {
		const company = await seedCompany('full-report');
		const org = await seedOrg('np-full');
		const user = await seedUser('emp-full');
		await seedCompanyMember(company.id, user.id);
		await seedNonprofitLink(company.id, org.id);

		const shift = await seedShift(org.id, {
			startTime: new Date('2026-03-01T08:00:00Z'),
			endTime: new Date('2026-03-01T12:00:00Z'),
		});
		await seedShiftSignup(shift.id, user.id, 'ATTENDED');
		await seedCredential(user.id, org.id, 'VERIFIED');

		const report = await generateESGReport({
			companyId: company.id,
			actorId: user.id,
			dateRange: {},
		});

		expect(report.companyName).toBe(`${PREFIX}company-full-report`);
		expect(report.rows).toHaveLength(1);
		expect(report.rows[0]).toMatchObject({
			orgId: org.id,
			employeeCount: 1,
			shiftCount: 1,
			totalHours: 4,
			verifiedCredentialCount: 1,
		});
		expect(report.totalOrgsSupported).toBe(1);
		expect(report.totalHours).toBe(4);
		expect(report.totalVerifiedCredentials).toBe(1);
		expect(report.totalEmployeesActive).toBe(1);
	});

	it('includes credential-only orgs with zero shift data', async () => {
		const company = await seedCompany('cred-only');
		const shiftOrg = await seedOrg('np-shift-only');
		const credOrg = await seedOrg('np-cred-only');
		const user = await seedUser('emp-cred-only');
		await seedCompanyMember(company.id, user.id);
		await seedNonprofitLink(company.id, shiftOrg.id);
		await seedNonprofitLink(company.id, credOrg.id);

		// Shift at one org
		const shift = await seedShift(shiftOrg.id, {
			startTime: new Date('2026-03-01T09:00:00Z'),
			endTime: new Date('2026-03-01T11:00:00Z'),
		});
		await seedShiftSignup(shift.id, user.id, 'ATTENDED');

		// Credential at a different org (no shifts)
		await seedCredential(user.id, credOrg.id, 'VERIFIED');

		const report = await generateESGReport({
			companyId: company.id,
			actorId: user.id,
			dateRange: {},
		});

		expect(report.rows).toHaveLength(2);
		expect(report.totalOrgsSupported).toBe(2);

		const credOnlyRow = report.rows.find((r) => r.orgId === credOrg.id);
		expect(credOnlyRow).toMatchObject({
			employeeCount: 0,
			shiftCount: 0,
			totalHours: 0,
			verifiedCredentialCount: 1,
		});
	});

	it('returns empty report for company with no activity', async () => {
		const company = await seedCompany('empty');

		const report = await generateESGReport({
			companyId: company.id,
			actorId: 'actor-id',
			dateRange: {},
		});

		expect(report.rows).toHaveLength(0);
		expect(report.totalHours).toBe(0);
		expect(report.totalOrgsSupported).toBe(0);
		expect(report.totalEmployeesActive).toBe(0);
	});

	it('throws for non-existent company', async () => {
		await expect(
			generateESGReport({
				companyId: 'nonexistent-id',
				actorId: 'actor-id',
				dateRange: {},
			}),
		).rejects.toThrow('Company not found');
	});

	it('aggregates multiple employees across multiple shifts', async () => {
		const company = await seedCompany('multi');
		const org = await seedOrg('np-multi');
		const emp1 = await seedUser('emp-multi-1');
		const emp2 = await seedUser('emp-multi-2');
		await seedCompanyMember(company.id, emp1.id);
		await seedCompanyMember(company.id, emp2.id);
		await seedNonprofitLink(company.id, org.id);

		const shift1 = await seedShift(org.id, {
			startTime: new Date('2026-03-01T09:00:00Z'),
			endTime: new Date('2026-03-01T12:00:00Z'), // 3 hours
		});
		const shift2 = await seedShift(org.id, {
			startTime: new Date('2026-03-02T14:00:00Z'),
			endTime: new Date('2026-03-02T18:00:00Z'), // 4 hours
		});
		await seedShiftSignup(shift1.id, emp1.id, 'ATTENDED');
		await seedShiftSignup(shift2.id, emp1.id, 'ATTENDED');
		await seedShiftSignup(shift1.id, emp2.id, 'ATTENDED');

		const report = await generateESGReport({
			companyId: company.id,
			actorId: emp1.id,
			dateRange: {},
		});

		expect(report.rows).toHaveLength(1);
		expect(report.rows[0]).toMatchObject({
			employeeCount: 2,
			shiftCount: 2, // 2 distinct shifts (emp count doesn't multiply shifts)
			totalHours: 10, // (3+4) from emp1 signups + 3 from emp2 signup
		});
		expect(report.totalEmployeesActive).toBe(2);
	});
});
