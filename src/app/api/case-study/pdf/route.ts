export const runtime = 'nodejs';

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth';
import { generateCaseStudyPdf } from '@/server/services/caseStudyService';

export async function GET(req: NextRequest) {
	const session = await getServerSession(authOptions);
	const userId = session?.user?.id;
	if (!userId) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	}

	// Platform admin check
	const adminIds = (process.env.PLATFORM_ADMIN_IDS ?? '')
		.split(',')
		.map((id) => id.trim())
		.filter(Boolean);
	if (!adminIds.includes(userId)) {
		return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
	}

	const orgId = req.nextUrl.searchParams.get('orgId');
	if (!orgId) {
		return NextResponse.json({ error: 'Missing orgId' }, { status: 400 });
	}

	try {
		const pdf = await generateCaseStudyPdf(orgId);
		if (!pdf) {
			return NextResponse.json(
				{ error: 'Organization not found' },
				{ status: 404 },
			);
		}

		const filename = `case-study-${orgId}-${new Date().toISOString().split('T')[0]}.pdf`;
		return new Response(new Uint8Array(pdf), {
			status: 200,
			headers: {
				'Content-Type': 'application/pdf',
				'Content-Disposition': `attachment; filename="${filename}"`,
			},
		});
	} catch (err) {
		console.error('[Case Study PDF] Generation failed', {
			orgId,
			error: err instanceof Error ? err.message : String(err),
		});
		return NextResponse.json(
			{ error: 'Failed to generate PDF' },
			{ status: 500 },
		);
	}
}
