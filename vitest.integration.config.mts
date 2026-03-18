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
		name: 'integration',
		include: ['src/**/*.integration.test.ts'],
		exclude: ['node_modules', '.next', 'prisma/generated'],
		environment: 'node',
		globals: true,
		setupFiles: ['src/test/integration-setup.ts'],
		pool: 'forks',
		poolOptions: { forks: { singleFork: true } },
	},
});
