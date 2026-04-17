import { z } from 'zod';

const slugSchema = z
	.string()
	.min(1)
	.max(80)
	.regex(
		/^[a-z0-9]+(?:-[a-z0-9]+)*$/,
		'Slug must be lowercase kebab-case (letters, numbers, hyphens).',
	);

const nameSchema = z.string().trim().min(1).max(120);
const keySchema = z.string().trim().min(1).max(80);
const promptSchema = z.string().trim().min(1).max(500);

export const createSkillFamilyInput = z.object({
	name: nameSchema,
	slug: slugSchema,
	order: z.number().int().min(0).max(10_000).optional(),
});

export const updateSkillFamilyInput = z.object({
	id: z.string().cuid(),
	name: nameSchema.optional(),
	slug: slugSchema.optional(),
	order: z.number().int().min(0).max(10_000).optional(),
	isActive: z.boolean().optional(),
});

export const idInput = z.object({ id: z.string().cuid() });

export const createSkillInput = z.object({
	familyId: z.string().cuid(),
	name: nameSchema,
	slug: slugSchema,
	order: z.number().int().min(0).max(10_000).optional(),
});

export const updateSkillInput = z.object({
	id: z.string().cuid(),
	name: nameSchema.optional(),
	slug: slugSchema.optional(),
	familyId: z.string().cuid().optional(),
	order: z.number().int().min(0).max(10_000).optional(),
	isActive: z.boolean().optional(),
});

export const screenerQuestionTypeSchema = z.enum([
	'TEXT',
	'SINGLE_CHOICE',
	'MULTI_CHOICE',
	'BOOLEAN',
	'NUMBER',
]);

export const configJsonSchema = z
	.record(z.string(), z.unknown())
	.refine((val) => val !== null, { message: 'configJson must be an object' });

export const createDefaultQuestionInput = z.object({
	key: keySchema,
	prompt: promptSchema,
	type: screenerQuestionTypeSchema,
	order: z.number().int().min(0).max(10_000).optional(),
	configJson: configJsonSchema,
});

export const updateDefaultQuestionInput = z.object({
	id: z.string().cuid(),
	prompt: promptSchema.optional(),
	type: screenerQuestionTypeSchema.optional(),
	order: z.number().int().min(0).max(10_000).optional(),
	configJson: configJsonSchema.optional(),
	isActive: z.boolean().optional(),
});

export type CreateSkillFamilyInput = z.infer<typeof createSkillFamilyInput>;
export type UpdateSkillFamilyInput = z.infer<typeof updateSkillFamilyInput>;
export type CreateSkillInput = z.infer<typeof createSkillInput>;
export type UpdateSkillInput = z.infer<typeof updateSkillInput>;
export type CreateDefaultQuestionInput = z.infer<
	typeof createDefaultQuestionInput
>;
export type UpdateDefaultQuestionInput = z.infer<
	typeof updateDefaultQuestionInput
>;
