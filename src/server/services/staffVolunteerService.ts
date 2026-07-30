import { TRPCError } from '@trpc/server';
import {
	type AddVolunteerOutcome,
	normalizeEmail,
	shouldNotifyByEmail,
} from '@/server/domain/org-volunteer';
import { isUniqueViolationOn } from '@/server/lib/prisma-errors';
import { writeAuditLogTx } from '@/server/repositories/auditRepo';
import {
	countAttendedShiftsByUser,
	countOrgVolunteers,
	createOrgVolunteer,
	createOrgVolunteerBlock,
	findLiveOrgVolunteer,
	findOrgVolunteerBlock,
	findRemovedOrgVolunteer,
	hasLeavableOrgRelationship,
	listMyOrgRelationships,
	listOrgVolunteers,
	restoreOrgVolunteer,
	softDeleteOrgVolunteer,
	softDeleteOwnOrgVolunteerByOrg,
} from '@/server/repositories/orgVolunteerRepo';
import { prisma } from '@/server/repositories/prisma';
import { sendRosterAddedEmail } from '@/server/repositories/sendRosterAddedEmail';

/**
 * Thrown when the volunteer is already on this org's live roster.
 *
 * Surfaced as CONFLICT so the UI can render "Already on your roster" as an
 * inline note rather than an error toast — it is a no-op, not a failure, and
 * treating it as an error trains coordinators to dismiss real errors.
 */
function alreadyOnRoster() {
	return new TRPCError({
		code: 'CONFLICT',
		message: 'Already on your roster',
	});
}

/**
 * True only for a P2002 raised by the ROSTER uniqueness constraint.
 *
 * The transaction also writes `User`, which carries its own unique indexes on
 * email. Two coordinators at DIFFERENT orgs adding the same brand-new address
 * concurrently both take the `!existing` branch; the loser's `user.create`
 * raises P2002 on `User_email_key`. Treating that as "Already on your roster"
 * would tell a coordinator something false about their own roster AND leak that
 * the address now exists platform-wide. Narrow to the constraint we mean.
 */
function isRosterDuplicate(err: unknown): boolean {
	return isUniqueViolationOn(err, 'OrgVolunteer_orgId_userId_active');
}

/**
 * Thrown when the volunteer has left this org's roster and refused its access.
 *
 * FORBIDDEN, not the NOT_FOUND that `requireOrgVolunteerRelationship` uses. That
 * guard hides "not yours" behind "not real" because it takes a `userId` from
 * input and a caller could otherwise probe ids. Here the input is an email the
 * coordinator already typed, about a person who was on their roster until that
 * person removed themselves — the org already knows they exist, so there is
 * nothing left to conceal and a vague error would just generate support mail.
 *
 * The copy names no mechanism ("blocked", "revoked") on purpose. The staff-side
 * fact is simply that this is not theirs to undo; the volunteer re-engaging is
 * what lifts it.
 */
function refusedByVolunteer() {
	return new TRPCError({
		code: 'FORBIDDEN',
		message:
			'This person left your roster and asked not to be added back. They can rejoin by applying or signing up for one of your shifts.',
	});
}

export type AddVolunteerResult = {
	outcome: AddVolunteerOutcome;
	volunteerId: string;
	userId: string;
	displayName: string;
	/** True when a notification email should go out (T12 owns sending it). */
	notify: boolean;
};

/**
 * Add a volunteer to an org roster. Three branches, per Flow §1.
 *
 *   normalize email
 *        │
 *        ├── no User            → mint shadow User (UNCLAIMED) + profile + edge
 *        ├── User is ACTIVE     → edge only, then notify them by email
 *        └── User is UNCLAIMED  → edge only, NO email (another org made them)
 *
 * The last two differ only in whether mail goes out. Their user-facing copy MUST
 * be identical — see INDISTINGUISHABLE_OUTCOMES in the domain module.
 *
 * The notification send is deliberately NOT inside the transaction and NOT
 * awaited here: Resend being down must not roll back a roster row the
 * coordinator can see on their screen. This function fires it after commit,
 * unless `sendNotification: false` — see that option.
 */
