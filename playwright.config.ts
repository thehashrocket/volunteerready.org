import { defineConfig, devices } from '@playwright/test';

const PORT = process.env.PORT ? Number(process.env.PORT) : 3005;
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
	testDir: './e2e',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 1 : undefined,
	reporter: process.env.CI ? 'github' : 'list',
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
				timeout: 120_000,
			},
});
