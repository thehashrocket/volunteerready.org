import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Each cron route's job name (`withCronAuth('<name>', …)`) is the Sentry
 * monitor slug, and `withCronAuth` looks its schedule up in vercel.json at
 * `/api/cron/<name>`. A route whose name has no matching vercel.json entry
 * still runs, but its check-ins carry no schedule, so Sentry never creates
 * the monitor and the job goes unwatched without anything failing.
 */

const CRON_DIR = join(__dirname, '..', 'src', 'app', 'api', 'cron');
const vercel = JSON.parse(
	readFileSync(join(__dirname, '..', 'vercel.json'), 'utf8'),
) as { crons: Array<{ path: string; schedule: string }> };

const routes = readdirSync(CRON_DIR, { withFileTypes: true })
	.filter((entry) => entry.isDirectory())
	.map((entry) => {
		const source = readFileSync(join(CRON_DIR, entry.name, 'route.ts'), 'utf8');
		const match = source.match(/withCronAuth\(\s*'([^']+)'/);
		return { dir: entry.name, jobName: match?.[1] };
	});

describe('cron monitor schedules', () => {
	it.each(routes)('$dir passes withCronAuth a job name', ({ jobName }) => {
		expect(jobName).toBeDefined();
	});

	it.each(routes)(
		'$dir has a vercel.json schedule under its job name',
		({ jobName }) => {
			const cron = vercel.crons.find(
				(entry) => entry.path === `/api/cron/${jobName}`,
			);
			expect(cron?.schedule).toMatch(/\S+ \S+ \S+ \S+ \S+/);
		},
	);

	it('has a route for every vercel.json cron', () => {
		const names = routes.map((route) => `/api/cron/${route.jobName}`);
		for (const cron of vercel.crons) {
			expect(names).toContain(cron.path);
		}
	});
});
