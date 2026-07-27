/**
 * Org ↔ shift access guard.
 *
 * `staffProcedure` answers "is the caller staff?" and `ctx.orgId` answers
 * "at which org?" — but neither says anything about a `shiftId` arriving in the
 * procedure's *input*. Eight staff procedures in `routers/shifts.ts` took that
 * id and acted on it with no such check: `getById`, `getSignups`, `getWaitlist`
 * and `markAttendance` (read another tenant's roster of volunteer names and
 * email addresses, and write attendance into it), plus `update`, `cancel`,
 * `complete` and `remove`, which accepted `orgId` but spent it only on the audit
 * row — so the write landed on the victim and was filed under the attacker.
 * `remove` was the worst: it cascades to `ShiftSignup`, destroying attendance
 * history.
 *
 * This is the same bug class as `requireOrgVolunteerRelationship` in
 * orgVolunteerAccessService.ts — an id from input, authorized against nothing —
 * and it is deliberately shaped the same way so the two read alike. The check
 * itself already existed, inline and correct, in `checkinByQr` and
 * `getCheckinStats`; those two now call this instead, so the policy lives in one
 * place rather than in two copies and eight omissions.
 *
 * THREE enforcement shapes exist here, deliberately. Prefer the first:
 *   1. `requireOrgShift` — the default. Throws NOT_FOUND.
 *   2. `isOrgShift` — when the caller already loaded the row and must return
 *      null rather than throw (`getShiftDetail`).
 *   3. `orgId` inside a write's own WHERE clause — ONLY in `completeShift`,
 *      whose `updateMany` is a deliberate single-statement conditional update;
 *      a preceding guard there would reintroduce the check-then-write race that
 *      statement exists to avoid, and would add a query to each of the ~200
 *      shifts the auto-close cron completes per run. It surfaces a foreign
 *      shift as CONFLICT rather than NOT_FOUND — still non-distinguishing, but
 *      it is the one divergence in the set. See shiftService.ts.
 *
 * @see requireOrgVolunteerRelationship for the sibling guard over user ids.
 */
import { TRPCError } from '@trpc/server';
import { getShiftById } from '@/server/repositories/shiftRepo';
import { getTemplateById } from '@/server/repositories/shiftTemplateRepo';

/**
 * The ownership predicate itself, as one definition.
 *
 * Exists because `getShiftDetail` needs the same decision but must return null
 * rather than throw (it has already loaded the shift *with* its signups, so it
 * cannot route through `requireOrgShift` without a second query). Without this,
 * that file carries a hand-copied `shift.orgId !== orgId` — and a copy of a
 * security predicate in another file is the one that gets missed when the rule
 * changes. Mirrors why `getOrgVolunteerRelationship` exists next to
 * `requireOrgVolunteerRelationship`.
 *
 * SECURITY: `T extends { orgId: string }` because a nullable `orgId` would let
 * both sides be null and make this return true — fail-open. Do not widen it.
 */
export function isOrgShift<T extends { orgId: string }>(
	shift: T | null | undefined,
	orgId: string,
): shift is T {
	return shift != null && shift.orgId === orgId;
}

/**
 * Assert that `shiftId` names a shift owned by `orgId`, and return it.
 *
 * Throws NOT_FOUND rather than FORBIDDEN, matching the sibling guards: the shift
 * genuinely exists, just not in this tenant, and FORBIDDEN would confirm that to
 * a caller probing ids. "Not yours" and "not real" must be indistinguishable.
 *
 * Costs one PK lookup. Most callers discard the return value — it is returned
 * for the two that need the row anyway (`checkinByQr` for its status check, and
 * `requireAttendanceAccess` for the audit row's `orgId`), so those do not fetch
 * it twice.
 */
export async function requireOrgShift(shiftId: string, orgId: string) {
	const shift = await getShiftById(shiftId);

	if (!isOrgShift(shift, orgId)) {
		throw new TRPCError({ code: 'NOT_FOUND', message: 'Shift not found.' });
	}

	return shift;
}

/**
 * Assert that `templateId` names a shift template owned by `orgId`.
 *
 * `ShiftTemplate` had the identical hole: `shiftTemplates.update` and
 * `.remove` accepted `orgId` and spent it only on the audit row, while
 * `updateTemplate`/`deleteTemplate` write on `where: { id }` alone — so staff at
 * org A could rewrite or delete org B's recurring schedule. `generateShifts`
 * DID check, inline, with a bare `Error` (a 500, not a NOT_FOUND) — proof the
 * check was known and simply not applied to the other two. All three now come
 * through here.
 *
 * Note `isOrgShift` is reused unchanged: it is structural over `{ orgId }`, not
 * shift-specific, so the predicate stays a single definition across both
 * entities.
 */
export async function requireOrgTemplate(templateId: string, orgId: string) {
	const template = await getTemplateById(templateId);

	if (!isOrgShift(template, orgId)) {
		throw new TRPCError({ code: 'NOT_FOUND', message: 'Template not found.' });
	}

	return template;
}

/**
 * Who is authorizing an attendance write.
 *
 * `markAttendance` has two callers with genuinely different authorization
 * models, so it takes this instead of a nullable `orgId` — a nullable one would
 * make "no org supplied" mean "skip the check", which is the fail-open shape
 * that caused this bug in the first place. A required discriminated union forces
 * every new caller to state which model applies.
 *
 * - `staff`: a coordinator marking someone else present. The shift must belong
 *   to their org.
 * - `self`: a volunteer checking themselves in via geo/token. Org membership is
 *   irrelevant — they are not a member — and identity is proven by the check-in
 *   token the router validated before calling.
 */
export type AttendanceAuthorization =
	| { by: 'staff'; orgId: string }
	| { by: 'self'; userId: string };

/**
 * Assert that `auth` permits writing attendance for `targetUserId` on
 * `shiftId`, and return the shift.
 */
export async function requireAttendanceAccess(
	shiftId: string,
	targetUserId: string,
	auth: AttendanceAuthorization,
) {
	if (auth.by === 'staff') {
		return requireOrgShift(shiftId, auth.orgId);
	}

	// Defense in depth: the router passes the session user as both the target and
	// the authorizer, so this can only fire if a future caller wires it wrongly.
	if (auth.userId !== targetUserId) {
		throw new TRPCError({
			code: 'FORBIDDEN',
			message: 'You can only check yourself in.',
		});
	}

	const shift = await getShiftById(shiftId);
	if (!shift) {
		throw new TRPCError({ code: 'NOT_FOUND', message: 'Shift not found.' });
	}

	return shift;
}