export async function addVolunteer(input: {
	orgId: string;
	displayName: string;
	email: string;
	phone?: string | null;
	actorId: string | null;
	impersonatedBy?: string | null;
	/**
	 * Provenance, stamped on the audit row. Omitted for the interactive form so
	 * existing audit metadata keeps its shape; the concierge importer (T17) sets
	 * it so a bulk-loaded roster is distinguishable from one typed in by hand.
	 *
	 * Deliberately NOT a third `OrgVolunteerSource`. The success metric counts
	 * `source = STAFF_ADDED` rows, and an imported row IS staff-added — the
	 * staff sent us the spreadsheet. Splitting the enum would drop every
	 * concierge-onboarded org out of the metric the concierge motion exists to
	 * move, and `ORG_VOLUNTEER_SOURCE_COPY` would need a fourth sentence saying
	 * the same thing as "Added by their staff".
	 */
	via?: 'CONCIERGE_IMPORT';
	/**
	 * Whether THIS call sends the roster-added email. Default true — the
	 * interactive path is unchanged.
	 *
	 * The importer passes false and sends them itself after the loop, awaited
	 * and paced. Firing 60 un-awaited sends at Resend in a tight loop gets rate
	 * limited, and the failure lands in a `.catch(console.error)` on a promise
	 * nobody is holding — so the population that most needs this email (people
	 * added from a spreadsheet they never saw) is the one whose notices would
	 * silently vanish. The returned `notify` flag is unaffected either way: it
	 * reports what is OWED, not what was sent.
	 */
	sendNotification?: boolean;
}): Promise<AddVolunteerResult> {
	const email = normalizeEmail(input.email);
	const displayName = input.displayName.trim();

	let result: AddVolunteerResult;
	try {
		result = await prisma.$transaction(async (tx) => {
			const existing = await tx.user.findUnique({
				where: { email },
				select: { id: true, name: true, accountState: true },
			});

			let userId: string;
			let outcome: AddVolunteerOutcome;

			if (!existing) {
				// Shadow user. VolunteerProfile is created PRIVATE so the person is
				// invisible to volunteer discovery, which hardcodes visibility PUBLIC.
				const created = await tx.user.create({
					data: {
						email,
						name: displayName,
						accountState: 'UNCLAIMED',
						profile: { create: { visibility: 'PRIVATE' } },
					},
					select: { id: true },
				});
				userId = created.id;
				outcome = 'CREATED_SHADOW';
			} else {
				userId = existing.id;
				outcome =
					existing.accountState === 'ACTIVE'
						? 'LINKED_ACTIVE'
						: 'LINKED_UNCLAIMED';

				// User.name is FIRST-WRITER-WINS: only set when currently null.
				// Overwriting would let org B rename a person across every surface
				// that reads User.name — and the never-write-User.name alternative
				// was scoped three times and abandoned (NOT in scope #4).
				if (existing.name === null) {
					await tx.user.update({
						where: { id: userId },
						data: { name: displayName },
					});
				}
			}

			// Guard the common case with a clear error before relying on the
			// partial unique index to catch the concurrent one.
			const live = await findLiveOrgVolunteer(input.orgId, userId, tx);
			if (live) throw alreadyOnRoster();

			// The volunteer's refusal outranks the coordinator's add. Checked here
			// rather than left to `findOrgVolunteerRelationship` because that guard
			// governs ACTIONS on a volunteer, not roster membership itself: without
			// this, the add would succeed and put a row on the roster page that
			// cannot be scheduled, credentialed, or background-checked, with no
			// explanation anywhere in the UI.
			//
			// Inside the transaction and after the User branch above, so a shadow
			// user minted moments ago is rolled back rather than left orphaned by a
			// refusal.
			//
			// This is a read-then-insert under READ COMMITTED with no lock on the
			// pair, so a leave committing between this read and the insert still
			// produces a live roster row beside a block. That window is accepted,
			// not closed: the resulting row is inert — `findOrgVolunteerRelationship`
			// suppresses it and `assignVolunteerToShift` re-checks — so the failure
			// mode is a confusing roster entry, not regained access.
			const blocked = await findOrgVolunteerBlock(input.orgId, userId, tx);
			if (blocked) throw refusedByVolunteer();

			const volunteer = await createOrgVolunteer(tx, {
				orgId: input.orgId,
				userId,
				displayName,
				phone: input.phone ?? null,
				source: 'STAFF_ADDED',
				addedByUserId: input.actorId,
			});

			await writeAuditLogTx(tx, {
				orgId: input.orgId,
				actorId: input.actorId,
				action: 'VOLUNTEER_ADDED',
				entityType: 'OrgVolunteer',
				entityId: volunteer.id,
				metadata: {
					email,
					outcome,
					...(input.via ? { via: input.via } : {}),
					// Attributes the action to the real admin, not just the
					// impersonated user, per the v0.30.0.0 convention.
					...(input.impersonatedBy
						? { impersonatedBy: input.impersonatedBy }
						: {}),
				},
			});

			return {
				outcome,
				volunteerId: volunteer.id,
				userId,
				displayName,
				notify: shouldNotifyByEmail(outcome),
			};
		});
	} catch (err) {
		// Two coordinators adding the same email at once: the findFirst above
		// passes for both, and the partial unique index rejects the loser.
		// A User-email P2002 is a DIFFERENT race and must not claim otherwise.
		if (isRosterDuplicate(err)) throw alreadyOnRoster();
		throw err;
	}

	// AFTER commit, and deliberately not awaited. Resend being down must not roll
	// back a roster row the coordinator can already see on their screen — the
	// failure mode we want is "one email missing", not "the row vanished".
	// `.catch(console.error)`, never a bare `void`: an unhandled rejection here
	// would take the process down (learning: nextauth-events-createuser-void-rejection).
	if (result.notify && input.sendNotification !== false) {
		void notifyRosterAdd(input.orgId, input.actorId, email).catch(
			console.error,
		);
	}

	return result;
}

