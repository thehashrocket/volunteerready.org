/**
 * Unit tests for platformCatalogService.
 *
 * Repo + audit are mocked — tests verify conflict detection, audit log
 * action mapping (UPDATED vs DEACTIVATED vs REACTIVATED), and that every
 * mutation path writes an audit log entry.
 */

import { TRPCError } from '@trpc/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoist mocks
// ---------------------------------------------------------------------------

const mockRepo = vi.hoisted(() => ({
	createFamilyTx: vi.fn(),
	createSkillTx: vi.fn(),
	createTemplateQuestionTx: vi.fn(),
	getFamilyById: vi.fn(),
	getFamilyByName: vi.fn(),
	getFamilyBySlug: vi.fn(),
	getSkillById: vi.fn(),
	getSkillByName: vi.fn(),
	getSkillBySlug: vi.fn(),
	getTemplateQuestionById: vi.fn(),
	getTemplateQuestionByKey: vi.fn(),
	listFamilies: vi.fn(),
	listSkills: vi.fn(),
	listTemplateQuestions: vi.fn(),
	updateFamilyTx: vi.fn(),
	updateSkillTx: vi.fn(),
	updateTemplateQuestionTx: vi.fn(),
}));

const mockAudit = vi.hoisted(() => ({
	writeAuditLogTx: vi.fn(),
}));

const mockPrisma = vi.hoisted(() => ({
	$transaction: vi.fn(async (cb: (tx: unknown) => unknown) => cb({})),
	organization: {
		findUnique: vi.fn(),
	},
}));

vi.mock('@/server/repositories/platformCatalogRepo', () => mockRepo);
vi.mock('@/server/repositories/auditRepo', () => mockAudit);
vi.mock('@/server/repositories/prisma', () => ({ prisma: mockPrisma }));

import {
	createDefaultQuestion,
	createSkill,
	createSkillFamily,
	updateDefaultQuestion,
	updateSkill,
	updateSkillFamily,
} from './platformCatalogService';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
	vi.clearAllMocks();
	mockPrisma.$transaction.mockImplementation(async (cb) => cb({}));
	mockPrisma.organization.findUnique.mockResolvedValue({ id: 'platform-org' });
});

// ---------------------------------------------------------------------------
// Skill families
// ---------------------------------------------------------------------------

describe('createSkillFamily', () => {
	it('throws CONFLICT when slug already exists', async () => {
		mockRepo.getFamilyBySlug.mockResolvedValue({
			id: 'f1',
			slug: 'leadership',
		});

		await expect(
			createSkillFamily({
				name: 'Leadership',
				slug: 'leadership',
				actorId: 'u1',
			}),
		).rejects.toThrow(TRPCError);

		expect(mockRepo.createFamilyTx).not.toHaveBeenCalled();
		expect(mockAudit.writeAuditLogTx).not.toHaveBeenCalled();
	});

	it('throws CONFLICT when name already exists', async () => {
		mockRepo.getFamilyBySlug.mockResolvedValue(null);
		mockRepo.getFamilyByName.mockResolvedValue({
			id: 'f1',
			name: 'Leadership',
		});

		await expect(
			createSkillFamily({
				name: 'Leadership',
				slug: 'leadership-new',
				actorId: 'u1',
			}),
		).rejects.toThrow(TRPCError);

		expect(mockRepo.createFamilyTx).not.toHaveBeenCalled();
		expect(mockAudit.writeAuditLogTx).not.toHaveBeenCalled();
	});

	it('creates family and writes SKILL_FAMILY_CREATED audit', async () => {
		mockRepo.getFamilyBySlug.mockResolvedValue(null);
		mockRepo.getFamilyByName.mockResolvedValue(null);
		mockRepo.createFamilyTx.mockResolvedValue({
			id: 'f1',
			name: 'Leadership',
			slug: 'leadership',
			order: 0,
			isActive: true,
		});

		await createSkillFamily({
			name: 'Leadership',
			slug: 'leadership',
			actorId: 'u1',
		});

		expect(mockRepo.createFamilyTx).toHaveBeenCalledTimes(1);
		expect(mockAudit.writeAuditLogTx).toHaveBeenCalledWith(expect.anything(), {
			actorId: 'u1',
			action: 'SKILL_FAMILY_CREATED',
			entityType: 'SkillFamily',
			entityId: 'f1',
			metadata: expect.objectContaining({ slug: 'leadership' }),
		});
	});
});

