import { z } from 'zod';
import { getLocation, getLocationSlugs } from '@/lib/locations';

export const VERTICAL_SLUGS = ['vertical-animal-shelters'] as const;

const VERTICAL_LABEL_MAP: Record<string, string> = {
	'vertical-animal-shelters': 'Animal Shelters',
};

/** Combines geo location slugs + vertical slugs for lead form validation. */
export function getValidLeadSlugs(): string[] {
	return [...getLocationSlugs(), ...VERTICAL_SLUGS];
}

/**
 * Resolves a lead source slug to a human-readable label.
 * Checks geo locations first, then vertical map, then falls back to raw slug.
 */
export function getLeadSourceLabel(slug: string): string {
	const location = getLocation(slug);
	if (location) return location.name;
	if (slug in VERTICAL_LABEL_MAP) return VERTICAL_LABEL_MAP[slug];
	return slug;
}

export const leadCaptureSchema = z.object({
	locationSlug: z
		.string()
		.min(1)
		.max(64)
		.refine((s) => getValidLeadSlugs().includes(s), 'Unknown location'),
	orgName: z.string().min(1, 'Organization name is required').max(200),
	contactEmail: z.string().email('Please enter a valid email').max(254),
	volunteerCount: z.string().max(50).optional(),
	currentProcess: z
		.enum(['Spreadsheets', 'Email', 'No system', 'Other'])
		.optional(),
	painPoints: z.string().max(2000).optional(),
	utmSource: z.string().max(200).optional(),
	utmCampaign: z.string().max(200).optional(),
	utmContent: z.string().max(200).optional(),
	/** Honeypot field — must be empty for legitimate submissions */
	org_phone: z.string().optional(),
});

export type LeadCaptureInput = z.infer<typeof leadCaptureSchema>;