/**
 * The display context a roster-added notice needs: both values are invariant for
 * a whole import run.
 *
 * Exported so a bulk sender resolves them ONCE. `notifyRosterAdd` below re-reads
 * them per recipient, which is right for a single interactive add and wasteful
 * for sixty — pre-fix, a 60-row import issued 120 redundant single-row reads for
 * an org name that cannot change mid-run.
 */
export async function resolveRosterNotificationContext(
	orgId: string,
	actorId: string | null,
): Promise<{ orgName: string; addedByName: string | null } | null> {
	const [org, actor] = await Promise.all([
		prisma.organization.findUnique({
			where: { id: orgId },
			select: { name: true },
		}),
		actorId
			? prisma.user.findUnique({
					where: { id: actorId },
					select: { name: true },
				})
			: Promise.resolve(null),
	]);

	if (!org) return null;
	return { orgName: org.name, addedByName: actor?.name ?? null };
}

/** Send one notice against an already-resolved context. */
export function sendRosterAddedNotice(
	context: { orgName: string; addedByName: string | null },
	to: string,
) {
	return sendRosterAddedEmail({
		to,
		orgName: context.orgName,
		addedByName: context.addedByName,
	});
}

/**
 * Look up the display context the notification needs, then send it.
 *
 * The single-add path. A bulk sender should resolve the context once with
 * `resolveRosterNotificationContext` and call `sendRosterAddedNotice` per
 * recipient instead.
 */
async function notifyRosterAdd(
	orgId: string,
	actorId: string | null,
	to: string,
) {
	const [org, actor] = await Promise.all([
		prisma.organization.findUnique({
			where: { id: orgId },
			select: { name: true },
		}),
		actorId
			? prisma.user.findUnique({
					where: { id: actorId },
					select: { name: true },
				})
			: Promise.resolve(null),
	]);

	if (!org) return;

	await sendRosterAddedEmail({
		to,
		orgName: org.name,
		addedByName: actor?.name ?? null,
	});
}

/**
 * Remove a volunteer from the roster. Soft delete — ShiftSignup rows and every
 * recorded hour survive, and the same person can be re-added immediately
 * because the unique index is scoped `WHERE deletedAt IS NULL`.
 */
export async function removeVolunteer(input: {
	orgId: string;
	volunteerId: string;
	actorId: string | null;
	impersonatedBy?: string | null;
}) {
	return prisma.$transaction(async (tx) => {
		const count = await softDeleteOrgVolunteer(
			tx,
			input.orgId,
			input.volunteerId,
		);
		if (count === 0) {
			throw new TRPCError({
				code: 'NOT_FOUND',
				message: 'Volunteer not found on your roster.',
			});
		}

		await writeAuditLogTx(tx, {
			orgId: input.orgId,
			actorId: input.actorId,
			action: 'VOLUNTEER_REMOVED',
			entityType: 'OrgVolunteer',
			entityId: input.volunteerId,
			metadata: {
				...(input.impersonatedBy
					? { impersonatedBy: input.impersonatedBy }
					: {}),
			},
		});

		return { id: input.volunteerId };
	});
}

