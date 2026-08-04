import { describe, expect, it } from 'vitest';
import { normalizeEmail, volunteerEmailSchema } from './org-volunteer';

/**
 * CHARACTERIZATION TEST — this pins a property we depend on but do not own.
 *
 * `normalizeEmail()` is `trim().toLowerCase()` with no Unicode normalization,
 * which is structurally the same defect as GHSA-7rqj-j65f-68wh (see
 * `magic-link-identifier.ts`): it canonicalizes case but not homoglyphs. It is
 * used as an AUTHORIZATION comparison in three places —
 * `memberService.ts` (org invitation acceptance), `companyService.ts` (company
 * invitation acceptance), and `backgroundCheckService.ts` Guard 1.5 (binding
 * submitted PII to the volunteer being checked).
 *
 * It is not exploitable today, and the reason is `volunteerEmailSchema`: zod's
 * `.email()` is ASCII-only, so a homoglyph address never reaches
 * `normalizeEmail` through any app path. But that is a property of ZOD'S
 * IMPLEMENTATION, not a decision this codebase made. A zod release that
 * relaxed toward RFC 6531 internationalized addresses would make three
 * authorization predicates collide on homoglyphs, with no failing test and no
 * change in this repo.
 *
 * So these assertions are the alarm. If they go red after a zod bump, the fix
 * is NOT to loosen the test — it is to add NFKC normalization to
 * `normalizeEmail` with the matching index migration, tracked as a P2 in
 * `docs/TODOS.md`. Do not delete this file when that lands: it covers the
 * `volunteerEmailSchema` paths, which the magic-link normalizer does not touch.
 */
describe('volunteerEmailSchema — homoglyph characterization', () => {
	const homoglyphs: [string, string][] = [
		['U+FF20 FULLWIDTH @', 'victim＠example.com'],
		['U+FE6B SMALL @', 'victim﹫example.com'],
		['U+FF41 FULLWIDTH a in domain', 'victim@exａmple.com'],
		['U+017F LATIN SMALL LETTER LONG S', 'ſtevejobs@example.com'],
	];

	it.each(
		homoglyphs,
	)('zod rejects %s before it can reach normalizeEmail', (_label, address) => {
		expect(volunteerEmailSchema.safeParse(address).success).toBe(false);
	});

	it.each(
		homoglyphs,
	)('%s WOULD collide or drift if it got through — this is what the rejection buys', (_label, address) => {
		// normalizeEmail is case-folding only, so the canonicalized form
		// differs from what it would produce. That gap is the latent defect.
		const viaNormalizeEmail = normalizeEmail(address);
		const viaNfkc = address.normalize('NFKC').trim().toLowerCase();
		expect(viaNormalizeEmail).not.toBe(viaNfkc);
	});

	describe('CONTRAST: ordinary addresses are accepted and canonicalized', () => {
		it('accepts a plain address', () => {
			const parsed = volunteerEmailSchema.safeParse('volunteer@example.com');
			expect(parsed.success).toBe(true);
			expect(parsed.success && parsed.data).toBe('volunteer@example.com');
		});

		it('lowercases and trims on the way through', () => {
			const parsed = volunteerEmailSchema.safeParse(
				'  Jason.Shultz@Example.COM  ',
			);
			expect(parsed.success).toBe(true);
			expect(parsed.success && parsed.data).toBe('jason.shultz@example.com');
		});

		it('accepts a plus-addressed local part', () => {
			const parsed = volunteerEmailSchema.safeParse('vol+shelter@example.com');
			expect(parsed.success).toBe(true);
			expect(parsed.success && parsed.data).toBe('vol+shelter@example.com');
		});
	});
});
