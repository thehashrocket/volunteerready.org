import {
	generateShiftDates,
	validateTemplateTime,
} from '@/server/domain/shift';
import { writeAuditLogTx } from '@/server/repositories/auditRepo';
import { prisma } from '@/server/repositories/prisma';
import {
	type CreateTemplateInput,
	countTemplatesByOrg,
	createShiftsFromTemplate,
	createTemplate,
	deleteTemplate,
	getTemplateById,
	listTemplatesByOrg,
	type UpdateTemplateInput,
	updateTemplate,
} from '@/server/repositories/shiftTemplateRepo';

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function listOrgTemplates(orgId: string) {
	return listTemplatesByOrg(orgId);
}

export async function getTemplate(id: string) {
	return getTemplateById(id);
}

export async function getOrgTemplateCount(orgId: string) {
	return countTemplatesByOrg(orgId);
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export async function createNewTemplate(
	input: CreateTemplateInput,
	actorId: string,
) {
	const timeCheck = validateTemplateTime(input);
	if (!timeCheck.ok) {
		throw new Error(timeCheck.reason);
	}

	return prisma.$transaction(async (tx) => {
		const template = await createTemplate(tx, input);
		await writeAuditLogTx(tx, {
			orgId: input.orgId,
			actorId,
			action: 'shiftTemplate.created',
			entityType: 'ShiftTemplate',
			entityId: template.id,
			metadata: { title: input.title, dayOfWeek: input.dayOfWeek },
		});
		return template;
	});
}

export async function updateExistingTemplate(
	input: UpdateTemplateInput,
	orgId: string,
	actorId: string,
) {
	if (
		input.startHour !== undefined &&
		input.startMinute !== undefined &&
		input.endHour !== undefined &&
		input.endMinute !== undefined
	) {
		const timeCheck = validateTemplateTime({
			startHour: input.startHour,
			startMinute: input.startMinute,
			endHour: input.endHour,
			endMinute: input.endMinute,
		});
		if (!timeCheck.ok) {
			throw new Error(timeCheck.reason);
		}
	}

	return prisma.$transaction(async (tx) => {
		const template = await updateTemplate(tx, input);
		await writeAuditLogTx(tx, {
			orgId,
			actorId,
			action: 'shiftTemplate.updated',
			entityType: 'ShiftTemplate',
			entityId: template.id,
			metadata: input,
		});
		return template;
	});
}

export async function removeTemplate(
	id: string,
	orgId: string,
	actorId: string,
) {
	return prisma.$transaction(async (tx) => {
		await deleteTemplate(tx, id);
		await writeAuditLogTx(tx, {
			orgId,
			actorId,
			action: 'shiftTemplate.deleted',
			entityType: 'ShiftTemplate',
			entityId: id,
		});
	});
}

export async function generateShiftsFromTemplate(
	templateId: string,
	weeks: number,
	startDate: Date,
	orgId: string,
	actorId: string,
) {
	const template = await getTemplateById(templateId);
	if (!template) throw new Error('Template not found.');
	if (template.orgId !== orgId) throw new Error('Template not found.');

	const dates = generateShiftDates(template, weeks, startDate);

	return prisma.$transaction(async (tx) => {
		const result = await createShiftsFromTemplate(
			tx,
			orgId,
			templateId,
			dates.map((d) => ({
				title: template.title,
				description: template.description,
				location: template.location,
				isRemote: template.isRemote,
				startTime: d.startTime,
				endTime: d.endTime,
				capacity: template.capacity,
				opportunityId: template.opportunityId,
			})),
		);

		await writeAuditLogTx(tx, {
			orgId,
			actorId,
			action: 'shiftTemplate.generated',
			entityType: 'ShiftTemplate',
			entityId: templateId,
			metadata: {
				weeks,
				shiftsCreated: result.count,
				startDate: startDate.toISOString(),
			},
		});

		return result;
	});
}
