/**
 * SECURITY tests for the foreign-`opportunityId` hole.
 *
 * The org↔shift guards scope the row a caller REACHES. This one scopes a
 * foreign id the caller PLANTS on a row they legitimately own, which the
 * id-based guards structurally cannot catch: `listShiftsByOrg`,
 * `getShiftWithSignups`, `listUpcomingShiftsForOrg` and `listTemplatesByOrg`
 * all `include: { opportunity: { select: { id, title } } }`, so staff at org A
 * could point their own shift or template at org B's opportunity and read B's
 * title straight back out of a list correctly scoped to A.
 *
 * Four write paths carried it: shift create, shift update (the field is new —
 * previously set-once at create), template create, and template update (whose
 * schema is `createShiftTemplateSchema.partial()`, so it has always carried
 * `opportunityId`).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	requireOrgOpportunity: vi.fn(),
	requireOrgShift: vi.fn(),
	requireOrgTemplate: vi.fn(),
	createShift: vi.fn(),
	updateShift: vi.fn(),
	createTemplate: vi.fn(),
	updateTemplate: vi.fn(),
	writeAuditLogTx: vi.fn(),
}));

vi.mock('@/server/services/shiftAccessService', () => ({
	requireOrgOpportunity: mocks.requireOrgOpportunity,
	requireOrgShift: mocks.requireOrgShift,
	requireOrgTemplate: mocks.requireOrgTemplate,
	isOrgShift: vi.fn(),
}));

vi.mock('@/server/repositories/shiftRepo', () => ({
	createShift: mocks.createShift,
	updateShift: mocks.updateShift,
	deleteShift: vi.fn(),
	getShiftById: vi.fn(),
	getShiftWithSignups: vi.fn(),
	listShiftsByOpportunity: vi.fn(),
	listShiftsByOrg: vi.fn(),
	listUpcomingShiftsForOrg: vi.fn(),
}));

vi.mock('@/server/repositories/shiftTemplateRepo', () => ({
	createTemplate: mocks.createTemplate,
	updateTemplate: mocks.updateTemplate,
	deleteTemplate: vi.fn(),
	getTemplateById: vi.fn(),
	listTemplatesByOrg: vi.fn(),
	countTemplatesByOrg: vi.fn(),
	createShiftsFromTemplate: vi.fn(),
}));

vi.mock('@/server/repositories/auditRepo', () => ({
	writeAuditLogTx: mocks.writeAuditLogTx,
}));

vi.mock('@/server/repositories/prisma', () => ({
	prisma: {
		$transaction: vi.fn(async (cb: (tx: unknown) => unknown) => cb({})),
	},
}));

vi.mock('@/server/services/notificationService', () => ({
	tryNotify: vi.fn(),
}));
vi.mock('@/server/lib/email', () => ({ sendEmail: vi.fn() }));

import { TRPCError } from '@trpc/server';
import { createNewShift, updateExistingShift } from '../shiftService';
import {
	createNewTemplate,
	updateExistingTemplate,
} from '../shiftTemplateService';

const ORG_ID = 'org-owner';
const FOREIGN_OPPORTUNITY_ID = 'opp-belongs-to-someone-else';
const ACTOR_ID = 'user-actor';

const NOT_FOUND = new TRPCError({
	code: 'NOT_FOUND',
	message: 'Opportunity not found.',
});

const shiftInput = {
	orgId: ORG_ID,
	title: 'Morning Shift',
	startTime: new Date('2026-09-01T09:00:00Z'),
	endTime: new Date('2026-09-01T12:00:00Z'),
	capacity: 5,
};

const templateInput = {
	orgId: ORG_ID,
	title: 'Weekly Shift',
	dayOfWeek: 1,
	startHour: 9,
	startMinute: 0,
	endHour: 12,
	endMinute: 0,
	capacity: 5,
};

beforeEach(() => {
	vi.clearAllMocks();
	mocks.requireOrgOpportunity.mockResolvedValue({ id: 'opp-1' });
	mocks.requireOrgShift.mockResolvedValue({ id: 'shift-1', orgId: ORG_ID });
	mocks.requireOrgTemplate.mockResolvedValue({ id: 'tpl-1', orgId: ORG_ID });
	mocks.createShift.mockResolvedValue({ id: 'shift-1' });
	mocks.updateShift.mockResolvedValue({ id: 'shift-1' });
	mocks.createTemplate.mockResolvedValue({ id: 'tpl-1' });
	mocks.updateTemplate.mockResolvedValue({ id: 'tpl-1' });
});

describe('createNewShift', () => {
	it('SECURITY: refuses an opportunityId owned by another org', async () => {
		mocks.requireOrgOpportunity.mockRejectedValue(NOT_FOUND);

		await expect(
			createNewShift(
				{ ...shiftInput, opportunityId: FOREIGN_OPPORTUNITY_ID },
				ACTOR_ID,
			),
		).rejects.toMatchObject({ code: 'NOT_FOUND' });

		expect(mocks.createShift).not.toHaveBeenCalled();
		expect(mocks.writeAuditLogTx).not.toHaveBeenCalled();
	});

	it('SECURITY: checks the opportunity against the SERVER-resolved orgId', async () => {
		await createNewShift({ ...shiftInput, opportunityId: 'opp-1' }, ACTOR_ID);

		expect(mocks.requireOrgOpportunity).toHaveBeenCalledWith('opp-1', ORG_ID);
	});

	it('skips the guard entirely when no opportunity is linked', async () => {
		await createNewShift(shiftInput, ACTOR_ID);

		expect(mocks.requireOrgOpportunity).not.toHaveBeenCalled();
		expect(mocks.createShift).toHaveBeenCalled();
	});
});

describe('updateExistingShift', () => {
	it('SECURITY: refuses to relink a shift to another org’s opportunity', async () => {
		mocks.requireOrgOpportunity.mockRejectedValue(NOT_FOUND);

		await expect(
			updateExistingShift(
				{ id: 'shift-1', opportunityId: FOREIGN_OPPORTUNITY_ID },
				ORG_ID,
				ACTOR_ID,
			),
		).rejects.toMatchObject({ code: 'NOT_FOUND' });

		expect(mocks.updateShift).not.toHaveBeenCalled();
	});

	it('allows clearing the link without an org check', async () => {
		// null means "unlink", which cannot leak anything.
		await updateExistingShift(
			{ id: 'shift-1', opportunityId: null },
			ORG_ID,
			ACTOR_ID,
		);

		expect(mocks.requireOrgOpportunity).not.toHaveBeenCalled();
		expect(mocks.updateShift).toHaveBeenCalled();
	});
});

describe('createNewTemplate', () => {
	it('SECURITY: refuses an opportunityId owned by another org', async () => {
		mocks.requireOrgOpportunity.mockRejectedValue(NOT_FOUND);

		await expect(
			createNewTemplate(
				{ ...templateInput, opportunityId: FOREIGN_OPPORTUNITY_ID },
				ACTOR_ID,
			),
		).rejects.toMatchObject({ code: 'NOT_FOUND' });

		expect(mocks.createTemplate).not.toHaveBeenCalled();
	});
});

describe('updateExistingTemplate', () => {
	it('SECURITY: refuses a foreign opportunityId on a template the caller DOES own', async () => {
		// The distinguishing case: requireOrgTemplate passes (the template really
		// is theirs) and the leak rides in on the opportunity link instead.
		mocks.requireOrgOpportunity.mockRejectedValue(NOT_FOUND);

		await expect(
			updateExistingTemplate(
				{ id: 'tpl-1', opportunityId: FOREIGN_OPPORTUNITY_ID },
				ORG_ID,
				ACTOR_ID,
			),
		).rejects.toMatchObject({ code: 'NOT_FOUND' });

		expect(mocks.requireOrgTemplate).toHaveBeenCalledWith('tpl-1', ORG_ID);
		expect(mocks.updateTemplate).not.toHaveBeenCalled();
	});
});
