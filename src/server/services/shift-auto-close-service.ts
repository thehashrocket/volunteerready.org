import { prisma } from '@/server/repositories/prisma';
import { completeShift } from '@/server/services/shiftService';

/**
 * Auto-close shifts whose endTime has passed but are still OPEN or FULL.
 *
 * Uses the composite index (status, endTime) for efficient lookup.
 * Per-record try/catch so one failure doesn't block others.
 * Called by the shift-auto-close cron job.
 */
export async function autoCloseExpiredShifts(): Promise<{
	processed: number;
	completed: number;
	errors: number;
}> {
	const now = new Date();

	const expiredShifts = await prisma.shift.findMany({
		where: {
			status: { in: ['OPEN', 'FULL'] },
			endTime: { lt: now },
		},
		select: { id: true, orgId: true, title: true },
		take: 200,
	});

	let completed = 0;
	let errors = 0;

	for (const shift of expiredShifts) {
		try {
			const result = await completeShift(shift.id, shift.orgId, null);
			if (result) {
				completed++;
			}
		} catch (e) {
			errors++;
			if ((e as { code?: string }).code === 'P2025') {
				console.warn(
					`[shift-auto-close] Shift ${shift.id} already modified — skipping`,
				);
			} else {
				console.error(
					`[shift-auto-close] Failed to close shift ${shift.id} (${shift.title}):`,
					e,
				);
			}
		}
	}

	return { processed: expiredShifts.length, completed, errors };
}
