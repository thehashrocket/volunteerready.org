/**
 * Background check adapter interface and shared types.
 *
 * CandidatePii — the identity forwarded to the provider. Most fields are
 * collected from staff; `email` is resolved server-side (see below).
 *
 *   ┌─────────────────────────────────────────────────────────────────┐
 *   │  PII LIFETIME                                                    │
 *   │  CandidatePii lives ONLY in the call stack of initiateCheck().  │
 *   │  It is NEVER stored in the database, NEVER logged, and NEVER    │
 *   │  included in error messages. The adapter contract enforces this. │
 *   └─────────────────────────────────────────────────────────────────┘
 */

export interface CandidatePii {
	firstName: string;
	lastName: string;
	/**
	 * Resolved SERVER-SIDE from the volunteer's `User` row, not forwarded from
	 * the initiate form. The form's email field is a confirmation field that
	 * Guard 1.5 compares against this value and then discards — see
	 * `initiateProviderCheck`. Do not thread the staff-typed address here.
	 */
	email: string;
	/** Date of birth in YYYY-MM-DD format. Never stored in DB. */
	dob: string;
	/** SSN — exactly 9 digits. Never stored in DB. Never logged. */
	ssn: string;
}

export interface BackgroundCheckAdapter {
	/**
	 * Initiates a background check with the provider.
	 * Returns the provider's report ID to be stored as externalId.
	 *
	 * IMPORTANT: Implementations MUST NOT log the pii object or any
	 * field within it. If an error occurs, log only safe fields
	 * (error code, status, requestId).
	 *
	 * @param accessToken Per-org Checkr OAuth access token (Partner API).
	 */
	initiateCheck(
		pii: CandidatePii,
		packageName: string,
		accessToken: string,
	): Promise<{ reportId: string }>;

	/**
	 * Verifies the webhook signature from the provider.
	 * Throws CheckrSignatureError on mismatch.
	 * Must use constant-time comparison (crypto.timingSafeEqual).
	 *
	 * For the Checkr Partner API, verification uses the partner client_secret
	 * (not the per-org access token).
	 */
	verifyWebhookSignature(rawBody: Buffer, signature: string): void;

	/**
	 * Parses an incoming webhook payload and extracts actionable data.
	 * Returns { reportId, result, accountId } for actionable events (e.g. report.completed),
	 * or null for informational/unsupported event types.
	 *
	 * accountId is the Checkr account ID from the Partner API webhook payload,
	 * used to route the event to the correct org.
	 */
	parseActionableWebhookPayload(
		payload: unknown,
	): { reportId: string; result: string; accountId?: string } | null;

	/**
	 * Exchanges a Partner API OAuth authorization code for an access token.
	 * Called from the OAuth callback route after the org connects their Checkr account.
	 *
	 * @returns accessToken — store per-org; accountId — Checkr account identifier
	 */
	exchangeOAuthCode(
		code: string,
	): Promise<{ accessToken: string; accountId: string }>;

	/**
	 * Builds the OAuth authorization URL to redirect org staff to Checkr.
	 * Includes state parameter for CSRF protection.
	 */
	getOAuthUrl(state: string): string;
}
