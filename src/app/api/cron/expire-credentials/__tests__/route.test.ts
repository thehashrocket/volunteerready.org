import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/server/repositories/prisma', () => ({
	prisma: {
		cronJobRun: { create: vi.fn(async () => ({})) },
	},
}));

vi.mock('@/server/services/credential-expiry-service', () => ({
	expireStaleCredentialsAndTokens: vi.fn(async () => ({
		credentialsExpired: 0,
		tokensExpired: 0,
	})),
	purgeOldDismissedNotifications: vi.fn(async () => ({
		notificationsPurged: 0,
	})),
}));

vi.mock('@/server/services/share-token-expiry-service', () => ({
	notifyExpiringShareTokens: vi.fn(async () => ({
		tokensNotified: 0,
	})),
}));

vi.mock('@/server/services/credential-expiry-notice-service', () => ({
	notifyStaffOfExpiringCredentials: vi.fn(async () => ({
		credentialsScanned: 0,
		credentialsNotified: 0,
		credentialsUnresolved: 0,
		orgsProcessed: 0,
		orgsWithNoRecipients: 0,
		noticeEmailsSent: 0,
		noticeEmailsFailed: 0,
		orgCapReached: false,
	})),
}));

import * as staffNoticeService from '@/server/services/credential-expiry-notice-service';
import * as expiryService from '@/server/services/credential-expiry-service';
import * as shareTokenService from '@/server/services/share-token-expiry-service';
import { GET, maxDuration } from '../route';

function makeRequest(authHeader?: string) {
	const headers = new Headers();
	if (authHeader) headers.set('authorization', authHeader);
	return new Request('http://localhost/api/cron/expire-credentials', {
		headers,
	});
}

describe('GET /api/cron/expire-credentials', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		process.env.CRON_SECRET = 'test-secret';
	});

	it('returns 401 when no auth header', async () => {
		const res = await GET(makeRequest());
		expect(res.status).toBe(401);
	});

	it('returns 401 when auth header is wrong', async () => {
		const res = await GET(makeRequest('Bearer wrong-secret'));
		expect(res.status).toBe(401);
	});

	it('returns 200 with counts on valid auth', async () => {
		vi.mocked(
			expiryService.expireStaleCredentialsAndTokens,
		).mockResolvedValueOnce({
			credentialsExpired: 3,
			tokensExpired: 1,
		});
		vi.mocked(
			expiryService.purgeOldDismissedNotifications,
		).mockResolvedValueOnce({
			notificationsPurged: 5,
		});
		vi.mocked(
			shareTokenService.notifyExpiringShareTokens,
		).mockResolvedValueOnce({
			tokensNotified: 2,
		});
		vi.mocked(
			staffNoticeService.notifyStaffOfExpiringCredentials,
		).mockResolvedValueOnce({
			credentialsScanned: 7,
			credentialsNotified: 6,
			credentialsUnresolved: 1,
			orgsProcessed: 2,
			orgsWithNoRecipients: 1,
			noticeEmailsSent: 4,
			noticeEmailsFailed: 0,
			orgCapReached: false,
		});

		const res = await GET(makeRequest('Bearer test-secret'));
		expect(res.status).toBe(200);

		const body = await res.json();
		expect(body).toEqual({
			ok: true,
			credentialsExpired: 3,
			tokensExpired: 1,
			notificationsPurged: 5,
			tokensNotified: 2,
			credentialsScanned: 7,
			credentialsNotified: 6,
			credentialsUnresolved: 1,
			orgsProcessed: 2,
			orgsWithNoRecipients: 1,
			noticeEmailsSent: 4,
			noticeEmailsFailed: 0,
			orgCapReached: false,
		});

		// ONE clock for both credential services. The expirer takes
		// `expiresAt < now` and the notifier `expiresAt > now`, so they are only
		// disjoint against a single read — with two reads a credential expiring
		// in the gap is expired AND warned about in the same run, and the notice
		// says it expires in 0 days. Dropping either argument leaves the body
		// assertion above untouched, so it is pinned here.
		const expiryNow = vi.mocked(expiryService.expireStaleCredentialsAndTokens)
			.mock.calls[0]?.[0];
		const noticeNow = vi.mocked(
			staffNoticeService.notifyStaffOfExpiringCredentials,
		).mock.calls[0]?.[0];
		expect(expiryNow).toBeInstanceOf(Date);
		expect(noticeNow).toBe(expiryNow);

		// The pacing budget in CREDENTIAL_EXPIRY_NOTICE_ORG_CAP is computed
		// against this number; inheriting the platform default changes it
		// silently underneath that arithmetic.
		expect(maxDuration).toBe(300);
	});

	it('returns 500 when only the staff notifier throws', async () => {
		// A failure in the newest branch must still surface as a FAILURE
		// CronJobRun rather than being masked by its three siblings resolving.
		vi.mocked(
			staffNoticeService.notifyStaffOfExpiringCredentials,
		).mockRejectedValueOnce(new Error('notifier down'));

		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const res = await GET(makeRequest('Bearer test-secret'));

		expect(res.status).toBe(500);
		errorSpy.mockRestore();
	});

	it('lets every service finish when one of them throws', async () => {
		// allSettled, not all. Under Promise.all a sibling throwing rejected the
		// route immediately while the notifier was mid-loop — after it had sent
		// real email and written irreversible notifiedAt stamps — and those
		// stamps are not replayable.
		vi.mocked(
			expiryService.expireStaleCredentialsAndTokens,
		).mockRejectedValueOnce(new Error('DB down'));

		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		await GET(makeRequest('Bearer test-secret'));

		expect(
			staffNoticeService.notifyStaffOfExpiringCredentials,
		).toHaveBeenCalled();
		expect(shareTokenService.notifyExpiringShareTokens).toHaveBeenCalled();
		expect(expiryService.purgeOldDismissedNotifications).toHaveBeenCalled();
		errorSpy.mockRestore();
	});

	it('records what the surviving services did on the failure path', async () => {
		// The CronJobRun FAILURE row is the only trace of a partial run. Without
		// the counters in the error, an operator sees "it failed" and has no way
		// to know which orgs were already stamped and emailed.
		vi.mocked(
			expiryService.expireStaleCredentialsAndTokens,
		).mockRejectedValueOnce(new Error('DB down'));
		vi.mocked(
			staffNoticeService.notifyStaffOfExpiringCredentials,
		).mockResolvedValueOnce({
			credentialsScanned: 4,
			credentialsNotified: 4,
			credentialsUnresolved: 0,
			orgsProcessed: 1,
			orgsWithNoRecipients: 0,
			noticeEmailsSent: 2,
			noticeEmailsFailed: 0,
			orgCapReached: false,
		});

		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		await GET(makeRequest('Bearer test-secret'));

		const logged = errorSpy.mock.calls
			.flat()
			.map((a) => (a instanceof Error ? a.message : String(a)))
			.join(' ');
		expect(logged).toContain('credentialsNotified');
		expect(logged).toContain('expireStaleCredentialsAndTokens');
		errorSpy.mockRestore();
	});

	it('returns 500 when service throws', async () => {
		vi.mocked(
			expiryService.expireStaleCredentialsAndTokens,
		).mockRejectedValueOnce(new Error('DB down'));

		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const res = await GET(makeRequest('Bearer test-secret'));

		expect(res.status).toBe(500);
		errorSpy.mockRestore();
	});

	it('returns 401 when CRON_SECRET is not set', async () => {
		process.env.CRON_SECRET = '';
		const res = await GET(makeRequest('Bearer anything'));
		expect(res.status).toBe(401);
	});
});
