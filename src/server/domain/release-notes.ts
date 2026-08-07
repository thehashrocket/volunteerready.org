/**
 * What changed in a release, in words a coordinator can act on.
 *
 * The update strip used to say only "VolunteerReady has been updated", which
 * gives nobody a reason to reload. This is the half that was deferred at D2 so
 * a live production bug would not wait on it (`docs/TODOS.md`, P2).
 *
 * ===================== AUTHORED, NEVER PARSED OUT OF CHANGELOG ===============
 * `CHANGELOG.md` is 2,000+ lines written for a technically-literate reader —
 * "the type checker", "the assembly step", "a routine automated dependency
 * update". A coordinator four releases behind would be handed sixty lines of
 * that. Deriving a summary from it produces confident nonsense, so summaries
 * are WRITTEN, one per release worth mentioning, and that authoring cost is the
 * whole reason this was split off as its own task rather than done inline.
 * =============================================================================
 *
 * ===================== SEVERITY AND NOTES ARE INDEPENDENT ====================
 * Easy to conflate, and getting it wrong makes the feature either silent or
 * spammy:
 *
 *   `RELEASE_SEVERITY`  answers "do we interrupt a coordinator for this?"
 *   a note here         answers "what changed?"
 *
 * A `notice` release MUST have a note — announcing an update with no reason to
 * act is the exact defect this module exists to fix, and
 * `scripts/release-notes-gate.test.ts` makes that a red test. A `silent`
 * release MAY have one, and usually will not: most releases here are
 * dependency bumps, CI and docs. But when a silent release DOES carry a note,
 * that note still surfaces later — a coordinator interrupted at 0.41.20.0 sees
 * everything since their own build, including the quiet releases in between.
 * That is why the range matters and why "latest note" would be wrong.
 * =============================================================================
 *
 * SERVER-ONLY as a VALUE, for the same provenance reason as
 * `RELEASE_SEVERITY`: these notes describe the build being SERVED. A client
 * that imported the array would render its own, older build's copy — the notes
 * for the release it is already running, which answers no question anyone has.
 * The client receives notes over the wire from `/api/version` and nowhere else.
 * `import type` is fine (types are erased and carry no data); the gate allows
 * exactly that and bans the value import.
 *
 * ======================= EVERY SUMMARY HERE IS PUBLIC ========================
 * "Server-only" above is about PROVENANCE, not secrecy, and the two are easy to
 * conflate into a dangerous assumption. `/api/version` is unauthenticated by
 * design (it is the hottest route in the app and deliberately imports no
 * session machinery), so anyone can read these — and because the answer is a
 * RANGE, walking `?since=` backwards recovers the whole history. The wire cap
 * bounds one response, not exposure.
 *
 * The trap is that the strip is `isStaff`-gated, which makes these read like
 * internal copy while they are world-readable. So:
 *
 *   WRITE NOTHING HERE YOU WOULD NOT PUT ON A PUBLIC CHANGELOG PAGE.
 *
 * In particular never describe a security fix in terms of what was vulnerable
 * ("coordinators could see other orgs' volunteers"). Say what is true now, or
 * mark the release `silent` and say nothing. Raised by an adversarial
 * cross-model review pass, which correctly noted that nothing in the authoring
 * path told the author any of this.
 * =============================================================================
 */

export type ReleaseNote = {
	/** A four-part release string, matching `VERSION` at the time it shipped. */
	version: string;
	/**
	 * One sentence, coordinator-voiced, describing what THEY can now do or what
	 * stopped being broken. Not a commit subject: "fix: delete the update
	 * banner" is our vocabulary, not theirs.
	 */
	summary: string;
};

/**
 * The strip renders this inline on ONE line (DESIGN.md's ambient notice strip
 * forbids a stacked title/body block), so a summary that runs long turns a
 * 48px band into a paragraph. Guarded rather than trusted.
 */
export const RELEASE_NOTE_MAX_LENGTH = 120;

/**
 * How many notes cross the wire at most.
 *
 * Someone returning after a long absence could otherwise be handed every note
 * ever written. The remainder is REPORTED as a count rather than dropped
 * silently — this repo's no-silent-caps rule; a truncated list that looks
 * complete is worse than one that says how much it left out.
 */
export const RELEASE_NOTES_WIRE_CAP = 5;

/**
 * Newest first. Add an entry at the TOP when shipping a release worth
 * describing; `/ship` prompts for it alongside `RELEASE_SEVERITY`.
 *
 * Most releases get no entry, and that is correct — see the severity note
 * above. Do not add one for a dependency bump.
 */
export const RELEASE_NOTES: readonly ReleaseNote[] = [
	{
		version: '0.41.14.0',
		summary:
			'You now get a notice when VolunteerReady has been updated, so you know when to reload.',
	},
	{
		version: '0.41.12.0',
		summary:
			'Fixed: first-time visitors were wrongly told to reload the page they had just opened.',
	},
];

/**
 * Splits a release string into comparable numbers, or `null` when it is not one.
 *
 * `null` rather than a fallback of `[0]`, deliberately: "this is not a version
 * we understand" is a different answer from "this is version zero", and the
 * callers below fail CLOSED on it. A lenient parse here would let a garbage
 * `?since=` value select every note ever written.
 */
