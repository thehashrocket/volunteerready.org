import { describe, expect, it } from 'vitest';
import { normalizeMagicLinkIdentifier } from './magic-link-identifier';

/**
 * Regression coverage for GHSA-7rqj-j65f-68wh (critical): next-auth's default
 * magic-link normalizer validated BEFORE Unicode normalization, so a homoglyph
 * `@` slipped past the single-separator check and the sign-in link could be
 * routed to a mailbox the victim does not control.
 *
 * The SECURITY block below is the regression proper. The block after it is its
 * mandatory contrast: a normalizer that rejects everything would pass every
 * negative assertion here while making sign-in impossible for every user, so
 * the positive cases are what stop this file from passing vacuously.
 */
describe('normalizeMagicLinkIdentifier', () => {
	describe('SECURITY: NFKC runs before validation, not after', () => {
		// U+FF20 FULLWIDTH COMMERCIAL AT and U+FE6B SMALL COMMERCIAL AT both
		// canonicalize to an ASCII `@` under NFKC.
		const mixedSeparatorAttacks: [string, string][] = [
			['U+FF20 FULLWIDTH', 'victim@example.com＠attacker.com'],
			['U+FE6B SMALL', 'victim@example.com﹫attacker.com'],
		];

		it.each(mixedSeparatorAttacks)(
			'rejects a mixed ASCII + %s separator address',
			(_label, attack) => {
				expect(() => normalizeMagicLinkIdentifier(attack)).toThrow(
					'Invalid email address format.',
				);
			},
		);

		// This is what makes the cases above a real bypass rather than an
		// ordinary malformed address, and it is the assertion that goes red if
		// `.normalize('NFKC')` is ever moved back below the `@` count.
		it.each(mixedSeparatorAttacks)(
			'%s attack carries exactly ONE ASCII @, so a validate-first normalizer would accept it',
			(_label, attack) => {
				expect(attack.match(/@/g)).toHaveLength(1);
				// ...and exactly TWO once canonicalized, which is why we reject it.
				expect(attack.normalize('NFKC').match(/@/g)).toHaveLength(2);
			},
		);

		it('does not treat the victim address itself as the delivery target', () => {
			// Belt and braces: whatever happens, the attack string must never
			// normalize to something that resolves to the victim's account.
			expect(() =>
				normalizeMagicLinkIdentifier('victim@example.com＠attacker.com'),
			).toThrow();
		});
	});

	describe('CONTRAST: ordinary addresses still sign in', () => {
		it('accepts a plain address unchanged', () => {
			expect(normalizeMagicLinkIdentifier('volunteer@example.com')).toBe(
				'volunteer@example.com',
			);
		});

		it('lowercases and trims, matching the canonical User.email form', () => {
			expect(normalizeMagicLinkIdentifier('  Jason.Shultz@Example.COM  ')).toBe(
				'jason.shultz@example.com',
			);
		});

		it('accepts a plus-addressed local part', () => {
			expect(normalizeMagicLinkIdentifier('vol+shelter@example.com')).toBe(
				'vol+shelter@example.com',
			);
		});

		it('accepts a subdomain', () => {
			expect(normalizeMagicLinkIdentifier('staff@mail.example.co.uk')).toBe(
				'staff@mail.example.co.uk',
			);
		});

		it('collapses a pure-homoglyph address to the mailbox it denotes', () => {
			// No ASCII `@` at all: unambiguous, and the link goes to the real
			// owner. Upstream's patched default behaves the same way.
			expect(normalizeMagicLinkIdentifier('volunteer＠example.com')).toBe(
				'volunteer@example.com',
			);
		});
	});

	describe('preserves the upstream default validations', () => {
		it('rejects an address with no @', () => {
			expect(() =>
				normalizeMagicLinkIdentifier('volunteer.example.com'),
			).toThrow('Invalid email address format.');
		});

		it('rejects quotes, which can steer downstream address parsers', () => {
			expect(() =>
				normalizeMagicLinkIdentifier('"volunteer"@example.com'),
			).toThrow('Invalid email address format.');
		});

		it('rejects an empty local part', () => {
			expect(() => normalizeMagicLinkIdentifier('@example.com')).toThrow(
				'Invalid email address format.',
			);
		});

		it('rejects an empty domain', () => {
			expect(() => normalizeMagicLinkIdentifier('volunteer@')).toThrow(
				'Invalid email address format.',
			);
		});

		it('rejects a domain with no dot', () => {
			expect(() => normalizeMagicLinkIdentifier('volunteer@localhost')).toThrow(
				'Invalid email address format.',
			);
		});

		it('truncates the domain at a comma', () => {
			expect(
				normalizeMagicLinkIdentifier('volunteer@example.com,evil.com'),
			).toBe('volunteer@example.com');
		});
	});
});
