import { type NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/server/auth';
import { esgReportInputSchema } from '@/server/domain/esg-report';
import {
	CompanyAccessDeniedError,
	requireCompanyAccess,
} from '@/server/services/companyAccessService';
import { generateESGPdfExport } from '@/server/services/employerReportService';

type SessionExt = { user?: { id?: string } };

// Intersect with the domain schema so the exports enforce the same
// from <= to refine as the tRPC path (an inverted range would otherwise
// return a legitimate-looking all-zeros report).
const paramsSchema = z
	.object({ companyId: z.string().min(1) })
	.and(esgReportInputSchema);

export async function GET(req: NextRequest) {
	// 1. Auth — session required
	const session = await getServerSession(authOptions);
	const sessionExt = session as (typeof session & SessionExt) | null;
	const userId = sessionExt?.user?.id;

	if (!userId) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	}

	// 2. Parse & validate search params
	const { searchParams } = req.nextUrl;
	const parsed = paramsSchema.safeParse({
		companyId: searchParams.get('companyId'),
		from: searchParams.get('from') || undefined,
		to: searchParams.get('to') || undefined,
	});

	if (!parsed.success) {
		return NextResponse.json(
			{ error: 'Invalid parameters', details: parsed.error.flatten() },
			{ status: 400 },
		);
	}

	const { companyId, from, to } = parsed.data;

	// 3. Auth — membership + role + plan tier, checked against companyId as
	// passed in the request (never session state)
	try {
		await requireCompanyAccess({
			userId,
			companyId,
			minRole: 'ADMIN',
			minPlanTier: 'PRO',
		});
	} catch (err) {
		if (err instanceof CompanyAccessDeniedError) {
			return NextResponse.json({ error: err.message }, { status: 403 });
		}
		throw err;
	}

	// 4. Generate PDF
	try {
		const pdf = await generateESGPdfExport({
			companyId,
			actorId: userId,
			dateRange: { from: from ?? null, to: to ?? null },
		});

		const filename = `esg-report-${companyId}-${new Date().toISOString().split('T')[0]}.pdf`;

		return new Response(new Uint8Array(pdf), {
			status: 200,
			headers: {
				'Content-Type': 'application/pdf',
				'Content-Disposition': `attachment; filename="${filename}"`,
			},
		});
	} catch (err) {
		console.error('[ESG PDF] Generation failed', {
			companyId,
			error: err instanceof Error ? err.message : String(err),
		});
		return NextResponse.json(
			{ error: 'Failed to generate PDF report' },
			{ status: 500 },
		);
	}
}
