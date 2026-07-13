import { z } from 'zod';

// ---------------------------------------------------------------------------
// Org profile (name + public apply slug) — shared client/server validation
// ---------------------------------------------------------------------------

/**
 * Slugs that collide with live /apply/* routes or reserved platform surfaces.
 * An org named "status" would shadow /apply/status (email status lookup);
 * "refer" would shadow /apply/refer (referral landing page). The rest are
 * defensive: plausible future routes we never want an org to squat on.
 */
export const RESERVED_ORG_SLUGS: ReadonlySet<string> = new Set([
	'status',
	'refer',
	'admin',
	'api',
	'app',
	'apply',
	'new',
]);

export const ORG_SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const orgSlugSchema = z
	.string()
	.min(3, 'Slug must be at least 3 characters')
	.max(60, 'Slug must be at most 60 characters')
	.regex(
		ORG_SLUG_PATTERN,
		'Use lowercase letters, numbers, and single hyphens (no leading/trailing hyphen)',
	)
	.refine((slug) => !RESERVED_ORG_SLUGS.has(slug), {
		message: 'This name is reserved',
	});

export const orgProfileUpdateSchema = z.object({
	name: z.string().trim().min(2, 'Name is too short').max(120),
	slug: orgSlugSchema,
});

export type OrgProfileUpdateInput = z.infer<typeof orgProfileUpdateSchema>;

/**
 * Normalize free typing toward a valid slug: lowercase, spaces → hyphens,
 * strip anything else. Unlike generateSlug() this preserves a trailing
 * hyphen mid-keystroke so the user can keep typing "my-" without the
 * hyphen vanishing; final validation still runs orgSlugSchema.
 */
export function normalizeSlugInput(raw: string): string {
	return raw
		.toLowerCase()
		.replace(/\s+/g, '-')
		.replace(/[^a-z0-9-]/g, '')
		.replace(/-{2,}/g, '-');
}
