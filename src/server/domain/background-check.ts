/**
 * background-check.ts — Pure domain functions for background check integration.
 *
 * NO framework imports. No Prisma. No tRPC. Pure functions only.
 * Follow volunteer-profile.ts pattern.
 *
 * Background check status state machine:
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
 *          CONSIDER ──► staff cancel ─────────────────────► CANCELLED (terminal)
 *          CONSIDER ──► FCRA adverse action finalized ────► FAILED (terminal)
 *
 *  RULE: Terminal status checks ignore subsequent webhooks (logged, not acted on).
 *
 * FCRA adverse action state machine (nested within CONSIDER status):
 *
 *      fcraStatus transitions (only meaningful when status=CONSIDER):
 *
 *      NONE ──────────────────────────► RESOLVED (staff issues credential directly)
 *        │                                  ▲
 *        ▼                                  │
 *      PRE_ADVERSE_SENT ───────────────► RESOLVED (staff issues credential during wait)
 *        │
 *        ▼ (after ≥ FCRA_WAITING_PERIOD_DAYS)
 *      ADVERSE_ACTION_SENT (terminal — status also moves to FAILED)
 *
 *  At any point: staff can CANCEL the check (status→CANCELLED, fcraStatus irrelevant).
 *  RESOLVED and ADVERSE_ACTION_SENT are terminal fcraStatus values.
 */

export type BackgroundCheckStatus =
	| 'PENDING'
	| 'COMPLETE'
	| 'CONSIDER'
	| 'FAILED'
	| 'CANCELLED';

export type BackgroundCheckProvider = 'CHECKR' | 'STERLING';

export type FcraStatus =
	| 'NONE'
	| 'PRE_ADVERSE_SENT'
	| 'ADVERSE_ACTION_SENT'
	| 'RESOLVED';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * FCRA "reasonable" waiting period in calendar days.
 * Industry standard is 5 days. Some jurisdictions require business days;
 * see docs/TODOS.md [P3] for configurable waiting period.
 */
export const FCRA_WAITING_PERIOD_DAYS = 5;

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
// FCRA state machine guards
// ---------------------------------------------------------------------------

/**
 * Returns true if a pre-adverse action notice can be sent.
 * Only allowed when fcraStatus is NONE (notice has not been sent yet).
 */
export function canSendPreAdverseNotice(fcraStatus: FcraStatus): boolean {
	return fcraStatus === 'NONE';
}

/**
 * Returns true if the adverse action can be finalized.
 * Only allowed after the pre-adverse notice has been sent.
 */
export function canFinalizeAdverseAction(fcraStatus: FcraStatus): boolean {
	return fcraStatus === 'PRE_ADVERSE_SENT';
}

/**
 * Returns true if the FCRA process can be resolved favorably
 * (e.g., staff issues a credential during the waiting period).
 * Allowed from NONE (no adverse process started) or PRE_ADVERSE_SENT
 * (during the waiting period).
 */
export function canResolveFcra(fcraStatus: FcraStatus): boolean {
	return fcraStatus === 'NONE' || fcraStatus === 'PRE_ADVERSE_SENT';
}

/**
 * Returns true if the FCRA waiting period has elapsed since the
 * pre-adverse notice was sent. Uses calendar days.
 */
export function isWaitingPeriodElapsed(sentAt: Date, now: Date): boolean {
	const diffMs = now.getTime() - sentAt.getTime();
	const diffDays = diffMs / (1000 * 60 * 60 * 24);
	return diffDays >= FCRA_WAITING_PERIOD_DAYS;
}

/**
 * Returns the number of full days remaining in the waiting period.
 * Returns 0 if the period has elapsed.
 */
export function waitingPeriodDaysRemaining(sentAt: Date, now: Date): number {
	const diffMs = now.getTime() - sentAt.getTime();
	const diffDays = diffMs / (1000 * 60 * 60 * 24);
	const remaining = FCRA_WAITING_PERIOD_DAYS - diffDays;
	return remaining > 0 ? Math.ceil(remaining) : 0;
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
