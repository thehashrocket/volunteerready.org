/**
 * Tests for the org ↔ volunteer access guard.
 *
 * The relationship SET is proven in orgVolunteerRepo.relationship.test.ts;
 * this file covers the two wrappers' contract — what they return and, more
 * importantly, which error code they throw.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	findOrgVolunteerRelationship: vi.fn(),
}));

vi.mock('@/server/repositories/orgVolunteerRepo', () => ({
	findOrgVolunteerRelationship: mocks.findOrgVolunteerRelationship,
}));

import {
	getOrgVolunteerRelationship,
	requireOrgVolunteerRelationship,
} from '../orgVolunteerAccessService';

const ORG = 'org-1';
const USER = 'user-1';

beforeEach(() => {
	vi.resetAllMocks();
});

describe('requireOrgVolunteerRelationship', () => {
	it('returns the matched relationship kind', async () => {
		mocks.findOrgVolunteerRelationship.mockResolvedValue('ORG_VOLUNTEER');

		await expect(requireOrgVolunteerRelationship(ORG, USER)).resolves.toBe(
			'ORG_VOLUNTEER',
		);
	});

	it('SECURITY: throws NOT_FOUND — not FORBIDDEN — for a stranger', async () => {
		// FORBIDDEN would confirm the account exists to a caller probing ids.
		// "Not yours" and "not real" must be indistinguishable.
		mocks.findOrgVolunteerRelationship.mockResolvedValue(null);

		await expect(
			requireOrgVolunteerRelationship(ORG, USER),
		).rejects.toMatchObject({ code: 'NOT_FOUND' });
	});

	it('SECURITY: passes the caller org through unmodified', async () => {
		mocks.findOrgVolunteerRelationship.mockResolvedValue('ORG_MEMBER');

		await requireOrgVolunteerRelationship(ORG, USER);

		expect(mocks.findOrgVolunteerRelationship).toHaveBeenCalledWith(
			ORG,
			USER,
			undefined,
		);
	});

	it('SECURITY: does not opt into acceptExistingCredential by default', async () => {
		// The circular case is off unless a caller explicitly asks. Only
		// revokeCredential does, because revoking cannot mint privilege.
		mocks.findOrgVolunteerRelationship.mockResolvedValue('ORG_MEMBER');

		await requireOrgVolunteerRelationship(ORG, USER);

		expect(mocks.findOrgVolunteerRelationship).not.toHaveBeenCalledWith(
			expect.anything(),
			expect.anything(),
			expect.objectContaining({ acceptExistingCredential: true }),
		);
	});

	it('forwards the opt-in through to the repository', async () => {
		mocks.findOrgVolunteerRelationship.mockResolvedValue('EXISTING_CREDENTIAL');

		await requireOrgVolunteerRelationship(ORG, USER, {
			acceptExistingCredential: true,
		});

		expect(mocks.findOrgVolunteerRelationship).toHaveBeenCalledWith(ORG, USER, {
			acceptExistingCredential: true,
		});
	});
});

describe('getOrgVolunteerRelationship', () => {
	it('returns null instead of throwing, for empty-state callers', async () => {
		mocks.findOrgVolunteerRelationship.mockResolvedValue(null);

		await expect(getOrgVolunteerRelationship(ORG, USER)).resolves.toBeNull();
	});

	it('returns the kind when related', async () => {
		mocks.findOrgVolunteerRelationship.mockResolvedValue('SHIFT_SIGNUP');

		await expect(getOrgVolunteerRelationship(ORG, USER)).resolves.toBe(
			'SHIFT_SIGNUP',
		);
	});
});
