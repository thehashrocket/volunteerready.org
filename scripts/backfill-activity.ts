/**
 * Backfill OrganizationMember.lastActivityAt from existing activity records.
 *
 * For each member, finds the most recent ShiftSignup.createdAt or
 * VolunteerApplication.submittedAt (whichever is newer). Falls back to
 * OrganizationMember.createdAt if no activity records exist.
 *
 * Usage: pnpm backfill:activity
 */
import { PrismaClient } from '../src/prisma/generated/client';

const prisma = new PrismaClient();
const BATCH_SIZE = 500;

async function main() {
	let cursor: string | undefined;
	let totalUpdated = 0;

	console.log('[backfill] Starting lastActivityAt backfill...');

	// eslint-disable-next-line no-constant-condition
	while (true) {
		const members = await prisma.organizationMember.findMany({
			where: { lastActivityAt: null },
			select: {
				id: true,
				userId: true,
				organizationId: true,
				createdAt: true,
			},
			orderBy: { id: 'asc' },
			take: BATCH_SIZE,
			...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
		});

		if (members.length === 0) break;

		for (const member of members) {
			// Find most recent shift signup
			const latestSignup = await prisma.shiftSignup.findFirst({
				where: { userId: member.userId },
				orderBy: { createdAt: 'desc' },
				select: { createdAt: true },
			});

			// Find most recent application submission
			const latestApp = await prisma.volunteerApplication.findFirst({
				where: {
					submittedByUserId: member.userId,
					orgId: member.organizationId,
				},
				orderBy: { submittedAt: 'desc' },
				select: { submittedAt: true },
			});

			// Pick the most recent date, falling back to member creation
			const dates = [
				latestSignup?.createdAt,
				latestApp?.submittedAt,
			].filter(Boolean) as Date[];

			const lastActivity =
				dates.length > 0
					? new Date(Math.max(...dates.map((d) => d.getTime())))
					: member.createdAt;

			await prisma.organizationMember.update({
				where: { id: member.id },
				data: { lastActivityAt: lastActivity },
			});

			totalUpdated++;
		}

		cursor = members[members.length - 1].id;
		console.log(`[backfill] Updated ${totalUpdated} members so far...`);
	}

	console.log(
		`[backfill] Done. Updated ${totalUpdated} members with lastActivityAt.`,
	);
}

main()
	.catch((e) => {
		console.error('[backfill] Fatal error:', e);
		process.exit(1);
	})
	.finally(() => prisma.$disconnect());
