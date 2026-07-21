import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
	mockWriteAuditLog,
	mockFindCompanyById,
	mockGetESGCredentialCounts,
	mockGetESGDistinctEmployeeCount,
	mockGetESGShiftAggregates,
} = vi.hoisted(() => ({
	mockWriteAuditLog: vi.fn(),
	mockFindCompanyById: vi.fn(),
	mockGetESGCredentialCounts: vi.fn(),
	mockGetESGDistinctEmployeeCount: vi.fn(),
	mockGetESGShiftAggregates: vi.fn(),
}));

vi.mock('@/server/repositories/auditRepo', () => ({
	writeAuditLog: mockWriteAuditLog,
}));

vi.mock('@/server/repositories/companyRepo', () => ({
	findCompanyById: mockFindCompanyById,
	getESGCredentialCounts: mockGetESGCredentialCounts,
	getESGDistinctEmployeeCount: mockGetESGDistinctEmployeeCount,
	getESGShiftAggregates: mockGetESGShiftAggregates,
}));

import { generateESGReport } from './employerReportService';

const COMPANY_ID = 'company-1';
const ACTOR_ID = 'target-1';
const ADMIN_ID = 'admin-1';

beforeEach(() => {
	vi.clearAllMocks();
	mockFindCompanyById.mockResolvedValue({ id: COMPANY_ID, name: 'Acme Corp' });
	mockGetESGShiftAggregates.mockResolvedValue([]);
	mockGetESGCredentialCounts.mockResolvedValue([]);
	mockGetESGDistinctEmployeeCount.mockResolvedValue(0);
	mockWriteAuditLog.mockResolvedValue({ id: 'audit-1' });
});

describe('generateESGReport — impersonatedBy audit metadata', () => {
	it('includes impersonatedBy in the audit metadata when impersonating', async () => {
		await generateESGReport({
			companyId: COMPANY_ID,
			actorId: ACTOR_ID,
			impersonatedBy: ADMIN_ID,
			dateRange: { from: null, to: null },
		});

		expect(mockWriteAuditLog).toHaveBeenCalledWith(
			expect.objectContaining({
				actorId: ACTOR_ID,
				action: 'esg_report.generated',
				metadata: expect.objectContaining({ impersonatedBy: ADMIN_ID }),
			}),
		);
	});

	it('omits impersonatedBy from the audit metadata when not impersonating', async () => {
		await generateESGReport({
			companyId: COMPANY_ID,
			actorId: ACTOR_ID,
			impersonatedBy: null,
			dateRange: { from: null, to: null },
		});

		const call = mockWriteAuditLog.mock.calls[0][0];
		expect(call.metadata).not.toHaveProperty('impersonatedBy');
	});

	it('omits impersonatedBy when the option is not passed at all', async () => {
		await generateESGReport({
			companyId: COMPANY_ID,
			actorId: ACTOR_ID,
			dateRange: { from: null, to: null },
		});

		const call = mockWriteAuditLog.mock.calls[0][0];
		expect(call.metadata).not.toHaveProperty('impersonatedBy');
	});
});
