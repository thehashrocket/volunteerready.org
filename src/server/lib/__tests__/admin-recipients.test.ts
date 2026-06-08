import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock prisma before importing the module under test
// ---------------------------------------------------------------------------

const mockFindMany = vi.fn();

vi.mock('@/server/repositories/prisma', () => ({
	prisma: {
		user: { findMany: (...args: unknown[]) => mockFindMany(...args) },
	},
}));

// ---------------------------------------------------------------------------
// Imports — after vi.mock()
// ---------------------------------------------------------------------------

import {
	_resetAdminEmailsCacheForTests,
	getAdminEmails,
} from '@/server/lib/admin-recipients';

// ---------------------------------------------------------------------------
// Shared setup
// ---------------------------------------------------------------------------

beforeEach(() => {
	_resetAdminEmailsCacheForTests();
	mockFindMany.mockReset();
	delete process.env.PLATFORM_ADMIN_ALERT_EMAIL;
	delete process.env.PLATFORM_ADMIN_IDS;
});

afterEach(() => {
	_resetAdminEmailsCacheForTests();
	delete process.env.PLATFORM_ADMIN_ALERT_EMAIL;
	delete process.env.PLATFORM_ADMIN_IDS;
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('getAdminEmails', () => {
	it('returns override email without hitting DB when PLATFORM_ADMIN_ALERT_EMAIL is set', async () => {
		process.env.PLATFORM_ADMIN_ALERT_EMAIL = 'override@example.com';

		const result = await getAdminEmails();

		expect(result).toEqual(['override@example.com']);
		expect(mockFindMany).not.toHaveBeenCalled();
	});

	it('queries DB admins when no override env var', async () => {
		mockFindMany.mockResolvedValueOnce([
			{ id: 'u1', email: 'dbadmin@example.com' },
		]);

		const result = await getAdminEmails();

		expect(mockFindMany).toHaveBeenCalledTimes(1);
		expect(result).toEqual(['dbadmin@example.com']);
	});

	it('returns cached result on second call without hitting DB again', async () => {
		mockFindMany.mockResolvedValueOnce([
			{ id: 'u1', email: 'admin@example.com' },
		]);

		await getAdminEmails();
		await getAdminEmails();

		expect(mockFindMany).toHaveBeenCalledTimes(1);
	});

	it('merges env IDs not already in DB admins', async () => {
		process.env.PLATFORM_ADMIN_IDS = 'env-user-1,env-user-2';

		// First call: DB admins (isPlatformAdmin=true) — only returns env-user-1 so env-user-2 is missing
		mockFindMany.mockResolvedValueOnce([
			{ id: 'env-user-1', email: 'envadmin1@example.com' },
		]);
		// Second call: look up missing env IDs
		mockFindMany.mockResolvedValueOnce([{ email: 'envadmin2@example.com' }]);

		const result = await getAdminEmails();

		expect(mockFindMany).toHaveBeenCalledTimes(2);
		expect(result).toContain('envadmin1@example.com');
		expect(result).toContain('envadmin2@example.com');
	});

	it('skips second DB call when all env IDs are already in DB admins', async () => {
		process.env.PLATFORM_ADMIN_IDS = 'u1';

		mockFindMany.mockResolvedValueOnce([
			{ id: 'u1', email: 'admin@example.com' },
		]);

		const result = await getAdminEmails();

		expect(mockFindMany).toHaveBeenCalledTimes(1);
		expect(result).toEqual(['admin@example.com']);
	});

	it('filters out users with null emails', async () => {
		mockFindMany.mockResolvedValueOnce([
			{ id: 'u1', email: 'admin@example.com' },
			{ id: 'u2', email: null },
		]);

		const result = await getAdminEmails();

		expect(result).toEqual(['admin@example.com']);
	});

	it('returns empty array when no admins found', async () => {
		mockFindMany.mockResolvedValueOnce([]);

		const result = await getAdminEmails();

		expect(result).toEqual([]);
	});
});
