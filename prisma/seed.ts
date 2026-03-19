import { seedDev } from './seed-dev.js';
import { prisma } from './seed-helpers.js';
import { seedProduction } from './seed-production.js';

// ---------------------------------------------------------------------------
// Seed dispatcher — runs production or dev seed based on NODE_ENV.
//
// Production: only essential infrastructure (platform org, skill catalog).
// Dev/staging: full demo data with test accounts for each role.
// ---------------------------------------------------------------------------

const env = process.env.NODE_ENV ?? 'development';
const isProduction = env === 'production';

async function main() {
	if (isProduction) {
		await seedProduction();
	} else {
		await seedDev();
	}
}

main()
	.catch((error) => {
		console.error('❌ Seed failed:', error);
		process.exitCode = 1;
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
