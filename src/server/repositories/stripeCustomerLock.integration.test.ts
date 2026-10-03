/**
 * Integration tests for the per-customer billing lock.
 *
 * Uses real Postgres. Run with: pnpm test:integration
 *
 * Two subscription webhooks for one Stripe customer each list the customer's
 * subscriptions and write the tier. `lockStripeCustomerTx` makes the second
 * wait until the first commits, so an older list can never overwrite a newer
 * one. The unit tests mock the lock; only Postgres shows it actually blocks.
 */

import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { prisma } from '@/server/repositories/prisma';
import { lockStripeCustomerTx } from '@/server/repositories/webhookRepo';

const HOLD_MS = 400;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Holds the lock for HOLD_MS, returning when it acquired and released it.
function holdLock(customerId: string) {
	return prisma.$transaction(async (tx) => {
		await lockStripeCustomerTx(tx, customerId);
		const acquiredAt = Date.now();
		await sleep(HOLD_MS);
		return { acquiredAt, releasedAt: Date.now() };
	});
}

describe('lockStripeCustomerTx', () => {
	it('makes a second transaction for the same customer wait', async () => {
		const customerId = `cus_lock_${randomUUID()}`;

		const first = holdLock(customerId);
		await sleep(50);
		const second = holdLock(customerId);

		const [a, b] = await Promise.all([first, second]);
		// Either may win on a cold connection pool; the holds must not overlap.
		expect(b.acquiredAt >= a.releasedAt || a.acquiredAt >= b.releasedAt).toBe(
			true,
		);
	});

	it('does not block a transaction for another customer', async () => {
		const first = holdLock(`cus_lock_${randomUUID()}`);
		await sleep(50);
		const second = holdLock(`cus_lock_${randomUUID()}`);

		const [a, b] = await Promise.all([first, second]);
		expect(b.acquiredAt).toBeLessThan(a.releasedAt);
	});
});
