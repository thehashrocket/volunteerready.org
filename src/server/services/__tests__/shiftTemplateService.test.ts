/**
 * Service-level tests for shiftTemplateService.
 *
 * Domain validation is tested in shift-templates-waitlist.test.ts;
 * these tests verify Prisma wiring, audit logging, and org-isolation.
 */

const mocks = vi.hoisted(() => ({
	createTemplate: vi.fn(),
	updateTemplate: vi.fn(),
	deleteTemplate: vi.fn(),
	getTemplateById: vi.fn(),
	listTemplatesByOrg: vi.fn(),
	countTemplatesByOrg: vi.fn(),
	createShiftsFromTemplate: vi.fn(),
	writeAuditLogTx: vi.fn(),
	generateShiftDates: vi.fn(),
	validateTemplateTime: vi.fn(),
}));

vi.mock('@/server/repositories/shiftTemplateRepo', () => ({
	createTemplate: mocks.createTemplate,
	updateTemplate: mocks.updateTemplate,
	deleteTemplate: mocks.deleteTemplate,
	getTemplateById: mocks.getTemplateById,
	listTemplatesByOrg: mocks.listTemplatesByOrg,
	countTemplatesByOrg: mocks.countTemplatesByOrg,
	createShiftsFromTemplate: mocks.createShiftsFromTemplate,
}));

vi.mock('@/server/repositories/auditRepo', () => ({
	writeAuditLogTx: mocks.writeAuditLogTx,
}));

vi.mock('@/server/domain/shift', () => ({
	generateShiftDates: mocks.generateShiftDates,
	validateTemplateTime: mocks.validateTemplateTime,
}));

vi.mock('@/server/repositories/prisma', () => ({
	prisma: {
		$transaction: vi.fn(async (cb: (tx: unknown) => unknown) => cb({})),
	},
}));

import {
	createNewTemplate,
	generateShiftsFromTemplate,
	getOrgTemplateCount,
	getTemplate,
	listOrgTemplates,
	removeTemplate,
	updateExistingTemplate,
} from '../shiftTemplateService';

const ORG_ID = 'org-1';
const ACTOR_ID = 'user-1';
const TEMPLATE_ID = 'tmpl-1';

function makeTemplate(overrides: Record<string, unknown> = {}) {
	return {
		id: TEMPLATE_ID,
		orgId: ORG_ID,
		title: 'Morning Shift',
		description: null,
		dayOfWeek: 1,
		startHour: 9,
		startMinute: 0,
		endHour: 12,
		endMinute: 0,
		capacity: 5,
		location: 'Library',
		isRemote: false,
		opportunityId: null,
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

describe('listOrgTemplates', () => {
	it('delegates to repo', async () => {
		const templates = [makeTemplate()];
		mocks.listTemplatesByOrg.mockResolvedValue(templates);

		const result = await listOrgTemplates(ORG_ID);

		expect(result).toBe(templates);
		expect(mocks.listTemplatesByOrg).toHaveBeenCalledWith(ORG_ID);
	});
});

describe('getTemplate', () => {
	it('delegates to repo', async () => {
		const template = makeTemplate();
		mocks.getTemplateById.mockResolvedValue(template);

		const result = await getTemplate(TEMPLATE_ID);

		expect(result).toBe(template);
		expect(mocks.getTemplateById).toHaveBeenCalledWith(TEMPLATE_ID);
	});
});

describe('getOrgTemplateCount', () => {
	it('delegates to repo', async () => {
		mocks.countTemplatesByOrg.mockResolvedValue(3);

		const result = await getOrgTemplateCount(ORG_ID);

		expect(result).toBe(3);
	});
});

// ---------------------------------------------------------------------------
// createNewTemplate
// ---------------------------------------------------------------------------

describe('createNewTemplate', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.validateTemplateTime.mockReturnValue({ ok: true });
		mocks.createTemplate.mockResolvedValue(makeTemplate());
	});

	it('creates template and writes audit log', async () => {
		const input = {
			orgId: ORG_ID,
			title: 'Morning Shift',
			dayOfWeek: 1,
			startHour: 9,
			startMinute: 0,
			endHour: 12,
			endMinute: 0,
			capacity: 5,
		};

		const result = await createNewTemplate(input, ACTOR_ID);

		expect(result.id).toBe(TEMPLATE_ID);
		expect(mocks.createTemplate).toHaveBeenCalledWith(expect.anything(), input);
		expect(mocks.writeAuditLogTx).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				action: 'shiftTemplate.created',
				actorId: ACTOR_ID,
			}),
		);
	});

	it('throws when time validation fails', async () => {
		mocks.validateTemplateTime.mockReturnValue({
			ok: false,
			reason: 'End time must be after start time',
		});

		await expect(
			createNewTemplate(
				{
					orgId: ORG_ID,
					title: 'Bad',
					dayOfWeek: 1,
					startHour: 12,
					startMinute: 0,
					endHour: 9,
					endMinute: 0,
					capacity: 5,
				},
				ACTOR_ID,
			),
		).rejects.toThrow('End time must be after start time');

		expect(mocks.createTemplate).not.toHaveBeenCalled();
	});
});

