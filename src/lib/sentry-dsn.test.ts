import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SENTRY_DSN } from './sentry-dsn';

/**
 * The `/monitoring` tunnel forwards a browser envelope only when its DSN equals
 * the server client's own (see sentry-dsn.ts). If one config stops reading the
 * shared constant (an env var, a pasted literal), the tunnel silently drops
 * every browser error, and nothing else in the suite notices.
 */
const ROOT = join(__dirname, '..', '..');
const CONFIGS = [
	'sentry.server.config.ts',
	'sentry.edge.config.ts',
	'src/instrumentation-client.ts',
];

function stripComments(source: string): string {
	return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

describe('Sentry DSN is shared by every runtime', () => {
	it('is a well-formed DSN', () => {
		expect(SENTRY_DSN).toMatch(
			/^https:\/\/[0-9a-f]+@o\d+\.ingest\.[a-z.]*sentry\.io\/\d+$/,
		);
	});

	for (const file of CONFIGS) {
		it(`${file} passes SENTRY_DSN to Sentry.init`, () => {
			const source = stripComments(readFileSync(join(ROOT, file), 'utf8'));
			expect(source).toMatch(/import \{ SENTRY_DSN \} from '[^']*sentry-dsn'/);
			expect(source).toMatch(/\bdsn: SENTRY_DSN,/);
			expect(source).not.toMatch(
				/SENTRY_DSN\s*\?\?|process\.env\.\w*SENTRY_DSN/,
			);
		});
	}
});
