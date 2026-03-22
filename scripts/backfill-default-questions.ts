/**
 * Backfill default screener questions for pre-existing orgs.
 *
 * This is a thin wrapper around the shared backfillDefaultQuestions() helper
 * in seed-helpers.ts. The same logic also runs as part of `pnpm db:seed` in
 * production (via seed-production.ts).
 *
 * Usage: pnpm backfill:default-questions
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import { backfillDefaultQuestions, prisma } from '../prisma/seed-helpers';

backfillDefaultQuestions()
	.catch((e) => {
		console.error('[backfill] Fatal error:', e);
		process.exit(1);
	})
	.finally(() => prisma.$disconnect());
