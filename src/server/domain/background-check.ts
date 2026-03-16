/**
 * background-check.ts — Pure domain functions for background check integration.
 *
 * NO framework imports. No Prisma. No tRPC. Pure functions only.
 * Follow volunteer-profile.ts pattern.
 *
 * State machine:
 *
 *          initiate         webhook:clear
 *  ──────► PENDING ──────────────────────────► COMPLETE (terminal)
 *                   │                               │ auto-issues VolunteerCredential
 *                   │ webhook:consider               │ type=BACKGROUND_CHECK
 *                   ▼                               │
 *                CONSIDER (non-terminal)            ✓
 *                   │ staff manually uses
 *                   │ existing credentials.issue
 *                   ▼
 *               (manual credential issuance)
 *
 *          PENDING ──► webhook:adverse/suspended/dispute ──► FAILED (terminal)
 *          PENDING ──► staff cancel ──────────────────────► CANCELLED (terminal)
 *          CONSIDER ──► staff cancel ───────────────────── ► CANCELLED (terminal)
 *
 *  RULE: Terminal status checks ignore subsequent webhooks (logged, not acted on).
 */

export type BackgroundCheckStatus =
	| 'PENDING'
	| 'COMPLETE'
	| 'CONSIDER'
	| 'FAILED'
	| 'CANCELLED';

export type BackgroundCheckProvider = 'CHECKR' | 'STERLING';

// ---------------------------------------------------------------------------
// Status mapping — Checkr result string → internal status
// ---------------------------------------------------------------------------

/**
 * Maps a Checkr report result string to our internal BackgroundCheckStatus.
 *
 * Checkr result values:
 *   'clear'    → COMPLETE (auto-issue credential)
 *   'consider' → CONSIDER (staff review required)
 *   anything else (e.g. 'adverse_action', 'suspended', 'dispute') → FAILED
 */
export function mapCheckrResultToStatus(result: string): BackgroundCheckStatus {
	if (result === 'clear') return 'COMPLETE';
	if (result === 'consider') return 'CONSIDER';
	return 'FAILED';
}

// ---------------------------------------------------------------------------
// Terminal status check
// ---------------------------------------------------------------------------

const TERMINAL_STATUSES = new Set<BackgroundCheckStatus>([
	'COMPLETE',
	'FAILED',
	'CANCELLED',
]);

/**
 * Returns true if the status is terminal — no further state transitions
 * should be applied when a webhook arrives for a request in this status.
 */
export function isTerminalStatus(status: BackgroundCheckStatus): boolean {
	return TERMINAL_STATUSES.has(status);
}

// ---------------------------------------------------------------------------
// Credential auto-issuance check
// ---------------------------------------------------------------------------

/**
 * Returns true if the given status should trigger automatic issuance of a
 * BACKGROUND_CHECK VolunteerCredential. Only COMPLETE qualifies.
 */
export function shouldAutoIssueCredential(
	status: BackgroundCheckStatus,
): boolean {
	return status === 'COMPLETE';
}

// ---------------------------------------------------------------------------
// PII sanitization
// ---------------------------------------------------------------------------

/**
 * Known PII field names from Checkr webhook payloads.
 * Strip these before storing any payload in the database.
 *
 * IMPORTANT: This function sanitizes recursively to catch nested objects
 * (e.g. candidate sub-objects inside report payloads).
 */
const PII_FIELDS = new Set([
	'ssn',
	'dob',
	'mother_maiden_name',
	'driver_license_number',
	'zipcode',
	'phone',
]);

/**
 * Strips known PII fields from a Checkr webhook payload before DB storage.
 * Returns a plain Record — cast to Prisma.InputJsonValue at the call site.
 *
 * - Handles nested objects recursively.
 * - Arrays: each element is sanitized if it is an object.
 * - Non-object values are returned as-is.
 */
export function sanitizeCheckrPayload(
	payload: unknown,
): Record<string, unknown> {
	if (
		typeof payload !== 'object' ||
		payload === null ||
		Array.isArray(payload)
	) {
		return {};
	}

	const result: Record<string, unknown> = {};

	for (const [key, value] of Object.entries(
		payload as Record<string, unknown>,
	)) {
		if (PII_FIELDS.has(key)) continue;

		if (Array.isArray(value)) {
			result[key] = value.map((item) =>
				typeof item === 'object' && item !== null
					? sanitizeCheckrPayload(item)
					: item,
			);
		} else if (typeof value === 'object' && value !== null) {
			result[key] = sanitizeCheckrPayload(value);
		} else {
			result[key] = value;
		}
	}

	return result;
}
