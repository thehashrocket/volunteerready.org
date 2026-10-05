import { describe, expect, it } from 'vitest';
import {
	generateOrgFeedbackToken,
	validateOrgFeedbackToken,
} from './org-feedback-token';

const SECRET = 'test-secret';

// Value: protects=a survey token only validates for the org and survey type it
// was minted for; fails_when=the HMAC input drops the org id, type or label;
// why_new=new module; seam=none
describe('org feedback survey tokens', () => {
	it('accepts the token minted for the same org and survey type', () => {
		const token = generateOrgFeedbackToken(SECRET, 'org-1', 'DAY_7');
		expect(validateOrgFeedbackToken(SECRET, 'org-1', 'DAY_7', token)).toBe(
			true,
		);
	});

	it.each([
		['another org', 'org-2', 'DAY_7', SECRET],
		['the other survey type', 'org-1', 'DAY_30', SECRET],
		['another secret', 'org-1', 'DAY_7', 'other-secret'],
	] as const)(
		'rejects a token presented for %s',
		(_label, orgId, type, secret) => {
			const token = generateOrgFeedbackToken(SECRET, 'org-1', 'DAY_7');
			expect(validateOrgFeedbackToken(secret, orgId, type, token)).toBe(false);
		},
	);

	it.each(['', 'not-hex', 'ab', 'A'.repeat(64)])(
		'rejects a malformed token %j',
		(token) => {
			expect(validateOrgFeedbackToken(SECRET, 'org-1', 'DAY_7', token)).toBe(
				false,
			);
		},
	);
});
