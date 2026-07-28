/**
 * Router-level tests for `screener.claimApplication` / `claimableApplications`.
 *
 * `my-applications.claim.test.ts` proves the SERVICE refuses an application that
 * was not submitted under the email it is handed. Nothing proved the ROUTER
 * hands it the right one. That is the whole bug class this fix belongs to: the
 * email is the authorization predicate, and if it were ever sourced from the
 * procedure's INPUT rather than from the server-resolved session, the service
 * and the repository `where` clause would both faithfully authorize against an
 * address the caller chose — restoring the exact escalation the fix removed.
 *
 * Mirrors the caller-factory precedent in profile.access.test.ts / volunteers.test.ts.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	claimApplication: vi.fn(),
	listClaimableApplications: vi.fn(),
	listMyApplications: vi.fn(),
	getMyApplicationDetail: vi.fn(),
	getMyApplicationStatusTimeline: vi.fn(),
}));

vi.mock('@/server/repositories/prisma', () => ({
	prisma: {
		organization: {
			findUnique: vi.fn().mockResolvedValue({ suspendedAt: null }),
		},
	},
}));
vi.mock('@/server/auth', () => ({ authOptions: {} }));

vi.mock('@/server/services/my-applications', () => ({
	claimApplication: mocks.claimApplication,
	getMyApplicationDetail: mocks.getMyApplicationDetail,
	getMyApplicationStatusTimeline: mocks.getMyApplicationStatusTimeline,
	listClaimableApplications: mocks.listClaimableApplications,
	listMyApplications: mocks.listMyApplications,
}));

import { t } from '@/server/trpc/init';
import { screenerRouter } from './screener';

const callerFactory = t.createCallerFactory(screenerRouter);
const ACTOR_ID = 'user-actor';
const SESSION_EMAIL = 'victim@example.test';

function caller(user: { id?: string; email?: string | null } = {}) {
	return callerFactory({
		session: {
			user: { id: ACTOR_ID, email: SESSION_EMAIL, ...user },
		},
		realSession: null,
		realUserId: ACTOR_ID,
		impersonation: null,
		orgId: null,
		role: null,
		companyId: null,
		companyRole: null,
		prisma: {} as never,
		sessionToken: null,
		ip: null,
	} as Parameters<typeof callerFactory>[0]);
}

beforeEach(() => {
	vi.resetAllMocks();
	mocks.claimApplication.mockResolvedValue({ id: 'app-1' });
	mocks.listClaimableApplications.mockResolvedValue([]);
});

describe('screener.claimApplication', () => {
	it('SECURITY: passes ONLY the session user id — never an address from anywhere', async () => {
		// The email is resolved from this id inside the service. The router must
		// not hand one over at all: `createTRPCContext` builds the session as
		// `{ ...realSession.user, id: effectiveUserId }`, so under impersonation
		// `session.user.email` is the REAL ADMIN's address while `id` is the
		// target's. Forwarding that email would let an admin bind their own
		// planted application to the person they are impersonating — the exact
		// escalation this whole change removes.
		await caller().claimApplication({
			id: 'app-1',
			email: 'attacker@example.test',
			userId: 'someone-else',
		} as never);

		expect(mocks.claimApplication).toHaveBeenCalledWith(ACTOR_ID, 'app-1');
		// Two args exactly — no third positional carrying an address.
		expect(mocks.claimApplication.mock.calls[0]).toHaveLength(2);
	});

	it('SECURITY: a smuggled email in input never reaches the service', async () => {
		await caller().claimApplication({
			id: 'app-1',
			email: 'attacker@example.test',
		} as never);

		expect(JSON.stringify(mocks.claimApplication.mock.calls[0])).not.toContain(
			'attacker@example.test',
		);
	});

	it('SECURITY: does not forward the session email even when one is present', async () => {
		// Pins the impersonation fix specifically: session email set, and it must
		// still not appear in the service call.
		await caller({ email: 'real-admin@example.test' }).claimApplication({
			id: 'app-1',
		});

		expect(JSON.stringify(mocks.claimApplication.mock.calls[0])).not.toContain(
			'real-admin@example.test',
		);
	});
});

describe('screener.claimableApplications', () => {
	it('SECURITY: lists by session user id, not by session email', async () => {
		await caller().claimableApplications();

		expect(mocks.listClaimableApplications).toHaveBeenCalledWith(ACTOR_ID);
		expect(mocks.listClaimableApplications).not.toHaveBeenCalledWith(
			SESSION_EMAIL,
		);
	});

	it('SECURITY: an impersonated session resolves candidates for the TARGET id', async () => {
		// id = impersonation target, email = real admin (how init.ts builds it).
		await caller({
			id: 'impersonated-target',
			email: 'real-admin@example.test',
		}).claimableApplications();

		expect(mocks.listClaimableApplications).toHaveBeenCalledWith(
			'impersonated-target',
		);
	});
});
