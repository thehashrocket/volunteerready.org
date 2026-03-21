export const runtime = 'nodejs';

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { verifyConsentToken } from '@/server/lib/case-study-token';
import { prisma } from '@/server/repositories/prisma';

export async function GET(req: NextRequest) {
	const token = req.nextUrl.searchParams.get('token');
	if (!token) {
		return NextResponse.redirect(new URL('/stories/consent-expired', req.url));
	}

	const orgId = verifyConsentToken(token);
	if (!orgId) {
		return NextResponse.redirect(new URL('/stories/consent-expired', req.url));
	}

	// Look up org for redirect
	const org = await prisma.organization.findUnique({
		where: { id: orgId },
		select: { slug: true },
	});

	if (!org) {
		return NextResponse.redirect(new URL('/stories/consent-expired', req.url));
	}

	// Set consent
	await prisma.organization.update({
		where: { id: orgId },
		data: { consentToPublicize: true },
	});

	return NextResponse.redirect(
		new URL(`/stories/consent-confirmed?org=${org.slug}`, req.url),
	);
}
