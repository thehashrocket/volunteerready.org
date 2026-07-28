import { z } from 'zod';

// ---------------------------------------------------------------------------
// Org volunteer roster — shared client/server validation + pure helpers
// ---------------------------------------------------------------------------

/** Max length of the org-typed display name, enforced on both sides. */
export const DISPLAY_NAME_MAX = 120;

/** Roster page size for cursor pagination. */
export const ROSTER_PAGE_SIZE = 25;

/**
 * How many roster rows the assign-to-shift picker offers at once.
 *
 * The picker is a search box, not a browsable list — it has no "load more",
 * because the coordinator already knows which person they are looking for and
 * typing two more letters is faster than paging. The cap keeps the popover
 * scannable; a coordinator whose match is not in the first 20 narrows instead.
 */
export const ASSIGN_PICKER_LIMIT = 20;

/**
 * Threshold at which a roster counts as "populated".
 *
 * Three things must agree on this number: the primary success metric (orgs
 * with >= 10 roster rows within 7 days), the T20 onboarding checklist
 * milestone, and the point at which the concierge "send us your spreadsheet"
 * offer stops being shown. If they drift, the product starts congratulating an
 * org for finishing something it is still nagging them about.
 */
export const ROSTER_POPULATED_THRESHOLD = 10;

/**
 * Canonical email form. MUST match the database trigger
 * (`normalize_user_email`, migration 20260726231500) exactly — that trigger is
 * `lower(btrim(...))`. If these two ever disagree, a lookup built on this
 * helper stops finding rows the trigger wrote, which is precisely the
 * fail-open bug T1 was written to close.
 *
 * The database is the enforcement point; this exists so callers can look a row
 * up by the same key it was stored under.
 */
export function normalizeEmail(email: string): string {
	return email.trim().toLowerCase();
}

export const volunteerEmailSchema = z
	.string()
	.trim()
	.min(1, 'Email is required.')
	.email('Enter a valid email address.')
	// RFC 5321 cap. Without it this is the one unbounded write in an otherwise
	// bounded schema set, and it is also the dedupe key.
	.max(254, 'Email must be 254 characters or fewer.')
	.transform(normalizeEmail);

export const displayNameSchema = z
	.string()
	.trim()
	.min(1, 'Name is required.')
	.max(
		DISPLAY_NAME_MAX,
		`Name must be ${DISPLAY_NAME_MAX} characters or fewer.`,
	);

/**
 * Phone is org-entered free text, deliberately not validated beyond a length
 * cap. Coordinators type "555-1234 (cell)" and "ext 12" and both are useful to
 * them; rejecting those buys nothing and loses data.
 */
export const volunteerPhoneSchema = z
	.string()
	.trim()
	.max(50, 'Phone must be 50 characters or fewer.')
	.optional()
	.nullable();

export const addVolunteerSchema = z.object({
	displayName: displayNameSchema,
	email: volunteerEmailSchema,
	phone: volunteerPhoneSchema,
});

export type AddVolunteerInput = z.infer<typeof addVolunteerSchema>;

/**
 * Outcome of an add, which the UI turns into one of three toasts.
 *
 * SECURITY: `CREATED_SHADOW` and `LINKED_UNCLAIMED` MUST produce identical
 * user-facing copy. Security §7 accepted account enumeration by reasoning
 * about "email unknown" vs "email belongs to an existing user" — but there are
 * three branches, not two. If the other-org-UNCLAIMED case reads differently,
 * the coordinator learns that *another organisation already has this person on
 * their roster*, which is cross-org membership disclosure and is NOT what §7
 * accepted. The two are distinguished here only so the service can decide
 * whether to send the notification email.
 */
export type AddVolunteerOutcome =
	/** No User existed; a shadow UNCLAIMED row was minted. */
	| 'CREATED_SHADOW'
	/** An UNCLAIMED User another org created was linked. No email sent. */
	| 'LINKED_UNCLAIMED'
	/** A real ACTIVE user was linked. They get a notification email. */
	| 'LINKED_ACTIVE';

/** Outcomes that must never be distinguishable in the UI. See above. */
export const INDISTINGUISHABLE_OUTCOMES: readonly AddVolunteerOutcome[] = [
	'CREATED_SHADOW',
	'LINKED_UNCLAIMED',
];

export function shouldNotifyByEmail(outcome: AddVolunteerOutcome): boolean {
	return outcome === 'LINKED_ACTIVE';
}

/**
 * What the CLIENT is allowed to learn about an add.
 *
 * `AddVolunteerOutcome` must never cross the tRPC boundary. Rendering identical
 * toast copy for `CREATED_SHADOW` and `LINKED_UNCLAIMED` is not enough if the
 * JSON response still names them differently — a coordinator with devtools open
 * reads `LINKED_UNCLAIMED` and learns that ANOTHER ORGANISATION already has
 * this person on its roster. That is cross-org membership disclosure, which
 * Security §7 explicitly did not accept, and it defeats the entire
 * indistinguishability effort at the transport layer.
 *
 * The client needs exactly one bit: did we email them? Everything else is
 * internal, so this collapses three outcomes into two.
 */
export type AddVolunteerClientResult = {
	volunteerId: string;
	displayName: string;
	/** True only for the ACTIVE branch, which is the only one that sends mail. */
	notified: boolean;
};

export function toClientResult(result: {
	volunteerId: string;
	displayName: string;
	outcome: AddVolunteerOutcome;
}): AddVolunteerClientResult {
	return {
		volunteerId: result.volunteerId,
		displayName: result.displayName,
		notified: shouldNotifyByEmail(result.outcome),
	};
}
