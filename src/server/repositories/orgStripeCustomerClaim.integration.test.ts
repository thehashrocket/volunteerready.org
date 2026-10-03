/**
 * Integration tests for the first-checkout Stripe customer claim.
 *
 * Uses real Postgres. Run with: pnpm test:integration
 *
 * WHY INTEGRATION AND NOT UNIT
 * ----------------------------
 * `claimOrgStripeCustomerId` is a compare-and-set: the "has none yet"
 * predicate lives in the WHERE clause, so of two concurrent first checkouts
 * only one stores its customer. The unit tests mock the boolean it returns;
 * only Postgres can show the predicate actually refuses the second claim.
 */

import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import {
	claimOrgStripeCustomerId,
	findOrgStripeCustomerId,
} from '@/server/repositories/orgRepo';
import { prisma } from '@/server/repositories/prisma';

// Unique per run, so rows left by a killed run cannot collide with this one
// on the unique slug or stripeCustomerId.
const PREFIX = `__stripe_customer_claim_${randomUUID().slice(0, 8)}__`;

const createdOrgIds: string[] = [];

afterEach(async () => {
	await prisma.organization.deleteMany({
		where: { id: { in: createdOrgIds.splice(0) } },
	});
});

async function makeOrg(suffix: string) {
	const org = await prisma.organization.create({
		data: { name: `${PREFIX}${suffix}`, slug: `${PREFIX}${suffix}` },
		select: { id: true },
	});
	createdOrgIds.push(org.id);
	return org;
}

describe('claimOrgStripeCustomerId', () => {
	it('stores the first customer and refuses a second claim', async () => {
		const org = await makeOrg('race');
		const winner = `${PREFIX}cus_winner`;
		const loser = `${PREFIX}cus_loser`;

		await expect(claimOrgStripeCustomerId(org.id, winner)).resolves.toBe(true);
		await expect(claimOrgStripeCustomerId(org.id, loser)).resolves.toBe(false);

		// The loser re-reads this to find the customer it must check out against.
		await expect(findOrgStripeCustomerId(org.id)).resolves.toBe(winner);
	});

	it('lets exactly one of two concurrent claims win', async () => {
		const org = await makeOrg('concurrent');
		const a = `${PREFIX}cus_a`;
		const b = `${PREFIX}cus_b`;

		const results = await Promise.all([
			claimOrgStripeCustomerId(org.id, a),
			claimOrgStripeCustomerId(org.id, b),
		]);

		expect(results.filter(Boolean)).toHaveLength(1);
		const stored = await findOrgStripeCustomerId(org.id);
		expect(stored).toBe(results[0] ? a : b);
	});
});
