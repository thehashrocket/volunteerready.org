/**
 * Backfill default screener questions for pre-existing orgs.
 *
 * For each org, inserts any missing default questions using createMany
 * with skipDuplicates (safe to run multiple times thanks to @@unique([orgId, key])).
 *
 * Usage: pnpm backfill:default-questions
 */
import { config } from 'dotenv';
config({ path: '.env.local' });
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import type { Prisma } from '../src/prisma/generated/client';
import { PrismaClient } from '../src/prisma/generated/client';
import { DEFAULT_SCREENER_QUESTIONS } from '../src/server/domain/volunteer-screening';

const datasourceUrl = process.env.DATABASE_URL;
if (!datasourceUrl) {
	throw new Error('DATABASE_URL is not set. Create a .env or .env.local file.');
}

const prisma = new PrismaClient({
	adapter: new PrismaPg(new Pool({ connectionString: datasourceUrl })),
});

async function main() {
	const orgs = await prisma.organization.findMany({
		select: { id: true, name: true },
		orderBy: { createdAt: 'asc' },
	});

	console.log(`[backfill] Found ${orgs.length} orgs. Checking for missing default questions...`);

	let totalInserted = 0;
	let orgsUpdated = 0;

	for (const org of orgs) {
		const result = await prisma.screenerQuestion.createMany({
			data: DEFAULT_SCREENER_QUESTIONS.map((q) => ({
				orgId: org.id,
				key: q.key,
				prompt: q.prompt,
				type: q.type,
				order: q.order,
				isActive: true,
				configJson: q.configJson as Prisma.InputJsonValue,
			})),
			skipDuplicates: true,
		});

		if (result.count > 0) {
			totalInserted += result.count;
			orgsUpdated++;
			console.log(`[backfill] ${org.name}: inserted ${result.count} default questions`);
		}
	}

	console.log(
		`[backfill] Done. Inserted ${totalInserted} questions across ${orgsUpdated} orgs (${orgs.length - orgsUpdated} already had all defaults).`,
	);
}

main()
	.catch((e) => {
		console.error('[backfill] Fatal error:', e);
		process.exit(1);
	})
	.finally(() => prisma.$disconnect());
