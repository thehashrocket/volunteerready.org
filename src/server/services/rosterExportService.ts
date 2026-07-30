/**
 * Roster CSV export (T19) — streams the roster a page at a time.
 *
 * Streamed rather than built into a string. Not for the memory (a 10k-row CSV
 * is under a megabyte) but for time-to-first-byte and for the connection: a
 * single `findMany` of the whole roster holds one query open for the length of
 * the scan, while this returns the first bytes after the first page and lets the
 * browser start the download immediately.
 */

import {
	formatFailureNotice,
	formatRosterHeader,
	formatRosterRow,
	formatTruncationNotice,
	ROSTER_EXPORT_BATCH,
	ROSTER_EXPORT_CAP,
} from '@/server/domain/roster-export';
import {
	countAttendedShiftsByUser,
	listOrgVolunteers,
} from '@/server/repositories/orgVolunteerRepo';

/**
 * A CSV of every LIVE roster row for `orgId`, oldest cursor page first.
 *
 * Soft-deleted rows are excluded because `listOrgVolunteers` filters
 * `deletedAt: null` — the same read the roster page uses, deliberately, so the
 * file and the screen cannot disagree about who is on the roster. A volunteer
 * who left must not reappear in an export.
 */
export function streamRosterCsv(orgId: string): ReadableStream<Uint8Array> {
	const encoder = new TextEncoder();
	let cursor: string | null = null;
	let emitted = 0;
	let wroteHeader = false;

	return new ReadableStream<Uint8Array>({
		async pull(controller) {
			const remaining = ROSTER_EXPORT_CAP - emitted;
			if (wroteHeader && remaining <= 0) {
				controller.enqueue(encoder.encode(`${formatTruncationNotice()}\n`));
				controller.close();
				return;
			}

			// The header rides along with the first data page rather than going out
			// as its own ~40-byte chunk and burning a pull cycle.
			let chunk = '';
			if (!wroteHeader) {
				chunk += `${formatRosterHeader()}\n`;
				wroteHeader = true;
			}

			let volunteers: Awaited<
				ReturnType<typeof listOrgVolunteers>
			>['volunteers'];
			let nextCursor: string | null;
			try {
				const page = await listOrgVolunteers({
					orgId,
					cursor,
					limit: Math.min(ROSTER_EXPORT_BATCH, remaining),
				});
				volunteers = page.volunteers;
				nextCursor = page.nextCursor;

				// One grouped query per page rather than per row. Org-scoped inside
				// the repository — counting a volunteer's signups without joining
				// through Shift would put another org's shift count in this file.
				const shiftCounts = await countAttendedShiftsByUser(
					orgId,
					volunteers.map((v) => v.userId),
				);

				for (const v of volunteers) {
					chunk += `${formatRosterRow({
						displayName: v.displayName,
						email: v.user.email,
						phone: v.phone,
						accountState: v.user.accountState,
						source: v.source,
						createdAt: v.createdAt,
						attendedShifts: shiftCounts.get(v.userId) ?? 0,
					})}\n`;
				}
			} catch (err) {
				// The 200 and its headers went out with the first chunk, so there is
				// no status code left to fail with. Mark the file instead: a
				// well-formed CSV prefix that looks complete is the worst outcome,
				// and it is the one this whole module is shaped to avoid.
				controller.enqueue(
					encoder.encode(`${chunk}${formatFailureNotice(emitted)}\n`),
				);
				controller.error(err);
				return;
			}

			controller.enqueue(encoder.encode(chunk));

			if (volunteers.length === 0) {
				controller.close();
				return;
			}

			emitted += volunteers.length;
			cursor = nextCursor;

			// No next cursor means that page was the last one. The cap case is
			// handled on the next pull, so the notice lands after the final row.
			if (!nextCursor) {
				controller.close();
			}
		},
	});
}
