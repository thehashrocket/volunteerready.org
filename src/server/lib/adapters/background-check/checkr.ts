/**
 * checkr.ts — Checkr Partner API adapter.
 *
 * Checkr Partner API differences from standard API:
 *   - Each org connects their own Checkr account via OAuth
 *   - API calls use per-org OAuth access tokens (not a single platform key)
 *   - Webhooks are signed with the partner client_secret (platform-level)
 *   - Webhook payloads include account_id for routing to the correct org
 *
 * Flow for initiateCheck:
 *
 *   staff submits PII (in memory only)
 *        │
 *        ▼
 *   POST /v1/candidates  →  candidateId (ephemeral — NOT stored)
 *        │ uses org's access_token
 *        ▼
 *   POST /v1/reports  →  reportId  ← stored as BackgroundCheckRequest.externalId
 *        │
 *        ▼
 *   PII lifetime ends here — SSN/DOB never touch the database
 *
 * Flow for OAuth connect:
 *
 *   staff clicks "Connect Checkr"
 *        │
 *        ▼
 *   Redirect → https://partners.checkr.com/authorize/{client_id}
 *        │
 *        ▼
 *   Checkr callback → /api/checkr/oauth/callback?code=...
 *        │
 *        ▼
 *   exchangeOAuthCode(code) → { accessToken, accountId }
 *        │
 *        ▼
 *   Store on Organization: checkrAccessToken + checkrAccountId
 *
 * NOTE: candidateId is intentionally not stored. Re-screening requires
 * re-collecting PII (see docs/TODOS.md [P3] Checkr candidate ID storage).
 *
 * Webhook signature verification uses HMAC-SHA256 with the partner client_secret
 * and constant-time comparison via crypto.timingSafeEqual to prevent timing attacks.
 */

import crypto from 'node:crypto';
import type { BackgroundCheckAdapter, CandidatePii } from './types';

// ---------------------------------------------------------------------------
// Error classes
// ---------------------------------------------------------------------------

/**
 * Base class for all Checkr webhook errors.
 * The webhook route catches this and returns 400.
 */
export class CheckrWebhookError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'CheckrWebhookError';
	}
}

/** Thrown when the X-Checkr-Signature header does not match. */
export class CheckrSignatureError extends CheckrWebhookError {
	constructor(message = 'Invalid Checkr webhook signature') {
		super(message);
		this.name = 'CheckrSignatureError';
	}
}

/** Thrown when the webhook body cannot be parsed as valid JSON. */
export class CheckrBadPayloadError extends CheckrWebhookError {
	constructor(message = 'Invalid Checkr webhook payload') {
		super(message);
		this.name = 'CheckrBadPayloadError';
	}
}

/** Thrown when the Checkr API returns a non-2xx response. */
export class CheckrApiError extends Error {
	constructor(
		public readonly status: number,
		message: string,
	) {
		super(message);
		this.name = 'CheckrApiError';
	}
}

/**
 * Thrown when a webhook references an unknown report ID.
 * The webhook route returns 500 so Checkr retries within its 72-hour window.
 */
export class CheckrRequeueError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'CheckrRequeueError';
	}
}

// ---------------------------------------------------------------------------
// Checkr Partner API adapter implementation
// ---------------------------------------------------------------------------

const CHECKR_BASE_URL = 'https://api.checkr.com';
const CHECKR_PARTNER_BASE_URL = 'https://partners.checkr.com';

class CheckrAdapter implements BackgroundCheckAdapter {
	private get clientId(): string {
		const id = process.env.CHECKR_CLIENT_ID;
		if (!id) throw new Error('CHECKR_CLIENT_ID is not set');
		return id;
	}

	private get clientSecret(): string {
		const secret = process.env.CHECKR_CLIENT_SECRET;
		if (!secret) throw new CheckrSignatureError('CHECKR_CLIENT_SECRET is not set');
		return secret;
	}

	/** Basic auth header using an OAuth access token as the username. */
	private tokenAuth(accessToken: string): string {
		return `Basic ${Buffer.from(`${accessToken}:`).toString('base64')}`;
	}

	/** Basic auth header using client_id:client_secret. */
	private partnerAuth(): string {
		return `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`;
	}

