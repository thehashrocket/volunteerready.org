import { prisma } from '@/server/repositories/prisma';

/**
 * Check whether a user is a platform admin.
 *
 * Resolution order (per design doc):
 *   1. DB column `User.isPlatformAdmin`
 *   2. Env-var fallback (`PLATFORM_ADMIN_IDS`) — removed after migration is verified
 *
 * Queries on demand; admin routes are rare so we don't bloat the session.
 */
export async function isPlatformAdmin(userId: string): Promise<boolean> {
	const user = await prisma.user.findUnique({
		where: { id: userId },
		select: { isPlatformAdmin: true },
	});

	if (user?.isPlatformAdmin) return true;

	// Env-var fallback — remove once all platform admins are migrated to DB
	const envIds = (process.env.PLATFORM_ADMIN_IDS ?? '')
		.split(',')
		.map((id) => id.trim())
		.filter(Boolean);

	return envIds.includes(userId);
}
