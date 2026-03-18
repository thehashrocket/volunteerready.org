import { NextResponse } from 'next/server';
import { expireStaleCredentialsAndTokens } from '@/server/services/credential-expiry-service';

export async function GET(req: Request) {
	const authHeader = req.headers.get('authorization');
	const expected = process.env.CRON_SECRET;

	if (!expected || authHeader !== `Bearer ${expected}`) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const result = await expireStaleCredentialsAndTokens();
		return NextResponse.json({ ok: true, ...result });
	} catch (e) {
		console.error('[cron] expire-credentials failed', e);
		return NextResponse.json(
			{ error: 'Internal server error' },
			{ status: 500 },
		);
	}
}
