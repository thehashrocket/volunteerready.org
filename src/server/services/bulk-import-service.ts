import { waitUntil } from '@vercel/functions';
import { ApplicationStatus } from '@/prisma/generated/client';
import {
	CsvFormatError,
	type CsvRecord,
	parseCsvRecords,
} from '@/server/domain/csv';
import { writeAuditLogTx } from '@/server/repositories/auditRepo';
import { prisma } from '@/server/repositories/prisma';

// ---------------------------------------------------------------------------
// CSV parsing
// ---------------------------------------------------------------------------

interface CsvRow {
	/**
	 * 1-indexed line in the source file.
	 *
	 * Carried through to `processImportJob` so a PROCESSING error reports the
	 * same coordinate a PARSE error does. Before this, processing errors were
	 * numbered by position in the surviving-rows array, so one `errorRows` column
	 * held two incompatible schemes — and they could collide, reporting two
	 * different problems as "row 3".
	 */
	line: number;
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
 *
 * Uses the shared RFC 4180 parser in `domain/csv.ts` — the same one the roster
 * importer reads through. This used to be `line.split(',')`, which shifts every
 * later column left the moment a quoted field contains a comma; real
 * spreadsheets contain `"Smith, Jane"`. The damage here was narrower than on the
 * roster (an email cannot contain a comma, so only `opportunityId` read as
 * garbage) but two CSV parsers is where one of them stops being maintained.
 *
 * Never throws for a malformed FILE. `parseCsvRecords` raises `CsvFormatError`
 * for an unterminated quote, and that is caught and returned as an error row
 * instead: the only caller is a tRPC mutation that records the outcome on a
 * `BulkImportJob`, so a job saying "unterminated quote starting on line 12" is
 * strictly better than an uncaught 500 that tells the coordinator nothing. The
 * roster importer re-throws on the same input because it has a file-level
 * handler and a terminal to print to; this one has a job record.
 *
 * Anything OTHER than a `CsvFormatError` is still re-thrown — there is no such
 * case today, and swallowing an unknown fault into an error row would hide a
 * real bug behind a coordinator-facing "bad CSV" message.
 *
 * `row` is the TRUE 1-indexed line in the file for a per-row error. It used to
 * be an index into a blank-line-filtered array, so any blank line shifted every
 * reported number — which an operator uses to find the row to fix. A FILE-level
 * error reports row 1 and names the real line in its message, since it has no
 * single row to attribute to.
 */
export function parseCsv(csv: string): ParseResult {
	let records: CsvRecord[];
	try {
		records = parseCsvRecords(csv);
	} catch (err) {
		if (err instanceof CsvFormatError) {
			return { rows: [], errors: [{ row: 1, error: err.message }] };
		}
		throw err;
	}

	const headerRecord = records[0];
	if (!headerRecord) {
		return { rows: [], errors: [{ row: 1, error: 'No header row found' }] };
	}
	if (records.length < 2) {
		return { rows: [], errors: [{ row: 1, error: 'No data rows found' }] };
	}

	const header = headerRecord.fields.map((h) => h.trim().toLowerCase());
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

	for (const { line, fields } of records.slice(1)) {
		// `parseCsvRecords` drops a record only when its single field is exactly
		// '', so a whitespace-only line survives where the old `.trim()`-then-
		// filter dropped it — and would be reported as `Invalid email: ""`,
		// inflating the parse-error count the upload page renders. Also catches
		// the `,,,` padding rows spreadsheet exports append.
		if (fields.every((f) => f.trim() === '')) continue;

		// Trimmed and lowercased exactly as before — `parseCsvRecords` is a
		// tokenizer and normalizes nothing, so dropping this would let leading
		// whitespace and mixed case reach `submittedByEmail`, which is stored
		// canonical.
		const email = (fields[emailIdx] ?? '').trim().toLowerCase();

		if (!email.includes('@')) {
			errors.push({ row: line, error: `Invalid email: "${email}"` });
			continue;
		}

		const opportunityId =
			oppIdx >= 0 ? (fields[oppIdx] ?? '').trim() || undefined : undefined;

		rows.push({ line, email, opportunityId });
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
				// The row's own file line, not its position in the surviving-rows
				// array. Those diverge the moment any row fails to parse, so the
				// persisted `errorRows` used to mix two numbering schemes — and they
				// collide: a parse error on line 3 and a processing failure on line 4
				// were both reported as "row 3".
				errors.push({
					row: row.line,
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
