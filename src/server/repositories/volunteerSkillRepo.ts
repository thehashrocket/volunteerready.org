import type { PrismaClient } from '@/prisma/generated/client';
import { prisma } from './prisma';

type TxClient = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

/** Get all skills for a user, with name and family context. */
export async function getSkillsForUser(userId: string) {
	return prisma.volunteerSkill.findMany({
		where: { userId },
		select: {
			skillId: true,
			skill: {
				select: {
					id: true,
					name: true,
					family: { select: { id: true, name: true } },
				},
			},
		},
		orderBy: { skill: { name: 'asc' } },
	});
}

/**
 * Replace a user's skill list with the desired set (diff-and-upsert).
 * Must be called inside a transaction so the caller can bundle audit logging.
 */
export async function setSkillsForUser(
	tx: TxClient,
	userId: string,
	skillIds: string[],
): Promise<void> {
	const existing = await tx.volunteerSkill.findMany({
		where: { userId },
		select: { id: true, skillId: true },
	});

	const existingSet = new Set(existing.map((s) => s.skillId));
	const desiredSet = new Set(skillIds);

	// Delete removed skills
	const toDelete = existing.filter((s) => !desiredSet.has(s.skillId));
	if (toDelete.length > 0) {
		await tx.volunteerSkill.deleteMany({
			where: { id: { in: toDelete.map((s) => s.id) } },
		});
	}

	// Create new skills
	const toCreate = skillIds.filter((id) => !existingSet.has(id));
	if (toCreate.length > 0) {
		await tx.volunteerSkill.createMany({
			data: toCreate.map((skillId) => ({ userId, skillId })),
		});
	}
}
