import type { PrismaClient } from '@/prisma/generated/client';
import { prisma } from './prisma';

type TxClient = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

/** Get all skill names for a user. */
export async function getSkillsForUser(userId: string): Promise<string[]> {
	const rows = await prisma.volunteerSkill.findMany({
		where: { userId },
		select: { skill: true },
		orderBy: { skill: 'asc' },
	});
	return rows.map((r) => r.skill);
}

/**
 * Replace a user's skill list with the desired set (diff-and-upsert).
 * Must be called inside a transaction so the caller can bundle audit logging.
 */
export async function setSkillsForUser(
	tx: TxClient,
	userId: string,
	skills: string[],
): Promise<void> {
	const existing = await tx.volunteerSkill.findMany({
		where: { userId },
		select: { id: true, skill: true },
	});

	const existingSet = new Set(existing.map((s) => s.skill.toLowerCase()));
	const desiredSet = new Set(skills.map((s) => s.trim().toLowerCase()));

	// Normalize desired skills (preserve original casing of first occurrence)
	const normalizedSkills = new Map<string, string>();
	for (const s of skills) {
		const key = s.trim().toLowerCase();
		if (!normalizedSkills.has(key)) {
			normalizedSkills.set(key, s.trim());
		}
	}

	// Delete removed skills
	const toDelete = existing.filter(
		(s) => !desiredSet.has(s.skill.toLowerCase()),
	);
	if (toDelete.length > 0) {
		await tx.volunteerSkill.deleteMany({
			where: { id: { in: toDelete.map((s) => s.id) } },
		});
	}

	// Create new skills
	const toCreate = [...normalizedSkills.entries()].filter(
		([key]) => !existingSet.has(key),
	);
	if (toCreate.length > 0) {
		await tx.volunteerSkill.createMany({
			data: toCreate.map(([, skill]) => ({ userId, skill })),
		});
	}
}