// ---------------------------------------------------------------------------
// updateExistingTemplate
// ---------------------------------------------------------------------------

describe('updateExistingTemplate', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.validateTemplateTime.mockReturnValue({ ok: true });
		mocks.updateTemplate.mockResolvedValue(makeTemplate());
	});

	it('updates and writes audit log', async () => {
		const input = {
			id: TEMPLATE_ID,
			title: 'Afternoon Shift',
			startHour: 13,
			startMinute: 0,
			endHour: 17,
			endMinute: 0,
		};

		await updateExistingTemplate(input, ORG_ID, ACTOR_ID);

		expect(mocks.updateTemplate).toHaveBeenCalledWith(expect.anything(), input);
		expect(mocks.writeAuditLogTx).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ action: 'shiftTemplate.updated' }),
		);
	});

	it('skips time validation when time fields are partial', async () => {
		const input = { id: TEMPLATE_ID, title: 'New Title' };

		await updateExistingTemplate(input, ORG_ID, ACTOR_ID);

		expect(mocks.validateTemplateTime).not.toHaveBeenCalled();
	});
});

// ---------------------------------------------------------------------------
// removeTemplate
// ---------------------------------------------------------------------------

describe('removeTemplate', () => {
	it('deletes and writes audit log', async () => {
		vi.clearAllMocks();
		mocks.deleteTemplate.mockResolvedValue(undefined);

		await removeTemplate(TEMPLATE_ID, ORG_ID, ACTOR_ID);

		expect(mocks.deleteTemplate).toHaveBeenCalledWith(
			expect.anything(),
			TEMPLATE_ID,
		);
		expect(mocks.writeAuditLogTx).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ action: 'shiftTemplate.deleted' }),
		);
	});
});

// ---------------------------------------------------------------------------
// generateShiftsFromTemplate
// ---------------------------------------------------------------------------

describe('generateShiftsFromTemplate', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.getTemplateById.mockResolvedValue(makeTemplate());
		mocks.generateShiftDates.mockReturnValue([
			{
				startTime: new Date('2026-04-01T09:00:00Z'),
				endTime: new Date('2026-04-01T12:00:00Z'),
			},
		]);
		mocks.createShiftsFromTemplate.mockResolvedValue({ count: 1 });
	});

	it('generates shifts and writes audit log', async () => {
		const startDate = new Date('2026-03-30');

		const result = await generateShiftsFromTemplate(
			TEMPLATE_ID,
			1,
			startDate,
			ORG_ID,
			ACTOR_ID,
		);

		expect(result.count).toBe(1);
		expect(mocks.createShiftsFromTemplate).toHaveBeenCalled();
		expect(mocks.writeAuditLogTx).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				action: 'shiftTemplate.generated',
				metadata: expect.objectContaining({ shiftsCreated: 1 }),
			}),
		);
	});

	it('throws when template not found', async () => {
		mocks.getTemplateById.mockResolvedValue(null);

		await expect(
			generateShiftsFromTemplate(TEMPLATE_ID, 1, new Date(), ORG_ID, ACTOR_ID),
		).rejects.toThrow('Template not found');
	});

	it('throws when template belongs to different org', async () => {
		mocks.getTemplateById.mockResolvedValue(
			makeTemplate({ orgId: 'other-org' }),
		);

		await expect(
			generateShiftsFromTemplate(TEMPLATE_ID, 1, new Date(), ORG_ID, ACTOR_ID),
		).rejects.toThrow('Template not found');
	});
});
