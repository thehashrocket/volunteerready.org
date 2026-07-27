import { config } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Load .env.local before vitest processes start (must happen at config time
// so forked workers inherit the env vars via process.env).
config({ path: '.env.local' });

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
		// Integration specs share one Postgres, so they must not run concurrently.
		// This was `poolOptions: { forks: { singleFork: true } }`, which Vitest 4
		// REMOVED — it printed a deprecation notice on every run and was otherwise
		// ignored, so these files have in fact been running in parallel forks and
		// were safe only because each happens to use a distinct table prefix.
		// `fileParallelism: false` is the supported replacement and makes the
		// serialization hold by construction rather than by luck.
		fileParallelism: false,
	},
});
