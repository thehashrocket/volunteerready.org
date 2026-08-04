import { TRPCError } from '@trpc/server';
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { describe, expect, it, vi } from 'vitest';

// Same shape as the other specs in `src/server/trpc/__tests__/`: importing
// `init.ts` drags in the auth chain, which reaches Prisma at module load.
vi.mock('@/server/repositories/prisma', () => ({ prisma: {} }));
vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('@/server/auth', () => ({ authOptions: {} }));

import {
	CLIENT_SAFE_ERROR_CODES,
	GENERIC_ERROR_MESSAGE,
} from '@/server/domain/error-disclosure';
import { t } from '@/server/trpc/init';

/**
 * `errorFormatter` runs for HTTP responses ONLY — `createCaller` throws the raw
 * TRPCError without consulting it, and every existing router test uses
 * `createCaller`. So none of them can see this, and without this file the
 * redaction would be asserted by reading `init.ts` rather than by executing it.
 *
 * These drive the real `fetchRequestHandler` against the real `t`, which is
 * what makes them mutation-verifiable: delete the `errorFormatter` from
 * `init.ts` and the SECURITY cases go red.
 */

const PRISMA_TEXT =
	'Invalid `prisma.user.findMany()` invocation: Unique constraint failed on the fields: (`email`)';

function routerThrowing(error: unknown) {
	return t.router({
		boom: t.procedure.query(() => {
			throw error;
		}),
	});
}

async function callOverHttp(error: unknown) {
	const response = await fetchRequestHandler({
		endpoint: '/api/trpc',
		req: new Request('http://localhost/api/trpc/boom'),
		router: routerThrowing(error),
		createContext: () => ({}) as never,
		// Silence the console.error the production route handler performs; this
		// spec is about the wire, not the log.
		onError: () => {},
	});

	const body = (await response.json()) as {
		error?: { json?: { message?: string; data?: Record<string, unknown> } };
	};

	// superjson wraps the payload under `json`.
	const shape = body.error?.json;
	return {
		status: response.status,
		message: shape?.message,
		data: shape?.data as { code?: string; stack?: string } | undefined,
	};
}

describe('tRPC errorFormatter', () => {
	it('SECURITY: replaces an unhandled throw with generic copy', async () => {
		// The exact shape that leaks: a service throws a Prisma error, tRPC wraps
		// it as INTERNAL_SERVER_ERROR with no explicit message, so TRPCError.message
		// falls back to `cause.message` — the raw driver string.
		const result = await callOverHttp(new Error(PRISMA_TEXT));

		expect(result.message).toBe(GENERIC_ERROR_MESSAGE);
		expect(result.message).not.toContain('prisma.');
		expect(result.data?.code).toBe('INTERNAL_SERVER_ERROR');
	});

	it('SECURITY: strips the stack, which embeds the message', async () => {
		// tRPC only attaches `stack` outside production, but a stack contains the
		// string it was thrown with — redacting the message alone would hand the
		// same text back one field over on every local and preview run.
		const result = await callOverHttp(new Error(PRISMA_TEXT));

		expect(result.data?.stack).toBeUndefined();
	});

	it('SECURITY: withholds an unrecognised code rather than allowing it', async () => {
		const result = await callOverHttp(
			new TRPCError({ code: 'PAYLOAD_TOO_LARGE', message: PRISMA_TEXT }),
		);

		expect(result.message).toBe(GENERIC_ERROR_MESSAGE);
	});

	it('SECURITY: redacts an allowlisted code whose message came from a CAUSE', async () => {
		// The fail-open this closes. tRPC's input middleware builds BAD_REQUEST as
		// `new TRPCError({ code, cause })` with no message, so `message` resolves
		// to `cause.message` — meaning a raw throw inside a Zod `.transform()`
		// shipped its text verbatim under an ALLOWLISTED code.
		const result = await callOverHttp(
			new TRPCError({
				code: 'BAD_REQUEST',
				cause: new Error(PRISMA_TEXT),
			}),
		);

		expect(result.message).toBe(GENERIC_ERROR_MESSAGE);
		expect(result.message).not.toContain('prisma.');
		// The CODE still ships — only the text is withheld, so a client that
		// branches on `data.code` (org-profile-form does) keeps working.
		expect(result.data?.code).toBe('BAD_REQUEST');
	});

	it('still ships an allowlisted message we authored ourselves', async () => {
		// The contrast that keeps the rule honest: authored copy has no Error
		// cause, so redacting on `cause` costs nothing hand-written.
		const result = await callOverHttp(
			new TRPCError({
				code: 'BAD_REQUEST',
				message: 'Cannot remove yourself.',
			}),
		);

		expect(result.message).toBe('Cannot remove yourself.');
	});

	it('the allowlist is populated, so the cases below are not vacuous', () => {
		// The it.each below derives from the value under test, so an emptied
		// allowlist would generate ZERO cases and this file would pass having
		// asserted nothing about pass-through.
		expect(CLIENT_SAFE_ERROR_CODES.size).toBe(8);
	});

	it.each([...CLIENT_SAFE_ERROR_CODES])(
		'passes an allowlisted %s message through verbatim',
		async (code) => {
			// The contrast case. Without it the SECURITY assertions above would
			// pass just as happily against a formatter that redacted EVERYTHING,
			// which would silently destroy every hand-authored refusal in the app
			// — "Already on your roster", the slug-taken copy, every FORBIDDEN.
			const result = await callOverHttp(
				new TRPCError({ code, message: 'Already on your roster.' }),
			);

			expect(result.message).toBe('Already on your roster.');
			expect(result.data?.code).toBe(code);
			// The stack is stripped on the ALLOW path too. An allowlisted FORBIDDEN
			// carries the same absolute server paths and module layout as an internal
			// error — the allowlist is a decision about the MESSAGE, and returning
			// `shape` untouched here handed the stack back on every `pnpm dev` run
			// and every self-hosted non-production deploy.
			expect(result.data?.stack).toBeUndefined();
		},
	);
});
