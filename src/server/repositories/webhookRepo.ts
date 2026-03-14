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
