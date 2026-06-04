import { NextResponse } from 'next/server';
import { DigestFrequency, Prisma } from '@/prisma/generated/client';
import { validateUnsubscribeTokenFromEnv } from '@/server/lib/digest-unsubscribe-token';
import { prisma } from '@/server/repositories/prisma';

function htmlError(status: number, message: string): NextResponse {
	return new NextResponse(
		`<html><body><p>${message}</p></body></html>`,
		{ status, headers: { 'Content-Type': 'text/html' } },
	);
}

function validateParams(searchParams: URLSearchParams): {
	userId: string;
	token: string;
} | null {
	const userId = searchParams.get('userId');
	const token = searchParams.get('token');
	return userId && token ? { userId, token } : null;
}

function validateToken(userId: string, token: string): boolean | 'error' {
	try {
		return validateUnsubscribeTokenFromEnv(userId, token);
	} catch {
		return 'error';
	}
}

/**
 * GET — show a branded confirmation page.
 *
 * Email link prefetchers (Apple Mail, Gmail, Proofpoint) auto-fetch all URLs
 * in emails. A GET that mutates state would unsubscribe users who never
 * clicked. Showing a confirmation page on GET and only processing on POST
 * is the industry-standard fix (RFC 8058 pattern).
 */
export async function GET(request: Request): Promise<NextResponse> {
	const { searchParams } = new URL(request.url);
	const params = validateParams(searchParams);

	if (!params) return htmlError(400, 'Invalid unsubscribe link.');

	const valid = validateToken(params.userId, params.token);
	if (valid === 'error')
		return htmlError(500, 'Unsubscribe service is temporarily unavailable. Please try again later.');
	if (!valid) return htmlError(400, 'Invalid or expired unsubscribe link.');

	const confirmUrl = `/api/unsubscribe/digest?userId=${encodeURIComponent(params.userId)}&token=${encodeURIComponent(params.token)}`;

	return new NextResponse(
		`<html>
<head><title>Unsubscribe from opportunity emails</title></head>
<body style="font-family:sans-serif;max-width:480px;margin:60px auto;padding:0 24px;color:#1B3C2A;">
  <h1 style="font-size:22px;margin-bottom:8px;">Unsubscribe from opportunity emails</h1>
  <p style="color:#6B5E4F;margin-bottom:24px;">Click the button below to stop receiving the weekly opportunity digest.</p>
  <form method="POST" action="${confirmUrl}">
    <button type="submit"
      style="background:#1B3C2A;color:white;padding:10px 20px;border:none;border-radius:6px;font-size:15px;cursor:pointer;">
      Confirm unsubscribe
    </button>
  </form>
</body>
</html>`,
		{ status: 200, headers: { 'Content-Type': 'text/html' } },
	);
}

/** POST — perform the unsubscribe. */
export async function POST(request: Request): Promise<NextResponse> {
	const { searchParams } = new URL(request.url);
	const params = validateParams(searchParams);

	if (!params) return htmlError(400, 'Invalid unsubscribe link.');

	const valid = validateToken(params.userId, params.token);
	if (valid === 'error')
		return htmlError(500, 'Unsubscribe service is temporarily unavailable. Please try again later.');
	if (!valid) return htmlError(400, 'Invalid or expired unsubscribe link.');

	try {
		await prisma.userMarketplacePreference.upsert({
			where: { userId: params.userId },
			create: { userId: params.userId, digestFrequency: DigestFrequency.OFF },
			update: { digestFrequency: DigestFrequency.OFF },
		});
	} catch (e) {
		// P2025: user account was deleted — treat as already unsubscribed
		if (
			e instanceof Prisma.PrismaClientKnownRequestError &&
			e.code === 'P2025'
		) {
			// fall through to success response
		} else {
			return htmlError(500, 'Something went wrong. Please try again later.');
		}
	}

	return new NextResponse(
		'<html><body><h1>Unsubscribed</h1><p>You have been unsubscribed from the weekly opportunity digest.</p></body></html>',
		{ status: 200, headers: { 'Content-Type': 'text/html' } },
	);
}
