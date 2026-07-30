import { type NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth';
import { IMPERSONATION_COOKIE } from '@/server/domain/impersonation';
import { rosterExportFilename } from '@/server/domain/roster-export';
import { resolveEffectiveUserId } from '@/server/lib/impersonation-context';
import { checkRateLimit } from '@/server/lib/rate-limit';
import { findOrgByIdOrSlug } from '@/server/repositories/orgRepo';
import { isRosterEnabledForOrg } from '@/server/services/featureFlagService';
import {
	OrgAccessDeniedError,
	requireOrgAccess,
} from '@/server/services/orgAccessService';
import { streamRosterCsv } from '@/server/services/rosterExportService';

/**
 * `GET /api/org/[orgId]/roster/csv` — the roster, as a spreadsheet.
 *
 * SCOPED BY URL, NEVER BY SESSION. The org id is a path segment and every
 * authorization decision below is made against it. A "global" route reading the
 * session's active org would serve the wrong tenant to anyone who belongs to
 * more than one org — the v0.29.2.0 bug, in a route that emits every volunteer's
 * name, email and phone number in one response.
 *
 * Available on every plan tier including FREE. See the note in
 * `domain/roster-export.ts`: an org that cannot get its data back out has not
 * chosen to stay.
 */

/**
 * Two budgets, because enumeration and export volume are different problems and
 * one key cannot bound both.
 *
 * The first version keyed a single limit on `${userId}:${orgId}` and claimed in
 * a comment that "probing many ids from one account consumes one budget". The
 * opposite was true: every distinct path segment minted a FRESH bucket, so
 * enumeration was bounded at 10-per-candidate-id rather than 10 in total. It
 * also gave a legitimate coordinator 20 exports/minute for one org, since the
 * id and the slug are different keys for the same tenant.
 *
 * PROBE is keyed on the caller alone and runs before the org lookup, so walking
 * ids costs one shared budget. EXPORT is keyed on the RESOLVED org id and runs
 * after, so it counts real downloads of one roster however they were addressed.
 *
 * Neither is a guarantee: `checkRateLimit` fails OPEN when Upstash is
 * unconfigured or erroring (see `lib/rate-limit.ts`). That is right for the
 * shared helper and worth naming here, because on a bulk-PII endpoint the
 * limiter is the only thing bounding exfiltration rate from a compromised staff
 * account.
 */
const PROBE_RATE_LIMIT = {
	limit: 30,
	windowSeconds: 60,
	prefix: 'roster:export:probe',
};

/**
 * Deliberately tight. This is a bulk PII read — one click produces the whole
 * roster — so the limit is set for "a coordinator downloading a file", not for
 * an integration. `credential:generate` and friends use the same shape.
 */
const EXPORT_RATE_LIMIT = {
	limit: 10,
	windowSeconds: 60,
	prefix: 'roster:export',
};

function tooManyRequests(windowSeconds: number) {
	return NextResponse.json(
		{ error: 'Too many exports. Try again in a minute.' },
		// Derived, not a second literal — a tightened window must not leave the
		// header telling clients to retry at the old one.
		{ status: 429, headers: { 'Retry-After': String(windowSeconds) } },
	);
}

export async function GET(
	req: NextRequest,
	{ params }: { params: Promise<{ orgId: string }> },
) {
	const { orgId } = await params;

	// Resolved through impersonation so a platform admin acting as a coordinator
	// exports the coordinator's org, not their own. `resolutionFailed` is fatal
	// here rather than falling back to the real admin's identity: this is a
	// read-then-act path over another tenant's PII.
	const session = await getServerSession(authOptions);
	const cookieValue = req.cookies.get(IMPERSONATION_COOKIE)?.value ?? null;
	const { effectiveUserId: userId, resolutionFailed } =
		await resolveEffectiveUserId(session?.user?.id ?? null, cookieValue);

	if (resolutionFailed || !userId) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	}

	// One 404 for "no such org", "not yours", "malformed segment" and "roster not
	// enabled here". A 403 or 400 on any of them would confirm the org exists to
	// someone typing ids.
	const notFound = () =>
		NextResponse.json({ error: 'Not found' }, { status: 404 });

	// Shape check before anything touches the database. Both accepted forms — a
	// cuid and an apply slug — fit inside these bounds, so a 4KB junk segment
	// costs neither a rate-limit slot nor a query.
	if (orgId.length < 3 || orgId.length > 64) return notFound();

	// Keyed on the CALLER alone, and before the org lookup, so walking candidate
	// ids draws on one shared budget instead of minting a fresh one per id.
	const probe = await checkRateLimit(PROBE_RATE_LIMIT, userId);
	if (!probe.success) return tooManyRequests(PROBE_RATE_LIMIT.windowSeconds);

	// Accepts an apply slug as well as an id — the segment is named `orgId`
	// because that is the canonical form, but a support conversation names an
	// org by its slug. Resolved FIRST so everything below authorizes against one
	// concrete `org.id` rather than against whichever form was typed. `id` wins
	// over `slug`; see the resolver's SECURITY note.
	const org = await findOrgByIdOrSlug(orgId);
	if (!org) return notFound();

	try {
		await requireOrgAccess({ userId, orgId: org.id, minRole: 'STAFF' });
	} catch (err) {
		if (err instanceof OrgAccessDeniedError) return notFound();
		throw err;
	}

	// After the access check, so a stranger cannot probe which orgs are in the
	// pilot. Same predicate `rosterProcedure` uses.
	if (!(await isRosterEnabledForOrg(org.id))) return notFound();

	// Keyed on the RESOLVED id, so the id and the slug share one budget rather
	// than granting 2x the intended downloads for the same tenant.
	const download = await checkRateLimit(
		EXPORT_RATE_LIMIT,
		`${userId}:${org.id}`,
	);
	if (!download.success) {
		return tooManyRequests(EXPORT_RATE_LIMIT.windowSeconds);
	}

	return new Response(streamRosterCsv(org.id), {
		status: 200,
		headers: {
			'Content-Type': 'text/csv; charset=utf-8',
			'Content-Disposition': `attachment; filename="${rosterExportFilename(org.slug, new Date())}"`,
			// A roster changes as coordinators edit it, and this response carries
			// PII. Nothing between here and the browser may keep a copy.
			'Cache-Control': 'no-store, private',
		},
	});
}
