import type { PrismaClient } from '@/prisma/generated/client';
import { prisma } from './prisma';

type TxClient = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function getTemplateById(id: string) {
	return prisma.shiftTemplate.findUnique({ where: { id } });
}

export async function listTemplatesByOrg(orgId: string) {
	return prisma.shiftTemplate.findMany({
		where: { orgId },
		include: {
			opportunity: { select: { id: true, title: true } },
			_count: { select: { shifts: true } },
		},
		orderBy: [{ dayOfWeek: 'asc' }, { startHour: 'asc' }],
	});
}

export async function countTemplatesByOrg(orgId: string) {
	return prisma.shiftTemplate.count({ where: { orgId } });
}

// ---------------------------------------------------------------------------
// Writes (transactional)
// ---------------------------------------------------------------------------

export type CreateTemplateInput = {
	orgId: string;
	title: string;
	description?: string | null;
	location?: string | null;
	isRemote?: boolean;
	dayOfWeek: number;
	startHour: number;
	startMinute: number;
	endHour: number;
	endMinute: number;
	capacity: number;
	opportunityId?: string | null;
};

export async function createTemplate(tx: TxClient, input: CreateTemplateInput) {
	return tx.shiftTemplate.create({
		data: {
			orgId: input.orgId,
			title: input.title,
			description: input.description ?? null,
			location: input.location ?? null,
			isRemote: input.isRemote ?? false,
			dayOfWeek: input.dayOfWeek,
			startHour: input.startHour,
			startMinute: input.startMinute,
			endHour: input.endHour,
			endMinute: input.endMinute,
			capacity: input.capacity,
			opportunityId: input.opportunityId ?? null,
		},
	});
}

export type UpdateTemplateInput = {
	id: string;
	title?: string;
	description?: string | null;
	location?: string | null;
	isRemote?: boolean;
	dayOfWeek?: number;
	startHour?: number;
	startMinute?: number;
	endHour?: number;
	endMinute?: number;
	capacity?: number;
	opportunityId?: string | null;
};

export async function updateTemplate(tx: TxClient, input: UpdateTemplateInput) {
	const { id, ...data } = input;
	return tx.shiftTemplate.update({ where: { id }, data });
}

export async function deleteTemplate(tx: TxClient, id: string) {
	return tx.shiftTemplate.delete({ where: { id } });
}

export async function createShiftsFromTemplate(
	tx: TxClient,
	orgId: string,
	templateId: string,
	shifts: Array<{
		title: string;
		description?: string | null;
		location?: string | null;
		isRemote: boolean;
		startTime: Date;
		endTime: Date;
		capacity: number;
		opportunityId?: string | null;
	}>,
) {
	return tx.shift.createMany({
		data: shifts.map((s) => ({
			orgId,
			templateId,
			title: s.title,
			description: s.description ?? null,
			location: s.location ?? null,
			isRemote: s.isRemote,
			startTime: s.startTime,
			endTime: s.endTime,
			capacity: s.capacity,
			opportunityId: s.opportunityId ?? null,
		})),
	});
}
