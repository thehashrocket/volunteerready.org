import { TRPCError } from '@trpc/server';
import { writeAuditLogTx } from '@/server/repositories/auditRepo';
import {
	getOrgDetail,
	listOrgApplications,
	listOrgMembers,
	listOrgOpportunities,
	listOrgsPage,
	setOrgSuspendedTx,
} from '@/server/repositories/platformOrgRepo';
import { prisma } from '@/server/repositories/prisma';

const ORG_SUSPEND_ACTION = 'ORG_SUSPENDED';
const ORG_UNSUSPEND_ACTION = 'ORG_UNSUSPENDED';
const ORG_ENTITY = 'Organization';

export async function listOrgs(input: {
	search?: string;
	cursor?: string | null;
	limit?: number;
}) {
	return listOrgsPage(input);
}

export async function getOrg(id: string) {
	const org = await getOrgDetail(id);
	if (!org) {
		throw new TRPCError({
			code: 'NOT_FOUND',
			message: 'Organization not found.',
		});
	}

	const [members, opportunities, applications] = await Promise.all([
		listOrgMembers(id),
		listOrgOpportunities(id),
		listOrgApplications(id),
	]);

	return { org, members, opportunities, applications };
}

export async function suspendOrg(args: {
	id: string;
	reason: string;
	actorId: string;
}) {
	return prisma.$transaction(async (tx) => {
		const current = await tx.organization.findUnique({
			where: { id: args.id },
			select: { id: true, suspendedAt: true },
		});
		if (!current) {
			throw new TRPCError({
				code: 'NOT_FOUND',
				message: 'Organization not found.',
			});
		}
		if (current.suspendedAt) {
			throw new TRPCError({
				code: 'BAD_REQUEST',
				message: 'Organization is already suspended.',
			});
		}

		const updated = await setOrgSuspendedTx(tx, {
			id: args.id,
			suspendedAt: new Date(),
			suspendedReason: args.reason,
			suspendedById: args.actorId,
		});

		await writeAuditLogTx(tx, {
			actorId: args.actorId,
			orgId: args.id,
			action: ORG_SUSPEND_ACTION,
			entityType: ORG_ENTITY,
			entityId: args.id,
			metadata: { reason: args.reason, slug: updated.slug },
		});

		return updated;
	});
}

export async function unsuspendOrg(args: {
	id: string;
	reason: string;
	actorId: string;
}) {
	return prisma.$transaction(async (tx) => {
		const current = await tx.organization.findUnique({
			where: { id: args.id },
			select: { id: true, suspendedAt: true, suspendedReason: true },
		});
		if (!current) {
			throw new TRPCError({
				code: 'NOT_FOUND',
				message: 'Organization not found.',
			});
		}
		if (!current.suspendedAt) {
			throw new TRPCError({
				code: 'BAD_REQUEST',
				message: 'Organization is not suspended.',
			});
		}

		const updated = await setOrgSuspendedTx(tx, {
			id: args.id,
			suspendedAt: null,
			suspendedReason: null,
			suspendedById: null,
		});

		await writeAuditLogTx(tx, {
			actorId: args.actorId,
			orgId: args.id,
			action: ORG_UNSUSPEND_ACTION,
			entityType: ORG_ENTITY,
			entityId: args.id,
			metadata: {
				reason: args.reason,
				priorSuspendedReason: current.suspendedReason,
				priorSuspendedAt: current.suspendedAt.toISOString(),
				slug: updated.slug,
			},
		});

		return updated;
	});
}
