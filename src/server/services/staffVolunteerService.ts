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
	findLiveOrgVolunteer,
	listOrgVolunteers,
	restoreOrgVolunteer,
	softDeleteOrgVolunteer,
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
	return isUniqueViolationOn(
		err,
		'OrgVolunteer_orgId_userId_active',
		'OrgVolunteer',
	);
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
 * coordinator can see on their screen. The caller fires it after commit.
 */
export async function addVolunteer(input: {
	orgId: string;
	displayName: string;
	email: string;
	phone?: string | null;
	actorId: string | null;
	impersonatedBy?: string | null;
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
	if (result.notify) {
		void notifyRosterAdd(input.orgId, input.actorId, email).catch(
			console.error,
		);
	}

	return result;
}

/** Look up the display context the notification needs, then send it. */
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
 */
export async function restoreVolunteer(input: {
	orgId: string;
	volunteerId: string;
	actorId: string | null;
	impersonatedBy?: string | null;
}) {
	try {
		return await prisma.$transaction(async (tx) => {
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
