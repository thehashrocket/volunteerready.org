import { NextResponse } from 'next/server';
import {
	expireStaleCredentialsAndTokens,
	purgeOldDismissedNotifications,
} from '@/server/services/credential-expiry-service';

export async function GET(req: Request) {
	const authHeader = req.headers.get('authorization');
	const expected = process.env.CRON_SECRET;

	if (!expected || authHeader !== `Bearer ${expected}`) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const [expiryResult, purgeResult] = await Promise.all([
			expireStaleCredentialsAndTokens(),
			purgeOldDismissedNotifications(),
		]);
		return NextResponse.json({ ok: true, ...expiryResult, ...purgeResult });
	} catch (e) {
		console.error('[cron] expire-credentials failed', e);
		return NextResponse.json(
			{ error: 'Internal server error' },
			{ status: 500 },
		);
	}
}
