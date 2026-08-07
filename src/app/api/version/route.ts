import { APP_VERSION, BUILD_ID } from '@/lib/app-version';
import { RELEASE_SEVERITY } from '@/server/domain/release';
import { notesForRange } from '@/server/domain/release-notes';

/**
 * What build is live right now.
 *
 * A client compares the `buildId` here against its own baked-in `BUILD_ID`.
 * Different means the tab is running an older build than the one being served.
 *
 * ===================== THIS ROUTE MUST STAY IMPORT-LIGHT =====================
 * It is the most-invoked route in the app — every signed-in tab, every few
 * minutes — and it exists to return three strings. The realistic failure is
 * not writing it wrong today; it is someone adding `getServerSession` to "log
 * who's checking", which drags next-auth and the Prisma client into the module
 * graph of a function that does no I/O at all.
 *
 * `scripts/version-route-gate.test.ts` pins the import list, the
 * `force-dynamic` export and the `no-store` header. (Decisions 8, 15.)
 * =============================================================================
 *
 * ===================== AND IT MUST NOT READ process.env ======================
 * `BUILD_ID` is imported, never recomputed here. `NEXT_PUBLIC_*` values are
 * inlined at BUILD time, so a client built without the SHA bakes the
 * `?? APP_VERSION` fallback — while this handler reading
 * `process.env.VERCEL_GIT_COMMIT_SHA` at RUNTIME on Vercel would get a real
 * SHA. The two would then disagree permanently and prompt every user forever.
 * `vercel deploy --prebuilt` is exactly that split. (Decision 50.)
 * =============================================================================
 */

// A CDN-cached version endpoint reports last week's answer to everyone: the
// comparison always matches, the prompt never fires, and there is no error
// anywhere to notice. That is byte-for-byte the bug this feature replaced,
// rebuilt with new parts — so it is asserted, not just intended.
export const dynamic = 'force-dynamic';

export function GET(request: Request) {
	// The caller's own release, so the answer is "what changed since YOUR build"
	// rather than "the newest note". A coordinator four releases behind needs
	// all four, and the range is the only way to express that. Unusable or
	// absent values are handled inside `notesForRange`, which is why nothing is
	// validated here — one place decides what an unknown `since` means.
	const since = new URL(request.url).searchParams.get('since');
	const { notes, olderCount } = notesForRange(since, APP_VERSION);

	return Response.json(
		{
			// The comparison value. Opaque; clients must treat it as a token.
			buildId: BUILD_ID,
			// Display only — the release string shown in the account menu.
			version: APP_VERSION,
			// 'silent' updates the account-menu affordance and renders no strip;
			// 'notice' renders the strip. Defaults to 'silent' and is promoted
			// deliberately at ship time (decisions 22, 34, 51).
			severity: RELEASE_SEVERITY,
			// What changed since `since`, newest first. Empty is normal and
			// renders the generic sentence: most releases carry no note, and a
			// rollback has nothing to announce by definition.
			notes,
			// Reported, never silently dropped, so a truncated list cannot read
			// as a complete one.
			olderCount,
		},
		{ headers: { 'Cache-Control': 'no-store' } },
	);
}
