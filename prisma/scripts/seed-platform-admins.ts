/**
 * One-time seed script: migrates PLATFORM_ADMIN_IDS env var to DB.
 *
 * Usage:
 *   source .env.local && pnpm tsx prisma/scripts/seed-platform-admins.ts
 *
 * Idempotent — safe to rerun. Validates user IDs exist, warns on missing.
 */
import { prisma } from '../../scripts/prisma-client';

async function main() {
	const raw = process.env.PLATFORM_ADMIN_IDS ?? '';
	const ids = raw
		.split(',')
		.map((id) => id.trim())
		.filter(Boolean);

	if (ids.length === 0) {
		console.log('⚠ PLATFORM_ADMIN_IDS is empty or not set. Nothing to seed.');
		return;
	}

	console.log(`Found ${ids.length} platform admin ID(s) in env var.`);

	let granted = 0;
	let alreadyAdmin = 0;
	const missing: string[] = [];

	for (const id of ids) {
		const user = await prisma.user.findUnique({
			where: { id },
			select: { id: true, email: true, isPlatformAdmin: true },
		});

		if (!user) {
			missing.push(id);
			continue;
		}

		if (user.isPlatformAdmin) {
			alreadyAdmin++;
			console.log(`  ✓ ${user.email ?? id} — already a platform admin`);
			continue;
		}

		await prisma.user.update({
			where: { id },
			data: { isPlatformAdmin: true },
		});
		granted++;
		console.log(`  ✅ ${user.email ?? id} — granted platform admin`);
	}

	if (missing.length > 0) {
		console.warn(`\n⚠ ${missing.length} user ID(s) not found in database:`);
		for (const id of missing) {
			console.warn(`  - ${id}`);
		}
	}

	console.log(
		`\nDone. Granted: ${granted}, Already admin: ${alreadyAdmin}, Missing: ${missing.length}`,
	);
}

main()
	.catch((err) => {
		console.error('Seed failed:', err);
		process.exit(1);
	})
	.finally(() => prisma.$disconnect());
