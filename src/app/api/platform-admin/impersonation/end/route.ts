import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth';
import { IMPERSONATION_COOKIE } from '@/server/domain/impersonation';
import { endImpersonation } from '@/server/services/impersonationService';

export async function POST() {
	const session = await getServerSession(authOptions);
	const userId = session?.user?.id;
	if (!userId) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	}

	const cookieStore = await cookies();
	const cookie = cookieStore.get(IMPERSONATION_COOKIE);
	if (!cookie?.value) {
		return NextResponse.json({ ok: true, alreadyEnded: true });
	}

	// Always clear the cookie, even if the service throws. Otherwise an admin
	// could see a successful client-side redirect while the platform still
	// treats them as the impersonator until TTL.
	try {
		const result = await endImpersonation(cookie.value, userId, 'manual');
		cookieStore.delete(IMPERSONATION_COOKIE);
		return NextResponse.json(result);
	} catch (err) {
		cookieStore.delete(IMPERSONATION_COOKIE);
		const code =
			err && typeof err === 'object' && 'code' in err
				? (err as { code?: string }).code
				: undefined;
		const status = code === 'FORBIDDEN' ? 403 : 500;
		const message =
			code === 'FORBIDDEN'
				? 'Cannot end another admin’s impersonation session.'
				: 'Failed to end impersonation.';
		return NextResponse.json({ error: message }, { status });
	}
}
