/**
 * Router-level org-scoping tests for the guarded credential mutations.
 *
 * The service tests prove the guard refuses a volunteer unrelated to the
 * `orgId` it is HANDED. They say nothing about which org the router hands it.
 * That is the same bug class this whole fix belongs to — see the
 * `companyScopedProcedure` note in CLAUDE.md, where authorizing off session
 * state rather than the request's real tenant was exactly the defect.
 *
 * `profile.access.test.ts` closed this for the read path; these two mutations
 * mint verification badges, so they warrant the tripwire at least as much.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	issueCredential: vi.fn(),
	revokeCredential: vi.fn(),
	removeCredential: vi.fn(),
	getOrgCredentials: vi.fn(),
	getMyCredentials: vi.fn(),
	getVolunteerCredentialsInOrg: vi.fn(),
}));

// orgProcedure does one indexed lookup per call to enforce org suspension
// (init.ts). Return an unsuspended org so the guard passes.
vi.mock('@/server/repositories/prisma', () => ({
	prisma: {
		organization: {
			findUnique: vi.fn().mockResolvedValue({ suspendedAt: null }),
		},
	},
}));
vi.mock('@/server/auth', () => ({ authOptions: {} }));

vi.mock('@/server/services/volunteerCredentialService', () => ({
	issueCredential: mocks.issueCredential,
	revokeCredential: mocks.revokeCredential,
	removeCredential: mocks.removeCredential,
	getOrgCredentials: mocks.getOrgCredentials,
	getMyCredentials: mocks.getMyCredentials,
	getVolunteerCredentialsInOrg: mocks.getVolunteerCredentialsInOrg,
}));

import { t } from '@/server/trpc/init';
import { credentialsRouter } from './credentials';

const callerFactory = t.createCallerFactory(credentialsRouter);
const CTX_ORG_ID = 'org-from-context';
const ACTOR_ID = 'user-actor';

function caller() {
	return callerFactory({
		session: { user: { id: ACTOR_ID } },
		realSession: null,
		realUserId: ACTOR_ID,
		impersonation: null,
		orgId: CTX_ORG_ID,
		role: 'STAFF',
		companyId: null,
		companyRole: null,
		prisma: {} as never,
		sessionToken: null,
		ip: null,
	} as Parameters<typeof callerFactory>[0]);
}

beforeEach(() => {
	vi.resetAllMocks();
	mocks.issueCredential.mockResolvedValue({ id: 'cred-1' });
	mocks.revokeCredential.mockResolvedValue({ id: 'cred-1' });
});

describe('credentials.issue org scoping', () => {
	it('SECURITY: issues against ctx.orgId, not anything client-supplied', async () => {
		await caller().issue({
			userId: 'user-target',
			type: 'BACKGROUND_CHECK',
			status: 'VERIFIED',
		});

		expect(mocks.issueCredential).toHaveBeenCalledWith(
			expect.objectContaining({ userId: 'user-target', orgId: CTX_ORG_ID }),
			ACTOR_ID,
		);
	});

	it('SECURITY: an orgId smuggled into the input cannot redirect the write', async () => {
		// The zod input schema declares no orgId, so an attacker-supplied one is
		// stripped. Asserting the observable consequence, since the stripping
		// itself is invisible at the callsite.
		await caller().issue({
			userId: 'user-target',
			type: 'BACKGROUND_CHECK',
			status: 'VERIFIED',
			orgId: 'org-attacker',
		} as never);

		expect(mocks.issueCredential).toHaveBeenCalledWith(
			expect.objectContaining({ orgId: CTX_ORG_ID }),
			ACTOR_ID,
		);
		expect(mocks.issueCredential).not.toHaveBeenCalledWith(
			expect.objectContaining({ orgId: 'org-attacker' }),
			expect.anything(),
		);
	});
});

describe('credentials.revoke org scoping', () => {
	it('SECURITY: revokes against ctx.orgId, not anything client-supplied', async () => {
		await caller().revoke({
			userId: 'user-target',
			type: 'BACKGROUND_CHECK',
		});

		expect(mocks.revokeCredential).toHaveBeenCalledWith(
			'user-target',
			CTX_ORG_ID,
			'BACKGROUND_CHECK',
			ACTOR_ID,
		);
	});

	it('SECURITY: an orgId smuggled into the input cannot redirect the write', async () => {
		await caller().revoke({
			userId: 'user-target',
			type: 'BACKGROUND_CHECK',
			orgId: 'org-attacker',
		} as never);

		expect(mocks.revokeCredential).toHaveBeenCalledWith(
			'user-target',
			CTX_ORG_ID,
			'BACKGROUND_CHECK',
			ACTOR_ID,
		);
	});
});
