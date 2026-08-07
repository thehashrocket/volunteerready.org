/**
 * The copy surfaces must DERIVE the warning window, never restate it.
 *
 * `CREDENTIAL_EXPIRY_WARNING_DAYS` exists because four places name the same
 * number and three of them were unbound literals — two numeric queries and one
 * sentence of marketing prose. Binding the two queries is enforced by their own
 * tests; the prose cannot be, because a hardcoded "30 days" in a paragraph is
 * indistinguishable from a correct one until the constant moves. A coordinator
 * who reads "30 days" on /screening and gets warned at 14 has been told
 * something false, and nothing would have failed.
 *
 * This is the same shape as `privacy/page.test.ts` walking the provider enum:
 * the un-derived form failed in production before, and a "remember to check the
 * copy" rule has nothing to trigger on when the constant is what changed.
 *
 * Read as source rather than rendered, because one surface is a React Server
 * Component page whose copy lives in a module-private array and the other is a
 * tRPC-backed client component whose empty state needs a full query mock. The
 * property under test is textual either way: is the number computed, or typed?
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CREDENTIAL_EXPIRY_WARNING_DAYS } from './credential-expiry';

const ROOT = join(__dirname, '..', '..', '..');

const COPY_SURFACES = [
	{
		label: '/screening marketing page',
		path: join(ROOT, 'src', 'app', '(public)', 'screening', 'page.tsx'),
	},
	{
		label: 'volunteer dashboard empty state',
		path: join(ROOT, 'src', 'components', 'app', 'volunteer-dashboard.tsx'),
	},
] as const;

/** Line comments first, then block comments — the ordering this repo's other
 * source-reading guards had to learn, since a `//` comment containing `/*`
 * otherwise swallows the real lines that follow it. */
function stripComments(source: string): string {
	return source.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
}

describe('credential expiry window copy', () => {
	for (const surface of COPY_SURFACES) {
		it(`${surface.label} imports the shared constant`, () => {
			const source = stripComments(readFileSync(surface.path, 'utf8'));

			expect(
				source.includes('CREDENTIAL_EXPIRY_WARNING_DAYS'),
				`${surface.label} names the credential expiry window to a user but does not import CREDENTIAL_EXPIRY_WARNING_DAYS from server/domain/credential-expiry. Interpolate the constant instead of typing the number.`,
			).toBe(true);
		});

		it(`${surface.label} states no hardcoded day count`, () => {
			const source = stripComments(readFileSync(surface.path, 'utf8'));

			// Deliberately matches the CURRENT value rather than any number: an
			// unrelated "7 days" elsewhere on the page is not this window, while a
			// literal equal to the constant is exactly the drift that survives a
			// change to it.
			const literal = new RegExp(
				`\\b${CREDENTIAL_EXPIRY_WARNING_DAYS}\\s+days?\\b`,
			);

			expect(
				literal.test(source),
				`${surface.label} hardcodes "${CREDENTIAL_EXPIRY_WARNING_DAYS} days". Changing CREDENTIAL_EXPIRY_WARNING_DAYS would leave this sentence promising a window the product no longer honours, with nothing red.`,
			).toBe(false);
		});
	}
});
