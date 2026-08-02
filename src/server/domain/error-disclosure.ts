import type { TRPC_ERROR_CODE_KEY } from '@trpc/server';

/**
 * Which tRPC error codes may cross the wire carrying their message.
 *
 * These are the codes our own procedures and services throw deliberately, with
 * text written for the person who will read it. Everything else — above all
 * INTERNAL_SERVER_ERROR — reaches tRPC as an unhandled throw, and
 * `getTRPCErrorFromUnknown` builds the TRPCError with no explicit message, so
 * `TRPCError.message` falls back to `cause.message`: the raw Prisma or driver
 * string, constraint and column names included.
 *
 * This is the single source of truth for BOTH halves of the control:
 *   - `errorFormatter` in `server/trpc/init.ts`, which redacts the message
 *     server-side so it never reaches the browser at all, and
 *   - `safeErrorMessage()` in `components/app/query-error-card.tsx`, which
 *     decides what a component renders.
 *
 * It lives here rather than beside the component because a second hand-kept
 * copy is where one of them stops being maintained — the same reason
 * `escapeCsvField` was collapsed into `domain/csv.ts` when it gained a second
 * consumer. Client components importing from `server/domain/**` is established
 * (`DAY_OF_WEEK_LABELS`, `ROSTER_POPULATED_THRESHOLD`); this module is pure
 * constants and a predicate, and its only `@trpc/server` import is a type,
 * which is erased at compile time.
 */
export const CLIENT_SAFE_ERROR_CODES: ReadonlySet<TRPC_ERROR_CODE_KEY> =
	new Set([
		'BAD_REQUEST',
		'UNAUTHORIZED',
		'FORBIDDEN',
		'NOT_FOUND',
		'CONFLICT',
		'PRECONDITION_FAILED',
		'TOO_MANY_REQUESTS',
		// "temporarily unavailable, try again" is a fact the caller can act on,
		// and the word "temporarily" is the whole value of the message. Only safe
		// to allowlist because `errorFormatter` additionally requires the message
		// to be one WE authored (no `Error` cause) — a raw upstream throw recoded
		// to this code is still redacted.
		'SERVICE_UNAVAILABLE',
	]);

/**
 * Fails CLOSED: a missing, null or unrecognised code is not safe. A non-tRPC
 * failure (network, parse) carries no code at all, and treating "no code" as
 * safe would defeat the allowlist on exactly the errors nobody anticipated.
 */
export function isClientSafeErrorCode(
	code: string | null | undefined,
): code is TRPC_ERROR_CODE_KEY {
	return (
		typeof code === 'string' &&
		CLIENT_SAFE_ERROR_CODES.has(code as TRPC_ERROR_CODE_KEY)
	);
}

/**
 * Substituted for any message the allowlist withholds, and used as
 * `QueryErrorCard`'s own default so the server-side and client-side halves
 * cannot drift into saying two different things about the same failure.
 */
export const GENERIC_ERROR_MESSAGE = 'Something went wrong. Please try again.';
