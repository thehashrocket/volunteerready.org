/**
 * Integration tests for getCheckinAnalytics in orgAnalyticsRepo.
 *
 * Uses real Postgres (Docker: volunteer-match-postgres).
 * Run with: pnpm test:integration
 */

import { afterEach, describe, expect, it } from 'vitest';
import { prisma } from '@/server/repositories/prisma';
import { getCheckinAnalytics } from './orgAnalyticsRepo';

// ---------------------------------------------------------------------------
// Unique prefix — isolates test data
// ---------------------------------------------------------------------------

const PREFIX = '__checkin_analytics_test__';

// ---------------------------------------------------------------------------
// Seeding helpers
// ---------------------------------------------------------------------------

async function seedOrg(suffix: string) {
	return prisma.organization.create({
		data: {
			name: `${PREFIX}${suffix}`,
			slug: `${PREFIX}${suffix}`.toLowerCase().replace(/[^a-z0-9]/g, '-'),
		},
	});
}

async function seedAuditLog(
	orgId: string,
	opts: { method?: string; createdAt?: Date },
) {
	return prisma.auditLog.create({
		data: {
			orgId,
			action: 'shift.attendance.attended',
			entityType: 'ShiftSignup',
			entityId: 'signup-test',
			metadata: { method: opts.method ?? 'manual' },
			createdAt: opts.createdAt ?? new Date(),
		},
	});
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

afterEach(async () => {
	const orgs = await prisma.organization.findMany({
		where: { name: { startsWith: PREFIX } },
		select: { id: true },
	});
	const orgIds = orgs.map((o) => o.id);

	if (orgIds.length > 0) {
		await prisma.auditLog.deleteMany({
			where: { orgId: { in: orgIds } },
		});
		await prisma.shift.deleteMany({ where: { orgId: { in: orgIds } } });
		await prisma.organization.deleteMany({ where: { id: { in: orgIds } } });
	}
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('getCheckinAnalytics', () => {
	it('returns correct method breakdown for mixed QR/manual/geo check-ins', async () => {
		const org = await seedOrg('mixed');

		await seedAuditLog(org.id, { method: 'qr' });
		await seedAuditLog(org.id, { method: 'qr' });
		await seedAuditLog(org.id, { method: 'manual' });
		await seedAuditLog(org.id, { method: 'geo' });

		const result = await getCheckinAnalytics(org.id, new Date('2020-01-01'));

		expect(result.qrCheckins).toBe(2);
		expect(result.manualCheckins).toBe(1);
		expect(result.geoCheckins).toBe(1);
		expect(result.totalCheckins).toBe(4);
	});

	it('defaults null method to manual via COALESCE', async () => {
		const org = await seedOrg('coalesce');

		// Simulate pre-QR audit entry with no method in metadata
		await prisma.auditLog.create({
			data: {
				orgId: org.id,
				action: 'shift.attendance.attended',
				entityType: 'ShiftSignup',
				entityId: 'signup-old',
				metadata: {}, // no method key
			},
		});

		const result = await getCheckinAnalytics(org.id, new Date('2020-01-01'));

		expect(result.manualCheckins).toBe(1);
		expect(result.qrCheckins).toBe(0);
		expect(result.totalCheckins).toBe(1);
	});

	it('filters by date range', async () => {
		const org = await seedOrg('datefilter');

		await seedAuditLog(org.id, {
			method: 'qr',
			createdAt: new Date('2026-01-15'),
		});
		await seedAuditLog(org.id, {
			method: 'qr',
			createdAt: new Date('2025-06-01'),
		});

		const result = await getCheckinAnalytics(org.id, new Date('2026-01-01'));

		expect(result.qrCheckins).toBe(1);
		expect(result.totalCheckins).toBe(1);
	});

	it('returns empty results when no check-ins exist', async () => {
		const org = await seedOrg('empty');

		const result = await getCheckinAnalytics(org.id, new Date('2020-01-01'));

		expect(result.totalCheckins).toBe(0);
		expect(result.qrCheckins).toBe(0);
		expect(result.manualCheckins).toBe(0);
		expect(result.geoCheckins).toBe(0);
		expect(result.hourBuckets).toEqual([]);
	});

	it('returns hour buckets sorted by hour', async () => {
		const org = await seedOrg('hours');

		await seedAuditLog(org.id, {
			method: 'qr',
			createdAt: new Date('2026-01-15T09:30:00Z'),
		});
		await seedAuditLog(org.id, {
			method: 'qr',
			createdAt: new Date('2026-01-15T09:45:00Z'),
		});
		await seedAuditLog(org.id, {
			method: 'manual',
			createdAt: new Date('2026-01-15T14:00:00Z'),
		});

		const result = await getCheckinAnalytics(org.id, new Date('2026-01-01'));

		expect(result.hourBuckets.length).toBe(2);
		const hour9 = result.hourBuckets.find((b) => b.hour === 9);
		const hour14 = result.hourBuckets.find((b) => b.hour === 14);
		expect(hour9?.count).toBe(2);
		expect(hour14?.count).toBe(1);
	});

	it('isolates data by orgId', async () => {
		const org1 = await seedOrg('iso1');
		const org2 = await seedOrg('iso2');

		await seedAuditLog(org1.id, { method: 'qr' });
		await seedAuditLog(org1.id, { method: 'qr' });
		await seedAuditLog(org2.id, { method: 'manual' });

		const result1 = await getCheckinAnalytics(org1.id, new Date('2020-01-01'));
		const result2 = await getCheckinAnalytics(org2.id, new Date('2020-01-01'));

		expect(result1.qrCheckins).toBe(2);
		expect(result1.manualCheckins).toBe(0);
		expect(result2.qrCheckins).toBe(0);
		expect(result2.manualCheckins).toBe(1);
	});
});
