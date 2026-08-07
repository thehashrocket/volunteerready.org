import { defineConfig, devices } from '@playwright/test';

const PORT = process.env.PORT ? Number(process.env.PORT) : 3005;
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
	testDir: './e2e',
	// Compiles the dev server's routes sequentially before the workers start.
	// `webServer.url` below only proves `/` answers; in `next dev` every other
	// route is still uncompiled, and releasing N workers onto ~20 of them at
	// once made Next read a `.next` manifest another compile was still writing
	// ("SyntaxError: Unexpected end of JSON input" → 500). See the file header.
	globalSetup: './e2e/global-setup.ts',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 1 : undefined,
	// Two reporters under CI, not one. `github` writes the inline PR annotations
	// that make a failure readable without leaving the diff; `html` writes
	// `playwright-report/`, which the workflow uploads on failure — and since
	// `trace: 'on-first-retry'` below only produces a trace on the retry of a
	// genuine failure, that artifact is the only way to see what the browser
	// actually did. `open: 'never'` because a headless runner has no browser to
	// open it in, and the default ('on-failure') would hang the job.
	reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
	use: {
		baseURL: BASE_URL,
		trace: 'on-first-retry',
	},
	// Mutually exclusive project sets: CAPTURE=1 registers ONLY the capture
	// project (marketing-screenshot pipeline, pnpm screenshots), everything
	// else registers ONLY chromium. This is deliberate — if both were
	// registered, a leaked CAPTURE env var would let a bare `playwright test`
	// rewrite public/marketing/*.png concurrently with the e2e specs that
	// assert on those very files.
	projects:
		process.env.CAPTURE === '1'
			? [
					{
						name: 'capture',
						use: { ...devices['Desktop Chrome'] },
						testMatch: /capture\.spec\.ts/,
					},
				]
			: [
					{
						name: 'chromium',
						use: { ...devices['Desktop Chrome'] },
						// capture.spec.ts only runs under the capture project.
						testIgnore: /capture\.spec\.ts/,
					},
				],
	webServer: process.env.PLAYWRIGHT_BASE_URL
		? undefined
		: {
				command: 'pnpm dev',
				url: BASE_URL,
				reuseExistingServer: !process.env.CI,
				// `url` is not "the process started" — Playwright polls it until it
				// answers, and answering `/` means Turbopack has COMPILED `/`. On a
				// developer's machine that is warm and near-instant; on a CI runner
				// there is no `.next` cache at all and `/` is a heavy marketing page,
				// so the first compile is the single slowest thing in the job.
				//
				// Raised for CI rather than left at 120s because of how this fails:
				// a boot timeout surfaces as "the dev server never came up", which
				// reads as the app being broken rather than slow, and it takes the
				// whole suite with it. The ceiling costs nothing when the server is
				// quick — it is a maximum wait, not a sleep — and the job's own
				// `timeout-minutes` is the real backstop against a genuine hang.
				timeout: process.env.CI ? 300_000 : 120_000,
			},
});
