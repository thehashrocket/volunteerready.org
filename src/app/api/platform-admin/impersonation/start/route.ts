import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth';
import {
	IMPERSONATION_COOKIE,
	IMPERSONATION_MAX_DURATION_MS,
	startImpersonationSchema,
} from '@/server/domain/impersonation';
import { isPlatformAdmin } from '@/server/domain/platform-admin';
import { startImpersonation } from '@/server/services/impersonationService';

export async function POST(req: NextRequest) {
	const session = await getServerSession(authOptions);
	const adminId = session?.user?.id;
	if (!adminId) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	}

	const isAdmin = await isPlatformAdmin(adminId);
	if (!isAdmin) {
		return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
	}

	let body: unknown;
	try {
		body = await req.json();
	} catch {
		return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
	}

	const parsed = startImpersonationSchema.safeParse(body);
	if (!parsed.success) {
		return NextResponse.json(
			{ error: 'Invalid input', issues: parsed.error.issues },
			{ status: 400 },
		);
	}

	try {
		const result = await startImpersonation(
			adminId,
			parsed.data.targetId,
			parsed.data.reason,
		);

		const cookieStore = await cookies();
		cookieStore.set(IMPERSONATION_COOKIE, result.sessionId, {
			httpOnly: true,
			secure: process.env.NODE_ENV === 'production',
			sameSite: 'lax',
			path: '/',
			maxAge: Math.floor(IMPERSONATION_MAX_DURATION_MS / 1000),
		});

		return NextResponse.json({
			sessionId: result.sessionId,
			targetUserId: result.targetUserId,
			expiresAt: result.expiresAt.toISOString(),
		});
	} catch (err) {
		const code =
			err && typeof err === 'object' && 'code' in err
				? (err as { code?: string }).code
				: undefined;

		// Only surface user-visible messages for TRPCError codes we expect.
		// Any other error (Prisma, transaction timeout, etc.) is an internal
		// failure — return 500 with a generic message so internal details like
		// table/constraint names aren't leaked to the caller.
		if (
			code === 'FORBIDDEN' ||
			code === 'NOT_FOUND' ||
			code === 'BAD_REQUEST'
		) {
			const status =
				code === 'FORBIDDEN' ? 403 : code === 'NOT_FOUND' ? 404 : 400;
			const message =
				err instanceof Error ? err.message : 'Failed to start impersonation.';
			return NextResponse.json({ error: message }, { status });
		}

		console.error('[impersonation.start] unexpected error', err);
		return NextResponse.json(
			{ error: 'Failed to start impersonation.' },
			{ status: 500 },
		);
	}
}
