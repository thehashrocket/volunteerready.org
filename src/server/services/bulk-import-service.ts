import { waitUntil } from '@vercel/functions';
import { ApplicationStatus } from '@/prisma/generated/client';
import { writeAuditLogTx } from '@/server/repositories/auditRepo';
import { prisma } from '@/server/repositories/prisma';

// ---------------------------------------------------------------------------
// CSV parsing
// ---------------------------------------------------------------------------

interface CsvRow {
	email: string;
	opportunityId?: string;
}

interface ParseResult {
	rows: CsvRow[];
	errors: Array<{ row: number; error: string }>;
}

/**
 * Parse a CSV string into rows. Expected columns: email (required),
 * opportunityId (optional). First row is treated as a header.
 */
export function parseCsv(csv: string): ParseResult {
	const lines = csv
		.split('\n')
		.map((l) => l.trim())
		.filter((l) => l.length > 0);

	if (lines.length < 2) {
		return { rows: [], errors: [{ row: 1, error: 'No data rows found' }] };
	}

	const headerLine = lines[0];
	if (!headerLine) {
		return { rows: [], errors: [{ row: 1, error: 'No header row found' }] };
	}
	const header = headerLine
		.toLowerCase()
		.split(',')
		.map((h) => h.trim());
	const emailIdx = header.indexOf('email');
	if (emailIdx === -1) {
		return {
			rows: [],
			errors: [{ row: 1, error: 'Missing required "email" column' }],
		};
	}
	const oppIdx = header.indexOf('opportunityid');

	const rows: CsvRow[] = [];
	const errors: Array<{ row: number; error: string }> = [];

	for (let i = 1; i < lines.length; i++) {
		const line = lines[i];
		if (!line) continue;
		const cols = line.split(',').map((c) => c.trim());
		const email = cols[emailIdx]?.toLowerCase() ?? '';

		if (!email?.includes('@')) {
			errors.push({ row: i + 1, error: `Invalid email: "${email}"` });
			continue;
		}

		rows.push({
			email,
			opportunityId: oppIdx >= 0 ? cols[oppIdx] || undefined : undefined,
		});
	}

	return { rows, errors };
}

// ---------------------------------------------------------------------------
// Import processing
// ---------------------------------------------------------------------------

export async function createBulkImportJob(opts: {
	orgId: string;
	uploadedById: string;
	fileName: string;
	csvContent: string;
}) {
	const { rows, errors } = parseCsv(opts.csvContent);

	const job = await prisma.bulkImportJob.create({
		data: {
			orgId: opts.orgId,
			uploadedById: opts.uploadedById,
			fileName: opts.fileName,
			status: 'PENDING',
			totalRows: rows.length,
			errorRows: errors.length > 0 ? errors : undefined,
		},
	});

	// Process asynchronously — waitUntil keeps the function alive on Vercel serverless
	waitUntil(processImportJob(job.id, opts.orgId, rows, errors));

	return { jobId: job.id, totalRows: rows.length, parseErrors: errors.length };
}

async function processImportJob(
	jobId: string,
	orgId: string,
	rows: CsvRow[],
	existingErrors: Array<{ row: number; error: string }>,
) {
	try {
		await prisma.bulkImportJob.update({
			where: { id: jobId },
			data: { status: 'PROCESSING' },
		});

		let createdRows = 0;
		let skippedRows = 0;
		let processedRows = 0;
		const errors = [...existingErrors];

		for (const row of rows) {
			processedRows++;

			try {
				// Check for duplicate (same email + org)
				const existing = await prisma.volunteerApplication.findFirst({
					where: { orgId, submittedByEmail: row.email },
					select: { id: true },
				});

				if (existing) {
					skippedRows++;
					continue;
				}

				// Validate opportunityId if provided
				let validOppId: string | null = null;
				if (row.opportunityId) {
					const opp = await prisma.volunteerOpportunity.findFirst({
						where: { id: row.opportunityId, orgId, status: 'PUBLISHED' },
						select: { id: true },
					});
					validOppId = opp?.id ?? null;
				}

				await prisma.$transaction(async (tx) => {
					const app = await tx.volunteerApplication.create({
						data: {
							orgId,
							submittedByEmail: row.email,
							status: ApplicationStatus.SUBMITTED,
							screeningStatus: 'REVIEW',
							opportunityId: validOppId,
						},
					});

					await writeAuditLogTx(tx, {
						orgId,
						action: 'volunteer_application.bulk_imported',
						entityType: 'VolunteerApplication',
						entityId: app.id,
						metadata: {
							bulkImportJobId: jobId,
							submittedByEmail: row.email,
						},
					});
				});

				createdRows++;
			} catch (err) {
				errors.push({
					row: processedRows + 1,
					error: err instanceof Error ? err.message : 'Unknown error',
				});
			}

			// Update progress every 50 rows
			if (processedRows % 50 === 0) {
				await prisma.bulkImportJob.update({
					where: { id: jobId },
					data: { processedRows, createdRows, skippedRows, errorRows: errors },
				});
			}
		}

		await prisma.bulkImportJob.update({
			where: { id: jobId },
			data: {
				status: 'COMPLETED',
				processedRows,
				createdRows,
				skippedRows,
				errorRows: errors.length > 0 ? errors : undefined,
			},
		});
	} catch (err) {
		console.error(`[bulk-import] Job ${jobId} failed:`, err);
		await prisma.bulkImportJob.update({
			where: { id: jobId },
			data: {
				status: 'FAILED',
				errorRows: [
					{
						row: 0,
						error: err instanceof Error ? err.message : 'Unknown error',
					},
				],
			},
		});
	}
}

// ---------------------------------------------------------------------------
// Query
// ---------------------------------------------------------------------------

export async function getImportJob(jobId: string, orgId: string) {
	return prisma.bulkImportJob.findFirst({
		where: { id: jobId, orgId },
	});
}

export async function listImportJobs(orgId: string) {
	return prisma.bulkImportJob.findMany({
		where: { orgId },
		orderBy: { createdAt: 'desc' },
		take: 20,
		select: {
			id: true,
			status: true,
			fileName: true,
			totalRows: true,
			createdRows: true,
			skippedRows: true,
			processedRows: true,
			createdAt: true,
		},
	});
}
