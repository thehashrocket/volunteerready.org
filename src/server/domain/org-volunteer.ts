import { z } from 'zod';
import type { OrgVolunteerSource } from '@/prisma/generated/client';

// ---------------------------------------------------------------------------
// Org volunteer roster — shared client/server validation + pure helpers
// ---------------------------------------------------------------------------

/** Max length of the org-typed display name, enforced on both sides. */
export const DISPLAY_NAME_MAX = 120;

/**
 * Hard cap on the "Organizations you volunteer with" list.
 *
 * Not pagination — a volunteer manages their own handful of memberships and a
 * "load more" there would be stranger than a long list. This is the backstop
 * for the fact that the row count is not the volunteer's to control: any org's
 * staff can add any email address without consent, so the ceiling is however
 * many orgs an attacker holds. Set far above any honest count.
 */
export const MY_MEMBERSHIPS_CAP = 200;

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
 * How many attended shifts the volunteer detail dialog SENDS to the client.
 *
 * A wire cap, not a query cap, and the distinction is load-bearing in both
 * directions. The read stays uncapped because the hours total and the "N
 * attended" figure are computed from every row and sit under a roster cell
 * showing the uncapped `countAttendedShiftsByUser` — a `take` on the query
 * would silently under-report both and contradict the row the coordinator just
 * clicked. But shipping every row is O(tenure): a daily volunteer over five
 * years is ~1800 rows (~420KB with superjson's per-Date metadata) transferred
 * to paint fifty list items. So the service sums across all of them and sends
 * this many, plus the count, and the dialog says "showing N of M".
 *
 * Lives in domain because BOTH layers need it — the service slices on it and
 * the dialog's copy names it. It was briefly a client-only constant, which
 * meant the server had no ceiling available to it even in principle.
 */
export const SHIFT_HISTORY_WIRE_CAP = 50;

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
 * Days after signup within which staff-added rows count toward the roster
 * launch's primary success metric.
 *
 * Named because the number is used twice: once as the query's window and once in
 * the sentence the admin page renders describing that window. As two literals,
 * changing the metric in one place made the UI describe a window the query did
 * not use.
 */
export const ROSTER_ACTIVATION_WINDOW_DAYS = 7;

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

/**
 * Upper bound for an `OrgVolunteer.id` arriving from a client.
 *
 * The id is a cuid (25 chars today); 64 is slack for a future id format without
 * leaving the input an unbounded string. Shared so the bound is decided once.
 * Every `volunteerId` input on `volunteersRouter` now uses it; the roster
 * cursor carries its own `max(64)` because it is a different kind of value.
 */
export const ORG_VOLUNTEER_ID_MAX = 64;

export const orgVolunteerIdSchema = z.string().min(1).max(ORG_VOLUNTEER_ID_MAX);

/**
 * Why a volunteer is on an org's roster, told to the volunteer themselves.
 *
 * A `Record` over the enum rather than a ternary with an `else` branch, so
 * adding a third `OrgVolunteerSource` — T17's concierge import is an open task
 * that would add exactly that — becomes a TYPE ERROR at every render site
 * instead of silently telling a bulk-imported volunteer that "their staff"
 * added them by hand. This renders on the consent surface whose entire job is
 * answering "why am I on this list?", where a confidently wrong answer is worse
 * than no answer.
 */
export const ORG_VOLUNTEER_SOURCE_COPY: Record<OrgVolunteerSource, string> = {
	STAFF_ADDED: 'Added by their staff',
	APPLIED: 'Added when they approved your application',
};

/**
 * The same fact, told to the ORG'S STAFF.
 *
 * A second Record rather than reusing the one above, because that copy is
 * second-person **to the volunteer** — "they" is the org and "your" is the
 * volunteer's. Rendered on a staff surface it inverts: a coordinator reading
 * "Added when they approved your application" sees the volunteer approving the
 * coordinator's application, which is backwards, and "Added by their staff"
 * reads as some other organisation's staff.
 *
 * T27 shipped the volunteer Record into the staff detail dialog and was caught
 * in review. The comment it shipped with drew the wrong lesson — that sharing
 * the Record means "the two surfaces cannot tell different stories about one
 * row". The correct lesson is narrower: **share the ENUM, never pronoun-bearing
 * prose.** Exhaustiveness is what the Record buys; voice is per-audience.
 *
 * Still a `Record` for the original reason: a third `OrgVolunteerSource` must
 * be a type error at every render site, in both voices.
 */
export const ORG_VOLUNTEER_SOURCE_COPY_STAFF: Record<
	OrgVolunteerSource,
	string
> = {
	STAFF_ADDED: 'Added by your team',
	APPLIED: 'Added when you approved their application',
};

/**
 * Why an org appears on the volunteer's own "organizations" list.
 *
 * Wider than `OrgVolunteerSource`, because that enum only describes a ROSTER
 * ROW and this list stopped being roster rows in v0.37.0.0. An org that removed
 * someone from its roster still holds their `VolunteerApplication` or a
 * `ShiftSignup`, and both keep satisfying `findOrgVolunteerRelationship` — so
 * both must be leavable. Otherwise an org that saw a departure coming could
 * pre-empt it by removing the volunteer first, leaving them no control at all
 * while the org kept `credentials.issue` and `backgroundChecks.initiate`.
 *
 * A `Record` for the same reason as `ORG_VOLUNTEER_SOURCE_COPY`: a new reason
 * has to be a type error at every render site, not a silently wrong sentence on
 * the surface whose entire job is answering "why is this organization here?".
 */
export type MyOrgRelationshipReason =
	/** Live roster row, `source: STAFF_ADDED`. */
	| 'STAFF_ADDED'
	/** Live roster row, `source: APPLIED`. */
	| 'APPLIED'
	/** No roster row, but an application they submitted. */
	| 'APPLICATION_ONLY'
	/** No roster row and no application — only a shift signup. */
	| 'SHIFT_ONLY';

export const MY_ORG_RELATIONSHIP_COPY: Record<MyOrgRelationshipReason, string> =
	{
		STAFF_ADDED: 'Added by their staff',
		APPLIED: 'Added when they approved your application',
		// These two deliberately do NOT say "roster". They mean the org has access
		// WITHOUT a roster row — precisely the case this list exists to surface —
		// and claiming a roster membership that does not exist would be the
		// confidently-wrong answer the Record shape is here to prevent.
		APPLICATION_ONLY: 'You applied to this organization',
		SHIFT_ONLY: 'You were signed up for one of their shifts',
	};

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
