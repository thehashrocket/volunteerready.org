import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TRPCError } from '@trpc/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

const { captureException } = vi.hoisted(() => ({
	captureException: vi.fn(),
}));

vi.mock('@sentry/nextjs', () => ({ captureException }));

import { CLIENT_SAFE_ERROR_CODES } from '@/server/domain/error-disclosure';
import { __resetReportBudget, reportTrpcError } from './error-reporting';

/**
 * `errorFormatter` deletes the raw message from the HTTP response, so this hook
 * is the ONLY remaining view of every internal failure in production. A silent
 * regression here is invisible by construction — nothing user-facing changes,
 * Sentry just quietly stops hearing about faults — which is exactly why it
 * needs its own spec rather than being trusted because it is short.
 */
describe('reportTrpcError', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.spyOn(console, 'error').mockImplementation(() => {});
		// The throttle is process-global; without this a later test inherits an
		// earlier one's budget and passes or fails for the wrong reason.
		__resetReportBudget();
	});

	it('reports an internal failure, preferring the original cause', () => {
		// tRPC wraps an unhandled service throw as INTERNAL_SERVER_ERROR with the
		// Prisma error as `cause`. The wrapper's stack points at tRPC internals;
		// the cause points at the query that actually failed.
		const cause = new Error('Invalid `prisma.user.findMany()` invocation');
		const error = new TRPCError({ code: 'INTERNAL_SERVER_ERROR', cause });

		reportTrpcError({ error, path: 'volunteers.remove', type: 'mutation' });

		expect(captureException).toHaveBeenCalledWith(cause, {
			tags: { trpcPath: 'volunteers.remove', trpcType: 'mutation' },
		});
	});

	it('falls back to the TRPCError when there is no Error cause', () => {
		const error = new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });

		reportTrpcError({ error, path: 'shifts.list', type: 'query' });

		expect(captureException).toHaveBeenCalledWith(error, expect.anything());
	});

	it('reports an allowlisted code whose message came from a CAUSE', () => {
		// Redacted on the wire AND skipped here would be invisible at both ends.
		// A raw throw inside a Zod `.transform()` arrives as BAD_REQUEST.
		const cause = new Error('Invalid `prisma.user.findMany()` invocation');

		reportTrpcError({
			error: new TRPCError({ code: 'BAD_REQUEST', cause }),
			path: 'screener.submit',
			type: 'mutation',
		});

		expect(captureException).toHaveBeenCalledWith(cause, expect.anything());
	});

	it('the allowlist is populated, so the cases below are not vacuous', () => {
		expect(CLIENT_SAFE_ERROR_CODES.size).toBe(8);
	});

	// Still derived from the allowlist, minus the codes that are allowlisted for
	// DISCLOSURE but are still faults. Those get their own test above; a code
	// added to the allowlist is exercised by one branch or the other.
	const DELIBERATE_REFUSALS = [...CLIENT_SAFE_ERROR_CODES].filter(
		(c) => c !== 'SERVICE_UNAVAILABLE',
	);

	it('the refusal set is populated and is narrower than the allowlist', () => {
		expect(DELIBERATE_REFUSALS.length).toBe(CLIENT_SAFE_ERROR_CODES.size - 1);
		expect(DELIBERATE_REFUSALS.length).toBeGreaterThan(0);
	});

	it.each(DELIBERATE_REFUSALS)(
		'stays silent for an allowlisted %s refusal',
		(code) => {
			// Delete the early return and Sentry fills with ordinary refusals —
			// every "not your org", every "already on the roster" — until the
			// real faults are unfindable. That failure mode is silent too.
			reportTrpcError({
				error: new TRPCError({ code, message: 'Not your organisation.' }),
				path: 'volunteers.list',
				type: 'query',
			});

			expect(captureException).not.toHaveBeenCalled();
		},
	);

	it('SECURITY: ignores Zod input validation, which is unauthenticated-reachable', () => {
		// `screener.submit`, `leads.create` and the marketplace/feedback routers
		// are publicProcedure, and httpBatchLink batches N calls per request — so
		// reporting these let anyone with curl drive one Sentry event per
		// malformed batch entry and exhaust the quota this hook depends on.
		// It is also not OUR fault to fix: a Zod failure is the client's input.
		let zodError: unknown;
		try {
			z.object({ email: z.string().email() }).parse({ email: 'nope' });
		} catch (err) {
			zodError = err;
		}

		reportTrpcError({
			error: new TRPCError({ code: 'BAD_REQUEST', cause: zodError as Error }),
			path: 'screener.submit',
			type: 'mutation',
		});

		expect(captureException).not.toHaveBeenCalled();
	});

	it('reports SERVICE_UNAVAILABLE even though it is allowlisted', () => {
		// Allowlisted for DISCLOSURE and still a fault. Skipping it because it
		// appears in the allowlist turned a background-check provider outage into
		// a silent one — coordinators saw "temporarily unavailable", we saw
		// nothing.
		const error = new TRPCError({
			code: 'SERVICE_UNAVAILABLE',
			message: 'Background check service is temporarily unavailable.',
		});

		reportTrpcError({
			error,
			path: 'backgroundChecks.initiate',
			type: 'mutation',
		});

		expect(captureException).toHaveBeenCalledWith(error, expect.anything());
	});

	it('throttles a storm per procedure+code, but never the server log', () => {
		// Replaces a global Sentry sampleRate, which thinned rare one-off signals
		// as readily as a flood. Bounded here instead: everything else stays 100%.
		const fire = () =>
			reportTrpcError({
				error: new TRPCError({ code: 'INTERNAL_SERVER_ERROR' }),
				path: 'shifts.list',
				type: 'query',
			});

		for (let i = 0; i < 20; i++) fire();

		expect(captureException.mock.calls.length).toBeLessThanOrEqual(5);
		// The log is the complete record and costs nothing to keep.
		expect(console.error).toHaveBeenCalledTimes(20);
	});

	it('throttling one procedure does not silence a different one', () => {
		for (let i = 0; i < 20; i++) {
			reportTrpcError({
				error: new TRPCError({ code: 'INTERNAL_SERVER_ERROR' }),
				path: 'shifts.list',
				type: 'query',
			});
		}
		captureException.mockClear();

		reportTrpcError({
			error: new TRPCError({ code: 'INTERNAL_SERVER_ERROR' }),
			path: 'volunteers.getRoster',
			type: 'query',
		});

		expect(captureException).toHaveBeenCalledTimes(1);
	});

	it('is actually WIRED to the tRPC route handler', () => {
		// Everything above tests the function in isolation. Deleting the
		// `onError:` line from the route handler leaves all of it green while
		// Sentry silently stops hearing about every internal tRPC fault — the
		// route module itself is unreachable from a unit test (it boots the real
		// appRouter), so a static assertion is what covers the wiring. Same
		// shape as `scripts/docs-nav-links.test.ts` covering the half the
		// VitePress build cannot see.
		const routePath = path.resolve(
			path.dirname(fileURLToPath(import.meta.url)),
			'../../app/api/trpc/[trpc]/route.ts',
		);

		expect(readFileSync(routePath, 'utf8')).toMatch(
			/onError:\s*reportTrpcError/,
		);
	});

	it('survives a missing path/type rather than throwing inside the handler', () => {
		// This runs inside tRPC's error path. Throwing here would replace a
		// legible failure with a confusing one.
		expect(() =>
			reportTrpcError({
				error: new TRPCError({ code: 'INTERNAL_SERVER_ERROR' }),
			}),
		).not.toThrow();

		expect(captureException).toHaveBeenCalledWith(expect.anything(), {
			tags: { trpcPath: 'unknown', trpcType: 'unknown' },
		});
	});
});
