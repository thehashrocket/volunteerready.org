import { NextResponse } from 'next/server';
import { prisma } from '@/server/repositories/prisma';

type CronResult = {
	ok: boolean;
	// biome-ignore lint/suspicious/noExplicitAny: cron results vary per job
	[key: string]: any;
};

type CronHandler = (req: Request) => Promise<CronResult>;

/**
 * Wraps a cron handler with Bearer token auth and CronJobRun recording.
 *
 * Usage:
 *   export const GET = withCronAuth('shift-reminders', async (req) => {
 *     const result = await sendShiftReminders();
 *     return { ok: true, ...result };
 *   });
 */
export function withCronAuth(jobName: string, handler: CronHandler) {
	return async (req: Request) => {
		const authHeader = req.headers.get('authorization');
		const expected = process.env.CRON_SECRET;

		if (!expected || authHeader !== `Bearer ${expected}`) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const startedAt = new Date();
		try {
			const result = await handler(req);
			const completedAt = new Date();
			const durationMs = completedAt.getTime() - startedAt.getTime();

			await recordCronRun(jobName, {
				startedAt,
				completedAt,
				status: 'SUCCESS',
				durationMs,
				resultSummary: result,
			});

			return NextResponse.json(result);
		} catch (e) {
			const completedAt = new Date();
			const durationMs = completedAt.getTime() - startedAt.getTime();
			const errorMessage = e instanceof Error ? e.message : 'Unknown error';

			console.error(`[cron] ${jobName} failed`, e);

			await recordCronRun(jobName, {
				startedAt,
				completedAt,
				status: 'FAILURE',
				durationMs,
				error: errorMessage,
			}).catch((recordErr) => {
				console.error(
					`[cron] Failed to record CronJobRun for ${jobName}`,
					recordErr,
				);
			});

			return NextResponse.json(
				{ error: 'Internal server error' },
				{ status: 500 },
			);
		}
	};
}

async function recordCronRun(
	jobName: string,
	data: {
		startedAt: Date;
		completedAt: Date;
		status: 'SUCCESS' | 'FAILURE';
		durationMs: number;
		resultSummary?: CronResult;
		error?: string;
	},
) {
	await prisma.cronJobRun.create({
		data: {
			jobName,
			startedAt: data.startedAt,
			completedAt: data.completedAt,
			status: data.status,
			durationMs: data.durationMs,
			resultSummary: data.resultSummary ?? undefined,
			error: data.error ?? null,
		},
	});
}
