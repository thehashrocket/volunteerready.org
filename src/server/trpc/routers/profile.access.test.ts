/**
 * Router-level test for profile.getOrgVisibleProfile's org scoping.
 *
 * volunteerIdentityService.test.ts proves the SERVICE refuses a volunteer
 * unrelated to the `orgId` it is handed. Nothing proved the ROUTER hands it the
 * right one. That gap is the whole bug class this fix belongs to: the procedure
 * takes `userId` from client input, and if `orgId` were ever sourced from input
 * too — or from a stale session field rather than the server-resolved `ctx` —
 * the service guard would faithfully authorize against an org the caller chose.
 * Compare the `companyScopedProcedure` note in CLAUDE.md, where authorizing off
 * session state instead of the request's real tenant was exactly the defect.
 *
 * Mirrors the caller-factory precedent in volunteers.test.ts / esg-report.test.ts.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	getOrgVisibleProfile: vi.fn(),
	getPublicProfile: vi.fn(),
}));

// orgProcedure does one indexed lookup per call to enforce org suspension
// (init.ts:279). Return an unsuspended org so the guard passes.
vi.mock('@/server/repositories/prisma', () => ({
	prisma: {
		organization: {
			findUnique: vi.fn().mockResolvedValue({ suspendedAt: null }),
		},
	},
}));
vi.mock('@/server/auth', () => ({ authOptions: {} }));

vi.mock('@/server/services/volunteerIdentityService', () => ({
	getOrgVisibleProfile: mocks.getOrgVisibleProfile,
	getPublicProfile: mocks.getPublicProfile,
}));

vi.mock('@/server/services/volunteerProfileService', () => ({
	getVolunteerProfileWithCompleteness: vi.fn(),
	saveVolunteerProfile: vi.fn(),
}));

import { t } from '@/server/trpc/init';
import { profileRouter } from './profile';

const callerFactory = t.createCallerFactory(profileRouter);
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
	mocks.getOrgVisibleProfile.mockResolvedValue({ displayName: 'Jane Doe' });
});

describe('profile.getOrgVisibleProfile org scoping', () => {
	it('SECURITY: scopes the lookup to ctx.orgId, not to anything client-supplied', async () => {
		await caller().getOrgVisibleProfile({ userId: 'user-target' });

		expect(mocks.getOrgVisibleProfile).toHaveBeenCalledWith(
			'user-target',
			CTX_ORG_ID,
		);
	});

	it('SECURITY: an orgId smuggled into the input cannot redirect the check', async () => {
		// The zod input schema declares only `userId`, so an attacker-supplied
		// orgId is stripped rather than forwarded. Asserting the observable
		// consequence, since the stripping itself is invisible at the callsite.
		await caller().getOrgVisibleProfile({
			userId: 'user-target',
			orgId: 'org-attacker',
		} as never);

		expect(mocks.getOrgVisibleProfile).toHaveBeenCalledWith(
			'user-target',
			CTX_ORG_ID,
		);
		expect(mocks.getOrgVisibleProfile).not.toHaveBeenCalledWith(
			expect.anything(),
			'org-attacker',
		);
	});
});
