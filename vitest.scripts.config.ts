import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	resolve: {
		alias: {
			'@': path.resolve(__dirname, 'src'),
		},
	},
	test: {
		name: 'scripts',
		include: ['scripts/**/*.test.ts', 'prisma/scripts/**/*.test.ts'],
		environment: 'node',
		globals: true,
		// See vitest.config.mts — decouples the Vitest 5 bump from adopting
		// its new clear-mocks-before-every-test default.
		clearMocks: false,
	},
});
