import { prisma } from '@/server/repositories/prisma';

let _adminEmailsCache: string[] | null = null;
let _adminEmailsCacheExpiry = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

export function _resetAdminEmailsCacheForTests() {
	_adminEmailsCache = null;
	_adminEmailsCacheExpiry = 0;
}

/**
 * Returns platform admin emails. Checks `PLATFORM_ADMIN_ALERT_EMAIL` env var
 * first (override for all admin notifications), then falls back to DB
 * isPlatformAdmin flag + PLATFORM_ADMIN_IDS env var.
 */
export async function getAdminEmails(): Promise<string[]> {
	const override = process.env.PLATFORM_ADMIN_ALERT_EMAIL;
	if (override) return [override];

	const now = Date.now();
	if (_adminEmailsCache && now < _adminEmailsCacheExpiry) {
		return _adminEmailsCache;
	}

	const dbAdmins = await prisma.user.findMany({
		where: { isPlatformAdmin: true },
		select: { id: true, email: true },
	});

	const envIds = (process.env.PLATFORM_ADMIN_IDS ?? '')
		.split(',')
		.map((id) => id.trim())
		.filter(Boolean);
	const dbAdminIds = new Set(dbAdmins.map((a) => a.id));
	const missingEnvIds = envIds.filter((id) => !dbAdminIds.has(id));

	let envAdmins: { email: string | null }[] = [];
	if (missingEnvIds.length > 0) {
		envAdmins = await prisma.user.findMany({
			where: { id: { in: missingEnvIds } },
			select: { email: true },
		});
	}

	_adminEmailsCache = [...dbAdmins, ...envAdmins]
		.map((a) => a.email)
		.filter((e): e is string => !!e);
	_adminEmailsCacheExpiry = now + CACHE_TTL_MS;
	return _adminEmailsCache;
}
