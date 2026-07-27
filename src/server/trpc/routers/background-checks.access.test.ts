/**
 * Router-level org-scoping test for backgroundChecks.initiate.
 *
 * The service test proves `initiateProviderCheck` refuses a volunteer unrelated
 * to the `orgId` it is HANDED. Nothing proved the router hands it the right
 * one — and this is the highest-stakes of the guarded procedures: it ships a
 * candidate's SSN and date of birth to a paid third-party API. If `orgId` were
 * ever sourced from client input rather than the server-resolved `ctx`, the
 * guard would faithfully authorize against an org the caller chose.
 *
 * Mirrors profile.access.test.ts / credentials.access.test.ts.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	initiateBackgroundCheck: vi.fn(),
	getOrgPlanTier: vi.fn(),
}));

vi.mock('@/server/repositories/prisma', () => ({
	prisma: {
		organization: {
			findUnique: vi.fn().mockResolvedValue({ suspendedAt: null }),
		},
	},
}));
vi.mock('@/server/auth', () => ({ authOptions: {} }));

// planTierProcedure('PRO') reads the org's tier via orgRepo before the
// role check runs; return PRO so the procedure reaches the service call.
vi.mock('@/server/repositories/orgRepo', () => ({
	getOrgPlanTier: mocks.getOrgPlanTier,
}));

vi.mock('@/server/services/backgroundCheckService', () => ({
	initiateBackgroundCheck: mocks.initiateBackgroundCheck,
	cancelBackgroundCheck: vi.fn(),
	connectSterlingAccount: vi.fn(),
	disconnectCheckrAccount: vi.fn(),
	disconnectSterlingAccount: vi.fn(),
	finalizeAdverseAction: vi.fn(),
	getCheckrConnectionStatus: vi.fn(),
	getSterlingConnectionStatus: vi.fn(),
	issueCredentialAndResolveFcra: vi.fn(),
	listOrgBackgroundChecks: vi.fn(),
	resolveFcra: vi.fn(),
	sendPreAdverseNotice: vi.fn(),
}));

import { t } from '@/server/trpc/init';
import { backgroundChecksRouter } from './background-checks';

const callerFactory = t.createCallerFactory(backgroundChecksRouter);
const CTX_ORG_ID = 'org-from-context';
const ACTOR_ID = 'user-actor';

const PII = {
	firstName: 'Jane',
	lastName: 'Doe',
	email: 'jane@example.com',
	dob: '1990-01-01',
	ssn: '123456789',
};

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
	mocks.getOrgPlanTier.mockResolvedValue('PRO');
	mocks.initiateBackgroundCheck.mockResolvedValue({ requestId: 'req-1' });
});

describe('backgroundChecks.initiate org scoping', () => {
	it('SECURITY: initiates against ctx.orgId, not anything client-supplied', async () => {
		await caller().initiate({ userId: 'user-target', pii: PII });

		expect(mocks.initiateBackgroundCheck).toHaveBeenCalledWith(
			expect.objectContaining({
				userId: 'user-target',
				orgId: CTX_ORG_ID,
				actorId: ACTOR_ID,
			}),
		);
	});

	it('SECURITY: an orgId smuggled into the input cannot redirect the check', async () => {
		await caller().initiate({
			userId: 'user-target',
			pii: PII,
			orgId: 'org-attacker',
		} as never);

		expect(mocks.initiateBackgroundCheck).toHaveBeenCalledWith(
			expect.objectContaining({ orgId: CTX_ORG_ID }),
		);
		expect(mocks.initiateBackgroundCheck).not.toHaveBeenCalledWith(
			expect.objectContaining({ orgId: 'org-attacker' }),
		);
	});
});
