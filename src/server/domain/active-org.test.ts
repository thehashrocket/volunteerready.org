import { describe, expect, it } from 'vitest';
import { resolveActiveOrgId, resolveOrgContext } from './active-org';

describe('resolveActiveOrgId', () => {
	it('honours the session org when the membership still exists', () => {
		expect(
			resolveActiveOrgId({
				membershipOrgIds: ['org-a', 'org-b'],
				sessionOrgId: 'org-b',
				isImpersonating: false,
			}),
		).toBe('org-b');
	});

	it('falls back to the oldest membership when there is no session org', () => {
		// Matches tRPC's rule (init.ts:149), so a page and its queries agree.
		expect(
			resolveActiveOrgId({
				membershipOrgIds: ['org-a', 'org-b'],
				sessionOrgId: null,
				isImpersonating: false,
			}),
		).toBe('org-a');
	});

	it('ignores a stale session org the user no longer belongs to', () => {
		// A user removed from an org keeps the old orgId on their session until
		// it refreshes. Trusting it would gate against an org they left.
		expect(
			resolveActiveOrgId({
				membershipOrgIds: ['org-b'],
				sessionOrgId: 'org-gone',
				isImpersonating: false,
			}),
		).toBe('org-b');
	});

	it('SECURITY: ignores session.orgId entirely while impersonating', () => {
		// session.orgId belongs to the REAL admin, not the impersonated target.
		// Honouring it resolves the flag — and the tenant — against the wrong org.
		expect(
			resolveActiveOrgId({
				membershipOrgIds: ['target-org'],
				sessionOrgId: 'admin-own-org',
				isImpersonating: true,
			}),
		).toBe('target-org');
	});

	it('SECURITY: returns null when an impersonated target has no orgs', () => {
		// Must NOT fall through to the admin's own org.
		expect(
			resolveActiveOrgId({
				membershipOrgIds: [],
				sessionOrgId: 'admin-own-org',
				isImpersonating: true,
			}),
		).toBeNull();
	});

	it('returns null for a user with no memberships at all', () => {
		expect(
			resolveActiveOrgId({
				membershipOrgIds: [],
				sessionOrgId: null,
				isImpersonating: false,
			}),
		).toBeNull();
	});
});

describe('staff_created_volunteers flag registration', () => {
	it('the exported constant is a REAL registry key, not a typo', async () => {
		// isFeatureEnabled() returns false for an unknown key, so a typo looks
		// exactly like "the flag is off" — the page would be permanently dark
		// with no error anywhere.
		const { FEATURE_FLAG_KEYS, STAFF_CREATED_VOLUNTEERS_FLAG, isKnownFlag } =
			await import('./feature-flags');

		expect(FEATURE_FLAG_KEYS).toContain(STAFF_CREATED_VOLUNTEERS_FLAG);
		expect(isKnownFlag(STAFF_CREATED_VOLUNTEERS_FLAG)).toBe(true);
	});

	it('defaults to OFF so it never ships enabled by accident', async () => {
		const { getFlagDefinition, STAFF_CREATED_VOLUNTEERS_FLAG } = await import(
			'./feature-flags'
		);
		expect(
			getFlagDefinition(STAFF_CREATED_VOLUNTEERS_FLAG)?.defaultEnabled,
		).toBe(false);
	});
});

describe('resolveOrgContext', () => {
	const memberships = [
		{ organizationId: 'org-a', role: 'STAFF' },
		{ organizationId: 'org-b', role: 'OWNER' },
	];

	it('keeps the saved org and its role when the user is a member', () => {
		expect(resolveOrgContext({ currentOrgId: 'org-b', memberships })).toEqual({
			currentOrgId: 'org-b',
			orgId: 'org-b',
			role: 'OWNER',
		});
	});

	// Value: protects=org context always comes from a membership;
	// fails_when=a saved currentOrgId is honoured without a membership;
	// why_new=the existing tests cover resolveActiveOrgId only; seam=none
	it('ignores a saved org the user is not a member of', () => {
		expect(
			resolveOrgContext({ currentOrgId: 'other-org', memberships }),
		).toEqual({ currentOrgId: 'org-a', orgId: 'org-a', role: 'STAFF' });
	});

	it('gives a user with no memberships no org at all', () => {
		expect(
			resolveOrgContext({ currentOrgId: 'other-org', memberships: [] }),
		).toEqual({ currentOrgId: null, orgId: null, role: null });
	});

	it('falls back to the oldest membership when nothing is saved', () => {
		expect(resolveOrgContext({ currentOrgId: null, memberships })).toEqual({
			currentOrgId: 'org-a',
			orgId: 'org-a',
			role: 'STAFF',
		});
	});
});
