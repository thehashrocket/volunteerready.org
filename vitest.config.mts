import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "src"),
		},
	},
	test: {
		globals: true,
		include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
		exclude: ["node_modules", ".next", "prisma/generated", "src/**/*.integration.test.ts"],
		// Per-file environment selection is the `@vitest-environment jsdom`
		// pragma comment on each .tsx test file (61 of them; the 3 without it
		// test Server Component modules that never render — no
		// testing-library/document/window reference among them — so `node`
		// is correct for them too). This used to also carry
		// `environmentMatchGlobs: [['src/**/*.test.tsx', 'jsdom']]`, which
		// doesn't exist in Vitest 5's types at all (confirmed absent from
		// vitest/dist/config.d.ts) and was redundant with the pragma even
		// while it worked under Vitest 4 — removed rather than fixed.
		setupFiles: ["src/test-setup.ts"],
		// Vitest 5 auto-clears mocks before every test by default (was
		// opt-in). This repo has no existing clearMocks/resetMocks/
		// restoreMocks convention — 177 files use bare vi.fn()/vi.spyOn()
		// outside vi.mock() — so adopting the new default here would
		// silently change what every one of those tests actually verifies.
		// `false` restores the pre-5 behavior exactly, decoupling the
		// version bump from that semantic risk. Adopting the new default
		// is deliberately deferred — see docs/TODOS.md.
		clearMocks: false,
		// A DST-observing zone, deliberately not UTC. CI runners are UTC, where
		// calendar-day arithmetic (`setDate(+30)`) and fixed-span arithmetic
		// (`now + 30 * 86_400_000`) are indistinguishable — so a test asserting
		// the credential expiry window is exactly 30 days passed under BOTH, and
		// the DST divergence it existed to catch was invisible.
		env: { TZ: "America/Los_Angeles" },
	},
});
