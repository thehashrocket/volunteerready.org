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
// Status mapping — provider result string → internal status
// ---------------------------------------------------------------------------

/**
 * Maps a background check provider's result string to our internal status.
 *
 * Both Checkr and Sterling use the same result vocabulary:
 *   'clear'    → COMPLETE (auto-issue credential)
 *   'consider' → CONSIDER (staff review required)
 *   anything else (e.g. 'adverse_action', 'suspended', 'dispute') → FAILED
 */
export function mapResultToStatus(result: string): BackgroundCheckStatus {
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
// Identity binding — does the submitted PII describe the named volunteer?
// ---------------------------------------------------------------------------

/**
 * Name particles that carry no identifying information, and so must NOT be
 * allowed to satisfy the overlap test on their own.
 *
 * Without this list `submittedNameMatchesAccount('John Smith Jr', 'Robert',
 * 'Jones Jr')` returns true on the shared "jr" — a false NEGATIVE in the only
 * direction that matters here, since a mismatch is the thing being looked for.
 */
const NON_IDENTIFYING_NAME_TOKENS = new Set([
	'jr',
	'sr',
	'ii',
	'iii',
	'iv',
	'mr',
	'mrs',
	'ms',
	'mx',
	'dr',
]);

/**
 * Lowercase, strip diacritics and punctuation, split into meaningful tokens.
 *
 * The separator class keeps `\p{M}` as well as `\p{L}\p{N}`, with the `u` flag,
 * and it took two adversarial passes to get there. `[^a-z0-9]` shipped first and
 * silently deleted every non-Latin script \u2014 a Chinese, Korean, Greek, Cyrillic,
 * Arabic or Hebrew name tokenized to the EMPTY set, which the caller reads as
 * "nothing to compare" and never flags. Widening to `\p{L}\p{N}` then SHATTERED
 * the scripts that write vowels as combining marks: Devanagari and Thai marks
 * are `\p{M}`, so `\u0936\u0930\u094d\u092e\u093e` fell apart into three one-letter fragments that match
 * almost anything. Both bugs are invisible in tests written in English.
 *
 * The explicit `\u0300-\u036f` strip above stays and does not conflict: that
 * block is Latin combining diacritics only, so accents are folded for
 * accent-insensitive matching while every other script keeps the marks that are
 * part of its letters.
 */
function nameTokens(value: string): Set<string> {
	const tokens = value
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.replace(/[^\p{L}\p{N}\p{M}]+/gu, ' ')
		.trim()
		.split(' ')
		.filter((t) => t.length > 0 && !NON_IDENTIFYING_NAME_TOKENS.has(t));
	return new Set(tokens);
}

/**
 * Does this submitted token correspond to something in the account's name?
 *
 * Equality, plus containment in either direction. Containment is what makes
 * scripts WITHOUT word separators work: a Japanese account name is one token
 * (`\u5c71\u7530\u592a\u90ce`) while the form splits it across two fields (`\u592a\u90ce` / `\u5c71\u7530`), so
 * pure set equality reports a mismatch for every such volunteer \u2014 the opposite
 * error from the ASCII bug above, and just as one-sided.
 *
 * **A one-character token is handled by SCRIPT, not by length**, and both of the
 * obvious rules are wrong in opposite directions \u2014 each was found by a separate
 * adversarial round:
 *
 *   - Blanket-refusing containment for 1-char tokens flags the majority of
 *     Chinese names. Chinese surnames ARE one character, so `\u738b\u5c0f\u660e` split as
 *     `\u738b` / `\u5c0f\u660e` could never corroborate its own surname, and every
 *     legitimate check stamped `identityNameMismatch`.
 *   - Blanket-allowing it corroborates on a letter buried in a word: `A Doe`
 *     against a stored `Jane Doe` passes because `jane` contains `a`.
 *
 * The discriminator is whether the character belongs to a CASED script. A Latin,
 * Greek or Cyrillic letter is a fragment of a word and means nothing inside one;
 * an ideograph or syllable is a whole morpheme and is exactly how separator-less
 * names decompose. `c.toLowerCase() !== c.toUpperCase()` is the cheap, complete
 * test for casedness \u2014 no script table to maintain.
 *
 * Containment still costs some sensitivity in Latin scripts ("Ann" inside
 * "Joanne"), which is the acceptable direction for a signal deliberately tuned
 * against false positives. The `other.length >= 2` floor stays on the ACCOUNT
 * side so two one-character tokens can never match by accident.
 */
function isCased(text: string): boolean {
	return text.toLowerCase() !== text.toUpperCase();
}

function tokenCorresponds(token: string, account: Set<string>): boolean {
	if (account.has(token)) return true;
	// A single letter of a cased script is a fragment, not a name \u2014 require the
	// exact match handled above and nothing looser.
	if (token.length === 1 && isCased(token)) return false;
	for (const other of account) {
		if (other.length >= 2 && (other.includes(token) || token.includes(other))) {
			return true;
		}
	}
	return false;
}

/**
 * How many submitted tokens must correspond before the names are accepted.
 *
 * Two whenever both sides can offer two — a single shared token is what two
 * DIFFERENT people in one spreadsheet have (`Robert Smith` vs `John Smith`).
 *
 * The subtlety is the one-token account, which is two different situations
 * wearing the same shape, and the discriminator is whether that token EQUALS a
 * submitted one:
 *
 *   - A mononym (`Smith`, `Bob`). It equals a submitted token, and one
 *     correspondence is all it can ever supply, so demanding two would flag
 *     every such account forever.
 *   - A separator-less full name (`山田太郎`, `김민수`). It equals nothing and
 *     CONTAINS the submitted tokens instead — it can corroborate both, so it
 *     must. Without this branch `山田太郎` accepted `花子 山田`: a shared family
 *     name and a different person, which is precisely the case the whole signal
 *     exists to record. Caught by the Codex structured review.
 */
function requiredCorrespondences(
	account: Set<string>,
	submitted: Set<string>,
): number {
	if (account.size === 1) {
		const [only] = account;
		if (submitted.has(only)) return 1;
	}
	return Math.min(2, submitted.size);
}

/**
 * Does the legal name typed on the initiate form plausibly belong to the person
 * whose account the check is being filed against?
 *
 * This is a SIGNAL, not a gate, and the asymmetry is deliberate. A person's
 * legal name and the name on their account routinely differ — preferred names,
 * marriage, transliteration, a roster imported from a spreadsheet that held
 * "Bob" — so refusing on a mismatch would block real checks for real people.
 * The caller records the mismatch on the audit row instead, where it is
 * evidence in the dispute this whole path exists to make reconstructable.
 *
 * The test is token CORRESPONDENCE rather than equality: "Jane Q. Smith-Jones"
 * against a stored "Jane Smith" must not flag. It answers "could this be the
 * same human?", not "is this the same string?".
 *
 * **How many tokens must correspond is the whole calibration**, and one is not
 * enough. A single shared token clears `Robert Smith` against a stored
 * `John Smith` and `Maria Lopez` against `Maria Garcia` — a shared surname or a
 * shared given name is exactly what two DIFFERENT people in one spreadsheet
 * have, so the one-token rule was blind to the likeliest wrong-row case. It now
 * requires TWO correspondences whenever both sides offer two, falling back to
 * one when either side is a single token (a `Bob`-only account, or a
 * separator-less script). Raised after the Codex adversarial pass.
 *
 * @returns true when there is no evidence of a mismatch — including when the
 *          account carries no name at all, which is common for shadow users
 *          created from an email address and is not a discrepancy.
 */
export function submittedNameMatchesAccount(
	accountName: string | null | undefined,
	firstName: string,
	lastName: string,
): boolean {
	if (!accountName?.trim()) return true;

	const account = nameTokens(accountName);
	const submitted = nameTokens(`${firstName} ${lastName}`);

	// Nothing identifying on either side — no claim either way, so no flag.
	if (account.size === 0 || submitted.size === 0) return true;

	let corresponding = 0;
	for (const token of submitted) {
		if (tokenCorresponds(token, account)) corresponding++;
	}

	return corresponding >= requiredCorrespondences(account, submitted);
}

// ---------------------------------------------------------------------------
// PII sanitization
// ---------------------------------------------------------------------------

/**
 * Known PII field names from background check webhook payloads.
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
 * Strips known PII fields from a webhook payload before DB storage.
 * Returns a plain Record — cast to Prisma.InputJsonValue at the call site.
 *
 * - Handles nested objects recursively.
 * - Arrays: each element is sanitized if it is an object.
 * - Non-object values are returned as-is.
 */
export function sanitizeWebhookPayload(
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
					? sanitizeWebhookPayload(item)
					: item,
			);
		} else if (typeof value === 'object' && value !== null) {
			result[key] = sanitizeWebhookPayload(value);
		} else {
			result[key] = value;
		}
	}

	return result;
}
