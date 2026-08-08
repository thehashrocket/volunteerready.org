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
		environmentMatchGlobs: [
			["src/**/*.test.tsx", "jsdom"],
		],
		setupFiles: ["src/test-setup.ts"],
		// A DST-observing zone, deliberately not UTC. CI runners are UTC, where
		// calendar-day arithmetic (`setDate(+30)`) and fixed-span arithmetic
		// (`now + 30 * 86_400_000`) are indistinguishable — so a test asserting
		// the credential expiry window is exactly 30 days passed under BOTH, and
		// the DST divergence it existed to catch was invisible.
		env: { TZ: "America/Los_Angeles" },
	},
});
