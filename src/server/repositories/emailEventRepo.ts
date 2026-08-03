import { prisma } from './prisma';

/**
 * Which of `addresses` already have a SENT event for this exact subject.
 *
 * ADVISORY, and the caller must treat it as such. Four reasons it cannot be a
 * hard gate:
 *
 *  1. `sendEmail` writes the SENT row fire-and-forget, so a missing row does not
 *     prove nothing was sent.
 *  2. A rejected send writes no row at all, so a genuine failure and a
 *     never-attempted send are indistinguishable here.
 *  3. `EmailEvent` carries no `orgId`, and the subject embeds only the org NAME
 *     — two orgs sharing a display name collide.
 *  4. The subject is rebuilt from the org's name as it stands NOW, while the
 *     stored one was built at send time — so a rename between the interrupted
 *     import and the recovery hides every earlier send from this query.
 *
 * Used to skip-and-report a resend, never to withhold one silently. (1), (2) and
 * (4) all fail toward re-sending, which is safe. (3) is the only one that fails
 * toward WITHHOLDING a notice — the dangerous direction, and the second reason a
 * hit is reported to the operator rather than acted on quietly.
 *
 * `to` + `eventType` is the leading pair of the `[to, eventType]` index; the
 * subject narrows an already-small result set and is not itself indexed.
 */
export async function findSentAddresses(
	addresses: readonly string[],
	subject: string,
): Promise<Set<string>> {
	if (addresses.length === 0) return new Set();

	const rows = await prisma.emailEvent.findMany({
		where: { to: { in: [...addresses] }, eventType: 'SENT', subject },
		select: { to: true },
		distinct: ['to'],
	});

	return new Set(rows.map((r) => r.to));
}
