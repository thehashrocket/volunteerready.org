/**
 * Router-level tests for volunteersRouter's audit attribution.
 *
 * `ctx.realUserId` is populated on EVERY logged-in request (trpc/init.ts:42),
 * not only impersonated ones. Passing it straight through as `impersonatedBy`
 * would stamp every audit row as impersonated and make `queryAuditLog`'s
 * `impersonatedOnly` filter match everything — silently destroying the ability
 * to answer "what did admins do while impersonating?".
 *
 * Mirrors the existing precedent in `esg-report.test.ts`.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	addVolunteer: vi.fn(),
	removeVolunteer: vi.fn(),
	restoreVolunteer: vi.fn(),
	getRoster: vi.fn(),
	getRosterCount: vi.fn(),
	getVolunteerDetail: vi.fn(),
	isFeatureEnabled: vi.fn(),
}));

vi.mock('@/server/services/featureFlagService', async () => {
	const { STAFF_CREATED_VOLUNTEERS_FLAG } = await import(
		'@/server/domain/feature-flags'
	);
	return {
		isFeatureEnabled: mocks.isFeatureEnabled,
		// A thin wrapper over isFeatureEnabled in the real module. Delegating
		// rather than mocking it outright keeps the flag-KEY assertions below
		// meaningful — otherwise they would only prove some helper was called.
		isRosterEnabledForOrg: (orgId: string) =>
			mocks.isFeatureEnabled(orgId, STAFF_CREATED_VOLUNTEERS_FLAG),
	};
});

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

vi.mock('@/server/services/staffVolunteerService', () => ({
	addVolunteer: mocks.addVolunteer,
	removeVolunteer: mocks.removeVolunteer,
	restoreVolunteer: mocks.restoreVolunteer,
	getRoster: mocks.getRoster,
	getRosterCount: mocks.getRosterCount,
	getVolunteerDetail: mocks.getVolunteerDetail,
}));

import { t } from '@/server/trpc/init';
import { volunteersRouter } from './volunteers';

const callerFactory = t.createCallerFactory(volunteersRouter);
const ORG_ID = 'org-1';
const ACTOR_ID = 'user-actor';
const REAL_ADMIN_ID = 'user-platform-admin';

function caller(overrides: { realUserId: string | null }) {
	return callerFactory({
		session: { user: { id: ACTOR_ID } },
		realSession: null,
		realUserId: overrides.realUserId,
		impersonation: null,
		orgId: ORG_ID,
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
	mocks.addVolunteer.mockResolvedValue({ outcome: 'CREATED_SHADOW' });
	mocks.removeVolunteer.mockResolvedValue({ id: 'ov-1' });
	mocks.restoreVolunteer.mockResolvedValue({ id: 'ov-1' });
	mocks.isFeatureEnabled.mockResolvedValue(true);
});

describe('volunteersRouter audit attribution', () => {
	it('sets impersonatedBy to null when NOT impersonating (realUserId === actor)', async () => {
		await caller({ realUserId: ACTOR_ID }).add({
			displayName: 'Ada Lovelace',
			email: 'ada@example.com',
			phone: null,
		});

		expect(mocks.addVolunteer).toHaveBeenCalledWith(
			expect.objectContaining({
				actorId: ACTOR_ID,
				impersonatedBy: null,
			}),
		);
	});

	it('stamps the real admin when impersonating (realUserId !== actor)', async () => {
		await caller({ realUserId: REAL_ADMIN_ID }).add({
			displayName: 'Ada Lovelace',
			email: 'ada@example.com',
			phone: null,
		});

		expect(mocks.addVolunteer).toHaveBeenCalledWith(
			expect.objectContaining({
				actorId: ACTOR_ID,
				impersonatedBy: REAL_ADMIN_ID,
			}),
		);
	});

	it('sets impersonatedBy to null when realUserId is missing', async () => {
		await caller({ realUserId: null }).add({
			displayName: 'Ada Lovelace',
			email: 'ada@example.com',
			phone: null,
		});

		expect(mocks.addVolunteer).toHaveBeenCalledWith(
			expect.objectContaining({ impersonatedBy: null }),
		);
	});

	it('applies the same rule to remove', async () => {
		await caller({ realUserId: REAL_ADMIN_ID }).remove({ volunteerId: 'ov-1' });
		expect(mocks.removeVolunteer).toHaveBeenCalledWith(
			expect.objectContaining({ impersonatedBy: REAL_ADMIN_ID }),
		);

		vi.clearAllMocks();
		await caller({ realUserId: ACTOR_ID }).remove({ volunteerId: 'ov-1' });
		expect(mocks.removeVolunteer).toHaveBeenCalledWith(
			expect.objectContaining({ impersonatedBy: null }),
		);
	});

	it('applies the same rule to restore', async () => {
		await caller({ realUserId: REAL_ADMIN_ID }).restore({
			volunteerId: 'ov-1',
		});
		expect(mocks.restoreVolunteer).toHaveBeenCalledWith(
			expect.objectContaining({ impersonatedBy: REAL_ADMIN_ID }),
		);
	});

	it('SECURITY: scopes every mutation to ctx.orgId, never to input', async () => {
		// orgProcedure guarantees ctx.orgId is the caller's own org. Nothing here
		// accepts an orgId from input, so a caller cannot address another tenant.
		await caller({ realUserId: ACTOR_ID }).remove({ volunteerId: 'ov-1' });
		expect(mocks.removeVolunteer).toHaveBeenCalledWith(
			expect.objectContaining({ orgId: ORG_ID }),
		);
	});
});

describe('volunteersRouter getById', () => {
	beforeEach(() => {
		mocks.getVolunteerDetail.mockResolvedValue({
			id: 'ov-1',
			displayName: 'Maria Garcia',
			email: 'maria@example.com',
			phone: null,
			accountState: 'UNCLAIMED',
			source: 'STAFF_ADDED',
			addedAt: new Date('2026-03-01T00:00:00Z'),
			totalHours: 0,
			shifts: [],
		});
	});

	it('SECURITY: pairs the input volunteerId with ctx.orgId, never an input org', async () => {
		// The whole authorization argument for this procedure is that the service
		// resolves the row through a WHERE carrying this orgId, so a crafted id
		// from another tenant misses. That only holds if the org comes from ctx.
		await caller({ realUserId: ACTOR_ID }).getById({ volunteerId: 'ov-1' });

		expect(mocks.getVolunteerDetail).toHaveBeenCalledWith({
			orgId: ORG_ID,
			volunteerId: 'ov-1',
		});
	});

	it('SECURITY: rejects a volunteerId longer than the id bound', async () => {
		// orgVolunteerIdSchema exists so this input is not an unbounded string.
		await expect(
			caller({ realUserId: ACTOR_ID }).getById({
				volunteerId: 'x'.repeat(65),
			}),
		).rejects.toMatchObject({ code: 'BAD_REQUEST' });
		expect(mocks.getVolunteerDetail).not.toHaveBeenCalled();
	});
});

describe('volunteersRouter add response shape', () => {
	// REGRESSION: the router originally returned the internal AddVolunteerOutcome
	// straight to the client. The UI rendered identical copy for CREATED_SHADOW
	// and LINKED_UNCLAIMED, but the JSON response named them differently — so a
	// coordinator with devtools open could read `LINKED_UNCLAIMED` and learn that
	// another organisation already had this person on its roster. That is the
	// cross-org membership disclosure Security §7 refused, leaking below the UI.
	it('SECURITY: never returns the internal outcome enum to the client', async () => {
		for (const outcome of [
			'CREATED_SHADOW',
			'LINKED_UNCLAIMED',
			'LINKED_ACTIVE',
		]) {
			mocks.addVolunteer.mockResolvedValue({
				outcome,
				volunteerId: 'ov-1',
				userId: 'u-1',
				displayName: 'Ava Thompson',
				notify: outcome === 'LINKED_ACTIVE',
			});

			const result = await caller({ realUserId: ACTOR_ID }).add({
				displayName: 'Ava Thompson',
				email: 'ava@example.com',
				phone: null,
			});

			expect(result).not.toHaveProperty('outcome');
			expect(JSON.stringify(result)).not.toContain('UNCLAIMED');
			expect(JSON.stringify(result)).not.toContain('CREATED_SHADOW');
		}
	});

	it('SECURITY: both silent branches produce a byte-identical response', async () => {
		async function responseFor(outcome: string) {
			mocks.addVolunteer.mockResolvedValue({
				outcome,
				volunteerId: 'ov-1',
				userId: 'u-1',
				displayName: 'Ava Thompson',
				notify: false,
			});
			return caller({ realUserId: ACTOR_ID }).add({
				displayName: 'Ava Thompson',
				email: 'ava@example.com',
				phone: null,
			});
		}

		const shadow = await responseFor('CREATED_SHADOW');
		const unclaimed = await responseFor('LINKED_UNCLAIMED');

		expect(JSON.stringify(shadow)).toBe(JSON.stringify(unclaimed));
	});

	it('still tells the client when an email went out', async () => {
		mocks.addVolunteer.mockResolvedValue({
			outcome: 'LINKED_ACTIVE',
			volunteerId: 'ov-1',
			userId: 'u-1',
			displayName: 'Maria Garcia',
			notify: true,
		});

		const result = await caller({ realUserId: ACTOR_ID }).add({
			displayName: 'Maria Garcia',
			email: 'maria@example.com',
			phone: null,
		});

		expect(result).toMatchObject({
			notified: true,
			displayName: 'Maria Garcia',
		});
	});
});

describe('volunteersRouter feature-flag gate', () => {
	// REGRESSION: the flag was originally enforced ONLY in two Server Component
	// layouts. Every procedure here is a live HTTP endpoint, so a STAFF user at a
	// non-enabled org could POST straight to tRPC and mint a global User row plus
	// send outbound mail to a third party — entirely around the kill switch.
	// A kill switch that does not cover the mutation surface is not a kill switch.
	it.each([
		'list',
		'count',
		'getById',
		'add',
		'remove',
		'restore',
	] as const)('SECURITY: %s is FORBIDDEN when the flag is off', async (procedure) => {
		mocks.isFeatureEnabled.mockResolvedValue(false);
		const c = caller({ realUserId: ACTOR_ID });

		const input =
			procedure === 'add'
				? { displayName: 'Ada', email: 'ada@example.com', phone: null }
				: procedure === 'list'
					? { cursor: null, search: null }
					: { volunteerId: 'ov-1' };

		// biome-ignore lint/suspicious/noExplicitAny: dynamic procedure dispatch
		const call = (c as any)[procedure];
		await expect(
			procedure === 'count' ? call() : call(input),
		).rejects.toMatchObject({ code: 'FORBIDDEN' });
	});

	it('SECURITY: no side effect runs when the flag is off', async () => {
		mocks.isFeatureEnabled.mockResolvedValue(false);

		await expect(
			caller({ realUserId: ACTOR_ID }).add({
				displayName: 'Ada',
				email: 'ada@example.com',
				phone: null,
			}),
		).rejects.toMatchObject({ code: 'FORBIDDEN' });

		// The service must never be reached — no shadow User, no email.
		expect(mocks.addVolunteer).not.toHaveBeenCalled();
	});

	it('gates against the CALLING org', async () => {
		await caller({ realUserId: ACTOR_ID }).count();
		expect(mocks.isFeatureEnabled).toHaveBeenCalledWith(
			ORG_ID,
			'staff_created_volunteers',
		);
	});
});
