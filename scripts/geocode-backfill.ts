import { config } from 'dotenv';

config({ path: '.env.local' });
config({ path: '.env' });

import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import {
	OpportunityStatus,
	PrismaClient,
} from '../src/prisma/generated/client';
import { geocodeLocation } from '../src/server/lib/geocode';

const datasourceUrl = process.env.DATABASE_URL;
if (!datasourceUrl) {
	console.error('DATABASE_URL is not set. Check .env.local.');
	process.exit(1);
}

const prisma = new PrismaClient({
	adapter: new PrismaPg(new Pool({ connectionString: datasourceUrl })),
});

const SLEEP_MS = 500;

function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
	const apiKey = process.env.OPENCAGE_API_KEY;
	if (!apiKey) {
		console.error('OPENCAGE_API_KEY is not set. Exiting.');
		process.exit(1);
	}

	const pending = await prisma.volunteerOpportunity.findMany({
		where: {
			status: OpportunityStatus.PUBLISHED,
			geocodeStatus: 'PENDING',
			location: { not: null },
		},
		select: { id: true, location: true },
	});

	console.log(`Found ${pending.length} opportunities to geocode.`);

	let success = 0;
	let failed = 0;
	let skipped = 0;

	for (const opp of pending) {
		if (!opp.location?.trim()) {
			await prisma.volunteerOpportunity.update({
				where: { id: opp.id },
				data: { geocodeStatus: 'SKIPPED' as const },
			});
			skipped++;
			console.log(`[SKIPPED] ${opp.id} — blank location`);
			continue;
		}

		const result = await geocodeLocation(opp.location);

		if (result.geocodeStatus === 'SUCCESS') {
			await prisma.volunteerOpportunity.update({
				where: { id: opp.id },
				data: { geocodeStatus: 'SUCCESS', lat: result.lat, lng: result.lng },
			});
			success++;
			console.log(
				`[OK] ${opp.id} — ${opp.location} → ${result.lat}, ${result.lng}`,
			);
		} else {
			await prisma.volunteerOpportunity.update({
				where: { id: opp.id },
				data: { geocodeStatus: result.geocodeStatus, lat: null, lng: null },
			});
			if (result.geocodeStatus === 'SKIPPED') {
				skipped++;
				console.log(`[SKIPPED] ${opp.id} — ${opp.location}`);
			} else {
				failed++;
				console.log(`[FAILED] ${opp.id} — ${opp.location}`);
			}
		}

		await sleep(SLEEP_MS);
	}

	console.log(
		`\nDone. Success: ${success} | Failed: ${failed} | Skipped: ${skipped}`,
	);
}

main()
	.catch((err) => {
		console.error(err);
		process.exit(1);
	})
	.finally(() => prisma.$disconnect());
