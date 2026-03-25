import { z } from 'zod';
import type { FeedbackMood, FeedbackStatus } from '@/prisma/generated/client';

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

export const feedbackSubmitSchema = z.object({
	mood: z.enum(['HAPPY', 'NEUTRAL', 'FRUSTRATED', 'BUG', 'IDEA']),
	message: z.string().trim().min(1).max(2000),
	pageUrl: z.string().max(2000),
	userAgent: z.string().max(500).optional(),
});

export const feedbackFilterSchema = z.object({
	status: z.enum(['NEW', 'IN_PROGRESS', 'RESOLVED', 'DISMISSED']).optional(),
	mood: z.enum(['HAPPY', 'NEUTRAL', 'FRUSTRATED', 'BUG', 'IDEA']).optional(),
	orgId: z.string().optional(),
	page: z.number().int().positive().optional(),
	pageSize: z.number().int().positive().max(100).optional(),
});

export type FeedbackSubmitInput = z.infer<typeof feedbackSubmitSchema>;
export type FeedbackFilterInput = z.infer<typeof feedbackFilterSchema>;

// ---------------------------------------------------------------------------
// Mood → Category mapping (for stats grouping, NOT stored)
// ---------------------------------------------------------------------------

export const MOOD_CATEGORY_MAP: Record<FeedbackMood, string> = {
	HAPPY: 'praise',
	NEUTRAL: 'feedback',
	FRUSTRATED: 'bug',
	BUG: 'bug',
	IDEA: 'suggestion',
};

// ---------------------------------------------------------------------------
// Route name resolution
// ---------------------------------------------------------------------------

const ROUTE_NAME_MAP: Record<string, string> = {
	'/app': 'Dashboard',
	'/app/shifts': 'Shift Management',
	'/app/opportunities': 'Opportunities',
	'/app/screener': 'Screener Questions',
	'/app/applications': 'Applications',
	'/app/settings': 'Settings',
	'/app/settings/team': 'Team Settings',
	'/app/settings/onboarding': 'Onboarding Settings',
	'/app/my-applications': 'My Applications',
	'/app/my-shifts': 'My Shifts',
	'/app/my-skills': 'My Skills',
	'/app/my-feedback': 'My Feedback',
	'/app/profile': 'Profile',
	'/app/browse': 'Browse Opportunities',
	'/app/scan': 'QR Check-in Scanner',
	'/app/impact-report': 'Impact Report',
	'/app/admin/feedback': 'Feedback Admin',
	'/app/admin/health': 'Platform Health',
	'/app/admin/case-studies': 'Case Studies Admin',
	'/app/admin/onboarding': 'Onboarding Analytics',
};

/**
 * Resolve a URL path to a human-readable page name.
 * Strips dynamic segments and falls back to title-cased path.
 */
export function resolvePageName(url: string): string {
	try {
		// Handle full URLs or paths
		const pathname = url.startsWith('http')
			? new URL(url).pathname
			: url.split('?')[0];

		// Direct match
		if (ROUTE_NAME_MAP[pathname]) {
			return ROUTE_NAME_MAP[pathname];
		}

		// Strip trailing dynamic segments (e.g., /app/opportunities/abc123 → /app/opportunities)
		const segments = pathname.split('/').filter(Boolean);
		for (let i = segments.length; i > 0; i--) {
			const partial = `/${segments.slice(0, i).join('/')}`;
			if (ROUTE_NAME_MAP[partial]) {
				return ROUTE_NAME_MAP[partial];
			}
		}

		// Fallback: title-case the last segment
		const lastSegment = segments[segments.length - 1] ?? '';
		return (
			lastSegment
				.replace(/[-_]/g, ' ')
				.replace(/\b\w/g, (c) => c.toUpperCase()) || 'Unknown page'
		);
	} catch {
		return 'Unknown page';
	}
}

// ---------------------------------------------------------------------------
// Volunteer-facing status labels
// ---------------------------------------------------------------------------

export const VOLUNTEER_STATUS_LABELS: Record<
	FeedbackStatus,
	{ label: string; variant: 'info' | 'warning' | 'success' | 'neutral' }
> = {
	NEW: { label: 'Received', variant: 'info' },
	IN_PROGRESS: { label: 'Being reviewed', variant: 'warning' },
	RESOLVED: { label: 'We took action', variant: 'success' },
	DISMISSED: { label: 'Noted', variant: 'neutral' },
};
