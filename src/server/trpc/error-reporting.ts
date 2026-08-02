import * as Sentry from '@sentry/nextjs';
import type { TRPCError } from '@trpc/server';
import { ZodError } from 'zod';
import { isClientSafeErrorCode } from '@/server/domain/error-disclosure';

/**
 * The other half of the disclosure control in `init.ts`.
 *
 * `errorFormatter` redacts a non-allowlisted message before it is serialized,
 * which removes the last place an unexpected failure was legible — the HTTP
 * response body. Landing that alone would trade a disclosure bug for a blind
 * one, so this puts the real error somewhere only we can read it.
 *
 * It lives in its own module rather than inline in the route handler because
 * the handler is reachable only by booting a full tRPC request, and this needs
 * to be verifiable directly: it is now the sole view of every internal failure
 * in production, and a silent regression here is invisible by construction.
 *
 * Runs BEFORE `errorFormatter`, with the raw `TRPCError`.
 */

/**
 * Codes that are allowlisted for DISCLOSURE but are still server faults.
 *
 * The two sets are not the same question. `SERVICE_UNAVAILABLE` is safe to show
 * a user ("temporarily unavailable, try again") AND is an operational outage we
 * need paged about — skipping it because it appears in the disclosure allowlist
 * turns a background-check provider outage into a silent one, which is how the
 * first draft of this file shipped.
 */
const REPORTABLE_DESPITE_ALLOWLIST: ReadonlySet<string> = new Set([
	'SERVICE_UNAVAILABLE',
]);

/**
 * Per-key throttle, in place of a global Sentry `sampleRate`.
 *
 * A uniform sample rate was tried and reverted: it is applied per-EVENT across
 * the whole Node client, so it discards the same 75% of a rare one-off signal
 * (`IMPERSONATION_RESOLVE_FAILED` fires almost never) as it does of a flood.
 * Sampling the noisy path specifically keeps rare faults at 100% while still
 * bounding a storm. Sentry's own grouping already merges duplicates, so this
 * only has to stop the volume, not the duplication.
 */
const WINDOW_MS = 60_000;
const MAX_PER_KEY_PER_WINDOW = 5;
const MAX_TRACKED_KEYS = 500;
const seen = new Map<string, { count: number; windowStart: number }>();

function withinReportBudget(key: string, now: number): boolean {
	// Bounded: an attacker choosing distinct paths cannot grow this without end.
	if (seen.size > MAX_TRACKED_KEYS) seen.clear();

	const entry = seen.get(key);
	if (!entry || now - entry.windowStart > WINDOW_MS) {
		seen.set(key, { count: 1, windowStart: now });
		return true;
	}
	entry.count += 1;
	return entry.count <= MAX_PER_KEY_PER_WINDOW;
}

/** Exported for tests only — the throttle is process-global state. */
export function __resetReportBudget(): void {
	seen.clear();
}

export function reportTrpcError(opts: {
	error: TRPCError;
	path?: string;
	type?: string;
}): void {
	const { error, path, type } = opts;

	// A Zod input-validation failure is the CLIENT's mistake, not a server
	// fault, and it is reachable without authentication: `screener.submit`,
	// `leads.create` and the marketplace/feedback routers are `publicProcedure`,
	// and `httpBatchLink` batches N procedures per request. Reporting these let
	// anyone with curl drive one Sentry event per malformed batch entry and
	// exhaust the quota this hook depends on — blinding us to real faults.
	// (Checked: a ZodError carries the failing PATH and the rule it broke, never
	// the submitted value, so nothing is lost by not capturing it.)
	if (error.cause instanceof ZodError) return;

	const isFault =
		!isClientSafeErrorCode(error.code) ||
		REPORTABLE_DESPITE_ALLOWLIST.has(error.code) ||
		// An allowlisted code whose message came from a `cause` was NOT authored
		// by us (see `errorFormatter`) — it is a raw throw wearing a safe code,
		// which would otherwise be redacted on the wire AND skipped here.
		//
		// ACCEPTED IMPRECISION: a malformed superjson payload also arrives as
		// BAD_REQUEST with a plain `Error` cause, so an unauthenticated caller can
		// still generate events on a public procedure. It is indistinguishable
		// from the laundering case without matching on tRPC's internal message
		// text, and narrowing it the other way would reopen the blind spot this
		// clause exists to close — a raw throw inside a `.transform()` being
		// invisible at BOTH ends. `withinReportBudget` is the bound: 5 per
		// procedure+code per minute, so the volume is capped either way.
		error.cause instanceof Error;

	// An ordinary FORBIDDEN or NOT_FOUND is a procedure refusing on purpose.
	// Reporting those would bury real faults under deliberate refusals.
	if (!isFault) return;

	// `error.cause` is the original throw (a Prisma error, typically). The
	// TRPCError wrapping it carries a less useful stack, so prefer the cause
	// when there is one.
	const reported = error.cause instanceof Error ? error.cause : error;

	// Deliberately NOT throttled: the server log is the complete record, and it
	// costs nothing to keep. Only the Sentry event is rate-limited.
	console.error(
		`[trpc] ${type ?? 'unknown'} ${path ?? '<unknown path>'} — ${error.code}`,
		reported,
	);

	if (!withinReportBudget(`${path ?? 'unknown'}:${error.code}`, Date.now())) {
		return;
	}

	Sentry.captureException(reported, {
		tags: { trpcPath: path ?? 'unknown', trpcType: type ?? 'unknown' },
	});
}
