import { Role } from '@/prisma/generated/client';
import { prisma } from '@/server/repositories/prisma';

export async function createInvitation(input: {
	orgId: string;
	email: string;
	role: Role;
	tokenHash: string;
	expiresAt: Date;
}) {
	return prisma.organizationInvitation.create({
		data: input,
		select: { id: true },
	});
}

export async function findValidInvitationByHash(tokenHash: string) {
	return prisma.organizationInvitation.findFirst({
		where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } },
		select: { id: true, orgId: true, email: true, role: true },
	});
}

export async function findInvitationByHash(tokenHash: string) {
	return prisma.organizationInvitation.findFirst({
		where: { tokenHash },
		select: {
			id: true,
			orgId: true,
			email: true,
			role: true,
			expiresAt: true,
			usedAt: true,
			organization: { select: { name: true, slug: true } },
		},
	});
}

export async function markInvitationUsed(id: string) {
	return prisma.organizationInvitation.update({
		where: { id },
		data: { usedAt: new Date() },
		select: { id: true },
	});
}
