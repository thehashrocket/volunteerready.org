import { prisma } from '@/server/repositories/prisma';

export async function listSkillFamilies() {
	return prisma.skillFamily.findMany({
		orderBy: { name: 'asc' },
		include: {
			skills: {
				orderBy: { name: 'asc' },
			},
		},
	});
}

export async function getSkillById(id: string) {
	return prisma.skill.findUnique({
		where: { id },
		include: { family: true },
	});
}

export async function getSkillFamilyById(id: string) {
	return prisma.skillFamily.findUnique({
		where: { id },
		include: { skills: { orderBy: { name: 'asc' } } },
	});
}
