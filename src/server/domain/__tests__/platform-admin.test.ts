import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock prisma before importing the module under test
vi.mock('@/server/repositories/prisma', () => ({
	prisma: {
		user: {
			findUnique: vi.fn(),
		},
	},
}));

import { prisma } from '@/server/repositories/prisma';
import { isPlatformAdmin } from '../platform-admin';

const mockFindUnique = prisma.user.findUnique as ReturnType<typeof vi.fn>;

describe('isPlatformAdmin', () => {
	beforeEach(() => {
		vi.unstubAllEnvs();
		mockFindUnique.mockReset();
	});

	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it('T1: returns true when DB column isPlatformAdmin is true', async () => {
		mockFindUnique.mockResolvedValue({ isPlatformAdmin: true });

		const result = await isPlatformAdmin('user-1');

		expect(result).toBe(true);
		expect(mockFindUnique).toHaveBeenCalledWith({
			where: { id: 'user-1' },
			select: { isPlatformAdmin: true },
		});
	});

	it('T2: returns true via env fallback when DB is false but user is in PLATFORM_ADMIN_IDS', async () => {
		mockFindUnique.mockResolvedValue({ isPlatformAdmin: false });
		vi.stubEnv('PLATFORM_ADMIN_IDS', 'user-1,user-2');

		const result = await isPlatformAdmin('user-1');

		expect(result).toBe(true);
	});

	it('T3: returns false when DB is false and env var is not set', async () => {
		mockFindUnique.mockResolvedValue({ isPlatformAdmin: false });
		vi.stubEnv('PLATFORM_ADMIN_IDS', '');

		const result = await isPlatformAdmin('user-1');

		expect(result).toBe(false);
	});

	it('T4: returns false when user is not in database', async () => {
		mockFindUnique.mockResolvedValue(null);
		vi.stubEnv('PLATFORM_ADMIN_IDS', '');

		const result = await isPlatformAdmin('nonexistent');

		expect(result).toBe(false);
	});
});