/**
 * Undo a removal (T26's Undo toast). Restores the same row so provenance —
 * who added them, when — survives, which a re-add would not preserve.
 *
 * SECURITY: this is the FOURTH path that can put a live roster row in front of
 * staff, and the one easiest to miss, because it does not look like a create.
 * `restoreOrgVolunteer` matches any row with `deletedAt` set for the org, and
 * `softDeleteOwnOrgVolunteerByOrg` — a volunteer leaving — produces exactly such a
 * row. Nothing on `OrgVolunteer` records who deleted it, so without the block
 * check below staff could undo a departure the volunteer chose, using an id
 * their roster page handed them before the volunteer left.
 */
export async function restoreVolunteer(input: {
	orgId: string;
	volunteerId: string;
	actorId: string | null;
	impersonatedBy?: string | null;
}) {
	try {
		return await prisma.$transaction(async (tx) => {
			// Read before restoring: the block is keyed on userId, which only the
			// row carries, and a restore that has already happened cannot be undone
			// by throwing afterwards.
			const removed = await findRemovedOrgVolunteer(
				tx,
				input.orgId,
				input.volunteerId,
			);
			if (!removed) {
				throw new TRPCError({
					code: 'NOT_FOUND',
					message: 'That removal can no longer be undone.',
				});
			}

			if (await findOrgVolunteerBlock(input.orgId, removed.userId, tx)) {
				throw refusedByVolunteer();
			}

			const count = await restoreOrgVolunteer(
				tx,
				input.orgId,
				input.volunteerId,
			);
			if (count === 0) {
				throw new TRPCError({
					code: 'NOT_FOUND',
					message: 'That removal can no longer be undone.',
				});
			}

			await writeAuditLogTx(tx, {
				orgId: input.orgId,
				actorId: input.actorId,
				action: 'VOLUNTEER_RESTORED',
				entityType: 'OrgVolunteer',
				entityId: input.volunteerId,
				metadata: {
					...(input.impersonatedBy
						? { impersonatedBy: input.impersonatedBy }
						: {}),
				},
			});

			return { id: input.volunteerId };
		});
	} catch (err) {
		// The volunteer was re-added between the removal and the Undo, so a live
		// row already exists. The user's intent is satisfied either way.
		if (isRosterDuplicate(err)) {
			throw new TRPCError({
				code: 'CONFLICT',
				message: 'They are already back on your roster.',
			});
		}
		throw err;
	}
}

/**
 * The orgs that can currently act on the caller (T32, widened in v0.37.0.0).
 *
 * Lives in this service, beside `removeVolunteer`, rather than in a
 * volunteer-facing one: leaving and being removed are the same soft delete over
 * the same partial unique index, and splitting them across two files is how the
 * two sets of rules drift.
 *
 * No longer "orgs that have you on a roster". It lists orgs holding ANY edge
 * that authorizes them — roster row, application, or shift signup — because
 * listing only roster rows let an org deny the remedy by removing the volunteer
 * first. See `listMyOrgRelationships`.
 */
export function listMyOrgMemberships(userId: string) {
	return listMyOrgRelationships(userId);
}

/**
 * Leave an org's roster — the volunteer's own exit from an edge staff created.
 *
 * This is the surface Security §2 assumed existed when it accepted the
 * wrong-email risk with "that user is notified and can remove the roster link",
 * and that `sendRosterAddedEmail` already promises in writing. Staff can add any
 * address they know without consent, so without this the person on the receiving
 * end has no recourse at all.
 *
 * Deliberately NOT behind `rosterProcedure`. `ensureAppliedRosterRow` creates
 * edges on approval for every org whether or not the pilot flag is on, so gating
 * the exit on the flag would strand volunteers on rosters they cannot leave. The
 * design doc's gating table makes this split explicit.
 *
 * Soft delete, same as staff removal: recorded hours and `ShiftSignup` rows
 * survive, so leaving does not erase work the org legitimately recorded.
 *
 * It IS a block, as of v0.37.0.0 — this paragraph previously said the opposite,
 * and that was true when T32 shipped. The soft delete alone revoked nothing:
 * every other edge in `findOrgVolunteerRelationship` is one staff can mint from
 * an email address, so the org could undo the departure in two clicks. The
 * transaction now also writes an `OrgVolunteerBlock`, which suppresses every
 * relationship kind except `ORG_MEMBER` and makes `addVolunteer`,
 * `ensureAppliedRosterRow` and `restoreVolunteer` refuse. Only the volunteer
 * lifts it, by re-engaging — see `liftOrgVolunteerBlock`.
 *
 * Keyed on `orgId`, NOT on `OrgVolunteer.id` as it was through v0.36.0.0. The
 * roster row is no longer the thing being left: an org holding only an
 * application or a shift signup has no roster row at all, yet still has access,
 * and under the id-keyed version it had no Leave button either — so an org
 * could deny the remedy by removing the volunteer first and keeping everything
 * the surviving edges authorize. The soft delete is now the OPTIONAL half and
 * the block is the mandatory one.
 */
