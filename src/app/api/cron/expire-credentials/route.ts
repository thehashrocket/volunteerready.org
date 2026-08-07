import { withCronAuth } from '@/server/lib/cron-auth';
import { notifyStaffOfExpiringCredentials } from '@/server/services/credential-expiry-notice-service';
import {
	expireStaleCredentialsAndTokens,
	purgeOldDismissedNotifications,
} from '@/server/services/credential-expiry-service';
import { notifyExpiringShareTokens } from '@/server/services/share-token-expiry-service';

/**
 * Explicit rather than inherited, because one branch of this job now paces its
 * sends and therefore has a wall-clock budget it must fit inside. Leaving it to
 * the platform default means the budget silently changes underneath the pacing
 * maths in `CREDENTIAL_EXPIRY_NOTICE_ORG_CAP`.
 */
export const maxDuration = 300;

export const GET = withCronAuth('expire-credentials', async () => {
	// ONE clock for the whole run. The expirer takes `expiresAt < now` and the
	// notifier `expiresAt > now`, which only makes them disjoint if it is the
	// SAME now — they used to read the clock separately, so a credential
	// expiring in the gap could be expired and warned about in one run.
	const now = new Date();

	// allSettled, not all. `Promise.all` is fail-fast: one sibling throwing
	// abandoned the notifier mid-loop, AFTER it had sent real email and written
	// irreversible `notifiedAt` stamps, and `withCronAuth`'s catch then recorded
	// a FAILURE with no resultSummary at all — so there was no record of what
	// had already been consumed, and the stamps are not replayable.
	const [expiryResult, purgeResult, shareTokenResult, staffNoticeResult] =
		await Promise.allSettled([
			expireStaleCredentialsAndTokens(now),
			purgeOldDismissedNotifications(),
			notifyExpiringShareTokens(),
			notifyStaffOfExpiringCredentials(now),
		]);

	const failures: string[] = [];
	const merge = <T extends object>(
		name: string,
		settled: PromiseSettledResult<T>,
	): Partial<T> => {
		if (settled.status === 'fulfilled') return settled.value;
		failures.push(name);
		console.error(`[cron] expire-credentials: ${name} failed`, settled.reason);
		return {};
	};

	const body = {
		ok: failures.length === 0,
		...merge('expireStaleCredentialsAndTokens', expiryResult),
		...merge('purgeOldDismissedNotifications', purgeResult),
		...merge('notifyExpiringShareTokens', shareTokenResult),
		...merge('notifyStaffOfExpiringCredentials', staffNoticeResult),
		...(failures.length > 0 ? { failedServices: failures } : {}),
	};

	// Rethrow AFTER the successful branches' counters are in hand, so the
	// FAILURE CronJobRun still carries what the other three actually did.
	if (failures.length > 0) {
		const err = new Error(
			`expire-credentials: ${failures.join(', ')} failed — partial summary: ${JSON.stringify(body)}`,
		);
		throw err;
	}

	return body;
});
