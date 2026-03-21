export const runtime = 'nodejs';

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { verifyConsentToken } from '@/server/lib/case-study-token';
import { prisma } from '@/server/repositories/prisma';
import { setOrgConsent } from '@/server/services/caseStudyService';

/** Escape HTML special characters to prevent XSS */
function escapeHtml(str: string): string {
	return str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

/**
 * GET — verify token and render a confirmation page.
 * Does NOT mutate state (safe for email prefetchers/scanners).
 */
export async function GET(req: NextRequest) {
	const token = req.nextUrl.searchParams.get('token');
	if (!token) {
		return NextResponse.redirect(new URL('/stories/consent-expired', req.url));
	}

	const orgId = verifyConsentToken(token);
	if (!orgId) {
		return NextResponse.redirect(new URL('/stories/consent-expired', req.url));
	}

	const org = await prisma.organization.findUnique({
		where: { id: orgId },
		select: { name: true },
	});

	if (!org) {
		return NextResponse.redirect(new URL('/stories/consent-expired', req.url));
	}

	const safeName = escapeHtml(org.name);
	const safeToken = escapeHtml(token);

	// Render a confirmation page with a POST form — no state change on GET
	const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Confirm Consent — VolunteerReady</title>
<style>body{font-family:system-ui,sans-serif;max-width:480px;margin:80px auto;padding:0 16px;color:#252422}
h1{font-size:24px;color:#1B3C2A}button{background:#1B3C2A;color:#fff;border:none;padding:12px 32px;
border-radius:9999px;font-size:16px;font-weight:600;cursor:pointer}button:hover{background:#2D5E42}
.note{color:#787571;font-size:14px;margin-top:16px}</style></head>
<body>
<h1>Share your story?</h1>
<p>By clicking below, you agree to let VolunteerReady feature <strong>${safeName}</strong>&rsquo;s
impact data on our public site.</p>
<form method="POST" action="/api/case-study/consent">
<input type="hidden" name="token" value="${safeToken}">
<button type="submit">Yes, share our story</button>
</form>
<p class="note">Your data stays private unless you approve. This link expires in 7 days.</p>
</body></html>`;

	return new Response(html, {
		status: 200,
		headers: { 'Content-Type': 'text/html; charset=utf-8' },
	});
}

/**
 * POST — actually set consent. Requires valid token in form body.
 */
export async function POST(req: NextRequest) {
	const formData = await req.formData();
	const rawToken = formData.get('token');
	const token = typeof rawToken === 'string' ? rawToken : null;

	if (!token) {
		return NextResponse.redirect(new URL('/stories/consent-expired', req.url), 303);
	}

	const orgId = verifyConsentToken(token);
	if (!orgId) {
		return NextResponse.redirect(new URL('/stories/consent-expired', req.url), 303);
	}

	const org = await prisma.organization.findUnique({
		where: { id: orgId },
		select: { slug: true },
	});

	if (!org) {
		return NextResponse.redirect(new URL('/stories/consent-expired', req.url), 303);
	}

	// Set consent via service layer
	await setOrgConsent(orgId, true);

	return NextResponse.redirect(
		new URL(`/stories/consent-confirmed?org=${org.slug}`, req.url),
		303, // 303 See Other — proper redirect after POST
	);
}