export async function leaveOrgRoster(input: {
	userId: string;
	orgId: string;
	impersonatedBy?: string | null;
}) {
	return prisma.$transaction(async (tx) => {
		// Precondition, not a formality: without it any authenticated user could
		// POST an arbitrary orgId and mint blocks against orgs they have never
		// interacted with. Checked BEFORE the write so a stranger's orgId cannot
		// leave a row behind.
		const leavable = await hasLeavableOrgRelationship(
			tx,
			input.orgId,
			input.userId,
		);
		if (!leavable) {
			throw new TRPCError({
				code: 'NOT_FOUND',
				message: 'You have no relationship with that organization to leave.',
			});
		}

		// Already blocked: the volunteer has acted, and a second audit row would
		// double-count one departure. Reachable from a stale tab, since the listing
		// filters blocked orgs out. NOT_FOUND rather than a success, matching the
		// two-tab behaviour the id-keyed version had.
		if (await findOrgVolunteerBlock(input.orgId, input.userId, tx)) {
			throw new TRPCError({
				code: 'NOT_FOUND',
				message: 'You have already left that organization.',
			});
		}

		// Optional half. Null is a NORMAL outcome — an application-only or
		// shift-only org has no roster row to soft-delete — so unlike the id-keyed
		// version this must not throw on null.
		const rosterRowId = await softDeleteOwnOrgVolunteerByOrg(
			tx,
			input.userId,
			input.orgId,
		);

		// The half that actually revokes, and the only mandatory one. Soft-deleting
		// the roster row alone left every other edge in
		// `findOrgVolunteerRelationship` intact — an APPLICATION the volunteer
		// sent, or a SHIFT_SIGNUP staff created unilaterally — and `addVolunteer`
		// could recreate the roster row from an email address anyway. Same
		// transaction: a leave that dropped the row but not the block would report
		// success while revoking nothing.
		await createOrgVolunteerBlock(tx, input.orgId, input.userId);

		await writeAuditLogTx(tx, {
			orgId: input.orgId,
			// The volunteer is the actor. The org still sees the departure in its
			// own audit log, scoped by the orgId the caller named.
			actorId: input.userId,
			action: 'VOLUNTEER_LEFT',
			// The roster row when there was one, else the user — an
			// application-only departure has no OrgVolunteer row to point at, and
			// pointing at a stale id would be worse than pointing at the person.
			entityType: rosterRowId ? 'OrgVolunteer' : 'OrgVolunteerBlock',
			entityId: rosterRowId ?? input.userId,
			metadata: {
				// Records which half ran, so the audit log distinguishes "left a
				// roster" from "revoked access they had without one".
				hadRosterRow: rosterRowId !== null,
				...(input.impersonatedBy
					? { impersonatedBy: input.impersonatedBy }
					: {}),
			},
		});

		return { orgId: input.orgId };
	});
}

/** Roster page plus the org-scoped attended-shift count per row. */
export async function getRoster(input: {
	orgId: string;
	cursor?: string | null;
	search?: string | null;
}) {
	const { volunteers, nextCursor } = await listOrgVolunteers(input);
	const shiftCounts = await countAttendedShiftsByUser(
		input.orgId,
		volunteers.map((v) => v.userId),
	);

	return {
		volunteers: volunteers.map((v) => ({
			id: v.id,
			displayName: v.displayName,
			email: v.user.email,
			phone: v.phone,
			accountState: v.user.accountState,
			// `source` and `userId` are deliberately NOT projected. User.id is
			// shared across orgs by design in the shadow-user model, so handing it
			// to a client gives one org a stable global identifier for a person —
			// a cross-tenant correlation handle nothing in the UI needs.
			addedAt: v.createdAt,
			attendedShifts: shiftCounts.get(v.userId) ?? 0,
		})),
		nextCursor,
	};
}

export function getRosterCount(orgId: string) {
	return countOrgVolunteers(orgId);
}