describe('updateSkillFamily', () => {
	it('throws NOT_FOUND when id missing', async () => {
		mockRepo.getFamilyById.mockResolvedValue(null);

		await expect(
			updateSkillFamily({ id: 'missing', actorId: 'u1' }),
		).rejects.toThrow(TRPCError);
	});

	it('maps isActive=false to SKILL_FAMILY_DEACTIVATED', async () => {
		mockRepo.getFamilyById.mockResolvedValue({
			id: 'f1',
			name: 'Leadership',
			slug: 'leadership',
			order: 0,
			isActive: true,
		});
		mockRepo.updateFamilyTx.mockResolvedValue({
			id: 'f1',
			name: 'Leadership',
			slug: 'leadership',
			order: 0,
			isActive: false,
		});

		await updateSkillFamily({ id: 'f1', isActive: false, actorId: 'u1' });

		expect(mockAudit.writeAuditLogTx).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ action: 'SKILL_FAMILY_DEACTIVATED' }),
		);
	});

	it('maps isActive=true (was false) to SKILL_FAMILY_REACTIVATED', async () => {
		mockRepo.getFamilyById.mockResolvedValue({
			id: 'f1',
			name: 'Leadership',
			slug: 'leadership',
			order: 0,
			isActive: false,
		});
		mockRepo.updateFamilyTx.mockResolvedValue({
			id: 'f1',
			name: 'Leadership',
			slug: 'leadership',
			order: 0,
			isActive: true,
		});

		await updateSkillFamily({ id: 'f1', isActive: true, actorId: 'u1' });

		expect(mockAudit.writeAuditLogTx).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ action: 'SKILL_FAMILY_REACTIVATED' }),
		);
	});

	it('maps plain rename to SKILL_FAMILY_UPDATED', async () => {
		mockRepo.getFamilyById.mockResolvedValue({
			id: 'f1',
			name: 'Leadership',
			slug: 'leadership',
			order: 0,
			isActive: true,
		});
		mockRepo.getFamilyByName.mockResolvedValue(null);
		mockRepo.updateFamilyTx.mockResolvedValue({
			id: 'f1',
			name: 'Leadership 2',
			slug: 'leadership',
			order: 0,
			isActive: true,
		});

		await updateSkillFamily({ id: 'f1', name: 'Leadership 2', actorId: 'u1' });

		expect(mockAudit.writeAuditLogTx).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ action: 'SKILL_FAMILY_UPDATED' }),
		);
	});

	it('throws CONFLICT when renaming name to one taken by another family', async () => {
		mockRepo.getFamilyById.mockResolvedValue({
			id: 'f1',
			name: 'Leadership',
			slug: 'leadership',
			order: 0,
			isActive: true,
		});
		mockRepo.getFamilyByName.mockResolvedValue({
			id: 'f2',
			name: 'Operations',
		});

		await expect(
			updateSkillFamily({ id: 'f1', name: 'Operations', actorId: 'u1' }),
		).rejects.toThrow(TRPCError);

		expect(mockRepo.updateFamilyTx).not.toHaveBeenCalled();
	});

	it('throws CONFLICT when renaming slug to one taken by another family', async () => {
		mockRepo.getFamilyById.mockResolvedValue({
			id: 'f1',
			name: 'Leadership',
			slug: 'leadership',
			order: 0,
			isActive: true,
		});
		mockRepo.getFamilyBySlug.mockResolvedValue({ id: 'f2', slug: 'other' });

		await expect(
			updateSkillFamily({ id: 'f1', slug: 'other', actorId: 'u1' }),
		).rejects.toThrow(TRPCError);

		expect(mockRepo.updateFamilyTx).not.toHaveBeenCalled();
	});
});

