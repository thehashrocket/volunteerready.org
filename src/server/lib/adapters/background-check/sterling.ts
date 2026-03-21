/**
 * sterling.ts — Sterling background check adapter.
 *
 * Sterling API flow:
 *
 *   staff submits PII (in memory only)
 *        │
 *        ▼
 *   POST /v2/screenings  →  screeningId (stored as externalId)
 *        │ uses org's API key (Bearer token)
 *        ▼
 *   PII lifetime ends here — SSN/DOB never touch the database
 *
 * OAuth flow (Sterling uses API key, not OAuth):
 *   Sterling uses a simpler auth model — API key per org, no OAuth dance.
 *   getOAuthUrl/exchangeOAuthCode are implemented as no-ops that throw;
 *   Sterling orgs are connected via admin settings (paste API key).
 *
 * Webhook signature verification uses HMAC-SHA256 with the platform-level
 * STERLING_WEBHOOK_SECRET and constant-time comparison.
 *
 * PII DISCIPLINE: Same contract as Checkr — PII is NEVER stored, logged,
 * or included in error messages.
 */

import crypto from 'node:crypto';
import type { BackgroundCheckAdapter, CandidatePii } from './types';

// ---------------------------------------------------------------------------
// Error classes (5 per design doc)
// ---------------------------------------------------------------------------

export class SterlingAuthError extends Error {
	constructor(message = 'Sterling authentication failed') {
		super(message);
		this.name = 'SterlingAuthError';
	}
}

export class SterlingValidationError extends Error {
	constructor(message = 'Sterling validation error') {
		super(message);
		this.name = 'SterlingValidationError';
	}
}

export class SterlingRateLimitError extends Error {
	constructor(
		message = 'Sterling rate limit exceeded',
		public readonly retryAfterMs: number = 2000,
	) {
		super(message);
		this.name = 'SterlingRateLimitError';
	}
}

export class SterlingTimeoutError extends Error {
	constructor(message = 'Sterling API request timed out') {
		super(message);
		this.name = 'SterlingTimeoutError';
	}
}

export class SterlingApiError extends Error {
	constructor(
		public readonly status: number,
		message: string,
	) {
		super(message);
		this.name = 'SterlingApiError';
	}
}

export class SterlingWebhookError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'SterlingWebhookError';
	}
}

export class SterlingSignatureError extends SterlingWebhookError {
	constructor(message = 'Invalid Sterling webhook signature') {
		super(message);
		this.name = 'SterlingSignatureError';
	}
}

// ---------------------------------------------------------------------------
// Sterling API adapter
// ---------------------------------------------------------------------------

const STERLING_BASE_URL = 'https://api.sterlingcheck.app';
const REQUEST_TIMEOUT_MS = 30_000;

class SterlingAdapter implements BackgroundCheckAdapter {
	private get webhookSecret(): string {
		const secret = process.env.STERLING_WEBHOOK_SECRET;
		if (!secret)
			throw new SterlingSignatureError('STERLING_WEBHOOK_SECRET is not set');
		return secret;
	}

	/**
	 * Initiates a background screening via Sterling's REST API.
	 *
	 * SECURITY: pii is NEVER logged. Errors include only status/code.
	 */
	async initiateCheck(
		pii: CandidatePii,
		packageName: string,
		accessToken: string,
	): Promise<{ reportId: string }> {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

		try {
			const res = await fetch(`${STERLING_BASE_URL}/v2/screenings`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${accessToken}`,
				},
				body: JSON.stringify({
					packageId: packageName,
					candidate: {
						firstName: pii.firstName,
						lastName: pii.lastName,
						email: pii.email,
						dateOfBirth: pii.dob,
						ssn: pii.ssn,
					},
				}),
				signal: controller.signal,
			});

			if (res.status === 401 || res.status === 403) {
				throw new SterlingAuthError(
					`Sterling auth failed with status ${res.status}`,
				);
			}

			if (res.status === 422) {
				throw new SterlingValidationError(
					'Invalid candidate information. Please verify the name, date of birth, and SSN.',
				);
			}

			if (res.status === 429) {
				const retryAfter =
					Number.parseInt(res.headers.get('retry-after') ?? '2', 10) * 1000;
				throw new SterlingRateLimitError(
					'Sterling rate limit exceeded',
					retryAfter,
				);
			}

			if (!res.ok) {
				throw new SterlingApiError(
					res.status,
					`Sterling screening creation failed with status ${res.status}`,
				);
			}

			const data = (await res.json()) as { id?: string };
			if (!data.id) {
				throw new SterlingApiError(
					500,
					'Sterling response missing screening ID',
				);
			}

			return { reportId: data.id };
		} catch (err) {
			if (err instanceof Error && err.name === 'AbortError') {
				throw new SterlingTimeoutError();
			}
			throw err;
		} finally {
			clearTimeout(timeout);
		}
	}

	/**
	 * Verifies Sterling webhook signature using HMAC-SHA256.
	 * Uses platform-level STERLING_WEBHOOK_SECRET.
	 */
	verifyWebhookSignature(rawBody: Buffer, signature: string): void {
		if (!signature) {
			throw new SterlingSignatureError('Missing X-Sterling-Signature header');
		}

		const expected = crypto
			.createHmac('sha256', this.webhookSecret)
			.update(rawBody)
			.digest('hex');

		const expectedBuf = Buffer.from(expected, 'utf-8');
		const signatureBuf = Buffer.from(signature, 'utf-8');

		if (
			expectedBuf.length !== signatureBuf.length ||
			!crypto.timingSafeEqual(expectedBuf, signatureBuf)
		) {
			throw new SterlingSignatureError();
		}
	}

	/**
	 * Parses Sterling webhook payloads.
	 * Returns { reportId, result } for screening.completed events.
	 * Returns null for informational events.
	 */
	parseActionableWebhookPayload(
		payload: unknown,
	): { reportId: string; result: string; accountId?: string } | null {
		if (typeof payload !== 'object' || payload === null) {
			throw new SterlingWebhookError('Webhook payload is not an object');
		}

		const body = payload as Record<string, unknown>;

		if (body.type !== 'screening.completed') {
			return null;
		}

		const data = body.data as Record<string, unknown> | undefined;
		if (typeof data?.id !== 'string' || typeof data?.result !== 'string') {
			throw new SterlingWebhookError(
				'screening.completed payload missing data.id or data.result',
			);
		}

		return { reportId: data.id, result: data.result };
	}

	/**
	 * Sterling uses API keys, not OAuth. This throws — Sterling orgs
	 * are connected by pasting their API key in admin settings.
	 */
	exchangeOAuthCode(
		_code: string,
	): Promise<{ accessToken: string; accountId: string }> {
		throw new SterlingApiError(
			501,
			'Sterling uses API keys, not OAuth. Connect via admin settings.',
		);
	}

	/**
	 * Sterling uses API keys, not OAuth. No redirect URL.
	 */
	getOAuthUrl(_state: string): string {
		throw new SterlingApiError(
			501,
			'Sterling uses API keys, not OAuth. Connect via admin settings.',
		);
	}
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

export const sterlingAdapter = new SterlingAdapter();
