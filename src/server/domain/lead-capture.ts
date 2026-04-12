import { z } from 'zod';
import { getLocationSlugs } from '@/lib/locations';

const validSlugs = getLocationSlugs();

export const leadCaptureSchema = z.object({
	locationSlug: z
		.string()
		.min(1)
		.max(64)
		.refine((s) => validSlugs.includes(s), 'Unknown location'),
	orgName: z.string().min(1, 'Organization name is required').max(200),
	contactEmail: z.string().email('Please enter a valid email').max(254),
	volunteerCount: z.string().max(50).optional(),
	currentProcess: z
		.enum(['Spreadsheets', 'Email', 'No system', 'Other'])
		.optional(),
	painPoints: z.string().max(2000).optional(),
	/** Honeypot field — must be empty for legitimate submissions */
	org_phone: z.string().optional(),
});

export type LeadCaptureInput = z.infer<typeof leadCaptureSchema>;