	/**
	 * Builds the OAuth authorization URL for the Checkr Partner connect flow.
	 * Org staff is redirected here to connect their Checkr account.
	 */
	getOAuthUrl(state: string): string {
		const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/checkr/oauth/callback`;
		const params = new URLSearchParams({
			redirect_uri: redirectUri,
			response_type: 'code',
			state,
		});
		return `${CHECKR_PARTNER_BASE_URL}/authorize/${this.clientId}?${params.toString()}`;
	}

	/**
	 * Exchanges a Partner API authorization code for a per-org access token.
	 * Called from the OAuth callback route.
	 *
	 * @returns accessToken to store per-org; accountId for webhook routing
	 */
	async exchangeOAuthCode(
		code: string,
	): Promise<{ accessToken: string; accountId: string }> {
		const res = await fetch(`${CHECKR_PARTNER_BASE_URL}/oauth/tokens`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: this.partnerAuth(),
			},
			body: JSON.stringify({ code, grant_type: 'authorization_code' }),
		});

		if (!res.ok) {
			throw new CheckrApiError(
				res.status,
				`Checkr OAuth token exchange failed with status ${res.status}`,
			);
		}

		const data = (await res.json()) as {
			access_token?: string;
			checkr_account_id?: string;
		};

		if (!data.access_token || !data.checkr_account_id) {
			throw new CheckrApiError(
				500,
				'Checkr OAuth response missing access_token or checkr_account_id',
			);
		}

		return {
			accessToken: data.access_token,
			accountId: data.checkr_account_id,
		};
	}

	/**
	 * Initiates a background check using the org's OAuth access token:
	 *   1. Create Checkr candidate (ephemeral — candidateId not stored)
	 *   2. Create Checkr report against that candidate
	 *   3. Return reportId (stored as externalId in DB)
	 *
	 * SECURITY: pii is NEVER logged. Errors include only status/code.
	 */
	async initiateCheck(
		pii: CandidatePii,
		packageName: string,
		accessToken: string,
	): Promise<{ reportId: string }> {
		const authHeader = this.tokenAuth(accessToken);

		// Step 1: Create candidate
		const candidateRes = await fetch(`${CHECKR_BASE_URL}/v1/candidates`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: authHeader,
			},
			body: JSON.stringify({
				first_name: pii.firstName,
				last_name: pii.lastName,
				email: pii.email,
				dob: pii.dob,
				ssn: pii.ssn,
			}),
		});

		if (!candidateRes.ok) {
			const status = candidateRes.status;
			// NEVER include pii in the error message
			if (status === 422) {
				throw new CheckrApiError(
					422,
					'Invalid candidate information. Please verify the name, date of birth, and SSN.',
				);
			}
			throw new CheckrApiError(
				status,
				`Checkr candidate creation failed with status ${status}`,
			);
		}

		const candidate = (await candidateRes.json()) as { id: string };
		const candidateId = candidate.id;
		// candidateId is ephemeral — see NOTE in file header for P3 re-screening decision

		// Step 2: Create report
		const reportRes = await fetch(`${CHECKR_BASE_URL}/v1/reports`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: authHeader,
			},
			body: JSON.stringify({
				candidate_id: candidateId,
				package: packageName,
			}),
		});

		if (!reportRes.ok) {
			const status = reportRes.status;
			if (status === 422) {
				throw new CheckrApiError(
					422,
					'Invalid background check package or candidate data.',
				);
			}
			throw new CheckrApiError(
				status,
				`Checkr report creation failed with status ${status}`,
			);
		}

		const report = (await reportRes.json()) as { id: string };
		return { reportId: report.id };
	}

	/**
	 * Verifies the X-Checkr-Signature header using HMAC-SHA256.
	 * Uses the partner client_secret (platform-level, not per-org token).
	 * Uses crypto.timingSafeEqual to prevent timing attacks.
	 * Throws CheckrSignatureError on mismatch.
	 */
	verifyWebhookSignature(rawBody: Buffer, signature: string): void {
		if (!signature) {
			throw new CheckrSignatureError('Missing X-Checkr-Signature header');
		}

		const expected = crypto
			.createHmac('sha256', this.clientSecret)
			.update(rawBody)
			.digest('hex');

		const expectedBuf = Buffer.from(expected, 'utf-8');
		const signatureBuf = Buffer.from(signature, 'utf-8');

		if (
			expectedBuf.length !== signatureBuf.length ||
			!crypto.timingSafeEqual(expectedBuf, signatureBuf)
		) {
			throw new CheckrSignatureError();
		}
	}

	/**
	 * Parses an incoming webhook payload.
	 * Returns { reportId, result, accountId } for 'report.completed' events.
	 * Returns null for all other event types.
	 * Throws CheckrBadPayloadError if the payload is structurally invalid.
	 *
	 * accountId comes from the Partner API 'account_id' field and is used to
	 * route the webhook to the correct org.
	 */
	parseActionableWebhookPayload(
		payload: unknown,
	): { reportId: string; result: string; accountId?: string } | null {
		if (typeof payload !== 'object' || payload === null) {
			throw new CheckrBadPayloadError('Webhook payload is not an object');
		}

		const body = payload as Record<string, unknown>;

		if (body.type !== 'report.completed') {
			// Informational event — not actionable
			return null;
		}

		const data = body.data as Record<string, unknown> | undefined;
		const reportObj = data?.object as Record<string, unknown> | undefined;

		if (
			typeof reportObj?.id !== 'string' ||
			typeof reportObj?.result !== 'string'
		) {
			throw new CheckrBadPayloadError(
				'report.completed payload missing data.object.id or data.object.result',
			);
		}

		// account_id is present in Partner API webhooks for routing
		const accountId =
			typeof body.account_id === 'string' ? body.account_id : undefined;

		return { reportId: reportObj.id, result: reportObj.result, accountId };
	}
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

export const checkrAdapter = new CheckrAdapter();
