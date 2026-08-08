import { describe, expect, it } from 'vitest';
import {
	CREDENTIAL_EXPIRY_WARNING_DAYS,
	credentialExpiryNoticeBody,
	credentialExpiryNoticeSubject,
	credentialExpiryNoticeTitle,
	credentialExpiryWindowEnd,
	credentialNoticeCycleStart,
	daysUntilExpiry,
	type ExpiringCredentialFact,
	groupCredentialsByOrg,
	shouldStampNotifiedAt,
} from './credential-expiry';

const DAY_MS = 24 * 60 * 60 * 1000;

function makeFact(
	overrides: Partial<ExpiringCredentialFact> = {},
): ExpiringCredentialFact {
	return {
		credentialId: 'cred-1',
		orgId: 'org-1',
		orgName: 'Helping Hands',
		volunteerName: 'Jane Doe',
		typeLabel: 'Background Check',
		expiresAt: new Date('2026-09-01T00:00:00Z'),
		...overrides,
	};
}

describe('daysUntilExpiry', () => {
	const now = new Date('2026-08-07T00:00:00Z');

	it('counts whole days', () => {
		expect(daysUntilExpiry(new Date(now.getTime() + 7 * DAY_MS), now)).toBe(7);
	});

	it('rounds up a partial day, so "expires tomorrow morning" is never 0', () => {
		expect(daysUntilExpiry(new Date(now.getTime() + 0.25 * DAY_MS), now)).toBe(
			1,
		);
	});

	it('returns the window size at the far edge of the window', () => {
		const edge = new Date(
			now.getTime() + CREDENTIAL_EXPIRY_WARNING_DAYS * DAY_MS,
		);
		expect(daysUntilExpiry(edge, now)).toBe(CREDENTIAL_EXPIRY_WARNING_DAYS);
	});
});

describe('credentialExpiryWindowEnd', () => {
	it('is a fixed span, not calendar days, across a DST boundary', () => {
		// MUTATION GUARD, and it only works because vitest.config.mts pins TZ to a
		// DST-observing zone. Under UTC — which is what CI runners use — the
		// rejected `windowEnd.setDate(getDate() + 30)` produces exactly the same
		// instant, so this assertion was green under both implementations and
		// proved nothing. This `now` puts the window across the US fall-back.
		const now = new Date('2026-10-20T12:00:00Z');
		expect(credentialExpiryWindowEnd(now).getTime() - now.getTime()).toBe(
			CREDENTIAL_EXPIRY_WARNING_DAYS * DAY_MS,
		);
	});

	it('is the mirror of the notice cycle start', () => {
		const now = new Date('2026-10-20T12:00:00Z');
		expect(credentialExpiryWindowEnd(now).getTime() - now.getTime()).toBe(
			now.getTime() - credentialNoticeCycleStart(now).getTime(),
		);
	});
});

describe('credentialNoticeCycleStart', () => {
	it('is one full window behind now', () => {
		// The renewal rule: a stamp older than this describes an expiry date the
		// row no longer has, because the window is only that long.
		const now = new Date('2026-10-20T12:00:00Z');
		expect(now.getTime() - credentialNoticeCycleStart(now).getTime()).toBe(
			CREDENTIAL_EXPIRY_WARNING_DAYS * DAY_MS,
		);
	});
});

describe('groupCredentialsByOrg', () => {
	it('returns an empty list for no facts', () => {
		expect(groupCredentialsByOrg([])).toEqual([]);
	});

	it('groups interleaved orgs, preserving first-seen order', () => {
		// The scan is ordered by urgency, not by org, so orgs genuinely do arrive
		// interleaved — this is the case that makes grouping necessary at all.
		const bundles = groupCredentialsByOrg([
			makeFact({ credentialId: 'a', orgId: 'org-1', orgName: 'First' }),
			makeFact({ credentialId: 'b', orgId: 'org-2', orgName: 'Second' }),
			makeFact({ credentialId: 'c', orgId: 'org-1', orgName: 'First' }),
		]);

		expect(bundles).toHaveLength(2);
		expect(bundles[0].orgId).toBe('org-1');
		expect(bundles[0].items.map((i) => i.credentialId)).toEqual(['a', 'c']);
		expect(bundles[1].orgId).toBe('org-2');
		expect(bundles[1].items.map((i) => i.credentialId)).toEqual(['b']);
	});
});

describe('shouldStampNotifiedAt', () => {
	const ok = { emailFailed: false };
	const failed = { emailFailed: true };

	it('does not stamp when there was nobody to tell', () => {
		expect(shouldStampNotifiedAt([])).toBe(false);
	});

	it('does not stamp when ANY recipient email failed', () => {
		// THE regression this rule exists for. The first version was
		// `deliveries.some(Boolean)` over `inAppSent || emailSent === true`, and
		// since `inAppSent` defaults to true, a Resend 429 stamped the batch
		// anyway and the email was lost permanently — while the docstring beside
		// it promised a retry. Flipping this back to `.some` turns this red.
		expect(shouldStampNotifiedAt([failed])).toBe(false);
		expect(shouldStampNotifiedAt([ok, failed, ok])).toBe(false);
	});

	it('stamps when every recipient was reached', () => {
		expect(shouldStampNotifiedAt([ok, ok])).toBe(true);
	});

	it('stamps when recipients opted out of both channels', () => {
		// An opt-out is a respected preference, not a lost notice. Treating it as
		// a failure would make the org retry nightly forever and hold a slot
		// under the org cap.
		expect(shouldStampNotifiedAt([ok])).toBe(true);
	});
});

describe('notice copy', () => {
	it('is singular for one credential and plural otherwise', () => {
		expect(credentialExpiryNoticeTitle(1)).toBe(
			'1 volunteer credential expiring soon',
		);
		expect(credentialExpiryNoticeTitle(3)).toBe(
			'3 volunteer credentials expiring soon',
		);
		expect(credentialExpiryNoticeSubject(1, 'Helping Hands')).toBe(
			'1 volunteer credential expiring soon at Helping Hands',
		);
		expect(credentialExpiryNoticeSubject(2, 'Helping Hands')).toBe(
			'2 volunteer credentials expiring soon at Helping Hands',
		);
	});

	it('names the org in the email subject but not the in-app title', () => {
		// The bell is already scoped to one org, and Notification.title is capped
		// at 200 chars — a long org name plus the prefix could exceed it.
		expect(credentialExpiryNoticeTitle(1)).not.toContain('Helping Hands');
		expect(credentialExpiryNoticeSubject(1, 'Helping Hands')).toContain(
			'Helping Hands',
		);
	});

	it('quotes the shared window constant in the body rather than a literal', () => {
		expect(credentialExpiryNoticeBody(2, 'Helping Hands')).toContain(
			`within ${CREDENTIAL_EXPIRY_WARNING_DAYS} days`,
		);
		expect(credentialExpiryNoticeBody(2, 'Helping Hands')).toContain(
			'Helping Hands',
		);
	});
});
