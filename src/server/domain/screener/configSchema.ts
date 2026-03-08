import { z } from 'zod';

// ---------------------------------------------------------------------------
// Rule schemas — shared between disqualifier and review rules
// ---------------------------------------------------------------------------

const ruleOperator = z.enum(['equals', 'includes', 'lt', 'lte', 'gt', 'gte']);

const ruleSchema = z.object({
	operator: ruleOperator,
	value: z.unknown().refine((v) => v !== undefined, {
		message: 'Rule value is required',
	}),
});

export type ParsedRule = z.infer<typeof ruleSchema>;

// ---------------------------------------------------------------------------
// Rules container — lives under configJson.rules
// ---------------------------------------------------------------------------

const rulesSchema = z.object({
	disqualifierRule: ruleSchema.optional(),
	reviewIf: ruleSchema.optional(),
	reason: z.string().optional(),
});

export type ParsedRules = z.infer<typeof rulesSchema>;

// ---------------------------------------------------------------------------
// Top-level configJson schema
// ---------------------------------------------------------------------------

export const screenerQuestionConfigSchema = z.object({
	required: z.boolean().optional(),
	maxLength: z.number().int().positive().optional(),
	options: z.array(z.string().min(1)).optional(),
	rules: rulesSchema.optional().nullable(),
});

export type ScreenerQuestionConfig = z.infer<
	typeof screenerQuestionConfigSchema
>;

// ---------------------------------------------------------------------------
// Parse helper — returns a typed config or throws with a clear message
// ---------------------------------------------------------------------------

/**
 * Parse raw configJson (from the database) into a typed config.
 * Throws a ZodError if the data is malformed.
 */
export function parseConfigJson(raw: unknown): ScreenerQuestionConfig {
	if (raw === null || raw === undefined) {
		return {};
	}
	return screenerQuestionConfigSchema.parse(raw);
}

/**
 * Safe variant — returns success/error discriminated union.
 */
export function safeParseConfigJson(raw: unknown) {
	if (raw === null || raw === undefined) {
		return { success: true as const, data: {} as ScreenerQuestionConfig };
	}
	return screenerQuestionConfigSchema.safeParse(raw);
}
