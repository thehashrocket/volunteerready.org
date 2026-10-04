import vercelConfig from '../../../vercel.json';

/**
 * The crontab for a cron job, read from vercel.json so the Sentry monitor and
 * Vercel's scheduler can never disagree. Each job's path is
 * `/api/cron/<jobName>`; `scripts/cron-monitor-schedules.test.ts` checks that
 * every route's job name has an entry here.
 */
export function cronScheduleFor(jobName: string): string | undefined {
	return vercelConfig.crons.find((cron) => cron.path === `/api/cron/${jobName}`)
		?.schedule;
}
