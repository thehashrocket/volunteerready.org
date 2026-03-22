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
	},
});
