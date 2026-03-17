// ---------------------------------------------------------------------------
// Employer Report Service — ESG report generation
// ---------------------------------------------------------------------------

import type { ESGOrgRow, ESGReportSummary } from '@/server/domain/esg-report';
import { computeESGSummary, formatESGCsv } from '@/server/domain/esg-report';
import { writeAuditLog } from '@/server/repositories/auditRepo';
import {
	findCompanyById,
	getESGCredentialCounts,
	getESGDistinctEmployeeCount,
	getESGShiftAggregates,
} from '@/server/repositories/companyRepo';

type GenerateOpts = {
	companyId: string;
	actorId: string;
	dateRange: { from?: Date | null; to?: Date | null };
};

/**
 * Generate an ESG report summary for a company.
 *
 * 1. Fetch company name
 * 2. Run 3 aggregate queries in parallel (shifts, credentials, distinct employees)
 * 3. Bidirectional merge: shift rows + credential-only orgs
 * 4. Compute summary totals
 * 5. Audit log (best-effort)
 */
export async function generateESGReport(
	opts: GenerateOpts,
): Promise<ESGReportSummary> {
	const { companyId, actorId, dateRange } = opts;

	const company = await findCompanyById(companyId);
	if (!company) {
		throw new Error(`Company not found: ${companyId}`);
	}

	// Parallel independent queries
	const [shiftRows, credentialRows, distinctEmployeeCount] = await Promise.all([
		getESGShiftAggregates(companyId, dateRange),
		getESGCredentialCounts(companyId),
		getESGDistinctEmployeeCount(companyId, dateRange),
	]);

	// Bidirectional merge: start from shift rows, overlay credentials,
	// then add credential-only orgs with zero shift data
	const rowMap = new Map<string, ESGOrgRow>();

	for (const sr of shiftRows) {
		rowMap.set(sr.orgId, {
			orgId: sr.orgId,
			orgName: sr.orgName,
			employeeCount: sr.employeeCount,
			shiftCount: sr.shiftCount,
			totalHours: sr.totalHours,
			verifiedCredentialCount: 0,
		});
	}

	for (const cr of credentialRows) {
		const existing = rowMap.get(cr.orgId);
		if (existing) {
			existing.verifiedCredentialCount = cr.verifiedCredentialCount;
		} else {
			// Credential-only org (no attended shifts)
			rowMap.set(cr.orgId, {
				orgId: cr.orgId,
				orgName: cr.orgName,
				employeeCount: 0,
				shiftCount: 0,
				totalHours: 0,
				verifiedCredentialCount: cr.verifiedCredentialCount,
			});
		}
	}

	const rows = Array.from(rowMap.values()).sort((a, b) =>
		a.orgName.localeCompare(b.orgName),
	);

	const summary: ESGReportSummary = {
		companyId,
		companyName: company.name,
		generatedAt: new Date(),
		dateRange: { from: dateRange.from ?? null, to: dateRange.to ?? null },
		...computeESGSummary(rows, distinctEmployeeCount),
		rows,
	};

	// Audit log — best-effort (await + catch)
	try {
		await writeAuditLog({
			companyId,
			actorId,
			action: 'esg_report.generated',
			entityType: 'ESGReport',
			metadata: {
				dateRange: {
					from: dateRange.from?.toISOString() ?? null,
					to: dateRange.to?.toISOString() ?? null,
				},
				totalOrgs: summary.totalOrgsSupported,
				totalHours: summary.totalHours,
			},
		});
	} catch (err) {
		console.error('[ESG] Audit log write failed', {
			companyId,
			actorId,
			error: err instanceof Error ? err.message : String(err),
		});
	}

	return summary;
}

/**
 * Generate ESG report and format as CSV string.
 */
export async function generateESGCsvExport(
	opts: GenerateOpts,
): Promise<string> {
	const summary = await generateESGReport(opts);
	return formatESGCsv(summary);
}
