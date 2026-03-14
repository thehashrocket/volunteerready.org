import type {
	CompanyMemberRole,
	PrismaClient,
} from '@/prisma/generated/client';
import { prisma } from './prisma';

type TxClient = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

export async function createCompanyInvitationTx(
	tx: TxClient,
	{
		companyId,
		email,
		role,
		tokenHash,
		expiresAt,
	}: {
		companyId: string;
		email: string;
		role: CompanyMemberRole;
		tokenHash: string;
		expiresAt: Date;
	},
) {
	return tx.companyInvitation.create({
		data: { companyId, email, role, tokenHash, expiresAt },
		select: { id: true },
	});
}

export async function findCompanyInvitationByTokenHash(tokenHash: string) {
	return prisma.companyInvitation.findUnique({
		where: { tokenHash },
		select: {
			id: true,
			companyId: true,
			email: true,
			role: true,
			expiresAt: true,
			usedAt: true,
			company: { select: { id: true, name: true } },
		},
	});
}

export async function markCompanyInvitationUsedTx(tx: TxClient, id: string) {
	return tx.companyInvitation.update({
		where: { id },
		data: { usedAt: new Date() },
		select: { id: true },
	});
}
