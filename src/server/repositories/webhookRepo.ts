import type { Prisma, PrismaClient } from '@/prisma/generated/client';
import { prisma } from './prisma';

type TxClient = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

/**
 * Optimization read outside transaction. The real idempotency safety net is
 * the UNIQUE constraint on StripeWebhookEvent.stripeId — if two concurrent
 * webhooks for the same event race, the second hits P2002 and the transaction
 * rolls back. The webhook route returns 200 for P2002 (already processed).
 */
export async function isWebhookEventProcessed(
	stripeId: string,
): Promise<boolean> {
	const event = await prisma.stripeWebhookEvent.findUnique({
		where: { stripeId },
		select: { id: true },
	});
	return event !== null;
}

export async function markWebhookEventProcessedTx(
	tx: TxClient,
	{
		stripeId,
		type,
		payload,
	}: { stripeId: string; type: string; payload: Prisma.InputJsonValue },
) {
	return tx.stripeWebhookEvent.create({
		data: { stripeId, type, payload },
		select: { id: true },
	});
}

/**
 * Namespace half of the billing lock key: `hashtext('stripe_customer_billing')`,
 * frozen as a literal. See `INVITE_RATE_LIMIT_LOCK_NAMESPACE` in
 * volunteerInvitationRepo.ts for why advisory locks here are namespaced.
 *
 * Reproduce with:
 *   SELECT hashtext('stripe_customer_billing');  -- -341053475
 */
const STRIPE_CUSTOMER_LOCK_NAMESPACE = -341_053_475;

/**
 * Serialize plan updates for one Stripe customer. Stripe can deliver two
 * subscription events for a customer at once; each lists the customer's
 * subscriptions and writes the tier, so without this an older list can commit
 * after a newer one and leave a cancelled customer on a paid plan. Take it
 * before listing, inside the transaction that writes.
 *
 * One static template with bound parameters, NOT composed from `Prisma.sql`
 * fragments, per the raw-SQL rule in CLAUDE.md.
 */
export function lockStripeCustomerTx(tx: TxClient, stripeCustomerId: string) {
	return tx.$executeRaw`SELECT pg_advisory_xact_lock(${STRIPE_CUSTOMER_LOCK_NAMESPACE}, hashtext(${stripeCustomerId}))`;
}