// ---------------------------------------------------------------------------
// Skills
// ---------------------------------------------------------------------------

describe('createSkill', () => {
	it('throws NOT_FOUND when family missing', async () => {
		mockRepo.getFamilyById.mockResolvedValue(null);

		await expect(
			createSkill({
				familyId: 'missing',
				name: 'Thing',
				slug: 'thing',
				actorId: 'u1',
			}),
		).rejects.toThrow(TRPCError);
	});

	it('throws CONFLICT when slug taken', async () => {
		mockRepo.getFamilyById.mockResolvedValue({ id: 'f1', slug: 'leadership' });
		mockRepo.getSkillBySlug.mockResolvedValue({ id: 's1' });

		await expect(
			createSkill({
				familyId: 'f1',
				name: 'Thing',
				slug: 'thing',
				actorId: 'u1',
			}),
		).rejects.toThrow(TRPCError);
	});

	it('throws CONFLICT when name taken', async () => {
		mockRepo.getFamilyById.mockResolvedValue({ id: 'f1', slug: 'leadership' });
		mockRepo.getSkillBySlug.mockResolvedValue(null);
		mockRepo.getSkillByName.mockResolvedValue({ id: 's1', name: 'Thing' });

		await expect(
			createSkill({
				familyId: 'f1',
				name: 'Thing',
				slug: 'thing',
				actorId: 'u1',
			}),
		).rejects.toThrow(TRPCError);

		expect(mockRepo.createSkillTx).not.toHaveBeenCalled();
	});

	it('creates skill and writes SKILL_CREATED audit', async () => {
		mockRepo.getFamilyById.mockResolvedValue({ id: 'f1', slug: 'leadership' });
		mockRepo.getSkillBySlug.mockResolvedValue(null);
		mockRepo.getSkillByName.mockResolvedValue(null);
		mockRepo.createSkillTx.mockResolvedValue({
			id: 's1',
			name: 'Thing',
			slug: 'thing',
			familyId: 'f1',
			order: 0,
			isActive: true,
		});

		await createSkill({
			familyId: 'f1',
			name: 'Thing',
			slug: 'thing',
			actorId: 'u1',
		});

		expect(mockAudit.writeAuditLogTx).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ action: 'SKILL_CREATED', entityId: 's1' }),
		);
	});
});

describe('updateSkill', () => {
	it('maps isActive=false to SKILL_DEACTIVATED', async () => {
		mockRepo.getSkillById.mockResolvedValue({
			id: 's1',
			name: 'Thing',
			slug: 'thing',
			familyId: 'f1',
			order: 0,
			isActive: true,
		});
		mockRepo.updateSkillTx.mockResolvedValue({
			id: 's1',
			name: 'Thing',
			slug: 'thing',
			familyId: 'f1',
			order: 0,
			isActive: false,
		});

		await updateSkill({ id: 's1', isActive: false, actorId: 'u1' });

		expect(mockAudit.writeAuditLogTx).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ action: 'SKILL_DEACTIVATED' }),
		);
	});

	it('throws NOT_FOUND when new familyId missing', async () => {
		mockRepo.getSkillById.mockResolvedValue({
			id: 's1',
			name: 'Thing',
			slug: 'thing',
			familyId: 'f1',
			order: 0,
			isActive: true,
		});
		mockRepo.getFamilyById.mockResolvedValue(null);

		await expect(
			updateSkill({ id: 's1', familyId: 'missing', actorId: 'u1' }),
		).rejects.toThrow(TRPCError);
	});
});

// ---------------------------------------------------------------------------
// Default screener questions
// ---------------------------------------------------------------------------

