import { NextResponse } from 'next/server';
import { DigestFrequency } from '@/prisma/generated/client';
import { validateUnsubscribeTokenFromEnv } from '@/server/lib/digest-unsubscribe-token';
import { prisma } from '@/server/repositories/prisma';

export async function GET(request: Request): Promise<NextResponse> {
	const { searchParams } = new URL(request.url);
	const userId = searchParams.get('userId');
	const token = searchParams.get('token');

	if (!userId || !token) {
		return new NextResponse(
			'<html><body><p>Invalid unsubscribe link.</p></body></html>',
			{ status: 400, headers: { 'Content-Type': 'text/html' } },
		);
	}

	let valid: boolean;
	try {
		valid = validateUnsubscribeTokenFromEnv(userId, token);
	} catch {
		return new NextResponse(
			'<html><body><p>Unsubscribe service is temporarily unavailable. Please try again later.</p></body></html>',
			{ status: 500, headers: { 'Content-Type': 'text/html' } },
		);
	}

	if (!valid) {
		return new NextResponse(
			'<html><body><p>Invalid or expired unsubscribe link.</p></body></html>',
			{ status: 400, headers: { 'Content-Type': 'text/html' } },
		);
	}

	try {
		await prisma.userMarketplacePreference.upsert({
			where: { userId },
			create: { userId, digestFrequency: DigestFrequency.OFF },
			update: { digestFrequency: DigestFrequency.OFF },
		});
	} catch {
		// User account may have been deleted — treat as already unsubscribed
	}

	return new NextResponse(
		'<html><body><h1>Unsubscribed</h1><p>You have been unsubscribed from the weekly opportunity digest.</p></body></html>',
		{ status: 200, headers: { 'Content-Type': 'text/html' } },
	);
}
