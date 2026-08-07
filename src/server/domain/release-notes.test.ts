import { describe, expect, it } from 'vitest';
import {
	compareReleaseVersions,
	notesForRange,
	parseReleaseVersion,
	RELEASE_NOTES_WIRE_CAP,
	type ReleaseNote,
} from './release-notes';

/**
 * Tested against FIXTURES, not against the live `RELEASE_NOTES` array. The live
 * data changes every release worth describing; a test bound to it would go red
 * for authoring reasons rather than logic ones, and would be rewritten until it
 * asserted nothing. `scripts/release-notes-gate.test.ts` guards the live array.
 */

const NOTES: ReleaseNote[] = [
	{ version: '0.41.15.0', summary: 'Fifteen.' },
	{ version: '0.41.14.0', summary: 'Fourteen.' },
	{ version: '0.41.9.0', summary: 'Nine.' },
	{ version: '0.41.2.0', summary: 'Two.' },
];

describe('parseReleaseVersion', () => {
	it('splits a four-part release into numbers', () => {
		expect(parseReleaseVersion('0.41.15.0')).toEqual([0, 41, 15, 0]);
	});

	it('accepts shorter and longer forms', () => {
		expect(parseReleaseVersion('1')).toEqual([1]);
		expect(parseReleaseVersion('1.2.3.4.5')).toEqual([1, 2, 3, 4, 5]);
	});

	it('tolerates surrounding whitespace', () => {
		expect(parseReleaseVersion('  0.41.15.0 ')).toEqual([0, 41, 15, 0]);
	});

	it.each([
		['', 'empty'],
		['v0.41.15.0', 'a leading v'],
		['0.41.15.0-rc1', 'a prerelease suffix'],
		['0..1', 'an empty segment'],
		['nonsense', 'letters'],
		['-1.2', 'a negative'],
		['0.41.15.0; DROP TABLE', 'trailing junk'],
	])('returns null for %s (%s)', (input) => {
		expect(parseReleaseVersion(input)).toBeNull();
	});

	it('returns null for non-strings', () => {
		expect(parseReleaseVersion(null)).toBeNull();
		expect(parseReleaseVersion(undefined)).toBeNull();
	});
});

describe('compareReleaseVersions', () => {
	it('orders by numeric segment, not lexically', () => {
		// The bug this exists to prevent: '0.41.9.0' > '0.41.15.0' as strings.
		expect(compareReleaseVersions('0.41.15.0', '0.41.9.0')).toBe(1);
		expect(compareReleaseVersions('0.41.9.0', '0.41.15.0')).toBe(-1);
	});

	it('treats a missing trailing segment as zero', () => {
		expect(compareReleaseVersions('0.41.15', '0.41.15.0')).toBe(0);
	});

	it('reports equality', () => {
		expect(compareReleaseVersions('1.2.3.4', '1.2.3.4')).toBe(0);
	});

	it('returns null — not 0 — when either side is unparseable', () => {
		// Returning 0 would make an unknown version compare EQUAL to every
		// release, which reads downstream as "you are up to date".
		expect(compareReleaseVersions('garbage', '0.41.15.0')).toBeNull();
		expect(compareReleaseVersions('0.41.15.0', 'garbage')).toBeNull();
	});
});

