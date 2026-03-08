import type { Prisma, PrismaClient } from '@/prisma/generated/client';
import { prisma } from './prisma';

export type AuditLogInput = {
	orgId: string;
	actorId?: string | null;
	action: string;
	entityType: string;
	entityId?: string | null;
	// biome-ignore lint/suspicious/noExplicitAny: metadata is intentionally untyped JSON
	metadata?: any;
};

/**
 * Transactional client type – works with both prisma and prisma.$transaction(tx => …)
 */
type TxClient = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

function buildAuditCreate(input: AuditLogInput) {
	return {
		data: {
			orgId: input.orgId,
			actorId: input.actorId ?? null,
			action: input.action,
			entityType: input.entityType,
			entityId: input.entityId ?? null,
			metadata: input.metadata as Prisma.InputJsonValue,
		},
		select: { id: true },
	} as const;
}

/**
 * Write an audit log entry using the global prisma client.
 * Prefer `writeAuditLogTx` inside an existing transaction.
 */
export async function writeAuditLog(input: AuditLogInput) {
	return prisma.auditLog.create(buildAuditCreate(input));
}

/**
 * Write an audit log entry within an existing Prisma interactive transaction.
 * This guarantees the audit row is committed atomically with the rest of the
 * transaction — no silent fire-and-forget failures.
 */
export async function writeAuditLogTx(tx: TxClient, input: AuditLogInput) {
	return tx.auditLog.create(buildAuditCreate(input));
}