describe('createDefaultQuestion', () => {
	it('throws CONFLICT when key taken', async () => {
		mockRepo.getTemplateQuestionByKey.mockResolvedValue({ id: 'q1' });

		await expect(
			createDefaultQuestion({
				key: 'age-18-plus',
				prompt: 'Are you 18+?',
				type: 'BOOLEAN',
				order: 0,
				configJson: { required: true },
				actorId: 'u1',
			}),
		).rejects.toThrow(TRPCError);

		expect(mockRepo.createTemplateQuestionTx).not.toHaveBeenCalled();
	});

	it('throws when platform org missing', async () => {
		mockRepo.getTemplateQuestionByKey.mockResolvedValue(null);
		mockPrisma.organization.findUnique.mockResolvedValue(null);

		await expect(
			createDefaultQuestion({
				key: 'age-18-plus',
				prompt: 'Are you 18+?',
				type: 'BOOLEAN',
				order: 0,
				configJson: { required: true },
				actorId: 'u1',
			}),
		).rejects.toThrow(TRPCError);
	});

	it('creates template question and writes DEFAULT_QUESTION_CREATED audit', async () => {
		mockRepo.getTemplateQuestionByKey.mockResolvedValue(null);
		mockRepo.createTemplateQuestionTx.mockResolvedValue({
			id: 'q1',
			key: 'age-18-plus',
			prompt: 'Are you 18+?',
			type: 'BOOLEAN',
			order: 0,
			isActive: true,
			isTemplate: true,
		});

		await createDefaultQuestion({
			key: 'age-18-plus',
			prompt: 'Are you 18+?',
			type: 'BOOLEAN',
			order: 0,
			configJson: { required: true },
			actorId: 'u1',
		});

		expect(mockRepo.createTemplateQuestionTx).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				orgId: 'platform-org',
				key: 'age-18-plus',
			}),
		);
		expect(mockAudit.writeAuditLogTx).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				action: 'DEFAULT_QUESTION_CREATED',
				entityType: 'ScreenerQuestionTemplate',
			}),
		);
	});
});

describe('updateDefaultQuestion', () => {
	it('throws NOT_FOUND when id missing', async () => {
		mockRepo.getTemplateQuestionById.mockResolvedValue(null);

		await expect(
			updateDefaultQuestion({ id: 'missing', actorId: 'u1' }),
		).rejects.toThrow(TRPCError);
	});

	it('maps isActive=false to DEFAULT_QUESTION_DEACTIVATED', async () => {
		mockRepo.getTemplateQuestionById.mockResolvedValue({
			id: 'q1',
			key: 'age-18-plus',
			prompt: 'Are you 18+?',
			type: 'BOOLEAN',
			order: 0,
			isActive: true,
			configJson: {},
		});
		mockRepo.updateTemplateQuestionTx.mockResolvedValue({
			id: 'q1',
			key: 'age-18-plus',
			prompt: 'Are you 18+?',
			type: 'BOOLEAN',
			order: 0,
			isActive: false,
			configJson: {},
		});

		await updateDefaultQuestion({ id: 'q1', isActive: false, actorId: 'u1' });

		expect(mockAudit.writeAuditLogTx).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ action: 'DEFAULT_QUESTION_DEACTIVATED' }),
		);
	});

	it('maps prompt change to DEFAULT_QUESTION_UPDATED', async () => {
		mockRepo.getTemplateQuestionById.mockResolvedValue({
			id: 'q1',
			key: 'age-18-plus',
			prompt: 'Are you 18+?',
			type: 'BOOLEAN',
			order: 0,
			isActive: true,
			configJson: {},
		});
		mockRepo.updateTemplateQuestionTx.mockResolvedValue({
			id: 'q1',
			key: 'age-18-plus',
			prompt: 'Are you at least 18?',
			type: 'BOOLEAN',
			order: 0,
			isActive: true,
			configJson: {},
		});

		await updateDefaultQuestion({
			id: 'q1',
			prompt: 'Are you at least 18?',
			actorId: 'u1',
		});

		expect(mockAudit.writeAuditLogTx).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ action: 'DEFAULT_QUESTION_UPDATED' }),
		);
	});
});
