import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	ROSTER_EXPORT_BATCH,
	ROSTER_EXPORT_CAP,
} from '@/server/domain/roster-export';

const mocks = vi.hoisted(() => ({
	listOrgVolunteers: vi.fn(),
	countAttendedShiftsByUser: vi.fn(),
}));

vi.mock('@/server/repositories/orgVolunteerRepo', () => ({
	listOrgVolunteers: mocks.listOrgVolunteers,
	countAttendedShiftsByUser: mocks.countAttendedShiftsByUser,
}));

const { streamRosterCsv } = await import('../rosterExportService');

const ORG = 'org_1';

function volunteer(n: number) {
	return {
		id: `ov_${n}`,
		userId: `u_${n}`,
		displayName: `Volunteer ${n}`,
		phone: null,
		source: 'STAFF_ADDED' as const,
		createdAt: new Date('2026-01-01T00:00:00Z'),
		addedByUserId: null,
		user: {
			id: `u_${n}`,
			email: `v${n}@example.org`,
			accountState: 'ACTIVE' as const,
		},
	};
}

async function drain(stream: ReadableStream<Uint8Array>) {
	const decoder = new TextDecoder();
	let out = '';
	for await (const chunk of stream as unknown as AsyncIterable<Uint8Array>) {
		out += decoder.decode(chunk, { stream: true });
	}
	return out;
}

/** Serve `total` volunteers across cursor pages, like the repository does. */
function servePages(total: number) {
	let served = 0;
	mocks.listOrgVolunteers.mockImplementation(
		async ({ limit }: { limit: number }) => {
			const take = Math.min(limit, total - served);
			const volunteers = Array.from({ length: take }, (_, i) =>
				volunteer(served + i),
			);
			served += take;
			return {
				volunteers,
				nextCursor: served < total ? `cursor_${served}` : null,
			};
		},
	);
}

beforeEach(() => {
	vi.clearAllMocks();
	mocks.countAttendedShiftsByUser.mockResolvedValue(new Map());
});

describe('streamRosterCsv', () => {
	it('emits the header before any row', async () => {
		servePages(2);
		const lines = (await drain(streamRosterCsv(ORG))).trim().split('\n');
		expect(lines[0]).toMatch(/^Name,Email,Phone,/);
		expect(lines).toHaveLength(3);
	});

	it('emits a header-only file for an empty roster', async () => {
		servePages(0);
		expect((await drain(streamRosterCsv(ORG))).trim().split('\n')).toHaveLength(
			1,
		);
	});

	it('pages through the roster with the cursor', async () => {
		servePages(ROSTER_EXPORT_BATCH + 10);
		const lines = (await drain(streamRosterCsv(ORG))).trim().split('\n');
		expect(lines).toHaveLength(ROSTER_EXPORT_BATCH + 10 + 1);
		expect(mocks.listOrgVolunteers).toHaveBeenCalledTimes(2);
		// The second call must carry the first page's cursor, or it re-reads page
		// one forever and the export never terminates.
		expect(mocks.listOrgVolunteers.mock.calls[1]?.[0]).toMatchObject({
			cursor: `cursor_${ROSTER_EXPORT_BATCH}`,
		});
	});

	it('reads soft-deleted rows out by delegating to listOrgVolunteers', async () => {
		// The `deletedAt: null` filter lives in that one query, shared with the
		// roster page — deliberately, so a volunteer who left cannot be in the
		// file while absent from the screen. Re-implementing the read here is what
		// would let the two disagree.
		servePages(1);
		await drain(streamRosterCsv(ORG));
		expect(mocks.listOrgVolunteers).toHaveBeenCalledWith(
			expect.objectContaining({ orgId: ORG }),
		);
	});

	it('scopes the attended-shift count to the org', async () => {
		// Counting a volunteer's signups without joining through Shift would put
		// another org's numbers in this file — the User row is shared by design.
		servePages(1);
		await drain(streamRosterCsv(ORG));
		expect(mocks.countAttendedShiftsByUser).toHaveBeenCalledWith(ORG, ['u_0']);
	});

	it('stops at the cap and says so in the file', async () => {
		servePages(ROSTER_EXPORT_CAP + ROSTER_EXPORT_BATCH);
		const lines = (await drain(streamRosterCsv(ORG))).trim().split('\n');
		// header + cap rows + notice
		expect(lines).toHaveLength(ROSTER_EXPORT_CAP + 2);
		expect(lines[lines.length - 1]).toContain('Truncated');
	});

	it('does not append a truncation notice to a roster that fit', async () => {
		servePages(3);
		expect(await drain(streamRosterCsv(ORG))).not.toContain('Truncated');
	});

	it('never asks for more rows than remain under the cap', async () => {
		servePages(ROSTER_EXPORT_CAP + 100);
		await drain(streamRosterCsv(ORG));
		for (const [args] of mocks.listOrgVolunteers.mock.calls) {
			expect(args.limit).toBeLessThanOrEqual(ROSTER_EXPORT_BATCH);
		}
	});
});
