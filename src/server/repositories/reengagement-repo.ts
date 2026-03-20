import { prisma } from '@/server/repositories/prisma';

export interface InactiveMember {
	id: string;
	userId: string;
	organizationId: string;
	lastActivityAt: Date | null;
	lastReengagementSegment: string | null;
	user: { email: string | null; name: string | null };
	organization: { name: string };
}

const SEGMENT_ORDER: Record<string, number> = {
	'30d': 1,
	'60d': 2,
	'90d': 3,
};

/**
 * Find org members inactive for at least `inactiveBefore` who haven't
 * received the given segment yet. Excludes OWNER/ADMIN roles (staff).
 * Respects NotificationPreference email opt-out for REENGAGEMENT.
 */
export async function findInactiveMembers(opts: {
	inactiveBefore: Date;
	segment: '30d' | '60d' | '90d';
	cursor?: string | null;
	limit?: number;
}): Promise<InactiveMember[]> {
	const { inactiveBefore, segment, cursor, limit = 100 } = opts;
	const segmentNum = SEGMENT_ORDER[segment];

	// Build the segment filter: null or lower segment than current
	const previousSegments = Object.entries(SEGMENT_ORDER)
		.filter(([, num]) => num < segmentNum)
		.map(([key]) => key);

	const segmentFilter =
		previousSegments.length > 0
			? [
					{ lastReengagementSegment: null },
					{ lastReengagementSegment: { in: previousSegments } },
				]
			: [{ lastReengagementSegment: null }];

	return prisma.organizationMember.findMany({
		where: {
			role: { notIn: ['OWNER', 'ADMIN'] },
			OR: [
				{ lastActivityAt: null },
				{ lastActivityAt: { lt: inactiveBefore } },
			],
			AND: [{ OR: segmentFilter }],
			user: {
				email: { not: null },
				// Exclude users who opted out of REENGAGEMENT emails
				notificationPreferences: {
					none: {
						type: 'REENGAGEMENT',
						email: false,
					},
				},
			},
		},
		include: {
			user: { select: { email: true, name: true } },
			organization: { select: { name: true } },
		},
		orderBy: { id: 'asc' },
		...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
		take: limit,
	});
}

/**
 * Mark a re-engagement segment as sent for a member.
 */
export async function markReengagementSent(
	memberId: string,
	segment: string,
): Promise<void> {
	await prisma.organizationMember.update({
		where: { id: memberId },
		data: { lastReengagementSegment: segment },
	});
}

/**
 * Update lastActivityAt on an OrganizationMember and reset the
 * re-engagement segment so the cycle can restart.
 */
export async function touchMemberActivity(memberId: string): Promise<void> {
	await prisma.organizationMember.update({
		where: { id: memberId },
		data: {
			lastActivityAt: new Date(),
			lastReengagementSegment: null,
		},
	});
}

/**
 * Look up the OrganizationMember for a (userId, orgId) pair.
 * Returns the member id or null if not found.
 */
export async function findMemberByUserAndOrg(
	userId: string,
	orgId: string,
): Promise<string | null> {
	const member = await prisma.organizationMember.findUnique({
		where: {
			organizationId_userId: { organizationId: orgId, userId },
		},
		select: { id: true },
	});
	return member?.id ?? null;
}
