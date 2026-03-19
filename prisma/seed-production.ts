import { prisma, seedSkillCatalog, upsertOrg } from './seed-helpers.js';

// ---------------------------------------------------------------------------
// Production seed — minimal data required for the app to function.
// Safe to run in any environment. Idempotent.
// ---------------------------------------------------------------------------

export async function seedProduction() {
	console.log('🌱 Seeding production essentials...\n');

	// =========================================================================
	// 1. Platform organization
	// =========================================================================
	console.log('🏛️  Creating platform organization...');
	// Platform org — issues system-level credentials (tenure badges).
	// Must always exist so tenureBadgeService can reference its ID.
	await upsertOrg('platform', 'VolunteerReady Platform');

	// =========================================================================
	// 2. Skill catalog
	// =========================================================================
	console.log('🎯 Seeding skill catalog...');
	const { skillBySlug, familyBySlug } = await seedSkillCatalog();
	console.log(
		`   ${skillBySlug.size} skills seeded across ${familyBySlug.size} families\n`,
	);

	console.log('✅ Production seed complete!');
	return { skillBySlug, familyBySlug };
}

// Allow running directly: ts-node prisma/seed-production.ts
if (process.argv[1]?.endsWith('seed-production.ts')) {
	seedProduction()
		.catch((error) => {
			console.error('❌ Production seed failed:', error);
			process.exitCode = 1;
		})
		.finally(async () => {
			await prisma.$disconnect();
		});
}
