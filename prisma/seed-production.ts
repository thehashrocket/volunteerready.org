import {
	backfillDefaultQuestions,
	prisma,
	seedPlatformTemplateQuestions,
	seedSkillCatalog,
	upsertOrg,
} from './seed-helpers.js';

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

	// =========================================================================
	// 3. Platform org template screener questions
	// =========================================================================
	console.log('🧩 Seeding platform template screener questions...');
	await seedPlatformTemplateQuestions();

	// =========================================================================
	// 4. Default screener questions for all other orgs (backfill)
	// =========================================================================
	console.log('📋 Backfilling default screener questions...');
	await backfillDefaultQuestions();

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
