import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';
import { prisma } from '@/server/repositories/prisma';
import { cronScheduleFor } from './cron-schedules';

type CronResult = {
	ok: boolean;
	// biome-ignore lint/suspicious/noExplicitAny: cron results vary per job
	[key: string]: any;
};

type CronHandler = (req: Request) => Promise<CronResult>;

// Sentry cron monitors: a check-in when the job starts and an ok or error
// check-in when it ends, so a job that fails or stops running alerts. Sent
// from here, after the CRON_SECRET check, rather than by Sentry's automatic
// Vercel cron monitoring: that one starts a check-in before any app code runs
// on anything carrying Vercel's user agent, so a forged request would post a
// failed run to the real monitor, and it only fires for traced requests.
// Times are in minutes; Vercel runs crons in UTC.
const MONITOR_CHECKIN_MARGIN_MINUTES = 5;
const MONITOR_MAX_RUNTIME_MINUTES = 10;

// The closing check-in is only queued when withMonitor returns. Nothing else
// flushes it for these route handlers (Sentry's own route-handler wrapper is
// not applied under Turbopack), so it could be lost when Vercel suspends the
// function after the response, and a healthy run would show as timed out.
// Sentry applies the timeout to two waits in turn (its own processing, then
// the transport), so this caps the delay at about two seconds on a response
// nobody reads. A failed flush is ignored: it must never change the cron's
// own response.
const SENTRY_FLUSH_TIMEOUT_MS = 1_000;

function monitorConfigFor(jobName: string) {
	const schedule = cronScheduleFor(jobName);
	if (!schedule) return undefined;
	return {
		schedule: { type: 'crontab' as const, value: schedule },
		checkinMargin: MONITOR_CHECKIN_MARGIN_MINUTES,
		maxRuntime: MONITOR_MAX_RUNTIME_MINUTES,
		timezone: 'Etc/UTC',
	};
}

/**
 * Wraps a cron handler with Bearer token auth, CronJobRun recording and a
 * Sentry cron monitor check-in.
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
			return await runAndRecord(jobName, handler, req, startedAt);
		} finally {
			await Sentry.flush(SENTRY_FLUSH_TIMEOUT_MS).catch(() => false);
		}
	};
}

async function runAndRecord(
	jobName: string,
	handler: CronHandler,
	req: Request,
	startedAt: Date,
) {
	try {
		const result = await Sentry.withMonitor(
			jobName,
			() => handler(req),
			monitorConfigFor(jobName),
		);
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
