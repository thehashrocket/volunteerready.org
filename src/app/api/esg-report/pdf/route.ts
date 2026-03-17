import { type NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/server/auth';
import { assertPlanAtLeast } from '@/server/domain/billing';
import {
	getCompanyMembership,
	getCompanyPlanTier,
} from '@/server/repositories/companyRepo';
import { generateESGPdfExport } from '@/server/services/employerReportService';

type SessionExt = { user?: { id?: string } };

const paramsSchema = z.object({
	companyId: z.string().min(1),
	from: z.coerce.date().nullish(),
	to: z.coerce.date().nullish(),
});

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

	// 3. Inline auth checks (membership + role + plan tier)
	const membership = await getCompanyMembership(userId, companyId);
	if (!membership) {
		return NextResponse.json(
			{ error: 'Not a member of this company' },
			{ status: 403 },
		);
	}

	if (membership.role === 'MEMBER') {
		return NextResponse.json({ error: 'Admin role required' }, { status: 403 });
	}

	const planTier = await getCompanyPlanTier(companyId);
	try {
		assertPlanAtLeast(planTier, 'PRO');
	} catch {
		return NextResponse.json(
			{ error: 'Requires PRO plan or higher' },
			{ status: 403 },
		);
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
