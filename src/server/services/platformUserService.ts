import { TRPCError } from '@trpc/server';
import { writeAuditLogTx } from '@/server/repositories/auditRepo';
import {
	countSubmittedApplications,
	deleteUserSessionsTx,
	getUserDetail,
	listSubmittedApplications,
	listUsersPage,
	updateUserPlatformAdminTx,
} from '@/server/repositories/platformUserRepo';
import { prisma } from '@/server/repositories/prisma';

export async function listUsers(input: {
	search?: string;
	cursor?: string | null;
	limit?: number;
}) {
	return listUsersPage(input);
}

export async function getUser(id: string) {
	const user = await getUserDetail(id);
	if (!user) {
		throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found.' });
	}
	const [applicationCount, applications] = await Promise.all([
		countSubmittedApplications(id),
		listSubmittedApplications(id),
	]);
	return { ...user, applicationCount, applications };
}

export async function setPlatformAdmin(input: {
	id: string;
	value: boolean;
	reason: string;
	actorId: string;
}) {
	if (!input.reason || input.reason.trim().length < 5) {
		throw new TRPCError({
			code: 'BAD_REQUEST',
			message: 'Reason is required.',
		});
	}

	if (input.actorId === input.id && !input.value) {
		throw new TRPCError({
			code: 'BAD_REQUEST',
			message: 'Platform admins cannot revoke their own admin status.',
		});
	}

	const target = await prisma.user.findUnique({
		where: { id: input.id },
		select: { id: true, isPlatformAdmin: true, email: true },
	});
	if (!target) {
		throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found.' });
	}

	if (target.isPlatformAdmin === input.value) {
		return { ok: true as const, noChange: true };
	}

	return prisma.$transaction(async (tx) => {
		const updated = await updateUserPlatformAdminTx(tx, input.id, input.value);
		await writeAuditLogTx(tx, {
			actorId: input.actorId,
			action: input.value ? 'PLATFORM_ADMIN_GRANTED' : 'PLATFORM_ADMIN_REVOKED',
			entityType: 'User',
			entityId: updated.id,
			metadata: {
				reason: input.reason,
				targetEmail: updated.email,
				previousValue: target.isPlatformAdmin,
				newValue: input.value,
				selfAction: input.actorId === input.id,
			},
		});
		return {
			ok: true as const,
			noChange: false,
			value: updated.isPlatformAdmin,
		};
	});
}

export async function revokeAllSessions(input: {
	id: string;
	reason: string;
	actorId: string;
}) {
	if (!input.reason || input.reason.trim().length < 5) {
		throw new TRPCError({
			code: 'BAD_REQUEST',
			message: 'Reason is required.',
		});
	}

	const target = await prisma.user.findUnique({
		where: { id: input.id },
		select: { id: true, email: true },
	});
	if (!target) {
		throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found.' });
	}

	return prisma.$transaction(async (tx) => {
		const result = await deleteUserSessionsTx(tx, input.id);
		await writeAuditLogTx(tx, {
			actorId: input.actorId,
			action: 'SESSIONS_REVOKED',
			entityType: 'User',
			entityId: input.id,
			metadata: {
				reason: input.reason,
				targetEmail: target.email,
				deletedCount: result.count,
			},
		});
		return { ok: true as const, count: result.count };
	});
}
