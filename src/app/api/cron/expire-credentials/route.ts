import { withCronAuth } from '@/server/lib/cron-auth';
import {
	expireStaleCredentialsAndTokens,
	purgeOldDismissedNotifications,
} from '@/server/services/credential-expiry-service';
import { notifyExpiringShareTokens } from '@/server/services/share-token-expiry-service';

export const GET = withCronAuth('expire-credentials', async () => {
	const [expiryResult, purgeResult, notifyResult] = await Promise.all([
		expireStaleCredentialsAndTokens(),
		purgeOldDismissedNotifications(),
		notifyExpiringShareTokens(),
	]);
	return { ok: true, ...expiryResult, ...purgeResult, ...notifyResult };
});
