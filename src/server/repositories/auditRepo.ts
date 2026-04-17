import { Prisma, type PrismaClient } from '@/prisma/generated/client';
import { prisma } from './prisma';

export type AuditQueryFilters = {
	actorId?: string | null;
	entityType?: string | null;
	entityId?: string | null;
	action?: string | null;
	orgId?: string | null;
	dateFrom?: Date | null;
	dateTo?: Date | null;
	impersonatedOnly?: boolean;
};

export type AuditLogInput = {
	orgId?: string | null;
	companyId?: string | null;
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
			orgId: input.orgId ?? null,
			companyId: input.companyId ?? null,
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

const AUDIT_QUERY_LIMIT_DEFAULT = 50;
const AUDIT_QUERY_LIMIT_MAX = 200;

export async function queryAuditLog(
	filters: AuditQueryFilters,
	pagination: { cursor?: string | null; limit?: number },
) {
	const take = Math.min(
		pagination.limit ?? AUDIT_QUERY_LIMIT_DEFAULT,
		AUDIT_QUERY_LIMIT_MAX,
	);

	const where: Prisma.AuditLogWhereInput = {};
	if (filters.actorId) where.actorId = filters.actorId;
	if (filters.entityType) where.entityType = filters.entityType;
	if (filters.entityId) where.entityId = filters.entityId;
	if (filters.action) where.action = filters.action;
	if (filters.orgId) where.orgId = filters.orgId;
	if (filters.dateFrom || filters.dateTo) {
		where.createdAt = {};
		if (filters.dateFrom) where.createdAt.gte = filters.dateFrom;
		if (filters.dateTo) where.createdAt.lte = filters.dateTo;
	}
	if (filters.impersonatedOnly) {
		// Rows where metadata.impersonatedBy is set
		where.metadata = {
			path: ['impersonatedBy'],
			not: Prisma.JsonNull,
		} as Prisma.JsonFilter;
	}

	const rows = await prisma.auditLog.findMany({
		where,
		take: take + 1,
		cursor: pagination.cursor ? { id: pagination.cursor } : undefined,
		skip: pagination.cursor ? 1 : 0,
		orderBy: { createdAt: 'desc' },
		select: {
			id: true,
			actorId: true,
			orgId: true,
			companyId: true,
			action: true,
			entityType: true,
			entityId: true,
			metadata: true,
			createdAt: true,
			actor: { select: { id: true, email: true, name: true } },
			organization: { select: { id: true, slug: true, name: true } },
		},
	});

	const hasMore = rows.length > take;
	const sliced = hasMore ? rows.slice(0, take) : rows;
	const nextCursor = hasMore ? sliced[sliced.length - 1].id : null;

	return { rows: sliced, nextCursor };
}

export async function listDistinctActions(limit = 200) {
	const rows = await prisma.auditLog.findMany({
		distinct: ['action'],
		select: { action: true },
		orderBy: { action: 'asc' },
		take: limit,
	});
	return rows.map((r) => r.action);
}

export async function listDistinctEntityTypes(limit = 200) {
	const rows = await prisma.auditLog.findMany({
		distinct: ['entityType'],
		select: { entityType: true },
		orderBy: { entityType: 'asc' },
		take: limit,
	});
	return rows.map((r) => r.entityType);
}