export function parseReleaseVersion(
	value: string | null | undefined,
): number[] | null {
	if (typeof value !== 'string') return null;
	const trimmed = value.trim();
	if (!/^\d+(\.\d+)*$/.test(trimmed)) return null;
	const parts = trimmed.split('.').map(Number);
	return parts.every(Number.isSafeInteger) ? parts : null;
}

/**
 * `1` / `0` / `-1` as usual, and `null` when either side is unparseable.
 *
 * Callers must handle `null` explicitly. A comparator that silently returned
 * `0` for garbage would make an unknown version compare EQUAL to every
 * release, which reads as "you are up to date" — the failure mode that hides
 * itself.
 */
export function compareReleaseVersions(a: string, b: string): number | null {
	const left = parseReleaseVersion(a);
	const right = parseReleaseVersion(b);
	if (!left || !right) return null;

	// Compared segment-by-segment with a 0 default, so `0.41.15` and `0.41.15.0`
	// are equal rather than the shorter one sorting first. String comparison is
	// wrong here for the obvious reason: '0.41.9.0' > '0.41.15.0' lexically.
	const length = Math.max(left.length, right.length);
	for (let index = 0; index < length; index += 1) {
		const difference = (left[index] ?? 0) - (right[index] ?? 0);
		if (difference !== 0) return difference > 0 ? 1 : -1;
	}
	return 0;
}

/**
 * Sorted ONCE at module load, not per request.
 *
 * `/api/version` is the most-invoked route in the app, it is `force-dynamic`
 * (so every call really executes) and it is public, so anyone can drive this
 * path directly. The array is small today and grows monotonically forever,
 * which is exactly the shape that is cheap to fix now and awkward later — the
 * cost of release history should not be request-time CPU on the hottest route.
 */
const SORTED_RELEASE_NOTES: readonly ReleaseNote[] = [...RELEASE_NOTES].sort(
	(a, b) => compareReleaseVersions(b.version, a.version) ?? 0,
);

export type ReleaseNoteSelection = {
	/** Newest first, capped at `RELEASE_NOTES_WIRE_CAP`. */
	notes: ReleaseNote[];
	/** How many further notes the cap dropped. Never silently discarded. */
	olderCount: number;
};

/**
 * The notes a client on `since` has not seen yet, up to and including the
 * deployed release `upTo`.
 *
 * WHEN `since` IS UNUSABLE (absent, empty, or not a version) the answer is the
 * deployed release's OWN note, not "everything" and not "nothing". A client
 * built without `NEXT_PUBLIC_APP_VERSION` genuinely cannot say where it
 * started, and the release it is being told about is the one relevant answer.
 * Returning everything would hand a first-time reader the entire history.
 *
 * A ROLLBACK yields an empty list on purpose: the client's version is NEWER
 * than the deployed one, so nothing is in range. The strip still renders (the
 * build ids differ), just without a reason — which is honest, because moving
 * backwards has no "what's new".
 *
 * DETECTION IS BUILD-KEYED, NOTES ARE VERSION-KEYED, and that asymmetry is
 * deliberate rather than an oversight. `BUILD_ID` is the commit SHA precisely
 * so a rollback or a preview promote counts as a change; notes are keyed to
 * the semver because that is what a release IS. So a new build carrying an
 * UNCHANGED semver — an env-only redeploy, a promote of the same release —
 * makes the strip appear with the generic sentence and no summary. That is the
 * correct answer: the build moved, the release did not, and there is genuinely
 * nothing new to report. Do not "fix" it by relaxing the range to include
 * equal versions; that re-announces a note the reader has already seen.
 */
export function notesForRange(
	since: string | null | undefined,
	upTo: string,
	source?: readonly ReleaseNote[],
): ReleaseNoteSelection {
	// The default list is pre-sorted at module load (see SORTED_RELEASE_NOTES).
	// A caller-supplied list is sorted here rather than trusted: the gate keeps
	// the FILE sorted for readability, but a function whose correctness depends
	// on hand-maintained ordering is one careless paste from being quietly
	// wrong, and the symptom is a mis-ordered list, not an error.
	const sorted =
		source === undefined
			? SORTED_RELEASE_NOTES
			: [...source].sort(
					(a, b) => compareReleaseVersions(b.version, a.version) ?? 0,
				);

	const hasUsableSince = parseReleaseVersion(since) !== null;

	const matching = sorted.filter((note) => {
		const withinUpper = compareReleaseVersions(note.version, upTo);
		// Fails closed: an unparseable `upTo` (or note version) selects nothing
		// rather than everything.
		if (withinUpper === null || withinUpper > 0) return false;
		if (!hasUsableSince) return withinUpper === 0;

		const afterSince = compareReleaseVersions(note.version, since as string);
		return afterSince !== null && afterSince > 0;
	});

	return {
		notes: matching.slice(0, RELEASE_NOTES_WIRE_CAP),
		olderCount: Math.max(0, matching.length - RELEASE_NOTES_WIRE_CAP),
	};
}
