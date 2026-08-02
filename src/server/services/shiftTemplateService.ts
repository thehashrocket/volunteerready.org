import { TRPCError } from '@trpc/server';
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
import {
	requireOrgOpportunity,
	requireOrgTemplate,
} from '@/server/services/shiftAccessService';

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
	// SECURITY: foreign `opportunityId`, same as `createNewShift`. Templates leak
	// it through `listTemplatesByOrg`, which includes the opportunity relation,
	// and every shift the template later generates inherits the same bad link.
	if (input.opportunityId) {
		await requireOrgOpportunity(input.opportunityId, input.orgId);
	}

	const timeCheck = validateTemplateTime(input);
	if (!timeCheck.ok) {
		// See shiftService: hand-authored validation copy needs an allowlisted
		// code or it is redacted as an internal fault.
		throw new TRPCError({ code: 'BAD_REQUEST', message: timeCheck.reason });
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

/**
 * SECURITY: `orgId` reached this function only to stamp the audit row, while
 * `updateTemplate` writes on `where: { id }` alone — so staff at org A could
 * rewrite org B's recurring schedule (title, capacity, day, time, opportunity)
 * and have the change filed under org A. Same omission in `removeTemplate`.
 * Identical to the `updateExistingShift` hole; see shiftAccessService.ts.
 */
export async function updateExistingTemplate(
	input: UpdateTemplateInput,
	orgId: string,
	actorId: string,
) {
	await requireOrgTemplate(input.id, orgId);

	// SECURITY: `updateShiftTemplateSchema` is `createShiftTemplateSchema.partial()`,
	// so it carries `opportunityId` — this path was exploitable in exactly the
	// same way as create, on a template the caller does legitimately own.
	if (input.opportunityId) {
		await requireOrgOpportunity(input.opportunityId, orgId);
	}

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
			throw new TRPCError({
				code: 'BAD_REQUEST',
				message: timeCheck.reason,
			});
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
	// SECURITY: unscoped `delete` destroyed another org's recurring schedule.
	await requireOrgTemplate(id, orgId);

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
	// This callsite always had the check, inline — but as a bare `Error`, which
	// surfaces as INTERNAL_SERVER_ERROR rather than the NOT_FOUND its siblings
	// now return. Routed through the shared guard so all three speak one language.
	const template = await requireOrgTemplate(templateId, orgId);

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
