/**
 * Backfill script: parse existing DAY_30 OrgFeedback responses for
 * consent_to_publicize and set Organization.consentToPublicize accordingly.
 *
 * Run once after deploying the consentToPublicize migration:
 *   pnpm tsx scripts/backfill-consent.ts
 *
 * Default-false strategy: only affirmative strings map to true.
 * Logs unmatched non-empty values for manual founder review.
 */

import { Prisma } from '../src/prisma/generated/client/index.js';
import { isAffirmativeConsent } from '../src/server/domain/case-study.js';
import { prisma } from './prisma-client';

async function main() {
	const feedbacks = await prisma.orgFeedback.findMany({
		where: { type: 'DAY_30', responses: { not: Prisma.DbNull } },
		select: { orgId: true, responses: true },
	});

	console.log(`Found ${feedbacks.length} DAY_30 feedback records.`);

	let updated = 0;
	const unmatched: { orgId: string; value: string }[] = [];

	for (const fb of feedbacks) {
		const responses = fb.responses as Record<string, string> | null;
		const consentValue = responses?.consent_to_publicize;

		if (!consentValue) continue;

		if (isAffirmativeConsent(consentValue)) {
			await prisma.organization.update({
				where: { id: fb.orgId },
				data: { consentToPublicize: true },
			});
			updated++;
			console.log(`  ✓ ${fb.orgId}: set consentToPublicize = true`);
		} else {
			unmatched.push({ orgId: fb.orgId, value: consentValue });
		}
	}

	console.log(`\nUpdated ${updated} orgs.`);

	if (unmatched.length > 0) {
		console.log(`\nUnmatched consent values (review manually):`);
		for (const { orgId, value } of unmatched) {
			console.log(`  - ${orgId}: "${value}"`);
		}
	}
}

main()
	.catch(console.error)
	.finally(() => prisma.$disconnect());
