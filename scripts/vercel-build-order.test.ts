import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Pins the step order in `scripts/vercel-build.sh`, which CI never runs (the
 * `build` job calls the seed and `next build` directly; see
 * `ci-build-gate.test.ts`), so nothing else would notice it drifting.
 *
 * The order that matters: `prisma generate` must come before the first command
 * that imports the generated client. On 2026-11-03 the email-collision
 * preflight ran first, and every production deploy whose install step was a
 * cache hit ("Already up to date", no postinstall) failed with
 * `Cannot find module '../src/prisma/generated/client'`.
 */

const SCRIPT = path.resolve(__dirname, 'vercel-build.sh');

/** Executable lines only: `#` comments stripped, blanks dropped. */
function commandLines(): string[] {
	return readFileSync(SCRIPT, 'utf8')
		.split('\n')
		.map((line) => line.replace(/(^|\s)#.*$/, '').trim())
		.filter(Boolean);
}

function firstIndex(lines: string[], pattern: RegExp): number {
	return lines.findIndex((line) => pattern.test(line));
}

describe('scripts/vercel-build.sh step order', () => {
	const lines = commandLines();
	const generate = firstIndex(lines, /^pnpm prisma generate$/);

	it('runs prisma generate', () => {
		expect(generate).toBeGreaterThanOrEqual(0);
	});

	it('generates before it branches on VERCEL_ENV', () => {
		const branch = firstIndex(lines, /VERCEL_ENV/);
		expect(branch).toBeGreaterThan(-1);
		expect(generate).toBeLessThan(branch);
	});

	it.each([
		['the email-collision preflight', /check:email-collisions/],
		['migrate deploy', /prisma migrate deploy/],
		['the seed', /^pnpm seed$/],
		['next build', /^pnpm next build$/],
	])('generates before %s', (_label, pattern) => {
		const step = firstIndex(lines, pattern);
		expect(step).toBeGreaterThan(-1);
		expect(generate).toBeLessThan(step);
	});
});
