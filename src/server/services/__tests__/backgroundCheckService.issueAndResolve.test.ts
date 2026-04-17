import { TRPCError } from '@trpc/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock modules before importing the service under test
// ---------------------------------------------------------------------------

const mockFindBackgroundCheckById = vi.fn();
const mockUpdateMany = vi.fn();
const mockUpsertCredential = vi.fn();
const mockWriteAuditLogTx = vi.fn();

vi.mock('@/server/repositories/backgroundCheckRepo', () => ({
	findBackgroundCheckById: (...args: unknown[]) =>
		mockFindBackgroundCheckById(...args),
	createBackgroundCheckRequestTx: vi.fn(),
}));

vi.mock('@/server/repositories/volunteerCredentialRepo', () => ({
	upsertCredential: (...args: unknown[]) => mockUpsertCredential(...args),
	findCredentialByUserOrgType: vi.fn(),
}));

vi.mock('@/server/repositories/auditRepo', () => ({
	writeAuditLogTx: (...args: unknown[]) => mockWriteAuditLogTx(...args),
}));

vi.mock('@/server/repositories/prisma', () => ({
	prisma: {
		$transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
			const fakeTx = {
				backgroundCheckRequest: { updateMany: mockUpdateMany },
				volunteerCredential: {
					upsert: vi.fn().mockResolvedValue({ id: 'cred-1' }),
				},
			};
			return fn(fakeTx);
		}),
	},
}));

// Prevent side-effect imports from blowing up
vi.mock('@/server/lib/adapters/background-check/registry', () => ({
	getBackgroundCheckAdapter: vi.fn(),
}));
vi.mock('@/server/repositories/sendFcraEmails', () => ({
	sendAdverseActionEmail: vi.fn(),
	sendPreAdverseActionEmail: vi.fn(),
}));
vi.mock('@/server/services/tenureBadgeService', () => ({
	checkAndIssueTenureBadges: vi.fn(),
}));

import { issueCredentialAndResolveFcra } from '../backgroundCheckService';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const baseRequest = {
	id: 'req-1',
	orgId: 'org-1',
	userId: 'user-1',
	status: 'CONSIDER',
	fcraStatus: 'NONE',
};

beforeEach(() => {
	vi.clearAllMocks();
	mockFindBackgroundCheckById.mockResolvedValue({ ...baseRequest });
	mockUpsertCredential.mockResolvedValue({ id: 'cred-1' });
	mockWriteAuditLogTx.mockResolvedValue({ id: 'audit-1' });
	mockUpdateMany.mockResolvedValue({ count: 1 });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('issueCredentialAndResolveFcra', () => {
	it('issues credential and resolves FCRA in a single transaction', async () => {
		await issueCredentialAndResolveFcra('req-1', 'org-1', 'actor-1', {});

		// Credential issued with correct type+status
		expect(mockUpsertCredential).toHaveBeenCalledOnce();
		const [, credArgs] = mockUpsertCredential.mock.calls[0]!;
		expect(credArgs).toMatchObject({
			userId: 'user-1',
			orgId: 'org-1',
			type: 'BACKGROUND_CHECK',
			status: 'VERIFIED',
			issuedById: 'actor-1',
		});

		// Status + FCRA resolved via CAS update
		expect(mockUpdateMany).toHaveBeenCalledOnce();
		expect(mockUpdateMany.mock.calls[0]?.[0]).toMatchObject({
			where: {
				id: 'req-1',
				status: 'CONSIDER',
				fcraStatus: { in: ['NONE', 'PRE_ADVERSE_SENT'] },
			},
			data: { status: 'COMPLETE', fcraStatus: 'RESOLVED' },
		});

		// Two audit log entries written (credential + FCRA)
		expect(mockWriteAuditLogTx).toHaveBeenCalledTimes(2);
	});

	it('passes notes and expiresAt to the credential', async () => {
		const expires = new Date('2027-01-01');
		await issueCredentialAndResolveFcra('req-1', 'org-1', 'actor-1', {
			notes: 'Clear with minor record',
			expiresAt: expires,
		});

		const [, credArgs] = mockUpsertCredential.mock.calls[0]!;
		expect(credArgs.notes).toBe('Clear with minor record');
		expect(credArgs.expiresAt).toBe(expires);
	});

	it('throws NOT_FOUND when request does not exist', async () => {
		mockFindBackgroundCheckById.mockResolvedValue(null);

		await expect(
			issueCredentialAndResolveFcra('req-missing', 'org-1', 'actor-1', {}),
		).rejects.toThrow(TRPCError);
	});

	it('throws NOT_FOUND when request belongs to a different org', async () => {
		mockFindBackgroundCheckById.mockResolvedValue({
			...baseRequest,
			orgId: 'org-other',
		});

		await expect(
			issueCredentialAndResolveFcra('req-1', 'org-1', 'actor-1', {}),
		).rejects.toThrow(TRPCError);
	});

	it('throws BAD_REQUEST when status is not CONSIDER', async () => {
		mockFindBackgroundCheckById.mockResolvedValue({
			...baseRequest,
			status: 'COMPLETE',
		});

		await expect(
			issueCredentialAndResolveFcra('req-1', 'org-1', 'actor-1', {}),
		).rejects.toThrow(/Cannot issue credential/);
	});

	it('throws BAD_REQUEST when FCRA status is RESOLVED (already resolved)', async () => {
		mockFindBackgroundCheckById.mockResolvedValue({
			...baseRequest,
			fcraStatus: 'RESOLVED',
		});

		await expect(
			issueCredentialAndResolveFcra('req-1', 'org-1', 'actor-1', {}),
		).rejects.toThrow(/Cannot resolve FCRA/);
	});

	it('throws BAD_REQUEST when FCRA status is ADVERSE_ACTION_SENT', async () => {
		mockFindBackgroundCheckById.mockResolvedValue({
			...baseRequest,
			fcraStatus: 'ADVERSE_ACTION_SENT',
		});

		await expect(
			issueCredentialAndResolveFcra('req-1', 'org-1', 'actor-1', {}),
		).rejects.toThrow(/Cannot resolve FCRA/);
	});

	it('throws CONFLICT on CAS race (status or FCRA changed concurrently)', async () => {
		mockUpdateMany.mockResolvedValue({ count: 0 });

		await expect(
			issueCredentialAndResolveFcra('req-1', 'org-1', 'actor-1', {}),
		).rejects.toThrow(/already changed/);
	});

	it('works when fcraStatus is PRE_ADVERSE_SENT', async () => {
		mockFindBackgroundCheckById.mockResolvedValue({
			...baseRequest,
			fcraStatus: 'PRE_ADVERSE_SENT',
		});

		await issueCredentialAndResolveFcra('req-1', 'org-1', 'actor-1', {});

		expect(mockUpsertCredential).toHaveBeenCalledOnce();
		expect(mockUpdateMany).toHaveBeenCalledOnce();
	});
});
