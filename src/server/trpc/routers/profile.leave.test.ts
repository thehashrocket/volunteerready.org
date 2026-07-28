/**
 * Router-level tests for profile.leaveOrgRoster / profile.listMyOrgMemberships (T32).
 *
 * `staffVolunteerService.test.ts` proves the SERVICE audits and refuses
 * correctly given a `userId`. Nothing proved the ROUTER hands it the right one,
 * or that these two procedures stay reachable by the people they exist for.
 *
 * Two distinct claims are pinned here, both invisible at the callsite:
 *
 *   1. `userId` comes from `ctx.session`, never from input. The mutation
 *      soft-deletes a row, so a client-supplied identity would let one
 *      volunteer remove another from a roster — the same bug class as
 *      v0.29.2.0 / v0.29.3.0.
 *   2. Neither procedure is behind `rosterProcedure`. Roster edges are minted
 *      for every org by `ensureAppliedRosterRow` regardless of the pilot flag,
 *      so gating the EXIT on staff-side context would strand volunteers on
 *      rosters they cannot leave. Making these "consistent" with
 *      `volunteersRouter` is a one-line change nothing else would catch.
 *
 * Mirrors the caller-factory precedent in profile.access.test.ts.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	leaveOrgRoster: vi.fn(),
	listMyOrgMemberships: vi.fn(),
}));

vi.mock('@/server/repositories/prisma', () => ({
	prisma: {
		organization: {
			findUnique: vi.fn().mockResolvedValue({ suspendedAt: null }),
		},
	},
}));
vi.mock('@/server/auth', () => ({ authOptions: {} }));

vi.mock('@/server/services/staffVolunteerService', () => ({
	leaveOrgRoster: mocks.leaveOrgRoster,
	listMyOrgMemberships: mocks.listMyOrgMemberships,
}));

vi.mock('@/server/services/volunteerIdentityService', () => ({
	getOrgVisibleProfile: vi.fn(),
	getPublicProfile: vi.fn(),
}));

vi.mock('@/server/services/volunteerProfileService', () => ({
	getVolunteerProfileWithCompleteness: vi.fn(),
	saveVolunteerProfile: vi.fn(),
}));

import { t } from '@/server/trpc/init';
import { profileRouter } from './profile';

const callerFactory = t.createCallerFactory(profileRouter);
const VOLUNTEER = 'user-volunteer';

/**
 * A plain volunteer: no org, no staff role, no company. Exactly the caller
 * `rosterProcedure` would reject, and exactly the person this feature is for.
 */
function volunteerCaller(over: Record<string, unknown> = {}) {
	return callerFactory({
		session: { user: { id: VOLUNTEER } },
		realSession: null,
		realUserId: VOLUNTEER,
		impersonation: null,
		orgId: null,
		role: null,
		companyId: null,
		companyRole: null,
		prisma: {} as never,
		sessionToken: null,
		ip: null,
		...over,
	} as Parameters<typeof callerFactory>[0]);
}

beforeEach(() => {
	vi.clearAllMocks();
	mocks.leaveOrgRoster.mockResolvedValue({ id: 'ov-1' });
	mocks.listMyOrgMemberships.mockResolvedValue([]);
});

describe('profile.leaveOrgRoster identity scoping', () => {
	it('SECURITY: takes userId from the session, and a smuggled one cannot override it', async () => {
		// The zod input declares only `volunteerId`, so an attacker-supplied
		// userId is stripped. Asserting the observable consequence, since the
		// stripping itself is invisible at the callsite.
		await volunteerCaller().leaveOrgRoster({
			volunteerId: 'ov-1',
			userId: 'user-victim',
		} as never);

		expect(mocks.leaveOrgRoster).toHaveBeenCalledWith(
			expect.objectContaining({ userId: VOLUNTEER, volunteerId: 'ov-1' }),
		);
		expect(mocks.leaveOrgRoster).not.toHaveBeenCalledWith(
			expect.objectContaining({ userId: 'user-victim' }),
		);
	});

	it('stamps impersonatedBy ONLY when the real admin differs from the effective user', async () => {
		// `ctx.realUserId` is set on every logged-in request. Stamping it
		// unconditionally marks every departure as impersonated and makes the
		// audit log's impersonatedOnly filter useless (see audit-actor.ts).
		await volunteerCaller().leaveOrgRoster({ volunteerId: 'ov-1' });
		expect(mocks.leaveOrgRoster).toHaveBeenCalledWith(
			expect.objectContaining({ impersonatedBy: null }),
		);

		mocks.leaveOrgRoster.mockClear();
		await volunteerCaller({ realUserId: 'real-admin' }).leaveOrgRoster({
			volunteerId: 'ov-1',
		});
		expect(mocks.leaveOrgRoster).toHaveBeenCalledWith(
			expect.objectContaining({
				userId: VOLUNTEER,
				impersonatedBy: 'real-admin',
			}),
		);
	});
});

describe('profile.leaveOrgRoster input validation', () => {
	it.each([
		['', 'empty'],
		['x'.repeat(65), 'over-long'],
	])('rejects a %s volunteerId before the service runs', async (volunteerId) => {
		// The bound is `orgVolunteerIdSchema` (min 1, max 64). An OrgVolunteer.id is
		// a 25-char cuid, so nothing legitimate is rejected; the point is that an
		// unbounded string never reaches a Prisma WHERE.
		await expect(
			volunteerCaller().leaveOrgRoster({ volunteerId }),
		).rejects.toMatchObject({ code: 'BAD_REQUEST' });

		expect(mocks.leaveOrgRoster).not.toHaveBeenCalled();
	});

	it('accepts a cuid-length id', async () => {
		await expect(
			volunteerCaller().leaveOrgRoster({ volunteerId: 'c'.repeat(25) }),
		).resolves.toEqual({ id: 'ov-1' });
	});
});

describe('the volunteer exit is not behind the roster pilot flag', () => {
	it('a volunteer with no org and no staff role can list and leave', async () => {
		// If either of these is ever moved onto `rosterProcedure`, this ctx —
		// orgId null, role null — starts throwing and the promise made by
		// sendRosterAddedEmail becomes unkeepable.
		await expect(
			volunteerCaller().listMyOrgMemberships(),
		).resolves.toBeDefined();
		await expect(
			volunteerCaller().leaveOrgRoster({ volunteerId: 'ov-1' }),
		).resolves.toEqual({ id: 'ov-1' });

		expect(mocks.listMyOrgMemberships).toHaveBeenCalledWith(VOLUNTEER);
	});
});