describe('notesForRange', () => {
	it('returns everything strictly after `since`, up to and including `upTo`', () => {
		const { notes } = notesForRange('0.41.9.0', '0.41.15.0', NOTES);
		expect(notes.map((n) => n.version)).toEqual(['0.41.15.0', '0.41.14.0']);
	});

	it('excludes the client’s own release', () => {
		// A coordinator on 0.41.14.0 must not be told about 0.41.14.0.
		const { notes } = notesForRange('0.41.14.0', '0.41.15.0', NOTES);
		expect(notes.map((n) => n.version)).toEqual(['0.41.15.0']);
	});

	it('excludes anything above the deployed release', () => {
		const { notes } = notesForRange('0.41.2.0', '0.41.14.0', NOTES);
		expect(notes.map((n) => n.version)).toEqual(['0.41.14.0', '0.41.9.0']);
	});

	it('returns newest first', () => {
		const { notes } = notesForRange('0.0.0.0', '0.41.15.0', NOTES);
		expect(notes.map((n) => n.version)).toEqual([
			'0.41.15.0',
			'0.41.14.0',
			'0.41.9.0',
			'0.41.2.0',
		]);
	});

	it('sorts defensively rather than trusting the array order', () => {
		const shuffled = [NOTES[2], NOTES[0], NOTES[3], NOTES[1]];
		const { notes } = notesForRange('0.0.0.0', '0.41.15.0', shuffled);
		expect(notes.map((n) => n.version)).toEqual([
			'0.41.15.0',
			'0.41.14.0',
			'0.41.9.0',
			'0.41.2.0',
		]);
	});

	describe('when `since` is unusable', () => {
		it.each([null, undefined, '', 'garbage'])(
			'returns only the deployed release’s own note for %p',
			(since) => {
				// Not "everything" — that would hand a client with no version the
				// entire history. Not "nothing" — the release it is being told
				// about is the one relevant answer.
				const { notes } = notesForRange(since, '0.41.15.0', NOTES);
				expect(notes.map((n) => n.version)).toEqual(['0.41.15.0']);
			},
		);

		it('returns nothing when the deployed release has no note either', () => {
			const { notes } = notesForRange(null, '0.41.13.0', NOTES);
			expect(notes).toEqual([]);
		});
	});

	it('returns nothing when `upTo` is unparseable, rather than everything', () => {
		// Fails closed. The opposite would announce the whole history on a
		// malformed deploy.
		const { notes } = notesForRange('0.41.2.0', 'garbage', NOTES);
		expect(notes).toEqual([]);
	});

	it('returns nothing for a rollback', () => {
		// Client is NEWER than the server. The strip still renders (build ids
		// differ) but has no "what's new", which is honest.
		const { notes } = notesForRange('0.41.15.0', '0.41.9.0', NOTES);
		expect(notes).toEqual([]);
	});

	it('returns nothing when the client is already current', () => {
		const { notes } = notesForRange('0.41.15.0', '0.41.15.0', NOTES);
		expect(notes).toEqual([]);
	});

	it('returns nothing for a NEW BUILD carrying the SAME release', () => {
		// Detection is build-keyed (commit SHA) but notes are version-keyed, so
		// an env-only redeploy or a promote of the same release makes the strip
		// appear with no summary. Same inputs as "already current" — pinned
		// separately because it is a different SCENARIO, and the one an
		// adversarial review flagged as looking like a bug. Relaxing the range
		// to include equal versions would re-announce a note already read.
		const { notes, olderCount } = notesForRange(
			'0.41.15.0',
			'0.41.15.0',
			NOTES,
		);
		expect(notes).toEqual([]);
		expect(olderCount).toBe(0);
	});

	it('uses the real RELEASE_NOTES when no source is passed', () => {
		// The default arg became a module-level pre-sorted constant to keep the
		// sort off the hottest route. If that branch were wired wrong, every
		// production call would silently select from an empty list — and every
		// other test here passes an explicit source, so nothing else would fail.
		const { notes } = notesForRange('0.0.0.0', '99.0.0.0');
		expect(notes.length).toBeGreaterThan(0);
		expect(notes.map((n) => n.version)).toEqual(
			[...notes.map((n) => n.version)].sort((a, b) =>
				a === b ? 0 : (compareReleaseVersions(b, a) ?? 0),
			),
		);
	});

	describe('the wire cap', () => {
		const many: ReleaseNote[] = Array.from({ length: 9 }, (_, index) => ({
			version: `0.41.${20 - index}.0`,
			summary: `Change ${20 - index}.`,
		}));

		it('sends at most RELEASE_NOTES_WIRE_CAP notes', () => {
			const { notes } = notesForRange('0.0.0.0', '0.41.20.0', many);
			expect(notes).toHaveLength(RELEASE_NOTES_WIRE_CAP);
		});

		it('keeps the newest, not the oldest', () => {
			const { notes } = notesForRange('0.0.0.0', '0.41.20.0', many);
			expect(notes[0].version).toBe('0.41.20.0');
		});

		it('reports the remainder instead of dropping it silently', () => {
			// No-silent-caps. A truncated list that looks complete is worse than
			// one that says how much it left out.
			const { olderCount } = notesForRange('0.0.0.0', '0.41.20.0', many);
			expect(olderCount).toBe(9 - RELEASE_NOTES_WIRE_CAP);
		});

		it('reports zero when nothing was dropped', () => {
			const { olderCount } = notesForRange('0.41.9.0', '0.41.15.0', NOTES);
			expect(olderCount).toBe(0);
		});
	});

	it('does not mutate the source array', () => {
		const source = [...NOTES];
		notesForRange('0.0.0.0', '0.41.15.0', source);
		expect(source).toEqual(NOTES);
	});
});
