/**
 * backgroundCheckRepo.ts — Prisma access for BackgroundCheckRequest and
 * CheckrWebhookEvent models.
 *
 * Follows webhookRepo.ts + volunteerCredentialRepo.ts patterns exactly.
 * All writes accept a TxClient so callers can compose atomic transactions.
 */

import type {
	BackgroundCheckProvider,
	BackgroundCheckStatus,
	FcraStatus,
	Prisma,
	PrismaClient,
} from '@/prisma/generated/client';
import { prisma } from './prisma';

type TxClient = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/** Find a single BackgroundCheckRequest by ID with user email (for FCRA emails). */
export async function findBackgroundCheckById(id: string) {
	return prisma.backgroundCheckRequest.findUnique({
		where: { id },
		select: {
			id: true,
			orgId: true,
			userId: true,
			status: true,
			fcraStatus: true,
			preAdverseNoticeSentAt: true,
			provider: true,
			credentialId: true,
			user: { select: { id: true, name: true, email: true } },
		},
	});
}

/** Find a single BackgroundCheckRequest by Checkr report ID (externalId). */
export async function findBackgroundCheckByExternalId(externalId: string) {
	return prisma.backgroundCheckRequest.findUnique({
		where: { externalId },
		select: {
			id: true,
			orgId: true,
			userId: true,
			status: true,
			provider: true,
			credentialId: true,
		},
	});
}

/** List all background check requests for an org. Default: 50 most recent. */
export async function listBackgroundChecksByOrg(
	orgId: string,
	opts: { take?: number } = {},
) {
	const take = opts.take ?? 50;
	return prisma.backgroundCheckRequest.findMany({
		where: { orgId },
		orderBy: { createdAt: 'desc' },
		take,
		select: {
			id: true,
			status: true,
			provider: true,
			fcraStatus: true,
			preAdverseNoticeSentAt: true,
			createdAt: true,
			updatedAt: true,
			user: { select: { id: true, name: true, email: true } },
		},
	});
}

/** List background check requests for a specific user within an org. */
export async function listBackgroundChecksByUser(
	userId: string,
	orgId: string,
) {
	return prisma.backgroundCheckRequest.findMany({
		where: { userId, orgId },
		orderBy: { createdAt: 'desc' },
	});
}

/**
 * Find an active (non-terminal) background check for a user in an org.
 * "Active" = PENDING or CONSIDER only.
 * Used to prevent duplicate in-flight checks.
 */
export async function findActiveCheckForUserInOrg(
	userId: string,
	orgId: string,
) {
	return prisma.backgroundCheckRequest.findFirst({
		where: {
			userId,
			orgId,
			status: { in: ['PENDING', 'CONSIDER'] },
		},
		select: { id: true, status: true },
	});
}

// ---------------------------------------------------------------------------
// Webhook idempotency — mirrors webhookRepo.ts exactly
// ---------------------------------------------------------------------------

/**
 * Optimization read outside of transaction.
 * The real idempotency safety net is the UNIQUE constraint on
 * CheckrWebhookEvent.checkrId — if two concurrent webhooks for the same event
 * race, the second hits P2002 and the transaction rolls back.
 */
export async function isCheckrWebhookEventProcessed(
	checkrId: string,
): Promise<boolean> {
	const event = await prisma.checkrWebhookEvent.findUnique({
		where: { checkrId },
		select: { id: true },
	});
	return event !== null;
}

// ---------------------------------------------------------------------------
// Writes (all take TxClient)
// ---------------------------------------------------------------------------

export interface CreateBackgroundCheckInput {
	orgId: string;
	userId: string;
	externalId: string;
	packageName: string;
	provider?: BackgroundCheckProvider;
}

/** Create a new BackgroundCheckRequest. Status defaults to PENDING, provider to CHECKR. */
export async function createBackgroundCheckRequestTx(
	tx: TxClient,
	input: CreateBackgroundCheckInput,
) {
	return tx.backgroundCheckRequest.create({
		data: {
			orgId: input.orgId,
			userId: input.userId,
			externalId: input.externalId,
			provider: input.provider ?? 'CHECKR',
			status: 'PENDING',
		},
		select: { id: true, externalId: true },
	});
}

export interface UpdateBackgroundCheckInput {
	status?: BackgroundCheckStatus;
	webhookPayload?: Prisma.InputJsonValue;
	credentialId?: string;
	fcraStatus?: FcraStatus;
	preAdverseNoticeSentAt?: Date;
	adverseActionAt?: Date;
}

/** Update status, webhookPayload, and/or credentialId on a request. */
export async function updateBackgroundCheckRequestTx(
	tx: TxClient,
	id: string,
	data: UpdateBackgroundCheckInput,
) {
	return tx.backgroundCheckRequest.update({
		where: { id },
		data,
		select: { id: true, status: true },
	});
}

/** Record a processed Checkr webhook event (idempotency guard). */
export async function markCheckrWebhookEventProcessedTx(
	tx: TxClient,
	{
		checkrId,
		type,
		payload,
	}: { checkrId: string; type: string; payload: Prisma.InputJsonValue },
) {
	return tx.checkrWebhookEvent.create({
		data: { checkrId, type, payload },
		select: { id: true },
	});
}
